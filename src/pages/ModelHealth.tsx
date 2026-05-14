import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { modelHealthApi } from '../api/modelHealth';
import { ModelStatusBadge } from '../components/ModelStatusBadge';
import { FallbackModeAlert } from '../components/FallbackModeAlert';
import { RetrainingProgressBanner } from '../components/RetrainingProgressBanner';
import { StatCard } from '../components/StatCard';
import { FullPageSpinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatPct, formatDateTime, LANG_FLAGS } from '../lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { PostLanguage } from '../types/api';

export default function ModelHealth() {
  const qc = useQueryClient();

  const { data: metrics, isLoading, isError: metricsError } = useQuery({
    queryKey: ['model-health', 'metrics'],
    queryFn: () => modelHealthApi.getMetrics(),
    refetchInterval: 60_000,
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: () => modelHealthApi.getPipelineStatus(),
    refetchInterval: 30_000,
  });

  const { data: trend } = useQuery({
    queryKey: ['model-health', 'f1-trend'],
    queryFn: () => modelHealthApi.getF1Trend(),
  });

  const { data: retrainStatus } = useQuery({
    queryKey: ['model-health', 'retrain-status'],
    queryFn: () => modelHealthApi.getRetrainStatus(),
    refetchInterval: 30_000,
  });

  const [retrainError, setRetrainError] = useState('');
  const { mutate: triggerRetrain, isPending: triggering } = useMutation({
    mutationFn: () => modelHealthApi.triggerRetrain(),
    onSuccess: () => {
      setRetrainError('');
      qc.invalidateQueries({ queryKey: ['pipeline-status'] });
      qc.invalidateQueries({ queryKey: ['model-health', 'retrain-status'] });
    },
    onError: () => setRetrainError('Failed to trigger retrain. Please try again.'),
  });

  if (isLoading) return <FullPageSpinner />;

  const perLang = metrics?.perLanguage ? Object.entries(metrics.perLanguage) as [PostLanguage, { macroF1: number; psi: number }][] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Model Health</h1>
        <div className="flex items-center gap-3">
          {pipeline && <ModelStatusBadge status={pipeline.status} />}
          <button
            onClick={() => triggerRetrain()}
            disabled={triggering || pipeline?.status === 'retraining'}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${triggering ? 'animate-spin' : ''}`} />
            Trigger Retrain
          </button>
        </div>
      </div>

      {metricsError && <ErrorBanner message="Failed to load model metrics." />}
      {retrainError && <ErrorBanner message={retrainError} />}

      {pipeline?.status === 'fallback' && <FallbackModeAlert />}
      {pipeline?.status === 'retraining' && retrainStatus?.startedAt && (
        <RetrainingProgressBanner startedAt={retrainStatus.startedAt} runId={retrainStatus.runId} />
      )}

      {/* Overall stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Macro F1"
          value={metrics ? formatPct(metrics.macroF1) : '—'}
          icon={TrendingUp}
          color="green"
          sub={metrics?.lastRetrain ? `Retrained ${formatDateTime(metrics.lastRetrain)}` : undefined}
        />
        <StatCard label="Precision" value={metrics ? formatPct(metrics.precision) : '—'} color="indigo" />
        <StatCard label="Recall" value={metrics ? formatPct(metrics.recall) : '—'} color="blue" />
        <StatCard
          label="Inference P95"
          value={metrics ? `${metrics.inferenceP95ms}ms` : '—'}
          color="yellow"
          sub="Latency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* F1 Trend */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">F1 Score Trend (30d)</h2>
          {trend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : String(v ?? ''))} />
                <Legend />
                <Line type="monotone" dataKey="macroF1" stroke="#6366f1" dot={false} name="Macro F1" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No trend data yet.</p>
          )}
        </div>

        {/* Per-language breakdown */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Per-Language Metrics</h2>
          {perLang.length ? (
            <div className="space-y-3">
              {perLang.map(([lang, vals]) => (
                <div key={lang}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">
                      {LANG_FLAGS[lang] ?? ''} {lang.toUpperCase()}
                    </span>
                    <span className="text-gray-500">{formatPct(vals.macroF1)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${vals.macroF1 * 100}%` }}
                    />
                  </div>
                  {vals.psi > 0.2 && (
                    <p className="text-xs text-orange-600 mt-0.5">
                      PSI drift: {vals.psi.toFixed(3)} — above threshold
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No per-language data.</p>
          )}
        </div>
      </div>

      {/* Feedback queue */}
      {metrics?.feedbackQueue !== undefined && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Feedback Queue</h2>
          <p className="text-3xl font-semibold text-gray-900">{metrics.feedbackQueue}</p>
          <p className="text-xs text-gray-500 mt-1">Posts pending feedback incorporation into next retrain</p>
        </div>
      )}
    </div>
  );
}
