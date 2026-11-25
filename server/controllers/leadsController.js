const db = require('../config/database');
const leadService = require('../services/crm/leadService');
const aiService = require('../services/ai/aiService');

async function listLeads(req, res, next) {
  try {
    const { search, qualified, status, sentiment } = req.query;
    const leads = await db.leads.findAll({ search, qualified, status, sentiment });
    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    next(err);
  }
}

async function getLead(req, res, next) {
  try {
    const lead = await db.leads.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }
    const [calls, appointments] = await Promise.all([
      db.calls.findAll({ leadId: lead.id }),
      db.appointments.findAll({ leadId: lead.id }),
    ]);
    res.json({ success: true, lead, calls, appointments });
  } catch (err) {
    next(err);
  }
}

async function createLead(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ success: false, message: 'Lead name is required.' });
    }

    if (body.phone || body.email) {
      const dup = await db.leads.findDuplicate({ phone: body.phone, email: body.email });
      if (dup) {
        return res.status(409).json({
          success: false,
          message: `Duplicate lead detected: ${dup.name} already uses this phone number or email.`,
          existingLeadId: dup.id,
        });
      }
    }

    const scoring = leadService.calculateLeadScore({
      name: body.name,
      phone: body.phone,
      email: body.email,
      location: body.preferredLocation,
      budget: body.budget,
      budgetLabel: body.budgetLabel,
      propertyType: body.propertyType,
      purchaseTimeline: body.purchaseTimeline,
      intent: body.intent || 'Medium',
      appointmentWilling: body.qualificationStatus === 'Qualified',
    });

    const leadScore =
      body.leadScore !== undefined && body.leadScore !== ''
        ? Math.min(100, Math.max(0, Number(body.leadScore)))
        : scoring.leadScore;
    const qualified =
      body.qualified !== undefined ? Boolean(body.qualified) : leadScore >= 60;

    const lead = await db.leads.create({
      name: String(body.name).trim(),
      phone: String(body.phone || '').trim(),
      email: String(body.email || '').trim().toLowerCase(),
      preferredLocation: body.preferredLocation || '',
      budget: Number(body.budget) || 0,
      budgetLabel: body.budgetLabel || aiService.formatINR(body.budget),
      propertyType: body.propertyType || '',
      purchaseTimeline: body.purchaseTimeline || '',
      leadScore,
      scoreBreakdown: scoring.breakdown,
      qualificationStatus: body.qualificationStatus || (qualified ? 'Qualified' : 'New'),
      qualified,
      sentiment: body.sentiment || 'Neutral',
      intent: body.intent || 'Medium',
      source: body.source || 'Manual CRM Entry',
      industry: body.industry || 'real-estate',
      followUpDate: body.followUpDate || '',
      notes: body.notes || '',
    });

    res.status(201).json({ success: true, lead });
  } catch (err) {
    next(err);
  }
}

async function updateLead(req, res, next) {
  try {
    const existing = await db.leads.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const body = req.body || {};
    if (body.phone || body.email) {
      const dup = await db.leads.findDuplicate({
        phone: body.phone !== undefined ? body.phone : existing.phone,
        email: body.email !== undefined ? body.email : existing.email,
        excludeId: existing.id,
      });
      if (dup) {
        return res.status(409).json({
          success: false,
          message: `Another lead (${dup.name}) already uses this phone number or email.`,
        });
      }
    }

    const mergedForScore = {
      name: body.name ?? existing.name,
      phone: body.phone ?? existing.phone,
      email: body.email ?? existing.email,
      location: body.preferredLocation ?? existing.preferredLocation,
      budget: body.budget ?? existing.budget,
      budgetLabel: body.budgetLabel ?? existing.budgetLabel,
      propertyType: body.propertyType ?? existing.propertyType,
      purchaseTimeline: body.purchaseTimeline ?? existing.purchaseTimeline,
      intent: body.intent ?? existing.intent,
      appointmentWilling: (body.qualificationStatus ?? existing.qualificationStatus) === 'Qualified',
    };

    const scoring = leadService.calculateLeadScore(mergedForScore);
    const updatedPayload = {
      ...body,
      budgetLabel:
        body.budgetLabel !== undefined
          ? body.budgetLabel
          : body.budget !== undefined
            ? aiService.formatINR(body.budget)
            : existing.budgetLabel,
      scoreBreakdown: scoring.breakdown,
    };

    if (body.qualificationStatus === 'Qualified' || body.qualificationStatus === 'Converted') {
      updatedPayload.qualified = true;
    } else if (body.qualificationStatus === 'Unqualified') {
      updatedPayload.qualified = false;
    }

    const lead = await db.leads.update(req.params.id, updatedPayload);
    res.json({ success: true, lead });
  } catch (err) {
    next(err);
  }
}

async function deleteLead(req, res, next) {
  try {
    const deleted = await db.leads.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }
    res.json({ success: true, message: 'Lead deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
};
