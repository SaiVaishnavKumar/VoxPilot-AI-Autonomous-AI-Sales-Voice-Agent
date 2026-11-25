import React, { useEffect, useState } from 'react';
import { AlertCircle, BarChart3, Loader2, TrendingUp, Users, PhoneCall, CalendarCheck } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import { formatDuration } from '../utils/formatters';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.dashboardAnalytics();
      setAnalytics(response);
    } catch (err) {
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        Loading sales analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
        <button type="button" onClick={loadAnalytics} className="font-semibold underline">Retry</button>
      </div>
    );
  }

  const summary = analytics?.summary || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Calls" value={summary.totalCalls ?? 0} subtitle="Recorded conversations" icon={PhoneCall} accent="blue" />
        <StatCard title="Total Leads" value={summary.totalLeads ?? 0} subtitle={`${summary.qualifiedLeads ?? 0} qualified`} icon={Users} accent="emerald" />
        <StatCard title="Lead Conversion" value={`${summary.conversionRate ?? 0}%`} subtitle="Qualified / total leads" icon={TrendingUp} accent="violet" />
        <StatCard title="Appointments" value={summary.totalAppointments ?? 0} subtitle={`${summary.appointmentConversionRate ?? 0}% of leads`} icon={CalendarCheck} accent="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Calls and qualified leads</h2>
          <p className="mb-4 mt-1 text-xs text-slate-500">Daily conversation volume</p>
          <div className="h-72">
            {analytics?.callsOverTime?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.callsOverTime}>
                  <defs>
                    <linearGradient id="analyticsCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="calls" stroke="#2563eb" fill="url(#analyticsCalls)" />
                  <Area type="monotone" dataKey="qualified" stroke="#7c3aed" fill="#ede9fe" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No call data yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-violet-600" />
            Lead sources
          </h2>
          <p className="mb-4 mt-1 text-xs text-slate-500">Where new prospects come from</p>
          <div className="h-72">
            {analytics?.leadSources?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.leadSources} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No lead source data yet.</div>
            )}
          </div>
        </section>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Average call duration: <strong className="text-slate-900">{formatDuration(summary.avgCallDuration)}</strong>
      </div>
    </div>
  );
}
