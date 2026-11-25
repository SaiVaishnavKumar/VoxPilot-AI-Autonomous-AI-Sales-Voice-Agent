const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('voxpilot_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.message || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // Health & Status
  health: () => request('/health'),
  aiStatus: () => request('/ai/status'),

  // Auth
  login: (payload) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/auth/me'),

  // Dashboard & Analytics
  dashboardStats: () => request('/dashboard/stats'),
  dashboardAnalytics: () => request('/dashboard/analytics'),

  // AI & Calls
  startCall: (payload) =>
    request('/calls', { method: 'POST', body: JSON.stringify(payload) }),
  endCall: (id, payload = {}) =>
    request(`/calls/${id}/end`, { method: 'PATCH', body: JSON.stringify(payload) }),
  listCalls: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/calls${qs ? `?${qs}` : ''}`);
  },
  getCall: (id) => request(`/calls/${id}`),
  deleteCall: (id) => request(`/calls/${id}`, { method: 'DELETE' }),
  aiChat: (payload) =>
    request('/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),
  aiAnalyze: (text) =>
    request('/ai/analyze', { method: 'POST', body: JSON.stringify({ text }) }),

  // Leads CRM
  listLeads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/leads${qs ? `?${qs}` : ''}`);
  },
  getLead: (id) => request(`/leads/${id}`),
  createLead: (payload) =>
    request('/leads', { method: 'POST', body: JSON.stringify(payload) }),
  updateLead: (id, payload) =>
    request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),

  // Appointments
  listAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/appointments${qs ? `?${qs}` : ''}`);
  },
  getAvailability: (date) =>
    request(`/appointments/availability?date=${encodeURIComponent(date)}`),
  createAppointment: (payload) =>
    request('/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  updateAppointment: (id, payload) =>
    request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),

  // Knowledge Base
  listKnowledge: () => request('/knowledge'),
  uploadKnowledgeFile: (formData) =>
    request('/knowledge/upload', { method: 'POST', body: formData }),
  addKnowledgeText: (payload) =>
    request('/knowledge/text', { method: 'POST', body: JSON.stringify(payload) }),
  queryKnowledge: (query) =>
    request('/knowledge/query', { method: 'POST', body: JSON.stringify({ query }) }),
  deleteKnowledge: (id) => request(`/knowledge/${id}`, { method: 'DELETE' }),
};
