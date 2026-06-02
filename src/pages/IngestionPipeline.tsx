// Changes vs. original:
//   • formatRel: now returns '—' for empty strings and invalid dates instead
//     of 'NaNh ago'. The backend returns lastEventAt: '' for unconnected
//     platforms — new Date('').getTime() produces NaN which propagated into
//     the displayed string.
//   • STATUS_META: added 'not_integrated' entry (gray, WifiOff icon) and
//     'mock' entry. Without it the fallback was STATUS_META.down (red),
//     incorrectly implying these connectors had failed rather than not being
//     wired yet.
//   • Degraded explanation banner: shown when pipeline.status === 'degraded'
//     so operators understand this is a cold-start condition, not a failure.
//   • Mock mode banner: shown when pipeline.mockMode === true or
//     pipeline.status === 'mock'.
//   • Pipeline stage colours: stages 1–2 are always emerald (ingest + Kafka
//     are infrastructure-level, not ML-dependent); stages 3–5 amber when
//     degraded/fallback.
//   • Kafka disabled banner: shown when kafka.enabled === false instead of
//     an empty topics table.
//   • Model version: 'unknown' shown as '—' with a subtle note that the
//     service is waking up rather than a confusing literal "unknown".
//   • Connector note column: shows the Phase 2 note string when present.

import { useQuery }          from '@tanstack/react-query';
import {
  Network, Wifi, AlertCircle, CheckCircle, Activity, WifiOff, Clock, Radio,
} from 'lucide-react';
import { modelHealthApi }   from '../api/modelHealth';
import { pipelineApi }      from '../api/pipeline';
import type { Connector, KafkaHealth } from '../api/pipeline';
import { StatCard }          from '../components/StatCard';
import { FullPageSpinner }   from '../components/Spinner';
import { ErrorBanner }       from '../components/ErrorBanner';
import { LABEL_META, LANG_LABELS, formatRelative } from '../lib/utils';
import type { RecentPost }   from '../types/api';

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, {
  color: string; bg: string; Icon: React.ElementType; label: string;
}> = {
  active:         { color: 'text-emerald-700', bg: 'bg-emerald-100', Icon: CheckCircle, label: 'Active'          },
  degraded:       { color: 'text-amber-700',   bg: 'bg-amber-100',   Icon: AlertCircle, label: 'Degraded'        },
  // 'waiting' = no data yet; connector is healthy but ingestion hasn't populated DB
  waiting:        { color: 'text-blue-600',    bg: 'bg-blue-50',     Icon: Clock,       label: 'Waiting for data' },
  down:           { color: 'text-red-700',     bg: 'bg-red-100',     Icon: WifiOff,     label: 'Down'            },
  not_integrated: { color: 'text-gray-500',    bg: 'bg-gray-100',    Icon: WifiOff,     label: 'Not integrated'  },
  mock:           { color: 'text-amber-700',   bg: 'bg-amber-100',   Icon: AlertCircle, label: 'Mock'            },
};

const PIPELINE_STAGES = [
  { id: 1, label: 'Ingest',    desc: 'Platform connectors pull posts via APIs / webhooks' },
  { id: 2, label: 'Kafka',     desc: 'Events streamed through Kafka topics for dedup + buffering' },
  { id: 3, label: 'Classify',  desc: 'ML service assigns label + confidence score' },
  { id: 4, label: 'HITL gate', desc: 'High-risk posts routed to human review queue' },
  { id: 5, label: 'Dispatch',  desc: 'Approved counter-narratives pushed to platforms' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// FIX: returns '—' for empty strings and invalid dates instead of 'NaNh ago'.
// The backend sends lastEventAt: '' for unconnected platforms; new Date('').getTime()
// is NaN which previously propagated directly into the displayed string.
function formatRel(iso: string): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '—';
  const diff = Date.now() - dt.getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function IngestionPipeline() {
  const { data: pipeline, isLoading, isError } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn:  () => modelHealthApi.getPipelineStatus(),
    refetchInterval: 30_000,
  });

  const { data: connectors, isLoading: loadingConnectors } = useQuery<Connector[]>({
    queryKey: ['pipeline', 'connectors'],
    queryFn:  () => pipelineApi.getConnectors(),
    refetchInterval: 30_000,
  });

  const { data: kafka } = useQuery<KafkaHealth>({
    queryKey: ['pipeline', 'kafka'],
    queryFn:  () => pipelineApi.getKafkaHealth(),
    refetchInterval: 30_000,
  });

  const { data: recentFeed } = useQuery({
    queryKey: ['pipeline', 'recent'],
    queryFn:  () => pipelineApi.getRecentFeed(),
    refetchInterval: 60_000,  // ML service updates every ~60 s
  });

  const activeConnectors = connectors?.filter((c) => c.status === 'active').length ?? 0;
  const totalConnectors  = connectors?.length ?? 0;
  const totalEPM         = connectors?.reduce((s, c) => s + c.eventsPerMin, 0) ?? 0;

  if (isLoading) return <FullPageSpinner />;

  const status        = pipeline?.status ?? 'unknown';
  const circuitState  = pipeline?.mlService?.circuitState ?? 'CLOSED';
  const isHealthy     = status === 'healthy';
  const isDegraded    = status === 'degraded';
  const isFallback    = status === 'fallback';
  const isMock        = status === 'mock' || pipeline?.mockMode === true;
  const modelVersion  = pipeline?.mlService?.modelVersion;

  // Stages 1–2 (Ingest, Kafka) are infrastructure — always show them as healthy.
  // Stages 3–5 (Classify, HITL, Dispatch) are ML-dependent — amber when degraded.
  const stageClass = (id: number) => {
    if (id <= 2)    return 'bg-emerald-600 text-white';
    if (isHealthy)  return 'bg-emerald-600 text-white';
    if (isFallback) return 'bg-red-500     text-white';
    if (isDegraded) return 'bg-amber-500   text-white';
    return 'bg-emerald-600 text-white';
  };

  const statusPill = isHealthy
    ? 'bg-emerald-50 text-emerald-700'
    : isMock
    ? 'bg-amber-50 text-amber-700'
    : isDegraded || isFallback
    ? 'bg-amber-50 text-amber-700'
    : 'bg-gray-100 text-gray-500';

  const statusDot = isHealthy   ? 'bg-emerald-500'
                  : isFallback  ? 'bg-red-500'
                  : 'bg-amber-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Ingestion pipeline</h1>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusPill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          {status}
        </span>
      </div>

      {isError && <ErrorBanner message="Failed to load pipeline status." />}

      {/* ── Degraded explanation ─────────────────────────────────────────────
          'degraded' fires when the ML service health probe times out in the
          2-second window. On HuggingFace free-tier this is normal at cold-start
          — the space needs 15–30 seconds to wake from sleep. The circuit breaker
          being CLOSED confirms no requests have actually failed yet.
      ─────────────────────────────────────────────────────────────────────── */}
      {isDegraded && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <strong>ML service waking up</strong> — the HuggingFace Space is cold-starting
            (free-tier spaces sleep after inactivity). The 2-second health probe timed out
            before the service responded, so the pipeline shows <em>degraded</em>.
            This resolves automatically within 15–30 seconds. The circuit breaker
            is <strong>{circuitState}</strong> — no requests have failed yet.
          </div>
        </div>
      )}

      {isFallback && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-500" />
          <div>
            <strong>Circuit breaker OPEN</strong> — the ML service has failed enough
            requests to trip the breaker. Posts are still ingested; classifications
            are queued to the HITL queue for manual review. The breaker resets after
            60 seconds and will probe automatically.
          </div>
        </div>
      )}

      {isMock && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
          <strong>Mock mode active</strong> — ML_MOCK_MODE=true in .env.
          Set ML_MOCK_MODE=false and restart to use the live HuggingFace model.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Active connectors" value={`${activeConnectors} / ${totalConnectors}`} icon={Wifi}        color="green"  />
        <StatCard label="Events / min"       value={totalEPM.toLocaleString()}                  icon={Activity}    color="indigo" />
        <StatCard label="Kafka lag"          value={kafka ? `${kafka.kafkaLagMs}ms` : '—'}      icon={Network}     color="yellow" />
        <StatCard label="Dedup rate"         value={kafka ? `${(kafka.dedupRate * 100).toFixed(1)}%` : '—'} icon={CheckCircle} color="green" />
      </div>

      {/* Pipeline stages */}
      <div className="glass-card p-4">
        <h2 className="text-xs font-semibold text-gray-700 mb-4">Pipeline stages</h2>
        <div className="flex items-start overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-start flex-shrink-0">
              <div className="flex flex-col items-center w-32">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${stageClass(stage.id)}`}>
                  {stage.id}
                </div>
                <p className="text-xs font-semibold text-gray-800 mt-1.5 text-center">{stage.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 text-center leading-snug">{stage.desc}</p>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex-shrink-0 mt-3.5 mx-1">
                  <div className="w-6 h-0.5 bg-gray-200" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Connectors + ML panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Connectors table */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-700">Connector status</h2>
          </div>
          {loadingConnectors ? <FullPageSpinner /> : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Source</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Status</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Ev/min</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Err%</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Last event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(connectors ?? []).map((c) => {
                  // FIX: fall back to not_integrated style rather than 'down' (red) for
                  // connectors whose status isn't in STATUS_META
                  const meta = STATUS_META[c.status] ?? STATUS_META.not_integrated;
                  return (
                    <tr key={c.platform} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-gray-800">{c.name}</span>
                        {c.note && (
                          <span className="block text-[10px] text-gray-400 mt-0.5">{c.note}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                          <meta.Icon className="h-3 w-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{c.eventsPerMin.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{(c.errorRate * 100).toFixed(1)}%</td>
                      {/* FIX: formatRel now returns '—' for empty string instead of 'NaNh ago' */}
                      <td className="px-3 py-2.5 text-right text-gray-400">{formatRel(c.lastEventAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          {/* ML service circuit breaker */}
          <div className="glass-card p-4">
            <h2 className="text-xs font-semibold text-gray-700 mb-3">ML service circuit breaker</h2>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                circuitState === 'CLOSED'    ? 'bg-emerald-100 text-emerald-700' :
                circuitState === 'HALF_OPEN' ? 'bg-amber-100   text-amber-700'  :
                                               'bg-red-100     text-red-700'
              }`}>
                {circuitState === 'CLOSED' ? '●' : circuitState === 'HALF_OPEN' ? '◑' : '○'}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{circuitState}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {circuitState === 'CLOSED'
                    ? 'ML service healthy — all requests passing through'
                    : circuitState === 'HALF_OPEN'
                    ? 'Probing — limited requests allowed to test recovery'
                    : 'Circuit open — fallback classifier active'}
                </p>
                {pipeline?.mlService && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {/* FIX: show '— (waking up)' instead of literal 'unknown' */}
                    Model: {modelVersion && modelVersion !== 'unknown'
                      ? modelVersion
                      : isDegraded
                      ? '— (waking up)'
                      : '—'}
                  </p>
                )}
                {pipeline?.mlService?.lastHealthError && (
                  <p className="text-[11px] text-amber-600 mt-0.5 font-mono">
                    {pipeline.mlService.lastHealthError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Kafka topics */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-700">Kafka topics</h2>
            </div>
            {/* FIX: show a Phase 2 note instead of an empty table when Kafka is disabled */}
            {kafka?.enabled === false ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-medium text-gray-500">Kafka disabled</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Set KAFKA_ENABLED=true in .env to enable streaming (Phase 2).
                </p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Topic</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Partitions</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Consumer lag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(kafka?.topics ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-[11px] text-gray-400">
                        No topics — Kafka connected but no topics produced yet.
                      </td>
                    </tr>
                  ) : (kafka?.topics ?? []).map((t) => (
                    <tr key={t.name} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-gray-700 text-[11px]">{t.name}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{t.partitions}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={t.lag > 1000 ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                          {t.lag.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Live ML Feed ──────────────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            <h2 className="text-xs font-semibold text-gray-700">Live ML Feed</h2>
            <span className="text-[10px] text-gray-400">Bluesky + YouTube · auto-classified 24/7</span>
          </div>
          {recentFeed && (
            <span className="text-[10px] text-gray-400">
              {recentFeed.total_since_start.toLocaleString()} total since service start
            </span>
          )}
        </div>

        {!recentFeed ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400">Loading live feed…</div>
        ) : recentFeed.posts.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400">No posts yet — feed will populate automatically.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentFeed.posts.slice(0, 20).map((post: RecentPost) => {
              const labelMeta = LABEL_META[post.label] ?? LABEL_META.irrelevant;
              const platform  = post.platform === 'bluesky' ? 'Bluesky' : 'YouTube';
              const lang      = post.language ? (LANG_LABELS[post.language] ?? post.language) : '—';
              const confPct   = Math.round(post.confidence * 100);

              return (
                <div key={post.post_id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50">
                  {/* Platform pill */}
                  <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${
                    post.platform === 'bluesky'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {platform}
                  </span>

                  {/* Content */}
                  <p className="flex-1 text-xs text-gray-700 leading-relaxed min-w-0 line-clamp-2">
                    {post.content_snippet}
                  </p>

                  {/* Metadata */}
                  <div className="flex-shrink-0 flex items-center gap-2 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${labelMeta.color}`}>
                      {labelMeta.label}
                    </span>
                    <span className={`font-mono font-semibold ${
                      confPct >= 85 ? 'text-red-600' :
                      confPct >= 70 ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      {confPct}%
                    </span>
                    <span className="text-gray-400 hidden sm:inline">{lang}</span>
                    <span className="text-gray-300">{formatRelative(post.classified_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}