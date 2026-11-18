const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' }) : null;

export function timeAgo(input, now = Date.now()) {
  if (!input) return '-';
  const diff = Math.round((new Date(input).getTime() - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 5) return 'just now';
  if (!rtf) return new Date(input).toLocaleString();
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function fmtDuration(ms) {
  if (ms == null) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export const fmtNumber = (n) => (n == null ? '-' : new Intl.NumberFormat('en').format(n));

export const shortId = (id) => (id ? String(id).slice(-6) : '');

export function fmtDateTime(input) {
  if (!input) return '-';
  return new Date(input).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtClock(input) {
  return new Date(input).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function uptime(from) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

export const STATUS_LABEL = {
  scheduled: 'Scheduled',
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  retrying: 'Retrying',
  dead: 'Dead',
  cancelled: 'Cancelled',
};

export const TYPE_LABEL = {
  'send-email': 'Send email',
  'generate-report': 'Generate report',
  'process-csv': 'Process CSV',
};

export const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 9:00 AM', value: '0 9 * * *' },
  { label: 'Weekdays at 6:00 PM', value: '0 18 * * 1-5' },
  { label: 'First of the month, 8:00 AM', value: '0 8 1 * *' },
];

export function describeCron(expr) {
  const hit = CRON_PRESETS.find((p) => p.value === expr);
  return hit ? hit.label : 'Custom schedule';
}
