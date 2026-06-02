import { useQuery } from '@tanstack/react-query';
import {
  FileText, AlertTriangle, Clock, Send,
  CheckSquare, BarChart2, Users, ShieldAlert,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { SeverityBadge } from '../components/Badge';
import { LabelBadge } from '../components/Badge';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { FallbackModeAlert } from '../components/FallbackModeAlert';
import { RetrainingProgressBanner } from '../components/RetrainingProgressBanner';
import { ErrorBanner } from '../components/ErrorBanner';
import { trendsApi } from '../api/trends';
import { alertsApi } from '../api/alerts';
import { modelHealthApi } from '../api/modelHealth';
import { hitlApi } from '../api/hitl';
import { dispatchApi } from '../api/dispatch';
import { useAuth } from '../context/AuthContext';
import { formatRelative, LANG_LABELS, PLATFORM_LABELS } from '../lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { Alert, PostLanguage, PostPlatform } from '../types/api';

// ── Mini sparkbar used in the narratives table ────────────────────────────────
function SparkBar({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const W = 5, G = 2, H = 20;
  const svgW = data.length * W + (data.length - 1) * G;
  return (
    <svg width={svgW} height={H} className="inline-block align-middle">
      {data.map((v, i) => {
        const bh = Math.max(2, Math.round((v / max) * H));
        return (
          <rect
            key={i}
            x={i * (W + G)} y={H - bh}
            width={W} height={bh}
            fill={v === max && max > 0 ? '#059669' : '#d1fae5'}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
const LANG_ORDER: PostLanguage[] = ['en', 'pcm', 'ha', 'yo', 'ig'];

// ── Analyst view ──────────────────────────────────────────────────────────────

function AnalystView() {
  const { data: breakdown, isLoading } = useQuery({
    queryKey: ['trends', 'classification-breakdown'],
    queryFn: () => trendsApi.classificationBreakdown(1),
  });

  const { data: hitlPending } = useQuery({
    queryKey: ['hitl', 'pending-count'],
    queryFn: () => hitlApi.list({ page: 1, limit: 1, status: 'pending' }),
    staleTime: 30_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', { resolved: false, severity: 'high' }],
    queryFn: () => alertsApi.list({ resolved: false, limit: 3 }),
  });

  const { data: narratives } = useQuery({
    queryKey: ['trends', 'top-narratives'],
    queryFn: () => trendsApi.topNarratives(7, 5),
  });

  const totalToday = breakdown?.reduce((s: number, b: { count: number }) => s + b.count, 0) ?? 0;
  const flaggedToday = breakdown
    ? breakdown
        .filter((b: { label: string }) => b.label === 'misinformation' || b.label === 'disinformation')
        .reduce((s: number, b: { count: number }) => s + b.count, 0)
    : 0;
  const highAlerts = (alertsData?.data ?? []).filter((a: Alert) => a.severity === 'high');

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Posts ingested today"   value={totalToday.toLocaleString()}              icon={FileText}     color="indigo" />
        <StatCard label="Flagged today"          value={flaggedToday.toLocaleString()}            icon={AlertTriangle} color="red"   />
        <StatCard label="Awaiting HITL review"  value={(hitlPending?.total ?? 0).toLocaleString()} icon={Clock}       color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* High-severity alerts */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">High-severity alerts</h2>
          {highAlerts.length ? (
            <div className="space-y-2">
              {highAlerts.map((alert: Alert) => (
                <div key={alert._id} className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-red-50 border-red-200 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 bg-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 leading-snug">{alert.title}</p>
                    <p className="text-gray-500 mt-0.5 truncate">{alert.message}</p>
                  </div>
                  <span className="text-gray-400 whitespace-nowrap flex-shrink-0">{formatRelative(alert.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No high-severity alerts" description="All clear." />
          )}
        </div>

        {/* Top narratives */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Top narratives (7 days)</h2>
          {narratives?.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                  <th className="text-left pb-2 w-6">#</th>
                  <th className="text-left pb-2">Claim</th>
                  <th className="text-right pb-2 w-12">Posts</th>
                  <th className="text-right pb-2 w-16">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {narratives.map((n: { narrative: string; count: number; label: string }, i: number) => (
                  <tr key={n.narrative} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-400 font-bold">{i + 1}</td>
                    <td className="py-2 text-gray-800 pr-2">
                      <p className="line-clamp-2 leading-snug">{n.narrative}</p>
                    </td>
                    <td className="py-2 text-right font-medium text-gray-700">{n.count}</td>
                    <td className="py-2 text-right"><LabelBadge label={n.label as never} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No narratives yet" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Senior Analyst view ───────────────────────────────────────────────────────

function SeniorAnalystView() {
  const { data: myStats, isLoading } = useQuery({
    queryKey: ['hitl', 'my-stats'],
    queryFn: () => hitlApi.myStats(),
    staleTime: 30_000,
  });

  const { data: dispatchStats } = useQuery({
    queryKey: ['dispatch', 'stats'],
    queryFn: () => dispatchApi.getStats(),
    staleTime: 60_000,
  });

  const { data: narratives } = useQuery({
    queryKey: ['trends', 'top-narratives'],
    queryFn: () => trendsApi.topNarratives(7, 5),
  });

  if (isLoading) return <FullPageSpinner />;

  const pendingHigh     = 0; // derived from myStats.pendingTotal — split not available at this level
  const pendingStandard = myStats?.pendingTotal ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="My reviews today"     value={(myStats?.reviewedToday   ?? 0).toString()} icon={CheckSquare}  color="green"  />
        <StatCard label="My reviews this week" value={(myStats?.reviewedThisWeek ?? 0).toString()} icon={BarChart2}   color="indigo" />
        <StatCard label="My override rate"     value={`${myStats?.overrideRate ?? 0}%`}           icon={AlertTriangle} color="yellow" />
        <StatCard label="Responses dispatched" value={(dispatchStats?.dispatchedToday ?? 0).toLocaleString()} icon={Send} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Queue priority breakdown */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Queue — pending items</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                <span className="text-gray-600">High priority</span>
              </div>
              <span className="font-semibold text-gray-900">{pendingHigh}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                <span className="text-gray-600">Standard priority</span>
              </div>
              <span className="font-semibold text-gray-900">{pendingStandard}</span>
            </div>
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Total pending</span>
              <span className="font-bold text-gray-900">{myStats?.pendingTotal ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Top narratives */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Top narratives (7 days)</h2>
          {narratives?.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wide text-[10px]">
                  <th className="text-left pb-2 w-6">#</th>
                  <th className="text-left pb-2">Claim</th>
                  <th className="text-right pb-2 w-12">Posts</th>
                  <th className="text-right pb-2 w-16">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {narratives.map((n: { narrative: string; count: number; label: string }, i: number) => (
                  <tr key={n.narrative} className="hover:bg-gray-50">
                    <td className="py-2 text-gray-400 font-bold">{i + 1}</td>
                    <td className="py-2 text-gray-800 pr-2">
                      <p className="line-clamp-2 leading-snug">{n.narrative}</p>
                    </td>
                    <td className="py-2 text-right font-medium text-gray-700">{n.count}</td>
                    <td className="py-2 text-right"><LabelBadge label={n.label as never} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No narratives yet" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Supervisor view ───────────────────────────────────────────────────────────

function SupervisorView() {
  const { data: teamStats, isLoading } = useQuery({
    queryKey: ['hitl', 'team-stats'],
    queryFn: () => hitlApi.teamStats(),
    staleTime: 30_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', { resolved: false }],
    queryFn: () => alertsApi.list({ resolved: false, limit: 4 }),
  });

  const { data: dispatchStats } = useQuery({
    queryKey: ['dispatch', 'stats'],
    queryFn: () => dispatchApi.getStats(),
    staleTime: 60_000,
  });

  const recentAlerts: Alert[] = alertsData?.data ?? [];

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Team reviews today"    value={(teamStats?.reviewedToday   ?? 0).toString()} icon={CheckSquare}  color="green"  />
        <StatCard label="Team override rate"    value={`${teamStats?.overrideRate ?? 0}%`}           icon={AlertTriangle} color="yellow" />
        <StatCard label="Active alerts"         value={(recentAlerts.length).toString()}              icon={ShieldAlert}  color="red"    />
        <StatCard label="Responses dispatched"  value={(dispatchStats?.dispatchedToday ?? 0).toLocaleString()} icon={Send} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active alerts */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Active alerts</h2>
          {recentAlerts.length ? (
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${
                    alert.severity === 'high'
                      ? 'bg-red-50 border-red-200'
                      : alert.severity === 'medium'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                    alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 leading-snug">{alert.title}</p>
                    <p className="text-gray-500 mt-0.5 truncate">{alert.message}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-gray-400 whitespace-nowrap">{formatRelative(alert.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No open alerts" description="All clear." />
          )}
        </div>

        {/* Top reviewers + queue breakdown */}
        <div className="glass-card p-4 space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-700 mb-2">Top reviewers today</h2>
            {teamStats?.topReviewers?.length ? (
              <div className="space-y-2">
                {teamStats.topReviewers.map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-gray-700">{r.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{r.count} reviews</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No reviews recorded today.</p>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <h2 className="text-xs font-semibold text-gray-700 mb-2">Pending queue</h2>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> High priority
                </span>
                <span className="font-semibold text-gray-900">{teamStats?.pendingHigh ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> Standard
                </span>
                <span className="font-semibold text-gray-900">{teamStats?.pendingStandard ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Super Admin view (full overview) ─────────────────────────────────────────

type DailyEntry = {
  day: string; date: string;
  misinformation: number; disinformation: number; factual: number; irrelevant: number;
};

function SuperAdminView() {
  const { data: dailyBreakdown, isLoading: loadingBreakdown, isError: breakdownError } = useQuery({
    queryKey: ['trends', 'daily-breakdown'],
    queryFn:  () => trendsApi.dailyBreakdown(7),
  });

  const { data: narratives, isError: narrativesError } = useQuery({
    queryKey: ['trends', 'top-narratives'],
    queryFn:  () => trendsApi.topNarratives(7, 5),
  });

  const { data: platformData } = useQuery({
    queryKey: ['trends', 'platform-ingestion'],
    queryFn:  () => trendsApi.platformIngestion(),
  });

  const { data: langData } = useQuery({
    queryKey: ['trends', 'language-distribution'],
    queryFn:  () => trendsApi.languageDistribution(),
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', { resolved: false }],
    queryFn:  () => alertsApi.list({ resolved: false, limit: 4 }),
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn:  () => modelHealthApi.getPipelineStatus(),
    refetchInterval: 30_000,
  });

  const { data: hitlPending } = useQuery({
    queryKey: ['hitl', 'pending-count'],
    queryFn:  () => hitlApi.list({ page: 1, limit: 1, status: 'pending' }),
    staleTime: 30_000,
  });

  const { data: dispatchStats } = useQuery({
    queryKey: ['dispatch', 'stats'],
    queryFn:  () => dispatchApi.getStats(),
    staleTime: 60_000,
  });

  const { data: teamStats } = useQuery({
    queryKey: ['hitl', 'team-stats'],
    queryFn:  () => hitlApi.teamStats(),
    staleTime: 30_000,
  });

  const typedDaily = (dailyBreakdown ?? []) as DailyEntry[];
  const today       = typedDaily[typedDaily.length - 1];
  const todayTotal  = today
    ? today.misinformation + today.disinformation + today.factual + today.irrelevant
    : 0;
  const flaggedCount = typedDaily.reduce((s, d) => s + d.misinformation + d.disinformation, 0);

  const recentAlerts: Alert[] = alertsData?.data ?? [];

  const platformTotal = platformData?.reduce((s: number, p: { count: number }) => s + p.count, 0) ?? 0;
  const platformRows  = (platformData ?? []).slice(0, 4).map((p: { _id: string; count: number }) => ({
    label: PLATFORM_LABELS[p._id as PostPlatform] ?? p._id,
    count: p.count,
    pct:   platformTotal > 0 ? Math.round((p.count / platformTotal) * 100) : 0,
  }));

  const langTotal = langData?.reduce((s: number, l: { count: number }) => s + l.count, 0) ?? 0;
  const langRows  = LANG_ORDER.map((code) => {
    const entry = langData?.find((l: { _id: string }) => l._id === code);
    const count = entry?.count ?? 0;
    return { code, label: LANG_LABELS[code], pct: langTotal > 0 ? Math.round((count / langTotal) * 100) : 0 };
  }).filter((r) => r.pct > 0);

  if (loadingBreakdown) return <FullPageSpinner />;

  return (
    <div className="space-y-4">
      {(breakdownError || narrativesError) && (
        <ErrorBanner message="Failed to load some dashboard data." />
      )}
      {pipeline?.status === 'fallback'   && <FallbackModeAlert />}
      {pipeline?.status === 'retraining' && pipeline.retrainingStartedAt && (
        <RetrainingProgressBanner startedAt={pipeline.retrainingStartedAt} />
      )}

      {/* Stats row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Posts ingested today"  value={todayTotal.toLocaleString()}                            icon={FileText}      color="indigo" />
        <StatCard label="Flagged (7 days)"      value={flaggedCount.toLocaleString()}                          icon={AlertTriangle} color="red"    />
        <StatCard label="Awaiting HITL review"  value={(hitlPending?.total ?? 0).toLocaleString()}             icon={Clock}         color="yellow" />
        <StatCard label="Responses dispatched"  value={(dispatchStats?.dispatchedToday ?? 0).toLocaleString()} icon={Send}          color="green"  />
      </div>

      {/* Stats row 2 — team */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Team reviews today"  value={(teamStats?.reviewedToday   ?? 0).toString()}         icon={CheckSquare} color="emerald" />
        <StatCard label="Team override rate"  value={`${teamStats?.overrideRate ?? 0}%`}                   icon={BarChart2}   color="yellow"  />
        <StatCard label="Pending (high)"      value={(teamStats?.pendingHigh    ?? 0).toString()}           icon={ShieldAlert} color="red"     />
        <StatCard label="Active reviewers"    value={(teamStats?.topReviewers?.length ?? 0).toString()}     icon={Users}       color="indigo"  />
      </div>

      {/* 7-day classification breakdown — full width stacked bar */}
      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">7-day classification breakdown</h2>
        {typedDaily.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typedDaily} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={42} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
                formatter={(v: unknown, name: unknown) => [
                  typeof v === 'number' ? v.toLocaleString() : String(v),
                  String(name).charAt(0).toUpperCase() + String(name).slice(1),
                ] as [string, string]}
              />
              <Legend iconSize={8} iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="misinformation" stackId="a" fill="#E24B4A" name="Misinformation" />
              <Bar dataKey="disinformation" stackId="a" fill="#D4537E" name="Disinformation" />
              <Bar dataKey="irrelevant"     stackId="a" fill="#9ca3af" name="Irrelevant"     />
              <Bar dataKey="factual"        stackId="a" fill="#1D9E75" name="Factual"         radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No classification data yet" />
        )}
      </div>

      {/* Top narratives + platform/language */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top narratives with trend */}
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Top narratives (7 days)</h2>
          {narratives?.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wide text-[10px] border-b border-gray-100">
                  <th className="text-left pb-2 pr-2 w-6">#</th>
                  <th className="text-left pb-2">Claim cluster</th>
                  <th className="text-right pb-2 w-14">Posts</th>
                  <th className="text-right pb-2 w-16">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {narratives.map((n: { narrative: string; count: number; label: string; trend?: number[] }, i: number) => (
                  <tr key={n.narrative} className="hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400 font-bold pr-2">{i + 1}</td>
                    <td className="py-2.5 text-gray-800 pr-3">
                      <p className="line-clamp-1 leading-snug">{n.narrative}</p>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-gray-700 tabular-nums">
                      {n.count.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right">
                      <SparkBar data={n.trend ?? Array(7).fill(0)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No narratives yet" />
          )}
        </div>

        {/* Platform + Language */}
        <div className="glass-card p-4 space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-700 mb-2">Platform ingestion today</h2>
            {platformRows.length ? (
              <div className="space-y-2">
                {platformRows.map((p) => (
                  <div key={p.label} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 w-28">{p.label}</span>
                    <span className="font-medium text-gray-900 w-16 text-right">{p.count.toLocaleString()}</span>
                    <span className="text-gray-400 w-10 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No ingestion data for today.</p>
            )}
          </div>
          <div>
            <h2 className="text-xs font-semibold text-gray-700 mb-2">Language distribution</h2>
            {langRows.length ? (
              <div className="space-y-1.5">
                {langRows.map((l) => (
                  <div key={l.code} className="flex items-center gap-2 text-xs">
                    <span className="w-14 text-gray-500">{l.label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${l.pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-gray-400">{l.pct}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No language data for today.</p>
            )}
          </div>
        </div>
      </div>

      {/* Alerts + Top reviewers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Active alerts</h2>
          {recentAlerts.length ? (
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${
                    alert.severity === 'high'   ? 'bg-red-50 border-red-200'
                    : alert.severity === 'medium' ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                    alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 leading-snug">{alert.title}</p>
                    <p className="text-gray-500 mt-0.5 truncate">{alert.message}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-gray-400 whitespace-nowrap">{formatRelative(alert.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No open alerts" description="All clear." />
          )}
        </div>

        {teamStats?.topReviewers?.length ? (
          <div className="glass-card p-4">
            <h2 className="text-xs font-semibold text-gray-700 mb-3">Top reviewers today</h2>
            <div className="space-y-2">
              {teamStats.topReviewers.map((r, i) => (
                <div key={r.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">{r.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{r.count} reviews</span>
                </div>
              ))}
            </div>
          </div>
        ) : <div />}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return <FullPageSpinner />;

  if (user.role === 'analyst')        return <AnalystView />;
  if (user.role === 'senior_analyst') return <SeniorAnalystView />;
  if (user.role === 'supervisor')     return <SupervisorView />;
  return <SuperAdminView />;
}
