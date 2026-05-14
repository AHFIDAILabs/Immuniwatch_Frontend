import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatDateTime } from '../lib/utils';
import type { AuditEntry, Paginated } from '../types/api';

const PAGE_SIZE = 30;

function fetchAuditLog(params: { page: number; limit: number; resourceType?: string }) {
  return api
    .get<Paginated<AuditEntry>>('/audit', { params })
    .then((r) => r.data);
}

const RESOURCE_TYPES = [
  'Classification', 'HITLReview', 'KnowledgeBase', 'User', 'Alert', 'Post', 'ModelMetrics',
];

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [resourceType, setResourceType] = useState('');

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['audit', { page, resourceType }],
    queryFn: () => fetchAuditLog({ page, limit: PAGE_SIZE, resourceType: resourceType || undefined }),
    placeholderData: (prev) => prev,
  });

  const entries: AuditEntry[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
        <span className="text-sm text-gray-500">{total.toLocaleString()} entries</span>
      </div>

      {isError && <ErrorBanner message="Failed to load audit log." />}

      <div className="glass-card p-4">
        <select
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All resource types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <FullPageSpinner />
        ) : entries.length === 0 ? (
          <EmptyState title="No audit entries" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{entry.actorName ?? String(entry.actor)}</p>
                      {entry.actorRole && (
                        <p className="text-xs text-gray-400 capitalize">{entry.actorRole}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{entry.action.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.resourceType}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{entry.resourceId}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
