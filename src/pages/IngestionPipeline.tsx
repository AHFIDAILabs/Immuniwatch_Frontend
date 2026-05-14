import { useQuery } from '@tanstack/react-query';
import { Network, Wifi, AlertCircle, CheckCircle, Activity, WifiOff } from 'lucide-react';
import { modelHealthApi } from '../api/modelHealth';
import { pipelineApi } from '../api/pipeline';
import type { Connector, KafkaHealth } from '../api/pipeline';
import { StatCard } from '../components/StatCard';
import { FullPageSpinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';

const STATUS_META: Record<string, { color: string; bg: string; Icon: React.ElementType; label: string }> = {
  active:   { color: 'text-emerald-700', bg: 'bg-emerald-100', Icon: CheckCircle, label: 'Active'   },
  degraded: { color: 'text-amber-700',   bg: 'bg-amber-100',   Icon: AlertCircle, label: 'Degraded' },
  down:     { color: 'text-red-700',     bg: 'bg-red-100',     Icon: WifiOff,     label: 'Down'     },
};

const PIPELINE_STAGES = [
  { id: 1, label: 'Ingest',    desc: 'Platform connectors pull posts via APIs / webhooks' },
  { id: 2, label: 'Kafka',     desc: 'Events streamed through Kafka topics for dedup + buffering' },
  { id: 3, label: 'Classify',  desc: 'ML service assigns label + confidence score' },
  { id: 4, label: 'HITL gate', desc: 'High-risk posts routed to human review queue' },
  { id: 5, label: 'Dispatch',  desc: 'Approved counter-narratives pushed to platforms' },
];

function formatRel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function IngestionPipeline() {
  const { data: pipeline, isLoading, isError } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: () => modelHealthApi.getPipelineStatus(),
    refetchInterval: 30_000,
  });

  const { data: connectors, isLoading: loadingConnectors } = useQuery<Connector[]>({
    queryKey: ['pipeline', 'connectors'],
    queryFn: () => pipelineApi.getConnectors(),
    refetchInterval: 30_000,
  });

  const { data: kafka } = useQuery<KafkaHealth>({
    queryKey: ['pipeline', 'kafka'],
    queryFn: () => pipelineApi.getKafkaHealth(),
    refetchInterval: 30_000,
  });

  const activeConnectors = connectors?.filter((c) => c.status === 'active').length ?? 0;
  const totalConnectors  = connectors?.length ?? 0;
  const totalEPM         = connectors?.reduce((s, c) => s + c.eventsPerMin, 0) ?? 0;

  if (isLoading) return <FullPageSpinner />;

  const circuitState   = pipeline?.mlService?.circuitState ?? 'CLOSED';
  const pipelineHealthy = pipeline?.status === 'healthy';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Ingestion pipeline</h1>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
          pipelineHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pipelineHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {pipeline?.status ?? 'unknown'}
        </span>
      </div>

      {isError && <ErrorBanner message="Failed to load pipeline status." />}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Active connectors" value={`${activeConnectors} / ${totalConnectors}`} icon={Wifi}        color="green"  />
        <StatCard label="Events / min"       value={totalEPM.toLocaleString()}                  icon={Activity}    color="indigo" />
        <StatCard label="Kafka lag"          value={kafka ? `${kafka.kafkaLagMs}ms` : '—'}      icon={Network}     color="yellow" />
        <StatCard label="Dedup rate"         value={kafka ? `${(kafka.dedupRate * 100).toFixed(1)}%` : '—'} icon={CheckCircle} color="green" />
      </div>

      {/* Pipeline stage diagram */}
      <div className="glass-card p-4">
        <h2 className="text-xs font-semibold text-gray-700 mb-4">Pipeline stages</h2>
        <div className="flex items-start overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-start flex-shrink-0">
              <div className="flex flex-col items-center w-32">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  pipelineHealthy || stage.id < 4 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                }`}>
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

      {/* Connectors table + Kafka/ML panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Connectors */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-700">Connector status</h2>
          </div>
          {loadingConnectors ? (
            <FullPageSpinner />
          ) : (
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
                  const meta = STATUS_META[c.status] ?? STATUS_META.down;
                  return (
                    <tr key={c.platform} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{c.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                          <meta.Icon className="h-3 w-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{c.eventsPerMin.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{(c.errorRate * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-right text-gray-400">{formatRel(c.lastEventAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          {/* ML circuit breaker */}
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
                  <p className="text-[11px] text-gray-400 mt-0.5">Model: {pipeline.mlService.modelVersion}</p>
                )}
              </div>
            </div>
          </div>

          {/* Kafka topics */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-700">Kafka topics</h2>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Topic</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Partitions</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Consumer lag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(kafka?.topics ?? []).map((t) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}
