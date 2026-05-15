import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from './ErrorBoundary';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':      'Overview',
  '/hitl':           'HITL Review',
  '/posts':          'Live post feed',
  '/dispatch':       'Response dispatch',
  '/trends':         'Trend analysis',
  '/knowledge-base': 'Knowledge base',
  '/ingestion':      'Ingestion pipeline',
  '/model-health':   'Model health',
  '/audit-log':      'Audit log',
  '/users':          'User management',
  '/settings':       'Settings',
  '/alerts':         'Alerts',
};

const NOTIFICATIONS = [
  { id: 1, color: 'bg-red-500',    text: 'Surge detected: "Jigi ta causes infertility" — 247 posts in 2 hrs (Hausa)', time: '2 min ago' },
  { id: 2, color: 'bg-red-500',    text: 'Coordinated cluster: OPV-polio link campaign on Facebook (Pidgin)', time: '19 min ago' },
  { id: 3, color: 'bg-amber-500',  text: 'Model drift: Yoruba PSI = 0.22 — retraining recommended', time: '1 hr ago' },
  { id: 4, color: 'bg-blue-500',   text: '14 posts escalated to high-priority HITL queue by auto-classifier', time: '2 hr ago' },
  { id: 5, color: 'bg-emerald-500',text: 'Monthly model retraining completed — macro-F1 improved to 0.847', time: '3 hr ago' },
];

export function Layout() {
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds]     = useState<Set<number>>(() => new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const title  = PAGE_TITLES[location.pathname] ?? 'Overview';
  const unread = NOTIFICATIONS.filter((n) => !readIds.has(n.id)).length;

  const { data: liveStats } = useQuery({
    queryKey: ['stats', 'live'],
    queryFn: () => api.get<{ postsLastHour: number; pendingHITL: number }>('/stats/live').then((r) => r.data),
    refetchInterval: 60_000,
    staleTime:       30_000,
  });

  function markAll() {
    setReadIds(new Set(NOTIFICATIONS.map((n) => n.id)));
  }

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  return (
    <div className="flex h-screen app-bg overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-12 glass-topbar flex items-center px-5 gap-3 flex-shrink-0 z-10">
          <span className="text-sm font-medium text-gray-900 flex-1">{title}</span>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-gray-500">
              Live · {liveStats ? `${liveStats.postsLastHour.toLocaleString()}/hr` : '—'}
            </span>
          </div>

          {/* Notification bell */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative w-8 h-8 rounded-md glass-card flex items-center justify-center hover:bg-white/90 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-gray-500" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute top-10 right-0 w-80 glass-dropdown rounded-xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/40">
                  <span className="text-sm font-semibold text-gray-900">
                    Notifications{' '}
                    {unread > 0 && (
                      <span className="ml-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unread}</span>
                    )}
                  </span>
                  <button onClick={markAll} className="text-xs text-emerald-600 hover:text-emerald-800">
                    Mark all read
                  </button>
                </div>
                <div className="divide-y divide-white/40 max-h-80 overflow-y-auto">
                  {NOTIFICATIONS.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => setReadIds((prev) => new Set([...prev, n.id]))}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-white/40 transition-colors ${!readIds.has(n.id) ? 'bg-emerald-50/50' : ''}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${n.color}`} />
                      <div>
                        <p className="text-xs text-gray-800 leading-snug">{n.text}</p>
                        <time className="text-[10px] text-gray-400 mt-0.5 block">{n.time}</time>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 text-center text-[11px] text-gray-400 border-t border-white/40">
                  No older notifications
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          <ErrorBoundary scope={title}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
