import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle, Clock, Eye, Loader2, RefreshCw, Shield, XCircle } from 'lucide-react';
import { createViewerApi, type ViewerSummary } from '../api/viewer';

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter/X', facebook: 'Facebook', youtube: 'YouTube',
  bluesky: 'Bluesky', instagram: 'Instagram', submission: 'Submission',
};

const PLATFORM_CHIP: Record<string, { bg: string; color: string }> = {
  bluesky:    { bg: 'rgba(91,164,207,0.14)',  color: '#1a6fa0' },
  youtube:    { bg: 'rgba(192,57,43,0.12)',   color: '#b03325' },
  twitter:    { bg: 'rgba(37,99,235,0.12)',   color: '#1e40af' },
  facebook:   { bg: 'rgba(0,137,123,0.12)',   color: '#005048' },
  instagram:  { bg: 'rgba(176,139,191,0.16)', color: '#7b4ea0' },
  submission: { bg: 'rgba(74,96,96,0.10)',    color: '#4a6060' },
};

const LABEL_CHIP: Record<string, { bg: string; color: string }> = {
  misinformation: { bg: 'rgba(192,57,43,0.12)',  color: '#b03325' },
  factual:        { bg: 'rgba(0,137,123,0.12)',  color: '#005048' },
  irrelevant:     { bg: 'rgba(74,96,96,0.10)',   color: '#4a6060' },
  pending:        { bg: 'rgba(244,162,97,0.12)', color: '#a0621a' },
};

function fmt(n: number) { return n.toLocaleString(); }
function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(13,61,61,0.10)',
  borderRadius: '16px',
};

const STATUS_ICON = {
  active:   <CheckCircle className="h-3.5 w-3.5" style={{ color: '#00897b' }} />,
  degraded: <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#e67e22' }} />,
  waiting:  <XCircle className="h-3.5 w-3.5" style={{ color: '#8da8a8' }} />,
};

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();
  const api = useRef(token ? createViewerApi(token) : null);

  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [data,   setData]   = useState<ViewerSummary | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  async function load(showSpinner = false) {
    if (!api.current) { setStatus('invalid'); return; }
    if (showSpinner) setRefreshing(true);
    try {
      const summary = await api.current.getSummary();
      setData(summary);
      setLastUpdated(new Date());
      setStatus('ready');
    } catch {
      if (status === 'loading') setStatus('invalid');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Invalid / loading states ─────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0d3d3d' }} />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="app-bg min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <Shield className="h-12 w-12" style={{ color: '#b03325' }} />
        <h1 className="text-xl font-semibold" style={{ color: '#0d3d3d' }}>Invalid or expired link</h1>
        <p className="text-sm text-center max-w-sm" style={{ color: '#4a6060' }}>
          This view-only link is not recognised. Contact the platform administrator for a valid link.
        </p>
      </div>
    );
  }

  const { stats, labels, platforms, recentPosts, connectors } = data!;
  const totalPlatform = platforms.reduce((s, p) => s + p.count, 0) || 1;

  return (
    <div className="app-bg min-h-screen" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header style={{ ...glass, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold" style={{ color: '#0d3d3d', letterSpacing: '-0.02em' }}>
              ImmuniWatch
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg"
              style={{ background: 'rgba(0,137,123,0.12)', color: '#005048', border: '1px solid rgba(0,137,123,0.20)' }}>
              <Eye className="h-3 w-3" /> View Only
            </span>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs" style={{ color: '#8da8a8' }}>
                Updated {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
            <button onClick={() => void load(true)} disabled={refreshing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors"
              style={{ background: 'rgba(13,61,61,0.06)', border: '1px solid rgba(13,61,61,0.12)', color: '#4a6060' }}>
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Posts',      value: fmt(stats.totalPosts),    icon: <Activity className="h-5 w-5" />, accent: '#0d3d3d' },
            { label: 'Ingested Today',   value: fmt(stats.todayPosts),    icon: <Clock className="h-5 w-5" />,    accent: '#005048' },
            { label: 'Misinfo Rate',     value: `${stats.misinfoRate}%`,  icon: <AlertTriangle className="h-5 w-5" />, accent: '#b03325' },
            { label: 'Pending Reviews',  value: fmt(stats.pendingReviews),icon: <Shield className="h-5 w-5" />,   accent: '#a0621a' },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} style={glass} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="label-caps" style={{ color: '#8da8a8' }}>{label}</span>
                <span style={{ color: accent, opacity: 0.7 }}>{icon}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: '#0d3d3d' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Middle row: Recent Posts + Platform breakdown ────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Recent posts */}
          <div style={glass} className="lg:col-span-2 p-5">
            <p className="label-caps mb-4" style={{ color: '#8da8a8' }}>Recent Posts</p>
            <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: 420 }}>
              {recentPosts.map((post, i) => {
                const chip = PLATFORM_CHIP[post.platform] ?? { bg: 'rgba(74,96,96,0.10)', color: '#4a6060' };
                const lbl  = LABEL_CHIP[post.label]     ?? LABEL_CHIP.pending;
                return (
                  <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl"
                    style={{ background: 'rgba(13,61,61,0.03)', border: '1px solid rgba(13,61,61,0.07)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                        style={{ background: chip.bg, color: chip.color }}>
                        {PLATFORM_LABELS[post.platform] ?? post.platform}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg capitalize"
                        style={{ background: lbl.bg, color: lbl.color }}>
                        {post.label}
                      </span>
                      {post.confidence > 0 && (
                        <span className="text-[10px]" style={{ color: '#8da8a8' }}>
                          {Math.round(post.confidence * 100)}% confidence
                        </span>
                      )}
                      <span className="ml-auto text-[10px]" style={{ color: '#8da8a8' }}>
                        {timeAgo(post.ingestedAt)}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: '#0f2626' }}>
                      {post.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform + label breakdown */}
          <div className="flex flex-col gap-4">
            <div style={glass} className="p-5">
              <p className="label-caps mb-4" style={{ color: '#8da8a8' }}>By Platform</p>
              <div className="space-y-3">
                {platforms.map(({ platform, count }) => {
                  const chip = PLATFORM_CHIP[platform] ?? { bg: 'rgba(74,96,96,0.10)', color: '#4a6060' };
                  const pct  = Math.round((count / totalPlatform) * 100);
                  return (
                    <div key={platform}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: chip.color }}>
                          {PLATFORM_LABELS[platform] ?? platform}
                        </span>
                        <span className="text-xs" style={{ color: '#8da8a8' }}>{fmt(count)}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'rgba(13,61,61,0.08)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: chip.color, opacity: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={glass} className="p-5">
              <p className="label-caps mb-4" style={{ color: '#8da8a8' }}>Classification</p>
              <div className="space-y-2">
                {labels.map(({ label, count }) => {
                  const lbl = LABEL_CHIP[label] ?? LABEL_CHIP.pending;
                  return (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg capitalize"
                        style={{ background: lbl.bg, color: lbl.color }}>{label}</span>
                      <span className="text-xs font-medium" style={{ color: '#4a6060' }}>{fmt(count)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Connectors ──────────────────────────────────────────────────── */}
        <div style={glass} className="p-5">
          <p className="label-caps mb-4" style={{ color: '#8da8a8' }}>Ingestion Connectors</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {connectors.map(({ platform, status: s, eventsPerMin, lastEventAt }) => {
              const chip = PLATFORM_CHIP[platform] ?? { bg: 'rgba(74,96,96,0.10)', color: '#4a6060' };
              return (
                <div key={platform} className="flex flex-col gap-2 p-3 rounded-xl"
                  style={{ background: 'rgba(13,61,61,0.03)', border: '1px solid rgba(13,61,61,0.07)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: chip.color }}>
                      {PLATFORM_LABELS[platform] ?? platform}
                    </span>
                    {STATUS_ICON[s]}
                  </div>
                  <p className="text-[10px]" style={{ color: '#8da8a8' }}>
                    {s === 'active' ? `${eventsPerMin}/min` : lastEventAt ? timeAgo(lastEventAt) : 'No data'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-[11px] pb-4" style={{ color: '#8da8a8' }}>
          ImmuniWatch Nigeria · Read-only view · Auto-refreshes every 60 s
        </p>
      </main>
    </div>
  );
}
