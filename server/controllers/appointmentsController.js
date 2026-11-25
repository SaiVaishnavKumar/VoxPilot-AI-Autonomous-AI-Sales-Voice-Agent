const db = require('../config/database');
const appointmentService = require('../services/appointments/appointmentService');

async function listAppointments(req, res, next) {
  try {
    const { status, date, leadId } = req.query;
    const appointments = await db.appointments.findAll({ status, date, leadId });
    res.json({ success: true, count: appointments.length, appointments });
  } catch (err) {
    next(err);
  }
}

async function getAvailability(req, res, next) {
  try {
    const date = req.query.date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const slots = await appointmentService.getAvailableSlots(date);
    res.json({ success: true, date, slots });
  } catch (err) {
    next(err);
  }
}

async function createAppointment(req, res, next) {
  try {
    const body = req.body || {};
    let customerName = body.customerName;
    let customerPhone = body.customerPhone || '';
    let customerEmail = body.customerEmail || '';

    if (body.leadId && !customerName) {
      const lead = await db.leads.findById(body.leadId);
      if (lead) {
        customerName = lead.name;
        customerPhone = customerPhone || lead.phone;
        customerEmail = customerEmail || lead.email;
      }
    }

    if (!customerName || !body.date || !body.time || !body.purpose) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, date, time, and purpose are required.',
      });
    }

    const appointment = await appointmentService.bookAppointment({
      ...body,
      customerName,
      customerPhone,
      customerEmail,
    });

    if (body.leadId) {
      await db.leads.update(body.leadId, {
        qualificationStatus: 'Converted',
        qualified: true,
      });
    }

    res.status(201).json({
      success: true,
      appointment,
      note: 'Appointment persisted in VoxPilot CRM database.',
    });
  } catch (err) {
    next(err);
  }
}

async function updateAppointment(req, res, next) {
  try {
    const existing = await db.appointments.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const body = req.body || {};
    const targetDate = body.date || existing.date;
    const targetTime = body.time ? appointmentService.normalizeTime(body.time) : existing.time;
    const targetStatus = body.status || existing.status;

    if (targetStatus !== 'Cancelled' && (body.date || body.time)) {
      const conflict = await db.appointments.findConflict({
        date: targetDate,
        time: targetTime,
        excludeId: existing.id,
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Slot ${targetTime} on ${targetDate} is already booked for ${conflict.customerName}.`,
        });
      }
    }

    const appointment = await db.appointments.update(req.params.id, {
      ...body,
      date: targetDate,
      time: targetTime,
    });

    res.json({ success: true, appointment });
  } catch (err) {
    next(err);
  }
}

async function deleteAppointment(req, res, next) {
  try {
    const deleted = await db.appointments.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    res.json({ success: true, message: 'Appointment deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAppointments,
  getAvailability,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
