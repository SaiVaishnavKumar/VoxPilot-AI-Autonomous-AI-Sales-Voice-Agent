import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Mic,
  Users,
  CalendarCheck,
  BookOpen,
  PhoneCall,
  BarChart3,
  LogOut,
  Menu,
  X,
  Sparkles,
  Database,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/voice-agent', label: 'AI Voice Agent', icon: Mic, badge: 'Live' },
  { to: '/leads', label: 'Leads & CRM', icon: Users },
  { to: '/appointments', label: 'Appointments', icon: CalendarCheck },
  { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { to: '/calls', label: 'Call History', icon: PhoneCall },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const PAGE_TITLES = {
  '/': 'Executive Overview',
  '/voice-agent': 'AI Voice Sales Agent',
  '/leads': 'Lead Management & CRM',
  '/appointments': 'Consultation Appointments',
  '/knowledge': 'RAG Knowledge Base',
  '/calls': 'Call History & Transcripts',
  '/analytics': 'Sales & Conversion Analytics',
};

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, systemStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = PAGE_TITLES[location.pathname] || 'VoxPilot AI';
  const isGemini = systemStatus?.ai?.mode === 'gemini';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-navy-900 text-slate-200">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/30">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">VoxPilot AI</div>
            <div className="text-[11px] font-medium text-blue-300/80">Autonomous Sales Agent</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Industry Tag */}
      <div className="mx-4 mt-4 rounded-xl bg-navy-800/90 border border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Building2 className="h-3.5 w-3.5 text-blue-400" />
          <span>Active Industry Profile</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">
            {systemStatus?.company || 'Horizon Crest Realty'}
          </span>
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
            Real Estate
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-400/20">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status & User Footer */}
      <div className="border-t border-white/10 p-4 space-y-3">
        <div className="rounded-xl bg-navy-950/70 border border-white/10 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              AI Engine
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isGemini
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {isGemini ? 'Gemini Live' : 'Demo Mode'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database className="h-3.5 w-3.5 text-blue-400" />
              Database
            </span>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300 uppercase">
              {systemStatus?.database?.engine || 'sqlite'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{user?.name || 'Demo User'}</p>
            <p className="truncate text-[11px] text-slate-400">{user?.email || 'demo@voxpilot.ai'}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-rose-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-full h-full">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {pageTitle}
                </h1>
                <p className="hidden sm:block text-xs text-slate-500">
                  VoxPilot AI — Your Intelligent AI Sales Representative
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  isGemini
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isGemini ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                {isGemini ? 'Gemini AI Mode' : 'Demo Fallback Mode'}
              </span>

              {location.pathname !== '/voice-agent' && (
                <button
                  type="button"
                  onClick={() => navigate('/voice-agent')}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-violet-700 transition-all"
                >
                  <Mic className="h-4 w-4" />
                  <span>Launch Voice Agent</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
