const db = require('../config/database');
const aiService = require('../services/ai/aiService');
const leadService = require('../services/crm/leadService');
const appointmentService = require('../services/appointments/appointmentService');
const { getLanguageConfig } = require('../services/voice/voiceConfig');

async function chat(req, res, next) {
  try {
    const { callId, message, language = 'en', industry = 'real-estate' } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }

    let call = callId ? await db.calls.findById(callId) : null;
    if (!call) {
      const langCfg = getLanguageConfig(language);
      call = await db.calls.create({
        callerName: 'Prospect Visitor',
        language,
        industry,
        mode: aiService.getAIStatus().mode,
        status: 'Active',
        transcript: [
          {
            speaker: 'ai',
            text: langCfg.openingGreeting,
            timestamp: new Date().toISOString(),
            language,
            retrievedSources: [],
          },
        ],
      });
    }

    const cleanMessage = String(message).trim();
    const aiResult = await aiService.processConversationTurn({
      message: cleanMessage,
      language: language || call.language || 'en',
      industry: industry || call.industry || 'real-estate',
      conversationHistory: call.transcript || [],
      existingExtracted: call.extractedInfo || {},
    });

    let bookedAppointment = null;
    let appointmentConflict = null;
    let finalReply = aiResult.reply;
    const extracted = { ...aiResult.extracted };

    // Handle appointment booking request if confirmed with date & time
    if (
      aiResult.appointmentIntent?.confirmed &&
      aiResult.appointmentIntent.date &&
      aiResult.appointmentIntent.time
    ) {
      try {
        bookedAppointment = await appointmentService.bookAppointment({
          leadId: call.leadId || '',
          customerName: extracted.name || call.callerName || 'Voice Prospect',
          customerPhone: extracted.phone || call.callerPhone || '',
          customerEmail: extracted.email || '',
          date: aiResult.appointmentIntent.date,
          time: aiResult.appointmentIntent.time,
          purpose:
            aiResult.appointmentIntent.purpose ||
            `${extracted.propertyType || 'Property'} Consultation`,
          source: 'AI Voice Agent',
          callId: call.id,
        });
        extracted.appointmentBooked = true;
        extracted.appointmentWilling = true;
      } catch (err) {
        if (err.statusCode === 409) {
          appointmentConflict = {
            message: err.message,
            alternatives: err.alternatives || [],
          };
          const altList =
            err.alternatives && err.alternatives.length > 0
              ? err.alternatives.join(', ')
              : 'another date';
          finalReply =
            language === 'hi'
              ? `क्षमा करें, ${aiResult.appointmentIntent.date} को ${aiResult.appointmentIntent.time} का स्लॉट पहले से बुक है। उपलब्ध समय हैं: ${altList}। कृपया इनमें से कोई समय चुनें।`
              : `That slot (${aiResult.appointmentIntent.date} at ${aiResult.appointmentIntent.time}) is already booked. Available slots on that date are: ${altList}. Which slot would you prefer?`;
        } else {
          throw err;
        }
      }
    }

    const validated = leadService.validateExtractedLead(extracted);

    // Auto-create or update lead incrementally once sufficient info is present
    const leadSync = await leadService.upsertLeadFromCall({
      callId: call.id,
      existingLeadId: call.leadId,
      extracted,
    });

    // Link appointment to created lead if booked before lead creation
    if (bookedAppointment && leadSync.lead && !bookedAppointment.leadId) {
      bookedAppointment = await db.appointments.update(bookedAppointment.id, {
        leadId: leadSync.lead.id,
      });
    }

    const now = new Date().toISOString();
    const updatedTranscript = [
      ...(call.transcript || []),
      {
        speaker: 'customer',
        text: cleanMessage,
        timestamp: now,
        language,
        retrievedSources: [],
      },
      {
        speaker: 'ai',
        text: finalReply,
        timestamp: new Date().toISOString(),
        language,
        retrievedSources: aiResult.rag?.sources || [],
      },
    ];

    const updatedCall = await db.calls.update(call.id, {
      callerName:
        validated.name && validated.name !== 'Prospect Visitor'
          ? validated.name
          : call.callerName,
      callerPhone: validated.phone || call.callerPhone,
      leadId: leadSync.lead ? leadSync.lead.id : call.leadId,
      mode: aiResult.mode,
      transcript: updatedTranscript,
      extractedInfo: extracted,
      sentiment: validated.sentiment,
      intent: validated.intent,
      leadScore: validated.leadScore,
      qualified: validated.qualified,
      recommendedNextAction: aiResult.recommendedNextAction,
      appointmentBookedId: bookedAppointment
        ? bookedAppointment.id
        : call.appointmentBookedId,
    });

    res.json({
      success: true,
      callId: updatedCall.id,
      reply: finalReply,
      mode: aiResult.mode,
      extracted: validated,
      rag: aiResult.rag,
      appointment: bookedAppointment,
      appointmentConflict,
      lead: leadSync.lead,
      leadAction: leadSync.action,
      recommendedNextAction: aiResult.recommendedNextAction,
      call: updatedCall,
    });
  } catch (err) {
    next(err);
  }
}

async function analyze(req, res, next) {
  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required for analysis.' });
    }
    const result = await aiService.analyzeMessage(text);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function summarize(req, res, next) {
  try {
    const { callId, transcript, extracted, appointmentBooked } = req.body || {};
    let targetTranscript = transcript || [];
    let targetExtracted = extracted || {};
    let hasAppt = Boolean(appointmentBooked);

    if (callId) {
      const call = await db.calls.findById(callId);
      if (!call) {
        return res.status(404).json({ success: false, message: 'Call not found.' });
      }
      targetTranscript = call.transcript || [];
      targetExtracted = call.extractedInfo || {};
      hasAppt = Boolean(call.appointmentBookedId);
    }

    const result = await aiService.summarizeCall({
      transcript: targetTranscript,
      extracted: targetExtracted,
      appointmentBooked: hasAppt,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function qualify(req, res, next) {
  try {
    const validated = leadService.validateExtractedLead(req.body || {});
    res.json({
      success: true,
      leadScore: validated.leadScore,
      qualified: validated.qualified,
      breakdown: validated.scoreBreakdown,
      validated,
    });
  } catch (err) {
    next(err);
  }
}

async function status(req, res) {
  res.json({
    success: true,
    ai: aiService.getAIStatus(),
    database: db.getStatus(),
  });
}

module.exports = {
  chat,
  analyze,
  summarize,
  qualify,
  status,
};
