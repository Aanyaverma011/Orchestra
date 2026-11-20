import { useId } from 'react';
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

// Calendar with a clock: the Orchestra mark. Drawn in the current text colour.
export const Logo = ({ size = 28 }) => {
  const id = `logo-${useId().replace(/:/g, '')}`;
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" fill="currentColor">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse">
          <rect width="64" height="64" fill="#fff" />
          <rect x="9" y="1" width="10" height="17" rx="5" fill="#000" />
          <rect x="31" y="1" width="10" height="17" rx="5" fill="#000" />
          <circle cx="46" cy="45" r="18" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <path fillRule="evenodd" d="M9 8h32a7 7 0 0 1 7 7v33a7 7 0 0 1-7 7H9a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7Zm-1 14v26a1 1 0 0 0 1 1h32a1 1 0 0 0 1-1V22Z" />
        <rect x="11" y="26" width="8" height="5" rx="1" /><rect x="21.5" y="26" width="8" height="5" rx="1" /><rect x="32" y="26" width="8" height="5" rx="1" />
        <rect x="11" y="34" width="8" height="5" rx="1" /><rect x="21.5" y="34" width="8" height="5" rx="1" /><rect x="32" y="34" width="8" height="5" rx="1" />
        <rect x="11" y="42" width="8" height="5" rx="1" /><rect x="21.5" y="42" width="8" height="5" rx="1" />
      </g>
      <rect x="11.5" y="3" width="5" height="13" rx="2.5" />
      <rect x="33.5" y="3" width="5" height="13" rx="2.5" />
      <circle cx="46" cy="45" r="13.5" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <path d="M46 36.5V45l5.5 3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
