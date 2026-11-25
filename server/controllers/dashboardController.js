const db = require('../config/database');
const aiService = require('../services/ai/aiService');

async function getStats(req, res, next) {
  try {
    const [leads, calls, appointments, docs] = await Promise.all([
      db.leads.findAll(),
      db.calls.findAll(),
      db.appointments.findAll(),
      db.knowledge.findAll(),
    ]);

    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter((l) => l.qualified).length;
    const totalCalls = calls.length;
    const completedCalls = calls.filter((c) => c.status === 'Completed').length;
    const scheduledAppointments = appointments.filter((a) => a.status === 'Scheduled').length;
    const successfulAppointments = appointments.filter((a) => a.status !== 'Cancelled').length;
    const conversionRate =
      totalLeads > 0 ? Number(((qualifiedLeads / totalLeads) * 100).toFixed(1)) : 0;

    const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
    for (const c of calls) {
      if (sentimentCounts[c.sentiment] !== undefined) sentimentCounts[c.sentiment] += 1;
    }

    const avgLeadScore =
      totalLeads > 0
        ? Math.round(leads.reduce((sum, l) => sum + (Number(l.leadScore) || 0), 0) / totalLeads)
        : 0;

    const recentCalls = calls.slice(0, 5);
    const upcomingAppointments = appointments
      .filter((a) => a.status === 'Scheduled')
      .slice(0, 5);

    // Recent unified activity feed from real records
    const activities = [
      ...calls.slice(0, 4).map((c) => ({
        id: `act_call_${c.id}`,
        type: 'call',
        title: `${c.callerName} — ${c.status} Call`,
        detail: c.summary || `Score ${c.leadScore}/100 • ${c.sentiment}`,
        timestamp: c.endedAt || c.startedAt,
      })),
      ...appointments.slice(0, 4).map((a) => ({
        id: `act_appt_${a.id}`,
        type: 'appointment',
        title: `Appointment: ${a.customerName}`,
        detail: `${a.date} at ${a.time} • ${a.status}`,
        timestamp: a.createdAt,
      })),
      ...leads.slice(0, 4).map((l) => ({
        id: `act_lead_${l.id}`,
        type: 'lead',
        title: `Lead: ${l.name}`,
        detail: `${l.propertyType || 'Property'} • ${l.preferredLocation || 'TBD'} • Score ${l.leadScore}`,
        timestamp: l.updatedAt || l.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    res.json({
      success: true,
      stats: {
        totalLeads,
        qualifiedLeads,
        totalCalls,
        completedCalls,
        scheduledAppointments,
        successfulAppointments,
        conversionRate,
        avgLeadScore,
        knowledgeDocs: docs.length,
      },
      sentimentDistribution: [
        { name: 'Positive', value: sentimentCounts.Positive, color: '#10b981' },
        { name: 'Neutral', value: sentimentCounts.Neutral, color: '#6366f1' },
        { name: 'Negative', value: sentimentCounts.Negative, color: '#ef4444' },
      ],
      recentCalls,
      upcomingAppointments,
      recentActivity: activities,
      system: {
        ai: aiService.getAIStatus(),
        database: db.getStatus(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const [leads, calls, appointments] = await Promise.all([
      db.leads.findAll(),
      db.calls.findAll(),
      db.appointments.findAll(),
    ]);

    const totalCalls = calls.length;
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter((l) => l.qualified).length;
    const conversionRate =
      totalLeads > 0 ? Number(((qualifiedLeads / totalLeads) * 100).toFixed(1)) : 0;
    const activeOrCompletedAppts = appointments.filter((a) => a.status !== 'Cancelled').length;
    const appointmentConversionRate =
      totalLeads > 0 ? Number(((activeOrCompletedAppts / totalLeads) * 100).toFixed(1)) : 0;

    // Calls over time (grouped by date)
    const callsByDate = new Map();
    for (const c of calls) {
      const day = String(c.startedAt || c.createdAt).slice(0, 10);
      if (!callsByDate.has(day)) {
        callsByDate.set(day, { date: day, calls: 0, qualified: 0 });
      }
      const entry = callsByDate.get(day);
      entry.calls += 1;
      if (c.qualified) entry.qualified += 1;
    }
    const callsOverTime = Array.from(callsByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Lead source distribution
    const sourceMap = new Map();
    for (const l of leads) {
      const src = l.source || 'Direct';
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
    }
    const leadSources = Array.from(sourceMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    // Sentiment distribution across leads & calls
    const sentimentMap = { Positive: 0, Neutral: 0, Negative: 0 };
    for (const c of calls) {
      if (sentimentMap[c.sentiment] !== undefined) sentimentMap[c.sentiment] += 1;
    }
    const sentimentAnalysis = Object.entries(sentimentMap).map(([name, count]) => ({
      name,
      count,
    }));

    // Appointment status breakdown
    const apptStatusMap = { Scheduled: 0, Completed: 0, Cancelled: 0 };
    for (const a of appointments) {
      if (apptStatusMap[a.status] !== undefined) apptStatusMap[a.status] += 1;
    }
    const appointmentBreakdown = Object.entries(apptStatusMap).map(([status, count]) => ({
      status,
      count,
    }));

    // Top locations
    const locMap = new Map();
    for (const l of leads) {
      if (l.preferredLocation) {
        locMap.set(l.preferredLocation, (locMap.get(l.preferredLocation) || 0) + 1);
      }
    }
    const topLocations = Array.from(locMap.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    res.json({
      success: true,
      summary: {
        totalCalls,
        totalLeads,
        qualifiedLeads,
        conversionRate,
        totalAppointments: appointments.length,
        activeOrCompletedAppts,
        appointmentConversionRate,
        avgCallDuration:
          totalCalls > 0
            ? Math.round(
                calls.reduce((s, c) => s + (Number(c.durationSeconds) || 0), 0) / totalCalls
              )
            : 0,
      },
      callsOverTime,
      leadSources,
      sentimentAnalysis,
      appointmentBreakdown,
      topLocations,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  getAnalytics,
};
