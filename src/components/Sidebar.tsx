import {
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  ChartNoAxesColumnIncreasing,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { EMPLOYEE } from '../model';
export type Page = 'entries' | 'review' | 'reports' | 'clients';
export function Sidebar({
  page,
  setPage,
  onBackup,
  onHelp,
}: {
  page: Page;
  setPage: (page: Page) => void;
  onBackup: () => void;
  onHelp: () => void;
}) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setPage('entries');
        }}
        aria-label="Counsel home"
      >
        <span className="brand-symbol">
          c<span>ı</span>
        </span>
        counsel<span className="brand-period">.</span>
      </a>
      <div className="workspace-label">
        <div className="firm-icon">
          <BriefcaseBusiness size={17} />
        </div>
        <div>
          <strong>Morgan & Partners</strong>
          <span>Firm workspace</span>
        </div>
        <span className="workspace-badge">M&P</span>
      </div>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {(
          [
            { id: 'entries', label: 'Time entries', icon: Clock3 },
            { id: 'review', label: 'Weekly review', icon: ShieldCheck },
            {
              id: 'reports',
              label: 'Reports',
              icon: ChartNoAxesColumnIncreasing,
            },
            { id: 'clients', label: 'Clients', icon: BriefcaseBusiness },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => setPage(item.id)}
          >
            <item.icon size={19} />
            {item.label}
            {page === item.id && <span className="nav-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-card">
          <span className="local-icon">
            <ShieldCheck size={17} />
          </span>
          <strong>Saved in this browser</strong>
          <p>Download a backup to keep a copy.</p>
          <button
            onClick={() => {
              onBackup();
            }}
          >
            Back up or restore <ArrowUpRight size={14} />
          </button>
        </div>
        <button className="help-button" onClick={() => onHelp()}>
          <HelpCircle size={18} /> Help guide <ArrowUpRight size={14} />
        </button>
        <div className="profile">
          <span className="avatar">AM</span>
          <div>
            <strong>{EMPLOYEE}</strong>
            <span>Associate · Local profile</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
