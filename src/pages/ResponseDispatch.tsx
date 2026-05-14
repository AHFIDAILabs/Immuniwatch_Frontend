import { useQuery } from '@tanstack/react-query';
import { Send, CheckCircle, Clock, BarChart2 } from 'lucide-react';
import { dispatchApi } from '../api/dispatch';
import { StatCard } from '../components/StatCard';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatRelative, PLATFORM_LABELS, LANG_FLAGS } from '../lib/utils';
import type { PostPlatform, PostLanguage } from '../types/api';

const STATUS_COLORS: Record<string, string> = {
  accepted: 'bg-emerald-100 text-emerald-700',
  sent:     'bg-blue-100 text-blue-700',
  pending:  'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function ResponseDispatch() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dispatch', 'stats'],
    queryFn: () => dispatchApi.getStats(),
    staleTime: 60_000,
  });

  const { data: dispatches, isLoading: loadingList } = useQuery({
    queryKey: ['dispatch', 'list'],
    queryFn: () => dispatchApi.list({ page: 1, limit: 20 }),
  });

  if (isLoading) return <FullPageSpinner />;

  const acceptancePct = stats ? (stats.platformAcceptanceRate * 100).toFixed(1) : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Response dispatch</h1>
        <span className="text-xs text-gray-400">Today's activity</span>
      </div>

      {isError && <ErrorBanner message="Failed to load dispatch data." />}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Dispatched today"        value={(stats?.dispatchedToday ?? 0).toLocaleString()} icon={Send}        color="green"  />
        <StatCard label="Avg response time"        value={stats ? `${stats.avgResponseTimeMin}m` : '—'}  icon={Clock}       color="indigo" />
        <StatCard label="Platform acceptance"      value={`${acceptancePct}%`}                            icon={CheckCircle} color="green"  />
        <StatCard label="Platforms active"         value={(stats?.byPlatform?.length ?? 0).toString()}    icon={BarChart2}   color="yellow" />
      </div>

      {/* Platform breakdown + Recent dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform breakdown */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">By platform</h2>
          {stats?.byPlatform?.length ? (
            <div className="space-y-3">
              {stats.byPlatform.map((p) => {
                const label = PLATFORM_LABELS[p.platform as PostPlatform] ?? p.platform;
                const pct = (p.acceptanceRate * 100).toFixed(0);
                const maxCount = Math.max(...stats.byPlatform.map((x) => x.count));
                const barW = maxCount > 0 ? Math.round((p.count / maxCount) * 100) : 0;
                return (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">{label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{p.count.toLocaleString()} sent</span>
                        <span className="text-emerald-600 font-medium">{pct}% accepted</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No platform data" />
          )}
        </div>

        {/* How it works */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Dispatch pipeline</h2>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Classification', desc: 'ML model labels post as misinformation or disinformation' },
              { step: '2', title: 'HITL Review',    desc: 'Analyst approves, overrides, or rejects the flagged post' },
              { step: '3', title: 'Response gen.',  desc: 'Counter-narrative drafted using Knowledge Base context' },
              { step: '4', title: 'Platform push',  desc: 'Response dispatched via platform API or webhook' },
            ].map((s) => (
              <div key={s.step} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">{s.title}</p>
                  <p className="text-[11px] text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent dispatches */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-700">Recent dispatches</h2>
        </div>
        {loadingList ? (
          <FullPageSpinner />
        ) : !dispatches?.data?.length ? (
          <EmptyState title="No dispatches yet" description="Dispatches will appear after HITL approvals." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Response excerpt</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Platform</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Lang</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Status</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dispatches.data.map((d) => (
                  <tr key={d._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="line-clamp-2 text-gray-700 leading-snug">{d.response}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {PLATFORM_LABELS[d.platform as PostPlatform] ?? d.platform}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      <span title={d.language}>{LANG_FLAGS[d.language as PostLanguage] ?? d.language}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                      {formatRelative(d.dispatchedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
