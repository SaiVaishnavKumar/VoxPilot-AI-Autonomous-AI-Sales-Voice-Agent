import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  PhoneCall,
  CalendarCheck,
  TrendingUp,
  Mic,
  Plus,
  BookOpen,
  ArrowUpRight,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import {
  formatDateTime,
  formatDuration,
  sentimentBadgeClass,
} from '../utils/formatters';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        api.dashboardStats(),
        api.dashboardAnalytics(),
      ]);
      setData(statsRes);
      setAnalytics(analyticsRes);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Loading live CRM & voice analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats || {};
  const sentimentData = (data?.sentimentDistribution || []).filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Leads"
          value={stats.totalLeads ?? 0}
          subtitle={`Avg score: ${stats.avgLeadScore ?? 0}/100`}
          icon={Users}
          accent="blue"
        />
        <StatCard
          title="Qualified Leads"
          value={stats.qualifiedLeads ?? 0}
          subtitle="Score ≥ 60 / Converted"
          icon={UserCheck}
          accent="emerald"
        />
        <StatCard
          title="Total Calls"
          value={stats.totalCalls ?? 0}
          subtitle={`${stats.completedCalls ?? 0} completed`}
          icon={PhoneCall}
          accent="indigo"
        />
        <StatCard
          title="Appointments"
          value={stats.successfulAppointments ?? 0}
          subtitle={`${stats.scheduledAppointments ?? 0} upcoming`}
          icon={CalendarCheck}
          accent="violet"
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats.conversionRate ?? 0}%`}
          subtitle="Qualified / Total Leads"
          icon={TrendingUp}
          accent="amber"
        />
      </div>

      {/* Quick Actions Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-navy-900 via-navy-800 to-indigo-950 p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold">Ready for a Live Voice Sales Demo?</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">
            Start an autonomous real estate consultation call, extract structured CRM fields, and
            book a verified slot end-to-end.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/voice-agent')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:from-blue-600 hover:to-violet-700"
          >
            <Mic className="h-4 w-4" />
            Start AI Call
          </button>
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-white/20"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
          <button
            type="button"
            onClick={() => navigate('/appointments')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-white/20"
          >
            <CalendarCheck className="h-4 w-4" />
            Book Slot
          </button>
          <button
            type="button"
            onClick={() => navigate('/knowledge')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-white/20"
          >
            <BookOpen className="h-4 w-4" />
            Upload Docs
          </button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calls & Qualification Trend */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Calls & Lead Qualification Trend</h3>
              <p className="text-xs text-slate-500">Real call volume vs qualified prospects</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Full Analytics <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-64">
            {analytics?.callsOverTime?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.callsOverTime}>
                  <defs>
                    <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="qualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    name="Total Calls"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#callsGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="qualified"
                    name="Qualified"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#qualGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No call data recorded yet. Start an AI Voice call to populate metrics.
              </div>
            )}
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-900">Sentiment Distribution</h3>
          <p className="text-xs text-slate-500 mb-3">Caller sentiment across recorded sessions</p>
          <div className="flex-1 min-h-[190px]">
            {sentimentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={4}
                  >
                    {sentimentData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No sentiment data available yet.
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-xs">
            {(data?.sentimentDistribution || []).map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-600 font-medium">
                  {s.name}: {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Calls & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Calls */}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent AI Calls</h3>
            <button
              type="button"
              onClick={() => navigate('/calls')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {(data?.recentCalls || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No calls recorded yet.</p>
            ) : (
              data.recentCalls.map((call) => (
                <button
                  type="button"
                  key={call.id}
                  onClick={() => navigate(`/calls?id=${call.id}`)}
                  className="w-full text-left rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 p-3.5 transition-all flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {call.callerName}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sentimentBadgeClass(
                          call.sentiment
                        )}`}
                      >
                        {call.sentiment}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                      {call.summary || 'Active or un-summarized conversation'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-800">
                      {call.leadScore}/100
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {formatDuration(call.durationSeconds)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent CRM Activity</h3>
            <button
              type="button"
              onClick={() => navigate('/leads')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Open CRM
            </button>
          </div>
          <div className="space-y-3">
            {(data?.recentActivity || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No recent activity.</p>
            ) : (
              data.recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-slate-50/80 border border-slate-100 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{act.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{act.detail}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">
                    {formatDateTime(act.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
