import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, ClipboardCheck, Radio, Send,
  TrendingUp, BookOpen, Network, Activity,
  ScrollText, Users, Settings, ShieldCheck, LogOut, Bell,
  Building2, Globe, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hitlApi } from '../api/hitl';
import { ROLE_LABELS } from '../lib/utils';
import type { UserRole } from '../types/api';

interface NavItem {
  to:         string;
  label:      string;
  Icon:       React.ElementType;
  roles?:     UserRole[];
  hitlBadge?: boolean;
}

// ── Platform nav (super_admin) ────────────────────────────────────────────────

const PLATFORM_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Platform',
    items: [
      { to: '/organizations',     label: 'Organizations',     Icon: Building2 },
      { to: '/platform/overview', label: 'Platform Overview', Icon: Globe },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/users',     label: 'All Users',         Icon: Users },
      { to: '/audit-log', label: 'Audit log',         Icon: ScrollText },
      { to: '/settings',  label: 'Platform Settings', Icon: Settings },
    ],
  },
];

// ── Org nav (health center users) ─────────────────────────────────────────────

const ORG_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Monitor',
    items: [
      { to: '/dashboard',  label: 'Overview',          Icon: LayoutDashboard },
      { to: '/hitl',       label: 'HITL Review',       Icon: ClipboardCheck, hitlBadge: true },
      { to: '/posts',      label: 'Live post feed',    Icon: Radio },
      { to: '/dispatch',   label: 'Response dispatch', Icon: Send,
        roles: ['senior_analyst', 'supervisor', 'org_admin'] },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/trends',         label: 'Trend analysis',     Icon: TrendingUp,
        roles: ['senior_analyst', 'supervisor', 'org_admin'] },
      { to: '/knowledge-base', label: 'Knowledge base',     Icon: BookOpen },
      { to: '/model-health',   label: 'Model health',       Icon: Activity,
        roles: ['supervisor', 'org_admin'] },
      { to: '/ingestion',      label: 'Ingestion pipeline', Icon: Network,
        roles: ['org_admin'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/alerts',    label: 'Alerts',          Icon: Bell,
        roles: ['supervisor', 'org_admin'] },
      { to: '/audit-log', label: 'Audit log',       Icon: ScrollText,
        roles: ['supervisor', 'org_admin'] },
      { to: '/users',     label: 'User management', Icon: Users,
        roles: ['supervisor', 'org_admin'] },
      { to: '/settings',  label: 'Settings',        Icon: Settings,
        roles: ['supervisor', 'org_admin'] },
    ],
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  open:    boolean;          // mobile drawer open state
  onClose: () => void;       // close the mobile drawer
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const location         = useLocation();
  const isSuperAdmin     = user?.role === 'super_admin';
  const navSections      = isSuperAdmin ? PLATFORM_NAV : ORG_NAV;

  // Close mobile drawer on route change
  useEffect(() => { onClose(); }, [location.pathname]); // eslint-disable-line

  const { data: hitlData } = useQuery({
    queryKey: ['hitl', 'pending-count'],
    queryFn:  () => hitlApi.list({ page: 1, limit: 1, status: 'pending' }),
    refetchInterval: 60_000,
    staleTime:       30_000,
    enabled: !isSuperAdmin,
  });
  const pendingCount = hitlData?.total ?? 0;

  const initials = user?.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  const sidebarContent = (
    <aside className="flex flex-col h-full glass-sidebar">
      {/* Logo + mobile close */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/40">
        <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <div className="text-xs font-semibold text-gray-900">ImmuniWatch</div>
          <div className="text-[10px] text-gray-400 truncate">
            {isSuperAdmin ? 'Platform Admin' : (user?.organization?.name ?? 'Health Center')}
          </div>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="md:hidden ml-auto p-1 rounded text-gray-400 hover:text-gray-600"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {navSections.map((section) => {
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
                    `flex items-center gap-2 px-2.5 py-2 md:py-1.5 rounded-md text-sm md:text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`h-4 w-4 md:h-3.5 md:w-3.5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'opacity-60'}`} />
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
          <div className={`h-8 w-8 md:h-7 md:w-7 rounded-full flex items-center justify-center text-xs md:text-[10px] font-bold flex-shrink-0 ${
            isSuperAdmin ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm md:text-xs font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs md:text-[10px] text-gray-400">{user ? ROLE_LABELS[user.role] : ''}</p>
          </div>
        </div>
        <button
          onClick={() => { void logout(); }}
          className="flex items-center gap-1.5 w-full text-xs md:text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 md:h-3 md:w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible md+ */}
      <div className="hidden md:flex md:flex-col md:w-52 md:min-h-screen md:flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-72 z-50 shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
