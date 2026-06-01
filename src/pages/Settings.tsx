// Settings.tsx — fully wired to GET /settings + PATCH /settings
//
// Changes vs. original:
//   • All values now loaded from the real API (useQuery on mount)
//   • Each NumberSetting's Save button calls PATCH /settings with just that field
//   • SYSTEM_INFO is derived from the live API response — real ML URL, real status
//   • Supervisors and super_admins can edit; analysts/senior_analysts see read-only view
//   • Mock mode banner shown when ML_MOCK_MODE=true

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { settingsApi } from '../api/settings';
import { FullPageSpinner } from '../components/Spinner';
import { ErrorBanner }     from '../components/ErrorBanner';
import { useAuth }         from '../context/AuthContext';
import { useToast }        from '../context/ToastContext';
import type { AppSettings } from '../types/api';

// ── Number setting row ────────────────────────────────────────────────────────

function NumberSetting({
  label, description, fieldKey, value, unit, min, max, step, readOnly, onSave,
}: {
  label:       string;
  description: string;
  fieldKey:    keyof Omit<AppSettings, 'systemInfo' | 'updatedAt' | 'notifEmail'>;
  value:       number;
  unit:        string;
  min?:        number;
  max?:        number;
  step?:       number;
  readOnly?:   boolean;
  onSave:      (key: string, value: number) => Promise<void>;
}) {
  const toast = useToast().toast;
  const [val,    setVal]    = useState(value);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    setStatus('saving');
    try {
      await onSave(fieldKey, val);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      toast.error('Save failed', `Could not update "${label}". Please try again.`);
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  // Sync when server data changes (e.g. on refetch)
  if (val !== value && status === 'idle') setVal(value);

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-xs font-medium text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          min={min}
          max={max}
          step={step ?? 'any'}
          disabled={readOnly || status === 'saving'}
          className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:bg-gray-50"
        />
        <span className="text-[11px] text-gray-400 w-10">{unit}</span>
        {!readOnly && (
          <button
            onClick={save}
            disabled={status === 'saving'}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors min-w-[48px] ${
              status === 'saved'  ? 'bg-emerald-600 text-white' :
              status === 'error'  ? 'bg-red-100 text-red-700 border border-red-300' :
              status === 'saving' ? 'bg-gray-100 text-gray-500 border border-gray-200' :
                                    'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {status === 'saved'  ? 'Saved' :
             status === 'error'  ? 'Error' :
             status === 'saving' ? '...'   : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const { user }  = useAuth();
  const qc        = useQueryClient();
  const canEdit   = user?.role === 'org_admin' || user?.role === 'supervisor' || user?.role === 'super_admin';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.get(),
    staleTime: 30_000,
  });

  const { mutateAsync: patchSettings } = useMutation({
    mutationFn: (patch: Record<string, number | string>) =>
      settingsApi.update(patch as never),
    onSuccess: (updated) => {
      qc.setQueryData(['settings'], updated);
    },
  });

  const handleSave = useCallback(
    async (key: string, value: number) => {
      await patchSettings({ [key]: value });
    },
    [patchSettings],
  );

  const [notifEmail,  setNotifEmail]  = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync email field when data loads
  if (data && notifEmail === '' && data.notifEmail) {
    setNotifEmail(data.notifEmail);
  }

  const { toast } = useToast();

  async function saveEmail() {
    setEmailStatus('saving');
    try {
      await patchSettings({ notifEmail });
      setEmailStatus('saved');
      toast.success('Email saved', `Alert notifications will be sent to ${notifEmail}.`);
      setTimeout(() => setEmailStatus('idle'), 2000);
    } catch {
      setEmailStatus('error');
      toast.error('Save failed', 'Could not update the notification email.');
      setTimeout(() => setEmailStatus('idle'), 3000);
    }
  }

  if (isLoading) return <FullPageSpinner />;
  if (isError || !data) return <ErrorBanner message="Failed to load settings. Please refresh the page." />;

  const s  = data;
  const si = s.systemInfo;

  const thresholdRows = [
    {
      fieldKey: 'surgePosts'            as const,
      label:       'Surge alert threshold',
      description: 'Alert when posts on a single claim exceed this count in 2 hrs',
      value:       s.surgePosts,
      unit:        'posts',
      min: 50,  max: 1000,  step: 50,
    },
    {
      fieldKey: 'hitlAutoEscalateAbove' as const,
      label:       'HITL auto-escalate above',
      description: 'Auto-escalate to high priority when confidence exceeds this value',
      value:       s.hitlAutoEscalateAbove,
      unit:        '%',
      min: 50,  max: 100,  step: 1,
    },
    {
      fieldKey: 'psiDriftAlert'         as const,
      label:       'PSI drift alert',
      description: 'Trigger retraining recommendation when PSI exceeds this value',
      value:       s.psiDriftAlert,
      unit:        'PSI',
      min: 0.05, max: 0.50, step: 0.05,
    },
    {
      fieldKey: 'overrideRateAlert'     as const,
      label:       'Override rate alert',
      description: 'Alert when analyst override rate in 24 h exceeds this level',
      value:       s.overrideRateAlert,
      unit:        '%',
      min: 5,   max: 60,   step: 5,
    },
  ];

  const modelTargetRows = [
    {
      fieldKey: 'macroF1Target'         as const,
      label:       'Macro-F1 target',
      description: 'Minimum acceptable macro-F1 before retraining is triggered',
      value:       s.macroF1Target,
      unit:        '',
      min: 0, max: 1, step: 0.01,
    },
    {
      fieldKey: 'inferenceP95Ms'        as const,
      label:       'Inference P95 target',
      description: 'Maximum acceptable p95 inference latency',
      value:       s.inferenceP95Ms,
      unit:        'ms',
      min: 50, max: 5000, step: 50,
    },
    {
      fieldKey: 'feedbackQueueMax'      as const,
      label:       'Feedback queue max',
      description: 'Trigger retraining when feedback queue exceeds this count',
      value:       s.feedbackQueueMax,
      unit:        'items',
      min: 100, max: 100000, step: 500,
    },
  ];

  const mlStatusColor = si.mlServiceStatus === 'ok' ? 'text-emerald-600' :
                        si.mlServiceStatus === 'degraded' ? 'text-amber-600' :
                        'text-red-600';

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-base font-semibold text-gray-900">Settings</h1>

      {isError && <ErrorBanner message="Failed to load settings." />}

      {/* Mock mode banner */}
      {si.mockMode && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
          <p>
            <strong>Mock mode active</strong> — the ML service is running with stub responses
            (ML_MOCK_MODE=true). Set ML_MOCK_MODE=false and restart to use the live model.
          </p>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
          <p>Settings are read-only for your role. Contact your Organization Admin or Supervisor to make changes.</p>
        </div>
      )}

      {/* Alert thresholds */}
      <div className="glass-card p-4">
        <h2 className="text-xs font-semibold text-gray-700 mb-1">Alert thresholds</h2>
        <p className="text-[11px] text-gray-400 mb-3">Configure when alerts are triggered. Changes take effect immediately.</p>
        <div>
          {thresholdRows.map((row) => (
            <NumberSetting key={row.fieldKey} {...row} readOnly={!canEdit} onSave={handleSave} />
          ))}
        </div>
      </div>

      {/* Model targets */}
      <div className="glass-card p-4">
        <h2 className="text-xs font-semibold text-gray-700 mb-1">Model performance targets</h2>
        <p className="text-[11px] text-gray-400 mb-3">Thresholds that trigger retraining recommendations or alerts.</p>
        <div>
          {modelTargetRows.map((row) => (
            <NumberSetting key={row.fieldKey} {...row} readOnly={!canEdit} onSave={handleSave} />
          ))}
        </div>
      </div>

      {/* Notification settings */}
      <div className="glass-card p-4">
        <h2 className="text-xs font-semibold text-gray-700 mb-3">Notification settings</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Alert notification email</label>
            <input
              value={notifEmail}
              onChange={(e) => setNotifEmail(e.target.value)}
              type="email"
              disabled={!canEdit}
              placeholder="alerts@nphcda.gov.ng"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>
          {canEdit && (
            <button
              onClick={saveEmail}
              disabled={emailStatus === 'saving'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                emailStatus === 'saved' ? 'bg-emerald-600 text-white' :
                emailStatus === 'error' ? 'bg-red-100 text-red-700 border border-red-300' :
                'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {emailStatus === 'saved' ? (
                <><CheckCircle className="h-3.5 w-3.5" /> Saved!</>
              ) : (
                <><Save className="h-3.5 w-3.5" /> Save</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* System info — live from API */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <h2 className="text-xs font-semibold text-gray-700">System information</h2>
          <Info className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
          {[
            { label: 'Region',           value: si.region },
            { label: 'Organisation',     value: si.organisation },
            { label: 'Backend version',  value: si.backendVersion },
            { label: 'Frontend version', value: si.frontendVersion },
            { label: 'ML service URL',   value: si.mlServiceUrl },
            {
              label: 'ML service status',
              value: si.mlServiceStatus,
              extra: <span className={`ml-1 text-[10px] font-medium ${mlStatusColor}`}>●</span>,
            },
            { label: 'ML model version', value: si.mlModelVersion },
            { label: 'Mock mode',        value: si.mockMode ? 'enabled' : 'disabled' },
            { label: 'Kafka',            value: si.kafkaEnabled ? 'enabled' : 'disabled (Phase 2)' },
          ].map(({ label, value, extra }) => (
            <div key={label} className="flex items-center justify-between text-xs border-b border-gray-50 pb-1.5">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-800 text-right truncate max-w-[180px]">
                {value}{extra}
              </span>
            </div>
          ))}
        </div>
        {s.updatedAt && (
          <p className="text-[10px] text-gray-400 mt-3">
            Settings last updated: {new Date(s.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}