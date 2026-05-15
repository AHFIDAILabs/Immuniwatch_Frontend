import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, ClipboardCheck, Radio, Send,
  TrendingUp, BookOpen, Network, Activity,
  ScrollText, Users, Settings, ShieldCheck, LogOut, Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hitlApi } from '../api/hitl';
import type { UserRole } from '../types/api';

interface NavItem {
  to:         string;
  label:      string;
  Icon:       React.ElementType;
  roles?:     UserRole[];
  hitlBadge?: boolean;
}

// ── Navigation definition ─────────────────────────────────────────────────────

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Monitor',
    items: [
      { to: '/dashboard', label: 'Overview',          Icon: LayoutDashboard },
      { to: '/hitl',      label: 'HITL Review',       Icon: ClipboardCheck, hitlBadge: true },
      { to: '/posts',     label: 'Live post feed',    Icon: Radio },
      {
        to: '/dispatch', label: 'Response dispatch', Icon: Send,
        roles: ['senior_analyst', 'supervisor', 'super_admin'],
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        to: '/trends', label: 'Trend analysis', Icon: TrendingUp,
        roles: ['senior_analyst', 'supervisor', 'super_admin'],
      },
      { to: '/knowledge-base', label: 'Knowledge base',     Icon: BookOpen },
      {
        to: '/model-health', label: 'Model health', Icon: Activity,
        roles: ['supervisor', 'super_admin'],
      },
      {
        to: '/ingestion', label: 'Ingestion pipeline', Icon: Network,
        roles: ['super_admin'],
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        to: '/alerts',    label: 'Alerts',          Icon: Bell,
        roles: ['supervisor', 'super_admin'],
      },
      {
        to: '/audit-log', label: 'Audit log',       Icon: ScrollText,
        roles: ['supervisor', 'super_admin'],
      },
      {
        to: '/users',     label: 'User management', Icon: Users,
        roles: ['supervisor', 'super_admin'],
      },
      {
        to: '/settings',  label: 'Settings',        Icon: Settings,
        roles: ['super_admin'],
      },
    ],
  },
];

// ── Role display labels ───────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  analyst:        'Analyst',
  senior_analyst: 'Senior Analyst',
  supervisor:     'Supervisor',
  super_admin:    'Super Admin',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, logout } = useAuth();

  const { data: hitlData } = useQuery({
    queryKey: ['hitl', 'pending-count'],
    queryFn:  () => hitlApi.list({ page: 1, limit: 1, status: 'pending' }),
    refetchInterval: 60_000,
    staleTime:       30_000,
  });
  const pendingCount = hitlData?.total ?? 0;

  const initials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?';

  return (
    <aside className="flex flex-col w-52 min-h-screen glass-sidebar flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/40">
        <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-xs font-semibold text-gray-900">ImmuniWatch</div>
          <div className="text-[10px] text-gray-400">Nigeria · NPHCDA</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role)),
          );
          if (visible.length === 0) return null;
          return (
            <div key={section.label} className="mb-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.label}
              </div>
              {visible.map(({ to, label, Icon, hitlBadge }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'opacity-60'}`} />
                      <span className="flex-1">{label}</span>
                      {hitlBadge && pendingCount > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/40">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-400">{user ? ROLE_LABELS[user.role] : ''}</p>
          </div>
        </div>
        <button
          onClick={() => { void logout(); }}
          className="flex items-center gap-1.5 w-full text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
