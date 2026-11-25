import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, ShieldCheck, Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('Horizon Crest Realty');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register, systemStatus } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password, company);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await login('demo@voxpilot.ai', 'VoxPilot@2026');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Demo login failed. Ensure backend server is running.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col lg:flex-row">
      {/* Left Brand / Value Showcase */}
      <div className="lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-950 to-indigo-950 p-8 sm:p-12 lg:p-16 flex flex-col justify-between text-white">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/30">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">VoxPilot AI</span>
            <p className="text-xs text-blue-300">FORTIVEX AI Challenge Edition</p>
          </div>
        </div>

        <div className="relative z-10 my-10 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-200">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
            <span>Autonomous AI Sales Voice Agent</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            Your Intelligent AI{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Sales Representative
            </span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-lg leading-relaxed">
            Engage inbound property buyers in real-time voice conversations, retrieve verified
            business facts via RAG, qualify leads on structured criteria, and book consultations
            directly into your CRM.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
              <div className="text-xs font-semibold text-blue-300">Voice + Text</div>
              <div className="mt-1 text-xs text-slate-300">English & Hindi STT/TTS</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
              <div className="text-xs font-semibold text-violet-300">Grounded RAG</div>
              <div className="mt-1 text-xs text-slate-300">PDF & TXT Policy Retrieval</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
              <div className="text-xs font-semibold text-emerald-300">End-to-End CRM</div>
              <div className="mt-1 text-xs text-slate-300">Auto-Scoring & Booking</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            JWT Auth & BCrypt Secured
          </span>
          <span>•</span>
          <span>
            Active Engine:{' '}
            <strong className="text-slate-200">
              {systemStatus?.ai?.mode === 'gemini' ? 'Google Gemini AI' : 'Intelligent Demo Mode'}
            </strong>
          </span>
        </div>
      </div>

      {/* Right Auth Card */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/50 p-7 sm:p-8">
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError('');
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                tab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError('');
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-900">
            {tab === 'login' ? 'Welcome back' : 'Create your VoxPilot workspace'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {tab === 'login'
              ? 'Sign in to access your AI Voice Agent, CRM, and Analytics.'
              : 'Set up an agent account to manage leads and knowledge documents.'}
          </p>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="K Sai Vaishnav Kumar"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Horizon Crest Realty"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@voxpilot.ai"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>{tab === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Instant Evaluation Access
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-violet-700 disabled:opacity-60 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            <span>One-Click Demo Login</span>
          </button>
          <p className="mt-2.5 text-center text-[11px] text-slate-500">
            Demo credentials: <code>demo@voxpilot.ai</code> / <code>VoxPilot@2026</code>
          </p>
        </div>
      </div>
    </div>
  );
}
