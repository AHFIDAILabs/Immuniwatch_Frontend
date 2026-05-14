import { useState } from 'react';
import { Save, Info } from 'lucide-react';

interface ThresholdRow {
  id: string;
  label: string;
  description: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const THRESHOLDS: ThresholdRow[] = [
  { id: 'surge_posts',        label: 'Surge alert threshold',    description: 'Alert when posts on a single claim exceed this count in 2 hrs', value: 200,  unit: 'posts', min: 50,   max: 1000, step: 50   },
  { id: 'hitl_auto_escalate', label: 'HITL auto-escalate above', description: 'Auto-escalate to high priority when confidence exceeds value',  value: 85,   unit: '%',     min: 50,   max: 100,  step: 1    },
  { id: 'psi_drift',          label: 'PSI drift alert',           description: 'Trigger retraining recommendation when PSI exceeds this value', value: 0.20, unit: 'PSI',   min: 0.05, max: 0.50, step: 0.05 },
  { id: 'override_rate',      label: 'Override rate alert',       description: 'Alert when analyst override rate in 24 h exceeds this level',   value: 25,   unit: '%',     min: 5,    max: 60,   step: 5    },
];

interface ModelTarget {
  id: string;
  label: string;
  description: string;
  value: number;
  unit: string;
}

const MODEL_TARGETS: ModelTarget[] = [
  { id: 'macro_f1_target',    label: 'Macro-F1 target',       description: 'Minimum acceptable macro-F1 before retraining is triggered', value: 0.80,  unit: ''      },
  { id: 'inference_p95_ms',   label: 'Inference P95 target',  description: 'Maximum acceptable p95 inference latency',                   value: 200,   unit: 'ms'    },
  { id: 'feedback_queue_max', label: 'Feedback queue max',     description: 'Trigger retraining when feedback queue exceeds this count',  value: 5000,  unit: 'items' },
];

const SYSTEM_INFO = [
  { label: 'Region',           value: 'Nigeria (Lagos · AF)'  },
  { label: 'Organisation',     value: 'NPHCDA'                },
  { label: 'Backend version',  value: 'v1.4.2'                },
  { label: 'Frontend version', value: 'v1.4.2'                },
  { label: 'ML service',       value: 'http://ml-service:8080'},
  { label: 'MongoDB cluster',  value: 'atlas-cluster-0 (M10)' },
  { label: 'Kafka brokers',    value: '3 brokers · replication 3' },
];

function NumberSetting({
  label, description, defaultValue, unit, min, max, step,
}: {
  label: string; description: string; defaultValue: number;
  unit: string; min?: number; max?: number; step?: number;
}) {
  const [val,   setVal]   = useState(defaultValue);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
          className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-[11px] text-gray-400 w-10">{unit}</span>
        <button
          onClick={save}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
            saved ? 'bg-emerald-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [notifEmail, setNotifEmail] = useState('alerts@nphcda.gov.ng');
  const [notifSaved, setNotifSaved] = useState(false);

  function saveNotif() {
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2000);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-base font-semibold text-gray-900">Settings</h1>

      {/* Alert thresholds */}
      <div className="glass-card p-4">
        <h2 className="text-xs font-semibold text-gray-700 mb-1">Alert thresholds</h2>
        <p className="text-[11px] text-gray-400 mb-3">Configure when alerts are triggered. Changes take effect immediately.</p>
        <div>
          {THRESHOLDS.map((row) => (
            <NumberSetting
              key={row.id}
              label={row.label}
              description={row.description}
              defaultValue={row.value}
              unit={row.unit}
              min={row.min}
              max={row.max}
              step={row.step}
            />
          ))}
        </div>
      </div>

      {/* Model targets */}
      <div className="glass-card p-4">
        <h2 className="text-xs font-semibold text-gray-700 mb-1">Model performance targets</h2>
        <p className="text-[11px] text-gray-400 mb-3">Thresholds that trigger retraining recommendations or alerts.</p>
        <div>
          {MODEL_TARGETS.map((t) => (
            <NumberSetting
              key={t.id}
              label={t.label}
              description={t.description}
              defaultValue={t.value}
              unit={t.unit}
            />
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
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={saveNotif}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex-shrink-0"
          >
            <Save className="h-3.5 w-3.5" />
            {notifSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* System info */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <h2 className="text-xs font-semibold text-gray-700">System information</h2>
          <Info className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
          {SYSTEM_INFO.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-xs border-b border-gray-50 pb-1.5">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-800 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
