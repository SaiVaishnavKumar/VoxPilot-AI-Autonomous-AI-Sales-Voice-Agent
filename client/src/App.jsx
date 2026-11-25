import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';

const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const CallsPage = lazy(() => import('./pages/CallsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VoiceAgentPage = lazy(() => import('./pages/VoiceAgentPage'));

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
      Loading VoxPilot AI...
    </main>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/" replace /> : <LoginPage />;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="voice-agent" element={<VoiceAgentPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </Suspense>
  );
}
