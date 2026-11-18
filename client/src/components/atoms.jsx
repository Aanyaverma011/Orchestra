import { Mail, FileText, FileSpreadsheet, Inbox, AlertTriangle } from 'lucide-react';
import { STATUS_LABEL, TYPE_LABEL } from '../lib/format';

export const StatusPill = ({ status }) => (
  <span className="pill" data-status={status}>
    <i />
    {STATUS_LABEL[status] || status}
  </span>
);

const TYPE_ICON = { 'send-email': Mail, 'generate-report': FileText, 'process-csv': FileSpreadsheet };

export const TypeIcon = ({ type, size = 15 }) => {
  const Icon = TYPE_ICON[type] || FileText;
  return <Icon size={size} />;
};

export const TypeLabel = ({ type }) => (
  <span className="type">
    <TypeIcon type={type} />
    {TYPE_LABEL[type] || type}
  </span>
);

export const Priority = ({ value }) => (
  <span className="prio" data-p={value}>
    <span className="bars" aria-hidden="true">
      <b /> <b /> <b />
    </span>
    {value[0].toUpperCase() + value.slice(1)}
  </span>
);

export const Meter = ({ value }) => (
  <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <b style={{ width: `${value}%` }} />
  </div>
);

export const Empty = ({ icon: Icon = Inbox, title, children, action }) => (
  <div className="empty">
    <div className="ico">
      <Icon size={20} />
    </div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export const ErrorBanner = ({ children }) => (
  <div className="error-banner" role="alert">
    <AlertTriangle size={16} />
    <span>{children}</span>
  </div>
);

export const SkeletonRows = ({ rows = 6, height = 18 }) => (
  <div style={{ padding: 18, display: 'grid', gap: 14 }}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="skeleton" style={{ height, width: `${70 + ((i * 13) % 30)}%` }} />
    ))}
  </div>
);

export const Logo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--raised)" stroke="var(--line)" />
    <rect x="7" y="13" width="4" height="12" rx="2" fill="var(--accent)" />
    <rect x="14" y="7" width="4" height="18" rx="2" fill="var(--accent)" />
    <rect x="21" y="16" width="4" height="9" rx="2" fill="var(--accent)" opacity=".55" />
  </svg>
);
