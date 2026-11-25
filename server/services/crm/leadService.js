const db = require('../../config/database');

/**
 * Deterministic rubric-based Lead Scoring (0-100) evaluating the 5 mandatory criteria:
 * 1. Budget suitability (0-25)
 * 2. Purchase timeline (0-25)
 * 3. Customer interest / intent (0-20)
 * 4. Requirement clarity (0-15)
 * 5. Appointment willingness (0-15)
 */
function calculateLeadScore(extracted = {}) {
  const budget = Number(extracted.budget) || 0;
  const budgetLabel = String(extracted.budgetLabel || '').toLowerCase();
  const timeline = String(extracted.purchaseTimeline || '').toLowerCase();
  const intent = String(extracted.intent || 'Medium');
  const location = String(extracted.location || extracted.preferredLocation || '').trim();
  const propertyType = String(extracted.propertyType || '').trim();
  const hasContact = Boolean((extracted.phone || '').trim() || (extracted.email || '').trim());
  const appointmentWilling = Boolean(
    extracted.appointmentWilling || extracted.appointmentBooked || extracted.appointmentRequested
  );

  // 1. Budget suitability (0-25)
  let budgetScore = 0;
  if (budget >= 4000000) {
    budgetScore = 25;
  } else if (budget >= 2500000) {
    budgetScore = 18;
  } else if (budget > 0 || budgetLabel) {
    budgetScore = 12;
  }

  // 2. Purchase timeline (0-25)
  let timelineScore = 0;
  if (/immediate|this month|1 month|2 month|3 month|soon|urgent|ready|जल्द|तुरंत|महीने/.test(timeline)) {
    timelineScore = 25;
  } else if (/4 month|5 month|6 month|quarter|few months/.test(timeline)) {
    timelineScore = 18;
  } else if (/year|12 month|next year|later/.test(timeline)) {
    timelineScore = 10;
  } else if (timeline) {
    timelineScore = 8;
  }

  // 3. Customer interest / intent (0-20)
  let intentScore = 8;
  if (intent === 'High') intentScore = 20;
  else if (intent === 'Medium') intentScore = 12;
  else if (intent === 'Low') intentScore = 4;

  // 4. Requirement clarity (0-15)
  let clarityScore = 0;
  if (location) clarityScore += 5;
  if (propertyType) clarityScore += 5;
  if (hasContact || (extracted.name && extracted.name !== 'Prospect Visitor')) clarityScore += 5;

  // 5. Appointment willingness (0-15)
  let appointmentScore = 0;
  if (extracted.appointmentBooked) {
    appointmentScore = 15;
  } else if (appointmentWilling) {
    appointmentScore = 12;
  } else if (extracted.appointmentMaybe) {
    appointmentScore = 6;
  }

  const total = Math.min(
    100,
    budgetScore + timelineScore + intentScore + clarityScore + appointmentScore
  );

  const qualified = total >= 60;

  return {
    leadScore: total,
    qualified,
    breakdown: {
      budgetSuitability: budgetScore,
      purchaseTimeline: timelineScore,
      customerInterest: intentScore,
      requirementClarity: clarityScore,
      appointmentWillingness: appointmentScore,
    },
  };
}

function validateExtractedLead(raw = {}) {
  const validSentiments = ['Positive', 'Neutral', 'Negative'];
  const validIntents = ['High', 'Medium', 'Low'];

  const cleanBudget = Number(String(raw.budget || 0).replace(/[^\d.]/g, '')) || 0;
  const sentiment = validSentiments.includes(raw.sentiment) ? raw.sentiment : 'Neutral';
  const intent = validIntents.includes(raw.intent) ? raw.intent : 'Medium';

  const normalized = {
    name: String(raw.name || '').trim() || '',
    phone: String(raw.phone || '').trim(),
    email: String(raw.email || '').trim().toLowerCase(),
    location: String(raw.location || raw.preferredLocation || '').trim(),
    budget: cleanBudget,
    budgetLabel: String(raw.budgetLabel || '').trim(),
    propertyType: String(raw.propertyType || '').trim(),
    purchaseTimeline: String(raw.purchaseTimeline || '').trim(),
    intent,
    sentiment,
    appointmentWilling: Boolean(raw.appointmentWilling),
    appointmentBooked: Boolean(raw.appointmentBooked),
    appointmentRequested: Boolean(raw.appointmentRequested),
  };

  const scoring = calculateLeadScore(normalized);

  return {
    ...normalized,
    leadScore: scoring.leadScore,
    qualified: scoring.qualified,
    scoreBreakdown: scoring.breakdown,
  };
}

async function upsertLeadFromCall({ callId, existingLeadId, extracted, summary }) {
  const validated = validateExtractedLead(extracted);
  const hasMeaningfulInfo =
    Boolean(validated.name && validated.name !== 'Prospect Visitor') ||
    Boolean(validated.phone) ||
    Boolean(validated.email) ||
    Boolean(validated.location) ||
    Boolean(validated.propertyType) ||
    validated.budget > 0;

  if (!hasMeaningfulInfo) {
    return { lead: null, action: 'skipped', validated };
  }

  let targetLead = null;
  if (existingLeadId) {
    targetLead = await db.leads.findById(existingLeadId);
  }
  if (!targetLead && (validated.phone || validated.email)) {
    targetLead = await db.leads.findDuplicate({
      phone: validated.phone,
      email: validated.email,
    });
  }

  const qualificationStatus = validated.appointmentBooked
    ? 'Converted'
    : validated.qualified
      ? 'Qualified'
      : validated.leadScore >= 35
        ? 'Follow-Up'
        : 'Unqualified';

  if (targetLead) {
    const updated = await db.leads.update(targetLead.id, {
      name:
        validated.name && validated.name !== 'Prospect Visitor'
          ? validated.name
          : targetLead.name,
      phone: validated.phone || targetLead.phone,
      email: validated.email || targetLead.email,
      preferredLocation: validated.location || targetLead.preferredLocation,
      budget: validated.budget || targetLead.budget,
      budgetLabel: validated.budgetLabel || targetLead.budgetLabel,
      propertyType: validated.propertyType || targetLead.propertyType,
      purchaseTimeline: validated.purchaseTimeline || targetLead.purchaseTimeline,
      leadScore: Math.max(validated.leadScore, targetLead.leadScore || 0),
      scoreBreakdown: validated.scoreBreakdown,
      qualified: validated.qualified || targetLead.qualified,
      qualificationStatus:
        targetLead.qualificationStatus === 'Converted' ? 'Converted' : qualificationStatus,
      sentiment: validated.sentiment || targetLead.sentiment,
      intent: validated.intent || targetLead.intent,
      lastCallId: callId || targetLead.lastCallId,
      notes: summary
        ? [targetLead.notes, `[AI Call Summary] ${summary}`].filter(Boolean).join('\n\n')
        : targetLead.notes,
    });
    return { lead: updated, action: 'updated', validated };
  }

  const followUpDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  const created = await db.leads.create({
    name: validated.name || 'Voice Prospect',
    phone: validated.phone,
    email: validated.email,
    preferredLocation: validated.location,
    budget: validated.budget,
    budgetLabel: validated.budgetLabel,
    propertyType: validated.propertyType,
    purchaseTimeline: validated.purchaseTimeline,
    leadScore: validated.leadScore,
    scoreBreakdown: validated.scoreBreakdown,
    qualified: validated.qualified,
    qualificationStatus,
    sentiment: validated.sentiment,
    intent: validated.intent,
    source: 'AI Voice Agent',
    industry: 'real-estate',
    followUpDate,
    notes: summary ? `[AI Call Summary] ${summary}` : 'Captured via VoxPilot AI Voice Agent',
    lastCallId: callId || '',
  });

  return { lead: created, action: 'created', validated };
}

module.exports = {
  calculateLeadScore,
  validateExtractedLead,
  upsertLeadFromCall,
};
