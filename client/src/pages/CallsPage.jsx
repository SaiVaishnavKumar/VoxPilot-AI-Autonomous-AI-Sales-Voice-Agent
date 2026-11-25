import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, Loader2, PhoneCall, Search } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime, formatDuration, sentimentBadgeClass } from '../utils/formatters';

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCalls = async (term = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await api.listCalls(term.trim() ? { search: term.trim() } : {});
      setCalls(response.calls || []);
    } catch (err) {
      setError(err.message || 'Failed to load call history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    loadCalls(search);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search caller, phone, or summary..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading call history...
          </div>
        ) : calls.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No calls found.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {calls.map((call) => (
              <li key={call.id} className="space-y-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <PhoneCall className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-slate-900">{call.callerName || 'Unknown caller'}</h2>
                      <p className="text-xs text-slate-500">{call.callerPhone || 'No phone number'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2.5 py-1 font-semibold ${sentimentBadgeClass(call.sentiment)}`}>
                      {call.sentiment || 'Neutral'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                      {call.status || 'Unknown'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{call.summary || 'No call summary available.'}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{formatDateTime(call.startedAt || call.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(call.durationSeconds)}
                  </span>
                  <span>Lead score: {call.leadScore ?? 0}/100</span>
                  {call.language && <span>Language: {call.language}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
