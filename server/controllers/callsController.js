const db = require('../config/database');
const aiService = require('../services/ai/aiService');
const leadService = require('../services/crm/leadService');
const { getLanguageConfig } = require('../services/voice/voiceConfig');

async function listCalls(req, res, next) {
  try {
    const { status, sentiment, search } = req.query;
    const calls = await db.calls.findAll({ status, sentiment, search });
    res.json({ success: true, count: calls.length, calls });
  } catch (err) {
    next(err);
  }
}

async function getCall(req, res, next) {
  try {
    const call = await db.calls.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call record not found.' });
    }
    const lead = call.leadId ? await db.leads.findById(call.leadId) : null;
    const appointment = call.appointmentBookedId
      ? await db.appointments.findById(call.appointmentBookedId)
      : null;
    res.json({ success: true, call, lead, appointment });
  } catch (err) {
    next(err);
  }
}

async function startCall(req, res, next) {
  try {
    const { language = 'en', industry = 'real-estate', callerName = 'Prospect Visitor' } =
      req.body || {};
    const langCfg = getLanguageConfig(language);
    const aiStatus = aiService.getAIStatus();

    const call = await db.calls.create({
      callerName,
      language: langCfg.code,
      industry,
      mode: aiStatus.mode,
      status: 'Active',
      startedAt: new Date().toISOString(),
      transcript: [
        {
          speaker: 'ai',
          text: langCfg.openingGreeting,
          timestamp: new Date().toISOString(),
          language: langCfg.code,
          retrievedSources: [],
        },
      ],
    });

    res.status(201).json({
      success: true,
      call,
      openingGreeting: langCfg.openingGreeting,
      aiMode: aiStatus.mode,
    });
  } catch (err) {
    next(err);
  }
}

async function endCall(req, res, next) {
  try {
    const call = await db.calls.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call record not found.' });
    }

    const endedAt = new Date().toISOString();
    const computedDuration = Math.max(
      1,
      Math.round((new Date(endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
    );
    const durationSeconds =
      req.body?.durationSeconds !== undefined
        ? Math.max(1, Number(req.body.durationSeconds))
        : computedDuration;

    const summaryResult = await aiService.summarizeCall({
      transcript: call.transcript || [],
      extracted: call.extractedInfo || {},
      appointmentBooked: Boolean(call.appointmentBookedId),
    });

    const leadSync = await leadService.upsertLeadFromCall({
      callId: call.id,
      existingLeadId: call.leadId,
      extracted: call.extractedInfo || {},
      summary: summaryResult.summary,
    });

    const updatedCall = await db.calls.update(call.id, {
      status: 'Completed',
      endedAt,
      durationSeconds,
      leadId: leadSync.lead ? leadSync.lead.id : call.leadId,
      leadScore: summaryResult.validated.leadScore,
      qualified: summaryResult.validated.qualified,
      sentiment: summaryResult.validated.sentiment,
      intent: summaryResult.validated.intent,
      summary: summaryResult.summary,
      recommendedNextAction: summaryResult.recommendedNextAction,
    });

    res.json({
      success: true,
      call: updatedCall,
      lead: leadSync.lead,
      leadAction: leadSync.action,
      summary: summaryResult.summary,
      recommendedNextAction: summaryResult.recommendedNextAction,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCall(req, res, next) {
  try {
    const deleted = await db.calls.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Call record not found.' });
    }
    res.json({ success: true, message: 'Call record deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCalls,
  getCall,
  startCall,
  endCall,
  deleteCall,
};
