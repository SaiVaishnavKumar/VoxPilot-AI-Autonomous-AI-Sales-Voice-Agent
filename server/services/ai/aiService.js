const env = require('../../config/env');
const logger = require('../../utils/logger');
const ragService = require('../rag/ragService');
const leadService = require('../crm/leadService');
const appointmentService = require('../appointments/appointmentService');
const { getLanguageConfig, getIndustryProfile } = require('../voice/voiceConfig');

let GoogleGenAI = null;
try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch {
  GoogleGenAI = null;
}

function getAIStatus() {
  const configured = Boolean(env.geminiApiKey && GoogleGenAI);
  return {
    mode: configured ? 'gemini' : 'demo',
    model: configured ? env.geminiModel : 'deterministic-demo-engine-v1',
    configured,
    provider: configured ? 'Google Gemini (@google/genai)' : 'VoxPilot Demo Fallback Engine',
  };
}

function parseIndianCurrency(text) {
  const lower = String(text || '').toLowerCase().replace(/,/g, '');
  // Match crore / cr
  const crMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)\b/);
  if (crMatch) {
    const val = Math.round(parseFloat(crMatch[1]) * 10000000);
    return { budget: val, budgetLabel: `₹${crMatch[1]} Cr` };
  }
  // Match lakh / lac / L
  const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|l)\b/);
  if (lakhMatch) {
    const val = Math.round(parseFloat(lakhMatch[1]) * 100000);
    return { budget: val, budgetLabel: `₹${lakhMatch[1]} Lakhs` };
  }
  // Match raw 6+ digit numbers (e.g. 7500000)
  const rawMatch = lower.match(/(?:rs\.?|inr|₹|budget\s*(?:is|of|around)?\s*)(\d{6,9})\b/);
  if (rawMatch) {
    const val = Number(rawMatch[1]);
    return { budget: val, budgetLabel: formatINR(val) };
  }
  return null;
}

function formatINR(num) {
  const n = Number(num) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')} Lakhs`;
  if (n > 0) return `₹${n.toLocaleString('en-IN')}`;
  return '';
}

function extractStructuredFromText(text, current = {}) {
  const s = String(text || '');
  const lower = s.toLowerCase();
  const next = { ...current };

  // Name extraction
  const nameMatch = s.match(
    /(?:my name is|i am|i'm|this is|call me|मेरा नाम)\s+([A-Z\u0900-\u097f][a-zA-Z\u0900-\u097f]+(?:\s+[A-Z\u0900-\u097f][a-zA-Z\u0900-\u097f]+)?)/i
  );
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    const ignoreWords = new Set(['looking', 'interested', 'calling', 'planning', 'here', 'fine', 'good']);
    if (!ignoreWords.has(candidate.toLowerCase())) {
      next.name = candidate.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  // Phone extraction
  const phoneMatch = s.match(/(?:\+91[\s-]?)?([6-9]\d{9})\b/);
  if (phoneMatch) {
    next.phone = phoneMatch[1];
  }

  // Email extraction
  const emailMatch = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    next.email = emailMatch[0].toLowerCase();
  }

  // Budget extraction
  const parsedBudget = parseIndianCurrency(s);
  if (parsedBudget) {
    next.budget = parsedBudget.budget;
    next.budgetLabel = parsedBudget.budgetLabel;
  }

  // Property Type extraction
  const propMatch = lower.match(
    /\b(1\s*bhk|2\s*bhk|3\s*bhk|4\s*bhk|5\s*bhk|villa|penthouse|duplex|plot|commercial|studio|flat|apartment)\b/i
  );
  if (propMatch) {
    next.propertyType = propMatch[1].replace(/\s+/g, '').toUpperCase();
    if (/villa|penthouse|duplex|plot|commercial|studio|flat|apartment/i.test(next.propertyType)) {
      next.propertyType =
        next.propertyType.charAt(0).toUpperCase() + next.propertyType.slice(1).toLowerCase();
    }
  }

  // Location extraction
  const knownLocations = [
    'Hyderabad',
    'Kokapet',
    'Gachibowli',
    'Jubilee Hills',
    'Kondapur',
    'Financial District',
    'Narsingi',
    'Madhapur',
    'Banjara Hills',
    'Bengaluru',
    'Bangalore',
    'Whitefield',
    'Sarjapur',
    'Pune',
    'Mumbai',
    'Noida',
    'Gurgaon',
  ];
  for (const loc of knownLocations) {
    if (lower.includes(loc.toLowerCase())) {
      next.location = loc === 'Bangalore' ? 'Bengaluru' : loc;
      break;
    }
  }

  // Purchase Timeline
  const timeMatch = s.match(
    /(?:within|in|next)?\s*(\d+\s*(?:month|months|week|weeks|year|years)|immediately|right away|this month|next month|तुरंत|इस महीने|\d+\s*महीने)/i
  );
  if (timeMatch) {
    next.purchaseTimeline = timeMatch[0].trim();
  }

  // Sentiment classification
  if (
    /\b(great|love|interested|awesome|perfect|yes|sure|good|excellent|happy|confirm|book|schedule|अच्छा|बढ़िया|हाँ)\b/i.test(
      lower
    )
  ) {
    next.sentiment = 'Positive';
  } else if (
    /\b(expensive|bad|not interested|no thanks|waste|terrible|annoying|wrong|too costly|महंगा|नहीं चाहिए)\b/i.test(
      lower
    )
  ) {
    next.sentiment = 'Negative';
  } else if (!next.sentiment) {
    next.sentiment = 'Neutral';
  }

  // Intent classification
  if (
    next.budget >= 3500000 ||
    /\b(book|visit|schedule|appointment|buy|purchase|finalize|site visit|consultation|खरीदना|विजिट)\b/i.test(
      lower
    )
  ) {
    next.intent = 'High';
  } else if (next.propertyType || next.location || next.budget > 0) {
    next.intent = next.intent === 'High' ? 'High' : 'Medium';
  } else if (/\b(just looking|not sure|browsing|maybe later)\b/i.test(lower)) {
    next.intent = 'Low';
  }

  // Appointment intent & date/time extraction
  if (
    /\b(appointment|visit|consultation|schedule|book|slot|meeting|मुलाकात|अपॉइंटमेंट)\b/i.test(lower)
  ) {
    next.appointmentRequested = true;
    next.appointmentWilling = true;
  }
  if (/\b(yes|sure|confirm|go ahead|book it|okay|ok book|please schedule|हाँ|बुक कर)\b/i.test(lower)) {
    if (next.appointmentRequested || current.awaitingAppointmentConfirm) {
      next.appointmentWilling = true;
    }
  }

  // Extract explicit date (YYYY-MM-DD or tomorrow/today)
  const isoDate = s.match(/\b(202\d-\d{2}-\d{2})\b/);
  if (isoDate) {
    next.appointmentDate = isoDate[1];
  } else if (/\btomorrow|कल\b/i.test(lower)) {
    next.appointmentDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  } else if (/\btoday|आज\b/i.test(lower)) {
    next.appointmentDate = new Date().toISOString().split('T')[0];
  }

  // Extract time slot
  const timeSlotMatch = s.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\b/i);
  if (timeSlotMatch) {
    next.appointmentTime = appointmentService.normalizeTime(timeSlotMatch[1]);
  }

  return next;
}

function buildNextAction(validatedLead, appointmentBooked) {
  if (appointmentBooked) {
    return 'Send property brochure ahead of scheduled consultation and prepare floor plans.';
  }
  if (validatedLead.qualified) {
    return 'Schedule site visit / property consultation with Senior Advisor within 24 hours.';
  }
  if (validatedLead.leadScore >= 35) {
    return 'Follow up in 48 hours with matching inventory options and financing sheet.';
  }
  return 'Nurture via automated inventory digest until purchase timeline firms up.';
}

async function generateDemoResponse({
  message,
  language,
  conversationHistory,
  existingExtracted,
  ragResult,
}) {
  const mergedExtracted = extractStructuredFromText(message, existingExtracted);
  const validated = leadService.validateExtractedLead(mergedExtracted);
  const lower = String(message || '').toLowerCase();
  const isHindi = language === 'hi';

  // Detect if user asked a specific knowledge question
  const isQuestion =
    /\?|\b(what|which|where|how|price|pricing|cost|amenities|facility|facilities|booking|procedure|loan|emi|rera|possession|discount|refund|pet|parking|clubhouse|location|about|company|tell me)\b/i.test(
      lower
    );

  let replyParts = [];

  // 1. Grounded Knowledge Answer if user asked a question
  if (isQuestion) {
    if (ragResult.hasRelevantFacts && ragResult.chunks.length > 0) {
      const topFact = ragResult.chunks[0].content.replace(/\s+/g, ' ').trim();
      const conciseFact = topFact.length > 340 ? `${topFact.slice(0, 337)}...` : topFact;
      if (isHindi) {
        replyParts.push(
          `हमारे सत्यापित रिकॉर्ड (${ragResult.chunks[0].docTitle}) के अनुसार: ${conciseFact}`
        );
      } else {
        replyParts.push(
          `Based on our verified documentation (${ragResult.chunks[0].docTitle}): ${conciseFact}`
        );
      }
    } else {
      if (isHindi) {
        replyParts.push(
          'मुझे खेद है, इस विशिष्ट विषय पर हमारे ज्ञानकोश (Knowledge Base) में पर्याप्त सत्यापित जानकारी उपलब्ध नहीं है। मैं अनुमान नहीं लगाऊँगा, लेकिन हमारे प्रॉपर्टी सलाहकार आपको सटीक विवरण दे सकते हैं।'
        );
      } else {
        replyParts.push(
          "I don't have sufficient verified information in our knowledge base about that specific detail, so I won't guess or invent policies. I can note this for our senior property advisor to confirm for you."
        );
      }
    }
  }

  // 2. Acknowledge newly shared details & handle appointment flow
  let appointmentIntent = {
    wantsBooking: Boolean(mergedExtracted.appointmentRequested),
    confirmed: false,
    date: mergedExtracted.appointmentDate || '',
    time: mergedExtracted.appointmentTime || '',
    purpose: `${validated.propertyType || 'Property'} Consultation${
      validated.location ? ` - ${validated.location}` : ''
    }`,
  };

  const hasConfirmPhrase = /\b(yes|confirm|book|schedule|go ahead|sure|okay|ok|हाँ|कन्फर्म|बुक)\b/i.test(
    lower
  );

  if (
    (mergedExtracted.appointmentRequested || existingExtracted.awaitingAppointmentConfirm) &&
    mergedExtracted.appointmentDate &&
    mergedExtracted.appointmentTime &&
    hasConfirmPhrase
  ) {
    appointmentIntent.confirmed = true;
  }

  // Check if user wants an appointment but hasn't given date/time yet
  if (appointmentIntent.confirmed) {
    replyParts.push(
      isHindi
        ? `बहुत बढ़िया! मैं ${appointmentIntent.date} को ${appointmentIntent.time} बजे आपकी प्रॉपर्टी कंसल्टेशन बुक कर रहा हूँ।`
        : `Perfect! Let me check availability and confirm your consultation for ${appointmentIntent.date} at ${appointmentIntent.time}.`
    );
  } else if (mergedExtracted.appointmentRequested && (!mergedExtracted.appointmentDate || !mergedExtracted.appointmentTime)) {
    mergedExtracted.awaitingAppointmentConfirm = true;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const slots = await appointmentService.getAvailableSlots(tomorrow);
    const openSlots = slots
      .filter((sl) => sl.available)
      .slice(0, 4)
      .map((sl) => sl.time)
      .join(', ');
    replyParts.push(
      isHindi
        ? `मैं आपकी कंसल्टेशन शेड्यूल करने में खुशी महसूस करूँगा। कल (${tomorrow}) के लिए हमारे पास ${openSlots} स्लॉट उपलब्ध हैं। कौन सा दिन और समय आपके लिए सुविधाजनक रहेगा?`
        : `I'd be happy to schedule a property consultation for you! For tomorrow (${tomorrow}), we have open slots at ${openSlots}. Which date and time works best for you?`
    );
  } else {
    // Discovery progression
    const ackPieces = [];
    if (validated.propertyType) ackPieces.push(validated.propertyType);
    if (validated.location) ackPieces.push(`in ${validated.location}`);
    if (validated.budgetLabel) ackPieces.push(`around ${validated.budgetLabel}`);

    if (!isQuestion && ackPieces.length > 0 && conversationHistory.length <= 4) {
      replyParts.push(
        isHindi
          ? `धन्यवाद${validated.name ? ` ${validated.name}` : ''}! आपने ${ackPieces.join(' ')} की आवश्यकता साझा की है।`
          : `Thank you${validated.name ? `, ${validated.name}` : ''}! I've noted your interest in a ${ackPieces.join(' ')}.`
      );
    }

    // Ask the next missing discovery question naturally
    if (!validated.propertyType) {
      replyParts.push(
        isHindi
          ? 'आप किस प्रकार की प्रॉपर्टी देख रहे हैं — जैसे 2BHK, 3BHK अपार्टमेंट या विला?'
          : 'What type of property are you interested in — for example, a 2BHK, 3BHK apartment, or a gated villa?'
      );
    } else if (!validated.location) {
      replyParts.push(
        isHindi
          ? 'आप किस लोकेशन या क्षेत्र को प्राथमिकता देते हैं?'
          : 'Which location or neighborhood do you prefer?'
      );
    } else if (!validated.budget) {
      replyParts.push(
        isHindi
          ? 'इस प्रॉपर्टी के लिए आपका अनुमानित बजट क्या है?'
          : 'What is your approximate budget range for this property?'
      );
    } else if (!validated.purchaseTimeline) {
      replyParts.push(
        isHindi
          ? 'आप कब तक प्रॉपर्टी खरीदने की योजना बना रहे हैं?'
          : 'When are you planning to make your purchase?'
      );
    } else if (!validated.name || !validated.phone) {
      replyParts.push(
        isHindi
          ? 'ताकि मैं आपके लिए व्यक्तिगत प्रॉपर्टी विकल्प और कंसल्टेशन स्लॉट तैयार कर सकूँ, कृपया अपना नाम और फ़ोन नंबर साझा करें।'
          : 'To prepare tailored property options and reserve a consultation for you, may I have your full name and phone number?'
      );
    } else {
      mergedExtracted.awaitingAppointmentConfirm = true;
      replyParts.push(
        isHindi
          ? `आपकी सभी ज़रूरतें स्पष्ट हैं (${validated.propertyType}, ${validated.location}, ${validated.budgetLabel || formatINR(validated.budget)})। क्या आप हमारे प्रॉपर्टी विशेषज्ञ के साथ साइट विज़िट या कंसल्टेशन शेड्यूल करना चाहेंगे?`
          : `Everything looks well aligned (${validated.propertyType} in ${validated.location}, budget ${validated.budgetLabel || formatINR(validated.budget)}). Would you like me to schedule a property consultation or site visit for you?`
      );
    }
  }

  return {
    reply: replyParts.join(' ').trim(),
    extracted: mergedExtracted,
    validated,
    appointmentIntent,
    recommendedNextAction: buildNextAction(validated, false),
    mode: 'demo',
  };
}

async function generateGeminiResponse({
  message,
  language,
  industry,
  conversationHistory,
  existingExtracted,
  ragResult,
}) {
  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  const langConfig = getLanguageConfig(language);
  const industryProfile = getIndustryProfile(industry);

  const historyText = conversationHistory
    .slice(-10)
    .map((m) => `${m.speaker === 'customer' ? 'Customer' : 'AI Agent'}: ${m.text}`)
    .join('\n');

  const prompt = `
You are VoxPilot AI, a ${industryProfile.agentRole} representing ${env.companyName}.
Language to respond in: ${langConfig.label} (${langConfig.code}).

STRICT GROUNDING RULES:
1. Below is the VERIFIED KNOWLEDGE BASE retrieved for this query. Use ONLY these verified facts for company policies, pricing, locations, amenities, and booking rules.
2. Clearly separate retrieved facts from general conversational help.
3. If the customer asks for specific prices, policies, availability, or company rules NOT present in the retrieved knowledge base, explicitly say you do not have sufficient verified information on that point instead of inventing facts.
4. Maintain conversational memory and naturally ask the next unanswered qualification question (property type, preferred location, budget in INR, purchase timeline, name/phone, consultation booking).

=== VERIFIED KNOWLEDGE BASE ===
${ragResult.hasRelevantFacts ? ragResult.contextText : 'NO RELEVANT VERIFIED DOCUMENTS RETRIEVED FOR THIS QUERY.'}

=== PREVIOUSLY EXTRACTED CUSTOMER DATA ===
${JSON.stringify(existingExtracted || {})}

=== CONVERSATION HISTORY ===
${historyText || 'No prior turns.'}

=== LATEST CUSTOMER MESSAGE ===
${message}

Respond ONLY with valid JSON matching this exact schema:
{
  "reply": "Natural, polite sales representative response in ${langConfig.label}",
  "extracted": {
    "name": "string or empty",
    "phone": "string or empty",
    "email": "string or empty",
    "location": "string or empty",
    "budget": 0,
    "budgetLabel": "string like ₹75 Lakhs or empty",
    "propertyType": "string like 3BHK, Villa or empty",
    "purchaseTimeline": "string like Within 3 months or empty",
    "intent": "High | Medium | Low",
    "sentiment": "Positive | Neutral | Negative",
    "appointmentWilling": false,
    "appointmentRequested": false,
    "appointmentDate": "YYYY-MM-DD or empty",
    "appointmentTime": "HH:MM 24h or empty"
  },
  "appointmentIntent": {
    "wantsBooking": false,
    "confirmed": false,
    "date": "YYYY-MM-DD or empty",
    "time": "HH:MM 24h or empty",
    "purpose": "short consultation purpose"
  },
  "recommendedNextAction": "concise next sales action"
}
`;

  const response = await ai.models.generateContent({
    model: env.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.35,
    },
  });

  const rawText = response.text || '';
  const parsed = JSON.parse(rawText);

  // Merge with deterministic extraction to ensure zero lost fields
  const deterministic = extractStructuredFromText(message, existingExtracted);
  const merged = {
    ...deterministic,
    ...(parsed.extracted || {}),
    name: (parsed.extracted?.name || deterministic.name || '').trim(),
    phone: (parsed.extracted?.phone || deterministic.phone || '').trim(),
    email: (parsed.extracted?.email || deterministic.email || '').trim(),
    location: (parsed.extracted?.location || deterministic.location || '').trim(),
    budget: Number(parsed.extracted?.budget) || deterministic.budget || 0,
    budgetLabel: parsed.extracted?.budgetLabel || deterministic.budgetLabel || '',
    propertyType: parsed.extracted?.propertyType || deterministic.propertyType || '',
    purchaseTimeline: parsed.extracted?.purchaseTimeline || deterministic.purchaseTimeline || '',
  };

  const validated = leadService.validateExtractedLead(merged);

  return {
    reply: parsed.reply || 'Thank you for sharing that. How else may I assist you?',
    extracted: merged,
    validated,
    appointmentIntent: parsed.appointmentIntent || {
      wantsBooking: Boolean(merged.appointmentRequested),
      confirmed: false,
      date: merged.appointmentDate || '',
      time: merged.appointmentTime || '',
      purpose: 'Property Consultation',
    },
    recommendedNextAction:
      parsed.recommendedNextAction || buildNextAction(validated, false),
    mode: 'gemini',
  };
}

async function processConversationTurn({
  message,
  language = 'en',
  industry = 'real-estate',
  conversationHistory = [],
  existingExtracted = {},
}) {
  const ragResult = await ragService.retrieveRelevantChunks(message, { topK: 4 });
  const status = getAIStatus();

  if (status.configured) {
    try {
      const geminiResult = await generateGeminiResponse({
        message,
        language,
        industry,
        conversationHistory,
        existingExtracted,
        ragResult,
      });
      return {
        ...geminiResult,
        rag: {
          hasRelevantFacts: ragResult.hasRelevantFacts,
          sources: ragResult.sources,
          chunks: ragResult.chunks,
        },
      };
    } catch (err) {
      logger.warn(`Gemini API call failed (${err.message}); falling back to Demo Engine.`);
    }
  }

  const demoResult = await generateDemoResponse({
    message,
    language,
    conversationHistory,
    existingExtracted,
    ragResult,
  });

  return {
    ...demoResult,
    rag: {
      hasRelevantFacts: ragResult.hasRelevantFacts,
      sources: ragResult.sources,
      chunks: ragResult.chunks,
    },
  };
}

async function summarizeCall({ transcript = [], extracted = {}, appointmentBooked = false }) {
  const validated = leadService.validateExtractedLead(extracted);
  const status = getAIStatus();

  if (status.configured && transcript.length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
      const transcriptText = transcript
        .map((t) => `${t.speaker.toUpperCase()}: ${t.text}`)
        .join('\n');

      const prompt = `
Summarize this real estate sales call accurately without inventing facts.
Transcript:
${transcriptText}

Extracted Lead Info:
${JSON.stringify(validated)}

Appointment Booked: ${appointmentBooked}

Return JSON:
{
  "summary": "2-4 sentence executive call summary",
  "recommendedNextAction": "concrete next step for the sales team"
}`;
      const res = await ai.models.generateContent({
        model: env.geminiModel,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const parsed = JSON.parse(res.text || '{}');
      if (parsed.summary) {
        return {
          summary: parsed.summary,
          recommendedNextAction:
            parsed.recommendedNextAction || buildNextAction(validated, appointmentBooked),
          validated,
          mode: 'gemini',
        };
      }
    } catch (err) {
      logger.warn(`Gemini summarize fallback: ${err.message}`);
    }
  }

  const customerTurns = transcript.filter((t) => t.speaker === 'customer').length;
  const parts = [];
  parts.push(
    `${validated.name || 'Prospect'} completed a ${customerTurns}-turn consultation call regarding ${
      validated.propertyType || 'residential property'
    }${validated.location ? ` in ${validated.location}` : ''}.`
  );
  if (validated.budget > 0) {
    parts.push(`Stated budget is ${validated.budgetLabel || formatINR(validated.budget)}.`);
  }
  if (validated.purchaseTimeline) {
    parts.push(`Target purchase timeline: ${validated.purchaseTimeline}.`);
  }
  if (appointmentBooked) {
    parts.push('A consultation appointment was confirmed and saved in the CRM.');
  }
  parts.push(
    `Overall sentiment was ${validated.sentiment} with a lead score of ${validated.leadScore}/100 (${
      validated.qualified ? 'Qualified' : 'Needs Follow-Up'
    }).`
  );

  return {
    summary: parts.join(' '),
    recommendedNextAction: buildNextAction(validated, appointmentBooked),
    validated,
    mode: 'demo',
  };
}

async function analyzeMessage(text) {
  const extracted = extractStructuredFromText(text, {});
  const validated = leadService.validateExtractedLead(extracted);
  return {
    extracted: validated,
    mode: getAIStatus().mode,
  };
}

module.exports = {
  getAIStatus,
  processConversationTurn,
  summarizeCall,
  analyzeMessage,
  extractStructuredFromText,
  formatINR,
};
