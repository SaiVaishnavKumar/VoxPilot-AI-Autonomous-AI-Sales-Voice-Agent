import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  X,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { api } from '../services/api';
import {
  formatINR,
  qualificationBadgeClass,
  sentimentBadgeClass,
} from '../utils/formatters';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  preferredLocation: '',
  budget: '',
  propertyType: '3BHK',
  purchaseTimeline: 'Within 3 months',
  qualificationStatus: 'New',
  sentiment: 'Neutral',
  intent: 'Medium',
  followUpDate: '',
  notes: '',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [qualFilter, setQualFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [detailData, setDetailData] = useState(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (qualFilter !== 'all') params.qualified = qualFilter;
      const res = await api.listLeads(params);
      setLeads(res.leads || []);
    } catch (err) {
      setError(err.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [qualFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLeads();
  };

  const openCreateModal = () => {
    setEditingLead(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      preferredLocation: lead.preferredLocation || '',
      budget: lead.budget || '',
      propertyType: lead.propertyType || '',
      purchaseTimeline: lead.purchaseTimeline || '',
      qualificationStatus: lead.qualificationStatus || 'New',
      sentiment: lead.sentiment || 'Neutral',
      intent: lead.intent || 'Medium',
      followUpDate: lead.followUpDate || '',
      notes: lead.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        budget: Number(form.budget) || 0,
      };
      if (editingLead) {
        await api.updateLead(editingLead.id, payload);
      } else {
        await api.createLead(payload);
      }
      setModalOpen(false);
      await fetchLeads();
    } catch (err) {
      setFormError(err.message || 'Failed to save lead.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete lead "${lead.name}" from CRM?`)) return;
    try {
      await api.deleteLead(lead.id);
      if (detailData?.lead?.id === lead.id) setDetailData(null);
      await fetchLeads();
    } catch (err) {
      setError(err.message || 'Failed to delete lead.');
    }
  };

  const viewLeadDetails = async (leadId) => {
    try {
      const res = await api.getLead(leadId);
      setDetailData(res);
    } catch (err) {
      setError(err.message || 'Failed to load lead details.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads by name, phone, email, location..."
              className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            {[
              { id: 'all', label: 'All' },
              { id: 'true', label: 'Qualified' },
              { id: 'false', label: 'Unqualified' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setQualFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  qualFilter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-violet-700"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Leads Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Loading CRM leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No leads found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5">Lead</th>
                  <th className="px-4 py-3.5">Requirement</th>
                  <th className="px-4 py-3.5">Budget</th>
                  <th className="px-4 py-3.5">Score</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Sentiment</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{lead.name}</div>
                      <div className="text-xs text-slate-500">
                        {lead.phone || 'No phone'} {lead.email ? `• ${lead.email}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800">
                        {lead.propertyType || 'Unspecified'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {lead.preferredLocation || 'Location TBD'} •{' '}
                        {lead.purchaseTimeline || 'Timeline TBD'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {lead.budgetLabel || formatINR(lead.budget)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{lead.leadScore}</span>
                        <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${lead.leadScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${qualificationBadgeClass(
                          lead.qualificationStatus,
                          lead.qualified
                        )}`}
                      >
                        {lead.qualificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sentimentBadgeClass(
                          lead.sentiment
                        )}`}
                      >
                        {lead.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => viewLeadDetails(lead.id)}
                          title="View Details"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(lead)}
                          title="Edit Lead"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(lead)}
                          title="Delete Lead"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Lead Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingLead ? 'Edit Lead Record' : 'Create New Lead'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-sm">
              {formError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="buyer@example.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Location
                  </label>
                  <input
                    value={form.preferredLocation}
                    onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })}
                    placeholder="Gachibowli, Hyderabad"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Budget (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="7500000"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Property Type
                  </label>
                  <input
                    value={form.propertyType}
                    onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
                    placeholder="3BHK, Villa"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Timeline
                  </label>
                  <input
                    value={form.purchaseTimeline}
                    onChange={(e) => setForm({ ...form, purchaseTimeline: e.target.value })}
                    placeholder="Within 3 months"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Qualification Status
                  </label>
                  <select
                    value={form.qualificationStatus}
                    onChange={(e) => setForm({ ...form, qualificationStatus: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="New">New</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Follow-Up">Follow-Up</option>
                    <option value="Converted">Converted</option>
                    <option value="Unqualified">Unqualified</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sentiment
                  </label>
                  <select
                    value={form.sentiment}
                    onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  >
                    <option value="Positive">Positive</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Negative">Negative</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2 text-xs font-semibold text-white hover:from-blue-700 hover:to-violet-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingLead ? 'Update Lead' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail Drawer */}
      {detailData && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{detailData.lead.name}</h3>
                <p className="text-xs text-slate-500">
                  Source: {detailData.lead.source} • Score {detailData.lead.leadScore}/100
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailData(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                <Phone className="h-4 w-4 text-blue-600" />
                <span>{detailData.lead.phone || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="truncate">{detailData.lead.email || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 sm:col-span-2">
                <MapPin className="h-4 w-4 text-violet-600" />
                <span>
                  {detailData.lead.propertyType || 'Property'} in{' '}
                  {detailData.lead.preferredLocation || 'TBD'} • Budget:{' '}
                  {detailData.lead.budgetLabel || formatINR(detailData.lead.budget)}
                </span>
              </div>
            </div>

            {detailData.lead.scoreBreakdown &&
              Object.keys(detailData.lead.scoreBreakdown).length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Lead Score Breakdown
                  </div>
                  {Object.entries(detailData.lead.scoreBreakdown).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-600">
                        {key.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <span className="font-bold text-slate-900">{val} pts</span>
                    </div>
                  ))}
                </div>
              )}

            {detailData.lead.notes && (
              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-line">
                <div className="font-bold text-slate-900 mb-1">CRM Notes</div>
                {detailData.lead.notes}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Linked Calls ({detailData.calls?.length || 0})
              </h4>
              {(detailData.calls || []).map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                  <div className="font-semibold text-slate-900">
                    {c.status} Call • {c.sentiment} • Score {c.leadScore}
                  </div>
                  <p className="mt-1 text-slate-600">{c.summary || 'No summary'}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Linked Appointments ({detailData.appointments?.length || 0})
              </h4>
              {(detailData.appointments || []).map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                  <div className="font-semibold text-slate-900">
                    {a.date} at {a.time} ({a.status})
                  </div>
                  <p className="mt-0.5 text-slate-600">{a.purpose}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
