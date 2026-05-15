import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, AlertTriangle, Globe, Layers } from 'lucide-react';
import { trendsApi } from '../api/trends';
import { StatCard } from '../components/StatCard';
import { LabelBadge } from '../components/Badge';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { LANG_LABELS } from '../lib/utils';
import type { PostLanguage } from '../types/api';

const LANG_COLORS: Record<string, string> = {
  en:  '#1D9E75',
  pcm: '#185FA5',
  ha:  '#E24B4A',
  yo:  '#D4537E',
  ig:  '#F59E0B',
};

const LANG_ORDER: PostLanguage[] = ['en', 'pcm', 'ha', 'yo', 'ig'];

export default function TrendAnalysis() {
  const { data: daily, isLoading, isError } = useQuery({
    queryKey: ['trends', 'daily-misinformation'],
    queryFn: () => trendsApi.dailyMisinformation(30),
  });

  const { data: breakdown } = useQuery({
    queryKey: ['trends', 'classification-breakdown'],
    queryFn: () => trendsApi.classificationBreakdown(7),
  });

  const { data: narratives } = useQuery({
    queryKey: ['trends', 'top-narratives'],
    queryFn: () => trendsApi.topNarratives(7, 8),
  });

  const { data: langData } = useQuery({
    queryKey: ['trends', 'language-distribution'],
    queryFn: () => trendsApi.languageDistribution(),
  });

  const totalPosts = breakdown?.reduce((s: number, b: { count: number }) => s + b.count, 0) ?? 0;
  const flagged = breakdown
    ? breakdown
        .filter((b: { label: string }) => b.label === 'misinformation' || b.label === 'disinformation')
        .reduce((s: number, b: { count: number }) => s + b.count, 0)
    : 0;
  const flagRate = totalPosts > 0 ? ((flagged / totalPosts) * 100).toFixed(1) : '0.0';

  const peakDay = daily?.reduce(
    (max: { count: number; date: string } | null, d: { count: number; date: string }) =>
      !max || d.count > max.count ? d : max,
    null,
  );

  const langTotal = langData?.reduce((s: number, l: { count: number }) => s + l.count, 0) ?? 0;
  const langRows = LANG_ORDER.map((code) => {
    const entry = langData?.find((l: { _id: string }) => l._id === code);
    const count = entry?.count ?? 0;
    return {
      code,
      label: LANG_LABELS[code],
      count,
      pct: langTotal > 0 ? Math.round((count / langTotal) * 100) : 0,
    };
  }).filter((r) => r.pct > 0);

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Trend analysis</h1>
        <span className="text-xs text-gray-400">Last 30 days</span>
      </div>

      {isError && <ErrorBanner message="Failed to load trend data." />}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Posts analysed (7d)" value={totalPosts.toLocaleString()} icon={Layers} color="indigo" />
        <StatCard label="Flagged (7d)" value={flagged.toLocaleString()} icon={AlertTriangle} color="red" />
        <StatCard label="Flag rate (7d)" value={`${flagRate}%`} icon={TrendingUp} color="yellow" />
        <StatCard label="Languages tracked" value={langRows.length.toString()} icon={Globe} color="green" />
      </div>

      {/* 30-day misinformation volume */}
      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Misinformation volume — 30 days</h2>
        {daily?.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={daily.map((d: { date: string; count: number }, i: number) => ({ ...d, day: i + 1 }))}
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="misGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E24B4A" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#E24B4A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickFormatter={(v: number) => `D${v}`}
                interval={1}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                width={40}
                allowDecimals={false}
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
                formatter={(v: unknown) => [typeof v === 'number' ? v.toLocaleString() : v, 'Flagged posts']}
                labelFormatter={(day: number) => {
                  const entry = daily[day - 1];
                  if (!entry) return `Day ${day}`;
                  const [yr, m, dd] = entry.date.split('-');
                  return `${parseInt(dd)}/${parseInt(m)}/${yr}`;
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#E24B4A"
                strokeWidth={2}
                fill="url(#misGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#E24B4A' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No trend data" description="Data will appear as posts are classified." />
        )}
        {peakDay && peakDay.count > 0 && (
          <p className="text-[11px] text-gray-400 mt-2">
            Peak: <strong className="text-gray-600">{peakDay.count.toLocaleString()} posts</strong> on{' '}
            {(() => { const [yr, m, dd] = peakDay.date.split('-'); return `${parseInt(dd)}/${parseInt(m)}/${yr}`; })()}
          </p>
        )}
      </div>

      {/* Language bar chart + Narratives */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mis rate by language */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Post volume by language</h2>
          {langRows.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={langRows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={28} unit="%" />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [typeof v === 'number' ? `${v}%` : '', 'Share']}
                />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {langRows.map((row) => (
                    <Cell key={row.code} fill={LANG_COLORS[row.code] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No language data" />
          )}
        </div>

        {/* Emerging narrative clusters */}
        <div className="glass-card p-4">
          <h2 className="text-xs font-semibold text-gray-700 mb-3">Emerging narratives (7 days)</h2>
          {narratives?.length ? (
            <div className="space-y-2">
              {narratives.map((n: { narrative: string; count: number; label: string }, i: number) => (
                <div key={n.narrative} className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug line-clamp-2">{n.narrative}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <LabelBadge label={n.label as never} />
                      <span className="text-[10px] text-gray-400">{n.count} posts</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No narratives yet" />
          )}
        </div>
      </div>
    </div>
  );
}
