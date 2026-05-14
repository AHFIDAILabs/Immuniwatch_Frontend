import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'indigo' | 'green' | 'emerald' | 'red' | 'yellow' | 'blue';
}

const ICON_MAP = {
  indigo:  'bg-indigo-100/80 text-indigo-600',
  green:   'bg-green-100/80 text-green-600',
  emerald: 'bg-emerald-100/80 text-emerald-600',
  red:     'bg-red-100/80 text-red-600',
  yellow:  'bg-yellow-100/80 text-yellow-600',
  blue:    'bg-blue-100/80 text-blue-600',
};

const TINT_MAP = {
  indigo:  'from-indigo-50/60 to-white/50',
  green:   'from-green-50/60 to-white/50',
  emerald: 'from-emerald-50/60 to-white/50',
  red:     'from-red-50/60 to-white/50',
  yellow:  'from-amber-50/60 to-white/50',
  blue:    'from-blue-50/60 to-white/50',
};

export function StatCard({ label, value, sub, icon: Icon, trend, color = 'indigo' }: StatCardProps) {
  return (
    <div className={`glass-card p-5 flex items-start gap-4 bg-gradient-to-br ${TINT_MAP[color]} transition-transform duration-200 hover:-translate-y-0.5`}>
      {Icon && (
        <div className={`flex-shrink-0 rounded-lg p-2.5 ${ICON_MAP[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900 leading-none">{value}</p>
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        {trend && (
          <p className={`mt-1 text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
