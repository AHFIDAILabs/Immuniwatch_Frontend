import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createViewerApi, type ViewerSummary } from '../api/viewer';

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X', facebook: 'Facebook', youtube: 'YouTube',
  bluesky: 'Bluesky', instagram: 'Instagram', submission: 'Direct Submission',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', pcm: 'Pidgin', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo',
};

const PLATFORM_COLOR: Record<string, string> = {
  twitter: '#1e40af', facebook: '#005048', youtube: '#b03325',
  bluesky: '#1a6fa0', instagram: '#7b4ea0', submission: '#4a6060',
};

const LABEL_META: Record<string, { label: string; bg: string; color: string }> = {
  misinformation: { label: 'Misinformation',    bg: 'rgba(192,57,43,0.10)',  color: '#c0392b' },
  factual:        { label: 'Factual Content',   bg: 'rgba(0,137,123,0.10)', color: '#00897b' },
  irrelevant:     { label: 'Irrelevant',        bg: 'rgba(74,96,96,0.10)',  color: '#4a6060' },
  pending:        { label: 'Awaiting Analysis', bg: 'rgba(217,119,6,0.10)', color: '#d97706' },
};

const STATUS_META = {
  active:   { label: 'Live',     dot: '#00897b', desc: 'Receiving data'   },
  degraded: { label: 'Slow',     dot: '#d97706', desc: 'Reduced activity' },
  waiting:  { label: 'No data',  dot: '#8da8a8', desc: 'Not yet seen'     },
};

function threatLevel(rate: number): { label: string; color: string; bg: string; glow: boolean } {
  if (rate < 10)  return { label: 'LOW',      color: '#00897b', bg: 'rgba(0,137,123,0.10)',  glow: false };
  if (rate < 25)  return { label: 'MODERATE', color: '#d97706', bg: 'rgba(217,119,6,0.10)',  glow: false };
  if (rate < 50)  return { label: 'HIGH',     color: '#e65100', bg: 'rgba(230,81,0,0.10)',   glow: true  };
  return            { label: 'CRITICAL',       color: '#c0392b', bg: 'rgba(192,57,43,0.10)',  glow: true  };
}

function fmt(n: number)     { return n.toLocaleString(); }
function pct(n: number)     { return `${n.toFixed(1)}%`; }
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();
  const api = useRef(token ? createViewerApi(token) : null);

  const [status,      setStatus]      = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [data,        setData]        = useState<ViewerSummary | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  async function load(spinner = false) {
    if (!api.current) { setStatus('invalid'); return; }
    if (spinner) setRefreshing(true);
    try {
      const summary = await api.current.getSummary();
      setData(summary);
      setLastUpdated(new Date());
      setStatus('ready');
    } catch (err: unknown) {
      console.error('[ViewerPage] getSummary failed:', err);
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

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <style>{CSS}</style>
      <div className="spinner" />
    </div>
  );

  // ── Invalid ──────────────────────────────────────────────────────────────────

  if (status === 'invalid') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: 'var(--bg)' }}>
      <style>{CSS}</style>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(192,57,43,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Invalid or expired link</h1>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        This view-only link is not recognised. Contact the platform administrator for a valid link.
      </p>
    </div>
  );

  // ── Ready ─────────────────────────────────────────────────────────────────────

  const { stats, labels, platforms, recentPosts, connectors } = data!;
  const threat = threatLevel(stats.misinfoRate);
  const totalPlatformPosts = platforms.reduce((s, p) => s + p.count, 0) || 1;
  const totalLabeled = labels.reduce((s, l) => s + l.count, 0) || 1;
  const misinfoCount = labels.find(l => l.label === 'misinformation')?.count ?? 0;
  const factualCount = labels.find(l => l.label === 'factual')?.count        ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="site-header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <span className="logo-text">ImmuniWatch <span className="logo-sub">Nigeria</span></span>
            <span className="view-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Read-only
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="live-pill">
              <span className="live-dot" />
              LIVE
            </span>
            {lastUpdated && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Updated {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
            <button className="refresh-btn" onClick={() => void load(true)} disabled={refreshing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'spin' : ''}>
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ── Mission strip ─────────────────────────────────────────────────── */}
      <div className="mission-strip">
        <p className="mission-text">
          Real-time surveillance of vaccine misinformation across Nigerian social media.
          Content is automatically ingested, classified by AI, and reviewed by human analysts before any response is deployed.
        </p>
      </div>

      <main className="main-content">

        {/* ── KPI cards ─────────────────────────────────────────────────────── */}
        <section className="kpi-grid">

          <div className="kpi-card">
            <div className="kpi-eyebrow">Posts Monitored</div>
            <div className="kpi-value">{fmt(stats.totalPosts)}</div>
            <div className="kpi-sub">Total content analyzed since launch</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-eyebrow">Ingested Today</div>
            <div className="kpi-value">{fmt(stats.todayPosts)}</div>
            <div className="kpi-sub">New posts collected in the last 24 hours</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-eyebrow">Content Classified</div>
            <div className="kpi-value">{fmt(totalLabeled)}</div>
            <div className="kpi-sub">Posts with an AI or analyst verdict</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="mini-chip" style={{ background: LABEL_META.misinformation.bg, color: LABEL_META.misinformation.color }}>
                {fmt(misinfoCount)} misinfo
              </span>
              <span className="mini-chip" style={{ background: LABEL_META.factual.bg, color: LABEL_META.factual.color }}>
                {fmt(factualCount)} factual
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-eyebrow">Pending Analyst Review</div>
            <div className="kpi-value">{fmt(stats.pendingReviews)}</div>
            <div className="kpi-sub">Posts flagged and waiting for a human decision</div>
          </div>

          {/* Threat level — accent card */}
          <div className="kpi-card threat-card" style={{
            borderColor: threat.color,
            boxShadow: threat.glow
              ? `0 0 0 1px ${threat.color}33, 0 0 24px ${threat.color}22`
              : undefined,
          }}>
            <div className="kpi-eyebrow">Misinfo Threat Level</div>
            <div className="threat-level-row">
              <span className="threat-label" style={{ color: threat.color }}>{threat.label}</span>
              <span className="threat-rate" style={{ background: threat.bg, color: threat.color }}>
                {pct(stats.misinfoRate)}
              </span>
            </div>
            <div className="threat-bar-track">
              <div className="threat-bar-fill" style={{
                width: `${Math.min(stats.misinfoRate, 100)}%`,
                background: threat.color,
              }} />
              <span className="threat-bar-tick" style={{ left: '10%' }} />
              <span className="threat-bar-tick" style={{ left: '25%' }} />
              <span className="threat-bar-tick" style={{ left: '50%' }} />
            </div>
            <div className="threat-scale">
              <span>Low</span><span>Moderate</span><span>High</span><span>Critical</span>
            </div>
            <div className="kpi-sub" style={{ marginTop: 8 }}>
              Share of classified content identified as vaccine misinformation
            </div>
          </div>

        </section>

        {/* ── Middle: Recent content + breakdowns ───────────────────────── */}
        <section className="mid-grid">

          {/* Recent posts */}
          <div className="glass-panel feed-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Latest Monitored Content</h2>
                <p className="panel-desc">The 30 most recently collected posts, shown with their AI classification</p>
              </div>
            </div>
            <div className="feed-list">
              {recentPosts.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
                  No content yet
                </p>
              )}
              {recentPosts.map((post, i) => {
                const meta = LABEL_META[post.label] ?? LABEL_META.pending;
                const pc   = PLATFORM_COLOR[post.platform] ?? '#4a6060';
                return (
                  <div key={i} className="feed-row">
                    <div className="feed-row-meta">
                      <span className="platform-dot" style={{ background: pc }} />
                      <span className="feed-platform">{PLATFORM_LABELS[post.platform] ?? post.platform}</span>
                      {post.language && (
                        <span className="feed-lang">{LANGUAGE_LABELS[post.language] ?? post.language}</span>
                      )}
                      <span className="verdict-chip" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      {post.confidence > 0 && (
                        <span className="confidence-bar-wrap" title={`${Math.round(post.confidence * 100)}% model confidence`}>
                          <span className="confidence-bar-fill" style={{ width: `${Math.round(post.confidence * 100)}%`, background: meta.color }} />
                        </span>
                      )}
                      <span className="feed-time">{timeAgo(post.ingestedAt)}</span>
                    </div>
                    <p className="feed-content">{post.content}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column */}
          <div className="right-col">

            {/* Classification breakdown */}
            <div className="glass-panel">
              <h2 className="panel-title">Content Classification</h2>
              <p className="panel-desc">How AI has categorised all analysed posts</p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {labels.map(({ label, count }) => {
                  const meta  = LABEL_META[label] ?? LABEL_META.pending;
                  const share = Math.round((count / totalLabeled) * 100);
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(count)} · {share}%
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${share}%`, background: meta.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform coverage */}
            <div className="glass-panel">
              <h2 className="panel-title">Platform Coverage</h2>
              <p className="panel-desc">Volume of posts collected per social platform</p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {platforms.map(({ platform, count }) => {
                  const color = PLATFORM_COLOR[platform] ?? '#4a6060';
                  const share = Math.round((count / totalPlatformPosts) * 100);
                  return (
                    <div key={platform}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color }}>{PLATFORM_LABELS[platform] ?? platform}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(count)} · {share}%
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${share}%`, background: color, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

        {/* ── Data sources ──────────────────────────────────────────────────── */}
        <section className="glass-panel">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <div>
              <h2 className="panel-title">Live Data Sources</h2>
              <p className="panel-desc">Whether each platform connector is actively delivering new content</p>
            </div>
          </div>
          <div className="sources-grid">
            {connectors.map(({ platform, status: s, eventsPerMin, lastEventAt }) => {
              const sm  = STATUS_META[s];
              const col = PLATFORM_COLOR[platform] ?? '#4a6060';
              return (
                <div key={platform} className="source-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: col }}>
                      {PLATFORM_LABELS[platform] ?? platform}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: sm.dot, display: 'inline-block' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: sm.dot }}>{sm.label}</span>
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {s === 'active'
                      ? `${eventsPerMin} posts/min · ${sm.desc}`
                      : lastEventAt
                        ? `Last data ${timeAgo(lastEventAt)} · ${sm.desc}`
                        : sm.desc
                    }
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="page-footer">
          <span>ImmuniWatch Nigeria</span>
          <span className="footer-dot" />
          <span>Secure read-only view · no login required</span>
          <span className="footer-dot" />
          <span>Auto-refreshes every 60 seconds</span>
        </footer>

      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap');

:root {
  --bg:            #f4f7f6;
  --surface:       rgba(255,255,255,0.80);
  --surface-hover: rgba(255,255,255,0.95);
  --border:        rgba(13,61,61,0.09);
  --brand:         #0d3d3d;
  --accent:        #00897b;
  --text-primary:  #0d3d3d;
  --text-secondary:#2d5050;
  --text-muted:    #6b8f8f;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:            #0a1f1f;
    --surface:       rgba(18,42,42,0.85);
    --surface-hover: rgba(24,54,54,0.95);
    --border:        rgba(255,255,255,0.07);
    --brand:         #7ecfc9;
    --accent:        #4db6ac;
    --text-primary:  #d4eeec;
    --text-secondary:#8ec8c4;
    --text-muted:    #5a8888;
  }
}
:root[data-theme="dark"] {
  --bg:            #0a1f1f;
  --surface:       rgba(18,42,42,0.85);
  --surface-hover: rgba(24,54,54,0.95);
  --border:        rgba(255,255,255,0.07);
  --brand:         #7ecfc9;
  --accent:        #4db6ac;
  --text-primary:  #d4eeec;
  --text-secondary:#8ec8c4;
  --text-muted:    #5a8888;
}

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text-primary); }

/* Header */
.site-header {
  position: sticky; top: 0; z-index: 50;
  background: var(--surface);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}
.header-inner {
  max-width: 1200px; margin: 0 auto;
  padding: 0 24px; height: 56px;
  display: flex; align-items: center; justify-content: space-between;
}
.logo-mark {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--brand); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.logo-text {
  font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 700;
  color: var(--text-primary); letter-spacing: -0.03em;
}
.logo-sub { font-weight: 400; opacity: 0.6; }
.view-badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
  padding: 2px 8px; border-radius: 20px;
  background: rgba(0,137,123,0.10); color: #00897b;
  border: 1px solid rgba(0,137,123,0.18);
}
.live-pill {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  padding: 3px 10px; border-radius: 20px;
  background: rgba(0,137,123,0.10); color: #00897b;
  border: 1px solid rgba(0,137,123,0.20);
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #00897b;
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.7); }
}
.refresh-btn {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
  color: var(--text-muted); background: transparent;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 5px 12px; cursor: pointer; transition: border-color .15s, color .15s;
}
.refresh-btn:hover { border-color: var(--accent); color: var(--accent); }
.refresh-btn:disabled { opacity: 0.5; cursor: default; }

/* Mission */
.mission-strip {
  background: var(--brand); padding: 14px 24px;
}
.mission-text {
  max-width: 1200px; margin: 0 auto;
  font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.75);
}

/* Layout */
.main-content {
  max-width: 1200px; margin: 0 auto;
  padding: 28px 24px 48px; display: flex; flex-direction: column; gap: 20px;
}

/* KPI grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
@media (min-width: 640px)  { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .kpi-grid { grid-template-columns: repeat(5, 1fr); } }

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px; padding: 18px;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.threat-card { border-width: 1.5px; transition: box-shadow .3s; }
.kpi-eyebrow {
  font-size: 10px; font-weight: 700; letter-spacing: 0.10em;
  text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;
}
.kpi-value {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 30px; line-height: 1; color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.kpi-sub {
  font-size: 11px; color: var(--text-muted); line-height: 1.5; margin-top: 6px;
}

/* Threat card */
.threat-level-row {
  display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px;
}
.threat-label {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 26px; line-height: 1;
}
.threat-rate {
  font-size: 12px; font-weight: 700; padding: 2px 8px;
  border-radius: 6px; letter-spacing: 0.02em;
}
.threat-bar-track {
  position: relative; height: 6px; border-radius: 3px;
  background: var(--border); overflow: hidden; margin-bottom: 4px;
}
.threat-bar-fill {
  height: 100%; border-radius: 3px; transition: width .6s ease;
}
.threat-bar-tick {
  position: absolute; top: 0; bottom: 0; width: 1px;
  background: rgba(255,255,255,0.5);
}
.threat-scale {
  display: flex; justify-content: space-between;
  font-size: 9px; color: var(--text-muted); letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* Mini chip */
.mini-chip {
  font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
}

/* Glass panel */
.glass-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px; padding: 20px;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.panel-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.panel-title {
  margin: 0 0 4px; font-size: 14px; font-weight: 700; color: var(--text-primary);
  font-family: 'Inter', sans-serif;
}
.panel-desc { margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.5; }

/* Mid grid */
.mid-grid { display: grid; gap: 20px; }
@media (min-width: 900px) {
  .mid-grid { grid-template-columns: 1fr 340px; }
}
.right-col { display: flex; flex-direction: column; gap: 20px; }

/* Feed */
.feed-panel { display: flex; flex-direction: column; }
.feed-list {
  flex: 1; overflow-y: auto; max-height: 520px;
  display: flex; flex-direction: column; gap: 8px;
}
.feed-row {
  padding: 10px 12px; border-radius: 10px;
  background: rgba(13,61,61,0.03);
  border: 1px solid var(--border);
}
.feed-row-meta {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap; margin-bottom: 6px;
}
.platform-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.feed-platform { font-size: 11px; font-weight: 700; color: var(--text-secondary); }
.feed-lang {
  font-size: 10px; color: var(--text-muted);
  padding: 1px 6px; border-radius: 4px; background: var(--border);
}
.verdict-chip {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 5px;
}
.confidence-bar-wrap {
  width: 40px; height: 4px; border-radius: 2px;
  background: var(--border); overflow: hidden; flex-shrink: 0;
}
.confidence-bar-fill { height: 100%; border-radius: 2px; opacity: 0.7; }
.feed-time { margin-left: auto; font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.feed-content {
  margin: 0; font-size: 12px; line-height: 1.55; color: var(--text-secondary);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

/* Bars */
.bar-track {
  height: 6px; border-radius: 3px; background: var(--border); overflow: hidden;
}
.bar-fill {
  height: 100%; border-radius: 3px; opacity: 0.75; transition: width .5s ease;
}

/* Sources grid */
.sources-grid {
  display: grid; gap: 10px;
  grid-template-columns: repeat(2, 1fr);
}
@media (min-width: 640px)  { .sources-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .sources-grid { grid-template-columns: repeat(6, 1fr); } }

.source-card {
  padding: 12px 14px; border-radius: 10px;
  background: rgba(13,61,61,0.03);
  border: 1px solid var(--border);
}

/* Footer */
.page-footer {
  display: flex; align-items: center; gap: 10px; justify-content: center;
  flex-wrap: wrap;
  font-size: 11px; color: var(--text-muted); padding-top: 4px;
}
.footer-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-muted); opacity: 0.4; }

/* Spinner */
.spinner {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--brand);
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .7s linear infinite; }

/* Scrollbar */
.feed-list::-webkit-scrollbar { width: 4px; }
.feed-list::-webkit-scrollbar-track { background: transparent; }
.feed-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

@media (prefers-reduced-motion: reduce) {
  .live-dot, .spinner, .spin { animation: none; }
  .threat-bar-fill, .bar-fill { transition: none; }
}
`;
