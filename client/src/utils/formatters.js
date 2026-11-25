export function formatINR(amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return 'Not specified';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')} Lakhs`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function sentimentBadgeClass(sentiment) {
  switch (sentiment) {
    case 'Positive':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Negative':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
}

export function qualificationBadgeClass(status, qualified) {
  if (status === 'Converted') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (status === 'Qualified' || qualified) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Follow-Up') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'Unqualified') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function appointmentBadgeClass(status) {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}
