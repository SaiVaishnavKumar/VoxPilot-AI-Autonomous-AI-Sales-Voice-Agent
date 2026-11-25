const db = require('../../config/database');

const STANDARD_SLOTS = [
  '10:00',
  '11:00',
  '12:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

function normalizeTime(timeStr) {
  const s = String(timeStr || '').trim().toLowerCase();
  // Match HH:MM
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = String(Number(m24[1])).padStart(2, '0');
    return `${h}:${m24[2]}`;
  }
  // Match 3pm, 11 am, 4:30 pm
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = Number(m12[1]);
    const min = m12[2] || '00';
    if (m12[3] === 'pm' && h < 12) h += 12;
    if (m12[3] === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  return s;
}

async function getAvailableSlots(date) {
  const appointments = await db.appointments.findAll({ date });
  const bookedTimes = new Set(
    appointments.filter((a) => a.status !== 'Cancelled').map((a) => normalizeTime(a.time))
  );
  return STANDARD_SLOTS.map((slot) => ({
    time: slot,
    available: !bookedTimes.has(slot),
  }));
}

async function bookAppointment(payload) {
  const cleanTime = normalizeTime(payload.time);
  if (!payload.date || !cleanTime) {
    const err = new Error('Appointment date and time are required.');
    err.statusCode = 400;
    throw err;
  }

  const conflict = await db.appointments.findConflict({
    date: payload.date,
    time: cleanTime,
    excludeId: payload.excludeId,
  });

  if (conflict) {
    const slots = await getAvailableSlots(payload.date);
    const alternatives = slots.filter((s) => s.available).map((s) => s.time);
    const err = new Error(
      `Time slot ${cleanTime} on ${payload.date} is already booked. Available slots: ${
        alternatives.length > 0 ? alternatives.join(', ') : 'None remaining for this date'
      }.`
    );
    err.statusCode = 409;
    err.alternatives = alternatives;
    throw err;
  }

  return db.appointments.create({
    leadId: payload.leadId || '',
    customerName: payload.customerName,
    customerPhone: payload.customerPhone || '',
    customerEmail: payload.customerEmail || '',
    date: payload.date,
    time: cleanTime,
    purpose: payload.purpose || 'Property Consultation & Site Visit',
    location: payload.location || 'Horizon Crest Experience Center',
    status: 'Scheduled',
    source: payload.source || 'CRM',
    callId: payload.callId || '',
    notes: payload.notes || '',
  });
}

module.exports = {
  STANDARD_SLOTS,
  normalizeTime,
  getAvailableSlots,
  bookAppointment,
};
