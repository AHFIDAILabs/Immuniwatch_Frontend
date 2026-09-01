import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardCheck, Radio, Bell, Network,
  ShieldCheck, Activity, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Loader2, Shield, Menu, X, Clock, TrendingUp,
} from 'lucide-react';
import {
  createViewerApi,
  type ViewerSummary, type ViewerPostFeed, type ViewerQueueItem, type ViewerAlert,
} from '../api/viewer';

// ── Constants ────────────────────────────────────────────────────────────────

type ViewKey = 'overview' | 'feed' | 'queue' | 'alerts' | 'platform';

const NAV_GROUPS = [
  {
    label: 'Monitor',
    items: [
      { key: 'overview' as ViewKey, label: 'Overview',       Icon: LayoutDashboard },
      { key: 'queue'    as ViewKey, label: 'HITL Review',    Icon: ClipboardCheck,  badge: 'queue' },
      { key: 'feed'     as ViewKey, label: 'Live Post Feed', Icon: Radio },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'alerts'   as ViewKey, label: 'Alerts',          Icon: Bell,    badge: 'alerts' },
      { key: 'platform' as ViewKey, label: 'Platform Status', Icon: Network },
    ],
  },
];

const PAGE_TITLES: Record<ViewKey, string> = {
  overview: 'Analyst Intelligence Hub',
  feed:     'Live Post Feed',
  queue:    'HITL Review Queue',
  alerts:   'Alerts',
  platform: 'Platform Status',
};

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X', facebook: 'Facebook', youtube: 'YouTube',
  bluesky: 'Bluesky', instagram: 'Instagram', submission: 'Direct Submission',
};

const PLATFORM_COLOR: Record<string, string> = {
  twitter: '#1e40af', facebook: '#005048', youtube: '#b03325',
  bluesky: '#1a6fa0', instagram: '#7b4ea0', submission: '#4a6060',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', pcm: 'Pidgin', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo',
};

const LABEL_META: Record<string, { label: string; bg: string; color: string }> = {
  misinformation: { label: 'Misinformation',    bg: 'rgba(192,57,43,0.10)',  color: '#c0392b' },
  factual:        { label: 'Factual',           bg: 'rgba(0,137,123,0.10)', color: '#00897b' },
  irrelevant:     { label: 'Irrelevant',        bg: 'rgba(74,96,96,0.10)',  color: '#4a6060' },
  pending:        { label: 'Awaiting Analysis', bg: 'rgba(217,119,6,0.10)', color: '#d97706' },
};

const SEVERITY_COLOR: Record<string, string> = {
  high: '#c0392b', medium: '#d97706', low: '#00897b', info: '#5ba4cf',
};

const STATUS_META = {
  active:   { label: 'Live',    dot: '#00897b' },
  degraded: { label: 'Slow',    dot: '#d97706' },
  waiting:  { label: 'No data', dot: '#8da8a8' },
};

function fmt(n: number)    { return n.toLocaleString(); }
function pct(n: number)    { return `${n.toFixed(1)}%`; }
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

function threatLevel(rate: number) {
  if (rate < 10)  return { label: 'LOW',      color: '#00897b', bg: 'rgba(0,137,123,0.10)' };
  if (rate < 25)  return { label: 'MODERATE', color: '#d97706', bg: 'rgba(217,119,6,0.10)' };
  if (rate < 50)  return { label: 'HIGH',     color: '#e65100', bg: 'rgba(230,81,0,0.10)'  };
  return            { label: 'CRITICAL',       color: '#c0392b', bg: 'rgba(192,57,43,0.10)' };
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function LabelChip({ label }: { label: string }) {
  const m = LABEL_META[label] ?? LABEL_META.pending;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function PlatformChip({ platform }: { platform: string }) {
  const color = PLATFORM_COLOR[platform] ?? '#4a6060';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${color}18`, color, whiteSpace: 'nowrap' }}>
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{icon}</span>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{message}</p>
    </div>
  );
}

function ViewLoader() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Loader2 className="animate-spin" style={{ width: 28, height: 28, color: 'var(--text-muted)' }} />
    </div>
  );
}

// ── View: Overview ───────────────────────────────────────────────────────────

function OverviewView({ summary }: { summary: ViewerSummary }) {
  const { stats, labels, platforms, recentPosts, connectors } = summary;
  const threat = threatLevel(stats.misinfoRate);
  const totalLabeled = labels.reduce((s, l) => s + l.count, 0) || 1;
  const totalPlatform = platforms.reduce((s, p) => s + p.count, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[
          { label: 'Posts Monitored',       value: fmt(stats.totalPosts),    sub: 'Total content analyzed', Icon: Activity, color: '#0d3d3d' },
          { label: 'Analyzed Today',         value: fmt(stats.todayPosts),    sub: 'New in last 24 h',       Icon: Clock,    color: '#005048' },
          { label: 'Pending Review',         value: fmt(stats.pendingReviews),sub: 'Awaiting analyst',       Icon: ClipboardCheck, color: '#d97706' },
          { label: 'Misinfo Rate',           value: pct(stats.misinfoRate),   sub: 'Of classified content',  Icon: AlertTriangle,  color: '#c0392b' },
        ].map(({ label, value, sub, Icon, color }) => (
          <div key={label} className="glass-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="label-caps" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</span>
              <Icon style={{ width: 15, height: 15, color, opacity: 0.6 }} />
            </div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</p>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{sub}</p>
          </div>
        ))}

        {/* Threat level card */}
        <div className="glass-card" style={{ padding: '18px 20px', borderColor: threat.color, borderWidth: 1.5 }}>
          <span className="label-caps" style={{ color: 'var(--text-muted)', fontSize: 10, display: 'block', marginBottom: 10 }}>Threat Level</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: threat.color, letterSpacing: '-0.01em' }}>{threat.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: threat.bg, color: threat.color }}>{pct(stats.misinfoRate)}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(13,61,61,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(stats.misinfoRate, 100)}%`, background: threat.color, borderRadius: 3, transition: 'width .5s' }} />
          </div>
        </div>
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 320px' }}>

        {/* Recent posts */}
        <div className="glass-card" style={{ padding: 20 }}>
          <p className="label-caps" style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 10 }}>Latest Monitored Content</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
            {recentPosts.map((post, i) => (
              <PostRow key={i} post={post} />
            ))}
          </div>
        </div>

        {/* Right col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Classification */}
          <div className="glass-card" style={{ padding: 20 }}>
            <p className="label-caps" style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 10 }}>Classification Breakdown</p>
            {labels.map(({ label, count }) => {
              const m = LABEL_META[label] ?? LABEL_META.pending;
              const share = Math.round((count / totalLabeled) * 100);
              return (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(count)} · {share}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(13,61,61,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${share}%`, background: m.color, opacity: 0.75, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Platform coverage */}
          <div className="glass-card" style={{ padding: 20 }}>
            <p className="label-caps" style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 10 }}>Platform Coverage</p>
            {platforms.map(({ platform, count }) => {
              const color = PLATFORM_COLOR[platform] ?? '#4a6060';
              const share = Math.round((count / totalPlatform) * 100);
              return (
                <div key={platform} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color }}>{PLATFORM_LABELS[platform] ?? platform}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(count)} · {share}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(13,61,61,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${share}%`, background: color, opacity: 0.75, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Connectors */}
      <div className="glass-card" style={{ padding: 20 }}>
        <p className="label-caps" style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 10 }}>Live Data Sources</p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {connectors.map(({ platform, status: s, eventsPerMin, lastEventAt }) => {
            const sm  = STATUS_META[s] ?? STATUS_META.waiting;
            const col = PLATFORM_COLOR[platform] ?? '#4a6060';
            return (
              <div key={platform} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(13,61,61,0.03)', border: '1px solid rgba(13,61,61,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{PLATFORM_LABELS[platform] ?? platform}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: sm.dot }}>{sm.label}</span>
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                  {s === 'active' ? `${eventsPerMin} posts/min` : lastEventAt ? `Last: ${timeAgo(lastEventAt)}` : 'No data yet'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── View: Feed ───────────────────────────────────────────────────────────────

function FeedView({ api }: { api: ReturnType<typeof createViewerApi> }) {
  const [feed,    setFeed]    = useState<ViewerPostFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try { setFeed(await api.getPosts(p)); } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { void load(page); }, [load, page]);

  if (loading && !feed) return <ViewLoader />;

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(13,61,61,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>All Monitored Posts</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            {feed ? `${fmt(feed.total)} total · page ${feed.page}` : ''}
          </p>
        </div>
        {loading && <Loader2 style={{ width: 16, height: 16, color: 'var(--text-muted)' }} className="animate-spin" />}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(13,61,61,0.07)' }}>
              {['Platform', 'Language', 'Classification', 'Confidence', 'Content', 'Ingested'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {feed?.posts.map((post) => (
              <tr key={post._id} style={{ borderBottom: '1px solid rgba(13,61,61,0.04)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(13,61,61,0.02)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}><PlatformChip platform={post.platform} /></td>
                <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{LANGUAGE_LABELS[post.language] ?? post.language}</td>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}><LabelChip label={post.label} /></td>
                <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {post.confidence > 0 ? pct(post.confidence * 100) : '—'}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', maxWidth: 400 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                    {post.content}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(post.ingestedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {feed && feed.total > feed.limit && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(13,61,61,0.07)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(13,61,61,0.12)', background: 'transparent', color: 'var(--text-secondary)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
          >← Prev</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} of {Math.ceil(feed.total / feed.limit)}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(feed.total / feed.limit)}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(13,61,61,0.12)', background: 'transparent', color: 'var(--text-secondary)', cursor: page >= Math.ceil(feed.total / feed.limit) ? 'not-allowed' : 'pointer', opacity: page >= Math.ceil(feed.total / feed.limit) ? 0.4 : 1 }}
          >Next →</button>
        </div>
      )}
    </div>
  );
}

// ── View: Queue ──────────────────────────────────────────────────────────────

function QueueView({ api, pendingCount }: { api: ReturnType<typeof createViewerApi>; pendingCount: number }) {
  const [items,   setItems]   = useState<ViewerQueueItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try { const r = await api.getQueue(); setItems(r.reviews); } finally { setLoading(false); }
    })();
  }, [api]);

  if (loading && !items) return <ViewLoader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Pending Review Queue</p>
        {pendingCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#c0392b', color: '#fff' }}>
            {pendingCount} pending
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
        Posts the AI has flagged with low confidence, queued for a human analyst to verify before any response is issued.
      </p>

      {items?.length === 0 && (
        <EmptyState icon={<CheckCircle style={{ width: 40, height: 40 }} />} message="No posts pending review right now" />
      )}

      {items?.map((item) => {
        const post     = item.postId;
        const priority = item.priority === 'high' ? { bg: 'rgba(192,57,43,0.10)', color: '#c0392b', label: 'High Priority' } : { bg: 'rgba(217,119,6,0.10)', color: '#d97706', label: 'Standard' };
        return (
          <div key={item._id} className="glass-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {post && <PlatformChip platform={post.platform} />}
              {post && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{LANGUAGE_LABELS[post.language] ?? post.language}</span>}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: priority.bg, color: priority.color }}>{priority.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                <Clock style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />
                {timeAgo(item.createdAt)}
              </span>
            </div>
            {post && (
              <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                {post.content}
              </p>
            )}
            {item.proposedResponse && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,137,123,0.05)', border: '1px solid rgba(0,137,123,0.12)', marginBottom: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#00897b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Proposed Counter-narrative</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.proposedResponse}</p>
              </div>
            )}
            {/* View-only — no action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield style={{ width: 11, height: 11, color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting analyst decision — view only</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── View: Alerts ─────────────────────────────────────────────────────────────

function AlertsView({ api }: { api: ReturnType<typeof createViewerApi> }) {
  const [alerts,  setAlerts]  = useState<ViewerAlert[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try { const r = await api.getAlerts(); setAlerts(r.alerts); } finally { setLoading(false); }
    })();
  }, [api]);

  if (loading && !alerts) return <ViewLoader />;

  const TRIGGER_LABEL: Record<string, string> = {
    surge: 'Volume Surge', psi_drift: 'Model Drift', model_update: 'Model Update',
    connector_error: 'Connector Error', override_rate: 'High Override Rate',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
        Active Alerts
        {alerts && alerts.length > 0 && (
          <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#c0392b', color: '#fff' }}>{alerts.length}</span>
        )}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>System-generated alerts that have not yet been resolved by an analyst.</p>

      {alerts?.length === 0 && (
        <EmptyState icon={<CheckCircle style={{ width: 40, height: 40 }} />} message="No active alerts — system is running normally" />
      )}

      {alerts?.map((alert) => {
        const sev = SEVERITY_COLOR[alert.severity] ?? '#8da8a8';
        return (
          <div key={alert._id} className="glass-card" style={{ padding: 18, borderLeft: `3px solid ${sev}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${sev}18`, color: sev, textTransform: 'capitalize' }}>
                    {alert.severity}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 5, background: 'rgba(13,61,61,0.05)' }}>
                    {TRIGGER_LABEL[alert.triggerType] ?? alert.triggerType}
                  </span>
                  {alert.platform && <PlatformChip platform={alert.platform} />}
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{alert.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{alert.message}</p>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(alert.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── View: Platform Status ────────────────────────────────────────────────────

function PlatformView({ summary }: { summary: ViewerSummary }) {
  const { connectors, platforms } = summary;
  const totalPlatform = platforms.reduce((s, p) => s + p.count, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Connector grid */}
      <div className="glass-card" style={{ padding: 20 }}>
        <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Ingestion Connector Health</p>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {connectors.map(({ platform, status: s, eventsPerMin, lastEventAt }) => {
            const sm  = STATUS_META[s] ?? STATUS_META.waiting;
            const col = PLATFORM_COLOR[platform] ?? '#4a6060';
            const StatusIcon = s === 'active' ? CheckCircle : s === 'degraded' ? AlertTriangle : XCircle;
            return (
              <div key={platform} style={{ padding: '16px', borderRadius: 12, border: `1px solid ${col}28`, background: `${col}06` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: col }}>{PLATFORM_LABELS[platform] ?? platform}</span>
                  <StatusIcon style={{ width: 16, height: 16, color: sm.dot }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                    {s === 'active' ? eventsPerMin : '—'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s === 'active' ? 'posts/min' : ''}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: sm.dot }}>
                  {sm.label}
                  {s !== 'active' && lastEventAt ? ` · last ${timeAgo(lastEventAt)}` : ''}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform volume */}
      <div className="glass-card" style={{ padding: 20 }}>
        <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Volume by Platform</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {platforms.map(({ platform, count }) => {
            const color = PLATFORM_COLOR[platform] ?? '#4a6060';
            const share = Math.round((count / totalPlatform) * 100);
            return (
              <div key={platform}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{PLATFORM_LABELS[platform] ?? platform}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(count)} posts · {share}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 4, background: 'rgba(13,61,61,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${share}%`, background: color, opacity: 0.75, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend context */}
      <div className="glass-card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <TrendingUp style={{ width: 32, height: 32, color: '#00897b', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Active Monitoring</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 520 }}>
            ImmuniWatch continuously monitors content across all connected platforms. When a connector shows "Slow" or "No data",
            analysts are automatically alerted so the connection can be restored promptly.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared PostRow ────────────────────────────────────────────────────────────

function PostRow({ post }: { post: ViewerSummary['recentPosts'][number] }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(13,61,61,0.025)', border: '1px solid rgba(13,61,61,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PLATFORM_COLOR[post.platform] ?? '#4a6060', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{PLATFORM_LABELS[post.platform] ?? post.platform}</span>
        {post.language && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '1px 5px', borderRadius: 4, background: 'rgba(13,61,61,0.05)' }}>
            {LANGUAGE_LABELS[post.language] ?? post.language}
          </span>
        )}
        <LabelChip label={post.label} />
        {post.confidence > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{Math.round(post.confidence * 100)}% confidence</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(post.ingestedAt)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
        {post.content}
      </p>
    </div>
  );
}

// ── Root page ────────────────────────────────────────────────────────────────

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();
  const api = useRef(token ? createViewerApi(token) : null);

  const [pageStatus,  setPageStatus]  = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [summary,     setSummary]     = useState<ViewerSummary | null>(null);
  const [activeView,  setActiveView]  = useState<ViewKey>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadSummary = useCallback(async (spinner = false) => {
    if (!api.current) { setPageStatus('invalid'); return; }
    if (spinner) setRefreshing(true);
    try {
      const s = await api.current.getSummary();
      setSummary(s);
      setLastUpdated(new Date());
      setPageStatus('ready');
    } catch (err: unknown) {
      console.error('[ViewerPage] getSummary failed:', err);
      if (pageStatus === 'loading') setPageStatus('invalid');
    } finally {
      setRefreshing(false);
    }
  }, [pageStatus]);

  useEffect(() => {
    void loadSummary();
    const id = setInterval(() => { void loadSummary(); }, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading / Invalid ───────────────────────────────────────────────────────

  if (pageStatus === 'loading') return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: '#0d3d3d', opacity: 0.5 }} />
    </div>
  );

  if (pageStatus === 'invalid') return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(192,57,43,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Shield style={{ width: 24, height: 24, color: '#c0392b' }} />
      </div>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0d3d3d' }}>Invalid or expired link</h1>
      <p style={{ margin: 0, fontSize: 13, color: '#6b8f8f', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        This view-only link is not recognised. Contact the platform administrator for a valid link.
      </p>
    </div>
  );

  // ── Ready ───────────────────────────────────────────────────────────────────

  const pendingCount = summary?.stats.pendingReviews ?? 0;
  const alertBadge   = 0; // loaded per-view

  const BADGE_MAP: Record<string, number> = { queue: pendingCount, alerts: alertBadge };

  // ── Sidebar content ─────────────────────────────────────────────────────────

  const sidebarContent = (
    <aside className="sidebar-primary" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(167,243,208,0.22), rgba(167,243,208,0.10))', border: '1px solid rgba(167,243,208,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck style={{ width: 18, height: 18, color: '#fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>ImmuniWatch</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>View-Only Access</div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="vw-mobile-only" style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Live badge */}
      <div style={{ margin: '12px', padding: '8px 12px', borderRadius: 10, background: 'rgba(0,137,123,0.10)', border: '1px solid rgba(0,137,123,0.18)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00897b', flexShrink: 0, animation: 'pulse-dot 2s ease-in-out infinite' }} />
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#4db6ac', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live Dashboard</p>
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {lastUpdated ? `Refreshed ${timeAgo(lastUpdated.toISOString())}` : 'Loading…'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 12px 12px' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <div style={{ padding: '0 12px', marginBottom: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              {group.label}
            </div>
            {group.items.map(({ key, label, Icon, badge }) => {
              const isActive = activeView === key;
              const cnt = badge ? BADGE_MAP[badge] ?? 0 : 0;
              return (
                <button
                  key={key}
                  onClick={() => { setActiveView(key); setSidebarOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '8px 12px', borderRadius: 10, marginBottom: 2,
                    border: isActive ? '1px solid rgba(167,243,208,0.12)' : '1px solid transparent',
                    background: isActive ? 'rgba(167,243,208,0.13)' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.52)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.80)'; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.52)'; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isActive ? 'rgba(167,243,208,0.16)' : 'transparent' }}>
                    <Icon style={{ width: 15, height: 15, color: isActive ? '#a7f3d0' : 'rgba(255,255,255,0.48)' }} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1 }}>{label}</span>
                  {cnt > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: '#c0392b', color: '#fff', lineHeight: 1 }}>
                      {cnt > 99 ? '99+' : cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(167,243,208,0.12)', border: '1px solid rgba(167,243,208,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Shield style={{ width: 14, height: 14, color: '#a7f3d0' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>Secure View-Only Link</p>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>No login required · Read only</p>
          </div>
        </div>
      </div>
    </aside>
  );

  // ── Full layout ─────────────────────────────────────────────────────────────

  return (
    <div className="app-bg" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
        .view-content-scroll::-webkit-scrollbar { width: 4px; }
        .view-content-scroll::-webkit-scrollbar-track { background: transparent; }
        .view-content-scroll::-webkit-scrollbar-thumb { background: rgba(13,61,61,.12); border-radius: 2px; }
        .view-content-scroll table tr:last-child { border-bottom: none; }
        @media (prefers-reduced-motion: reduce) { [style*="animation"] { animation: none !important; } }

        .vw-mobile-only  { display: flex; }
        .vw-desktop-only { display: none; }
        .vw-sidebar-desktop { display: none !important; }
        .vw-mobile-overlay  { position: fixed; inset: 0; z-index: 40; }

        @media (min-width: 768px) {
          .vw-mobile-only  { display: none !important; }
          .vw-desktop-only { display: flex; }
          .vw-sidebar-desktop { display: flex !important; flex-direction: column; flex-shrink: 0; }
          .vw-mobile-overlay  { display: none !important; }
        }
      `}</style>

      {/* Desktop sidebar */}
      <div className="vw-sidebar-desktop" style={{ width: 260, minHeight: '100vh', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="vw-mobile-overlay">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 280, zIndex: 50 }}>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header className="glass-topbar" style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, zIndex: 10 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="vw-mobile-only"
            style={{ padding: 8, borderRadius: 8, border: 'none', background: 'transparent', color: '#404848', cursor: 'pointer', flexShrink: 0 }}
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>

          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1a1c1c', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {PAGE_TITLES[activeView]}
          </span>

          {/* Live rate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, background: 'rgba(0,107,95,0.08)', border: '1px solid rgba(0,107,95,0.15)', flexShrink: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00897b', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#00897b' }}>
              {summary ? `${fmt(summary.stats.todayPosts)} today` : 'Live'}
            </span>
          </div>

          {/* Refresh */}
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#8da8a8', flexShrink: 0 }} className="vw-desktop-only">
              {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <button
            onClick={() => void loadSummary(true)}
            disabled={refreshing}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(13,61,61,0.12)', background: 'transparent', cursor: refreshing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#707978', flexShrink: 0, opacity: refreshing ? 0.5 : 1 }}
          >
            <RefreshCw style={{ width: 15, height: 15 }} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* View-only badge */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(0,137,123,0.08)', color: '#00897b', border: '1px solid rgba(0,137,123,0.18)', letterSpacing: '0.03em', flexShrink: 0 }}>
            <Shield style={{ width: 11, height: 11 }} />
            Read Only
          </span>
        </header>

        {/* View content */}
        <main className="view-content-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeView === 'overview'  && summary && <OverviewView summary={summary} />}
          {activeView === 'feed'      && api.current && <FeedView api={api.current} />}
          {activeView === 'queue'     && api.current && <QueueView api={api.current} pendingCount={pendingCount} />}
          {activeView === 'alerts'    && api.current && <AlertsView api={api.current} />}
          {activeView === 'platform'  && summary && <PlatformView summary={summary} />}
        </main>
      </div>
    </div>
  );
}
