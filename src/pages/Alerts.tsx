import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { alertsApi } from '../api/alerts';
import { SeverityBadge } from '../components/Badge';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatDateTime } from '../lib/utils';
import type { Alert } from '../types/api';

const PAGE_SIZE = 20;

export default function Alerts() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [resolved, setResolved] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['alerts', { page, resolved }],
    queryFn: () => alertsApi.list({ page, limit: PAGE_SIZE, resolved }),
    placeholderData: (prev) => prev,
  });

  const { mutate: resolve } = useMutation({
    mutationFn: (id: string) => alertsApi.resolve(id),
    onSuccess: () => { setResolveError(''); qc.invalidateQueries({ queryKey: ['alerts'] }); },
    onError: () => setResolveError('Failed to resolve alert. Please try again.'),
  });

  const alerts: Alert[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Alerts</h1>
        <span className="text-sm text-gray-500">{total.toLocaleString()} alerts</span>
      </div>

      {isError && <ErrorBanner message="Failed to load alerts." />}
      {resolveError && <ErrorBanner message={resolveError} />}

      <div className="flex gap-2">
        <button
          onClick={() => { setResolved(false); setPage(1); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            !resolved ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => { setResolved(true); setPage(1); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            resolved ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Resolved
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <FullPageSpinner />
        ) : alerts.length === 0 ? (
          <EmptyState title={resolved ? 'No resolved alerts' : 'No open alerts'} description="All clear." />
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {alerts.map((alert) => (
                <div key={alert._id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-xs text-gray-400 capitalize">{alert.triggerType.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDateTime(alert.createdAt)}</p>
                    </div>
                    {!alert.isResolved && (
                      <button
                        onClick={() => resolve(alert._id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 flex-shrink-0"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetching}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isFetching}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
