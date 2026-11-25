import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { appointmentBadgeClass } from '../utils/formatters';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const defaultTomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [modalOpen, setModalOpen] = useState(false);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({
    leadId: '',
    customerName: '',
    customerPhone: '',
    date: defaultTomorrow,
    time: '11:00',
    purpose: 'Property Consultation & Site Visit',
    location: 'Horizon Crest Experience Center',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [apptRes, leadsRes] = await Promise.all([
        api.listAppointments(statusFilter !== 'all' ? { status: statusFilter } : {}),
        api.listLeads(),
      ]);
      setAppointments(apptRes.appointments || []);
      setLeads(leadsRes.leads || []);
    } catch (err) {
      setError(err.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadAvailability = async (dateStr) => {
    try {
      const res = await api.getAvailability(dateStr);
      setSlots(res.slots || []);
      const firstOpen = (res.slots || []).find((s) => s.available);
      if (firstOpen) {
        setForm((prev) => ({ ...prev, time: firstOpen.time }));
      }
    } catch {
      setSlots([]);
    }
  };

  const openModal = async () => {
    setFormError('');
    setModalOpen(true);
    await loadAvailability(form.date);
  };

  const handleLeadSelect = (leadId) => {
    const match = leads.find((l) => l.id === leadId);
    setForm((prev) => ({
      ...prev,
      leadId,
      customerName: match ? match.name : prev.customerName,
      customerPhone: match ? match.phone : prev.customerPhone,
    }));
  };

  const handleDateChange = async (newDate) => {
    setForm((prev) => ({ ...prev, date: newDate }));
    await loadAvailability(newDate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.createAppointment(form);
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Unable to book appointment.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.updateAppointment(id, { status });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this appointment permanently?')) return;
    try {
      await api.deleteAppointment(id);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete appointment.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 flex items-center gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-blue-600" />
        <span>
          Appointments are persisted directly in the VoxPilot CRM database with real-time slot
          conflict checking. External calendar invites (Google/Outlook) are not sent in this local
          MVP.
        </span>
      </div>

      {/* Header Actions */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          {['all', 'Scheduled', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 capitalize transition-all ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-violet-700"
        >
          <Plus className="h-4 w-4" />
          Schedule Appointment
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading appointments...
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-12 text-center text-sm text-slate-500">
          No appointments found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{appt.customerName}</h3>
                    <p className="text-xs text-slate-500">{appt.customerPhone || 'No phone'}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${appointmentBadgeClass(
                      appt.status
                    )}`}
                  >
                    {appt.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <CalendarCheck className="h-4 w-4 text-blue-600" />
                    <span>{appt.date}</span>
                    <Clock className="h-4 w-4 text-violet-600 ml-2" />
                    <span>{appt.time}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{appt.location}</span>
                  </div>
                  <p className="rounded-xl bg-slate-50 p-2.5 text-slate-700 font-medium">
                    {appt.purpose}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <span className="text-[11px] text-slate-400">Source: {appt.source}</span>
                <div className="flex items-center gap-1">
                  {appt.status === 'Scheduled' && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateStatus(appt.id, 'Completed')}
                        title="Mark Completed"
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(appt.id, 'Cancelled')}
                        title="Cancel Appointment"
                        className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(appt.id)}
                    title="Delete"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Schedule Consultation</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
              {formError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Existing Lead (Optional)
                </label>
                <select
                  value={form.leadId}
                  onChange={(e) => handleLeadSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">-- Custom / Walk-in Customer --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.phone || l.email || 'No contact'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    required
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    value={form.customerPhone}
                    onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Available Time Slot *
                  </label>
                  <select
                    required
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    {slots.length > 0 ? (
                      slots.map((s) => (
                        <option key={s.time} value={s.time} disabled={!s.available}>
                          {s.time} {s.available ? '(Available)' : '(Booked)'}
                        </option>
                      ))
                    ) : (
                      <option value="11:00">11:00</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose *</label>
                <input
                  required
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2 text-xs font-semibold text-white hover:from-blue-700 hover:to-violet-700"
                >
                  {saving ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
