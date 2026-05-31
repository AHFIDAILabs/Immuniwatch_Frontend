// ModelHealth.tsx
//
// Changes vs. original:
//   • Stale data banner: shown when metrics.stale === true (ML service unreachable,
//     dashboard is showing MongoDB cache — was silent before)
//   • Per-language recall: displayed alongside F1 now that the backend maps it
//   • Mock mode badge: shown in the header when pipeline.mockMode is true
//   • computedAt: shown below the F1 stat so operators know how fresh the metrics are

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, AlertCircle } from "lucide-react";
import { modelHealthApi } from "../api/modelHealth";
import { ModelStatusBadge } from "../components/ModelStatusBadge";
import { FallbackModeAlert } from "../components/FallbackModeAlert";
import { RetrainingProgressBanner } from "../components/RetrainingProgressBanner";
import { StatCard } from "../components/StatCard";
import { FullPageSpinner } from "../components/Spinner";
import { ErrorBanner } from "../components/ErrorBanner";
import { formatPct, formatDateTime, LANG_FLAGS } from "../lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PostLanguage } from "../types/api";

export default function ModelHealth() {
  const qc = useQueryClient();

  const {
    data: metrics,
    isLoading,
    isError: metricsError,
  } = useQuery({
    queryKey: ["model-health", "metrics"],
    queryFn: () => modelHealthApi.getMetrics(),
    refetchInterval: 60_000,
  });

  const { data: pipeline } = useQuery({
    queryKey: ["pipeline-status"],
    queryFn: () => modelHealthApi.getPipelineStatus(),
    refetchInterval: 30_000,
  });

  const { data: trend } = useQuery({
    queryKey: ["model-health", "f1-trend"],
    queryFn: () => modelHealthApi.getF1Trend(),
  });

  const { data: retrainStatus } = useQuery({
    queryKey: ["model-health", "retrain-status"],
    queryFn: () => modelHealthApi.getRetrainStatus(),
    refetchInterval: 30_000,
  });

  const [retrainError, setRetrainError] = useState("");
  const { mutate: triggerRetrain, isPending: triggering } = useMutation({
    mutationFn: () => modelHealthApi.triggerRetrain(),
    onSuccess: () => {
      setRetrainError("");
      void qc.invalidateQueries({ queryKey: ["pipeline-status"] });
      void qc.invalidateQueries({
        queryKey: ["model-health", "retrain-status"],
      });
    },
    onError: () =>
      setRetrainError("Failed to trigger retrain. Please try again."),
  });

  if (isLoading) return <FullPageSpinner />;

  const perLang = metrics?.perLanguage
    ? (Object.entries(metrics.perLanguage) as [
        PostLanguage,
        { macroF1: number; recall: number; psi: number },
      ][])
    : [];

  const isMock = pipeline?.mockMode === true || pipeline?.status === "mock";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Model Health</h1>
          {isMock && (
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
              MOCK MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pipeline && <ModelStatusBadge status={pipeline.status} />}
          <button
            onClick={() => triggerRetrain()}
            disabled={triggering || pipeline?.status === "retraining"}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw
              className={`h-4 w-4 ${triggering ? "animate-spin" : ""}`}
            />
            Trigger Retrain
          </button>
        </div>
      </div>

      {/* Stale data warning — shown when the ML service was unreachable */}
      {metrics?.stale && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
          <p>
            <strong>Showing cached data</strong> — the ML service was
            unreachable at the last refresh. Metrics may be outdated. The
            dashboard will update automatically once the service comes back
            online.
            {metrics.computedAt && (
              <span className="ml-1 text-amber-600">
                Last computed: {formatDateTime(metrics.computedAt)}.
              </span>
            )}
          </p>
        </div>
      )}

      {metricsError && <ErrorBanner message="Failed to load model metrics." />}
      {retrainError && <ErrorBanner message={retrainError} />}

      {pipeline?.status === "fallback" && <FallbackModeAlert />}
      {pipeline?.status === "retraining" && retrainStatus?.startedAt && (
        <RetrainingProgressBanner
          startedAt={retrainStatus.startedAt}
          runId={retrainStatus.runId}
        />
      )}

      {/* Overall stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Macro F1"
          value={metrics ? formatPct(metrics.macroF1) : "—"}
          icon={TrendingUp}
          color="green"
          sub={
            metrics?.computedAt
              ? `Computed ${formatDateTime(metrics.computedAt)}`
              : metrics?.lastRetrain
                ? `Retrained ${formatDateTime(metrics.lastRetrain)}`
                : undefined
          }
        />
        <StatCard
          label="Recall"
          value={metrics ? formatPct(metrics.recall) : "—"}
          color="blue"
          sub="Overall"
        />
        <StatCard
          label="Precision"
          value={metrics ? formatPct(metrics.precision) : "—"}
          color="indigo"
        />
        <StatCard
          label="Inference P95"
          value={metrics ? `${metrics.inferenceP95ms}ms` : "—"}
          color="yellow"
          sub="Latency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* F1 Trend */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            F1 Score Trend (30d)
          </h2>
          {trend?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v: unknown) =>
                    typeof v === "number" ? `${(v * 100).toFixed(1)}%` : ""
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="macroF1"
                  stroke="#6366f1"
                  dot={false}
                  name="Macro F1"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">
              No trend data yet.
            </p>
          )}
        </div>

        {/* Per-language breakdown — now shows recall too */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Per-Language Metrics
          </h2>
          {perLang.length ? (
            <div className="space-y-4">
              {perLang.map(([lang, vals]) => (
                <div key={lang}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">
                      {LANG_FLAGS[lang] ?? ""} {lang.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span>F1 {formatPct(vals.macroF1)}</span>
                      {"recall" in vals && (
                        <span>
                          Recall{" "}
                          {formatPct(
                            (vals as typeof vals & { recall: number }).recall,
                          )}
                        </span>
                      )}
                    </div>
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
            <p className="text-sm text-gray-400 text-center py-12">
              No per-language data.
            </p>
          )}
        </div>
      </div>

      {/* Feedback queue */}
      {metrics?.feedbackQueue !== undefined && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Feedback Queue
          </h2>
          <p className="text-3xl font-semibold text-gray-900">
            {metrics.feedbackQueue}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Posts pending feedback incorporation into next retrain
          </p>
        </div>
      )}
    </div>
  );
}
