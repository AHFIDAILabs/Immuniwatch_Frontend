import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { postsApi } from '../api/posts';
import { hitlApi } from '../api/hitl';
import { LabelBadge } from '../components/Badge';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatRelative, LANG_FLAGS, PLATFORM_LABELS } from '../lib/utils';
import type { PostLanguage, PostPlatform, Post } from '../types/api';

const PAGE_SIZE = 20;

const CONF_COLOR: Record<string, string> = {
  misinformation: 'bg-red-500',
  disinformation: 'bg-pink-500',
  factual:        'bg-emerald-500',
  irrelevant:     'bg-gray-400',
  pending:        'bg-blue-400',
};

function ActionButton({ post }: { post: Post }) {
  const qc = useQueryClient();
  const label     = post.classification?.label;
  const confidence = post.classification?.confidence ?? 0;

  const { mutate: queueForHITL, isPending: queuingHITL } = useMutation({
    mutationFn: () =>
      hitlApi.queuePost
        ? hitlApi.queuePost(post._id)
        : Promise.resolve(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hitl'] }),
  });

  if (!label || label === 'pending') return null;

  if (label === 'misinformation' || label === 'disinformation') {
    if (confidence >= 0.85) {
      return (
        <button
          onClick={() => queueForHITL()}
          disabled={queuingHITL}
          className="px-2.5 py-1 text-[10px] font-medium border border-red-400 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
        >
          Escalate
        </button>
      );
    }
    return (
      <button
        onClick={() => queueForHITL()}
        disabled={queuingHITL}
        className="px-2.5 py-1 text-[10px] font-medium border border-emerald-500 text-emerald-700 rounded-md hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap"
      >
        Queue
      </button>
    );
  }

  if (label === 'factual') {
    return (
      <button className="px-2.5 py-1 text-[10px] font-medium border border-gray-300 text-gray-500 rounded-md hover:bg-gray-50 whitespace-nowrap">
        Archive
      </button>
    );
  }

  return (
    <button className="px-2.5 py-1 text-[10px] font-medium border border-amber-400 text-amber-700 rounded-md hover:bg-amber-50 whitespace-nowrap">
      Review
    </button>
  );
}

export default function Posts() {
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [platform, setPlatform]       = useState('');
  const [language, setLanguage]       = useState('');
  const [labeled, setLabeled]         = useState('');

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['posts', { page, search, platform, language, labeled }],
    queryFn: () =>
      postsApi.list({
        page,
        limit: PAGE_SIZE,
        search:   search   || undefined,
        platform: (platform as PostPlatform)  || undefined,
        language: (language as PostLanguage)  || undefined,
        labeled:  labeled === '' ? undefined : labeled === 'true',
      }),
    placeholderData: (prev) => prev,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const posts     = data?.data ?? [];
  const total     = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Live post feed</h1>
        <span className="text-xs text-gray-500">{total.toLocaleString()} posts</span>
      </div>

      {isError && <ErrorBanner message="Failed to load posts. Please try again." />}

      {/* Filters */}
      <div className="glass-card p-3 flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex-1 min-w-48 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search posts…"
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700">
            Search
          </button>
        </form>
        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All platforms</option>
          {(Object.entries(PLATFORM_LABELS) as [PostPlatform, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={language}
          onChange={(e) => { setLanguage(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All languages</option>
          {(Object.entries(LANG_FLAGS) as [PostLanguage, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v} {k.toUpperCase()}</option>
          ))}
        </select>
        <select
          value={labeled}
          onChange={(e) => { setLabeled(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All posts</option>
          <option value="true">Labeled</option>
          <option value="false">Unlabeled</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <FullPageSpinner />
        ) : posts.length === 0 ? (
          <EmptyState title="No posts found" description="Try adjusting your filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '36%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Post excerpt</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Platform</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Lang</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Label</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Confidence</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Ingested</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {posts.map((post) => {
                    const conf  = post.classification?.confidence ?? 0;
                    const label = post.classification?.label;
                    const color = label ? (CONF_COLOR[label] ?? 'bg-gray-300') : 'bg-gray-200';
                    return (
                      <tr key={post._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <p className="line-clamp-2 text-gray-700 leading-snug">{post.content}</p>
                          {post.authorHandle && (
                            <p className="text-gray-400 mt-0.5">@{post.authorHandle}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 truncate">
                          {PLATFORM_LABELS[post.platform]}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">
                          <span title={post.language}>{LANG_FLAGS[post.language]}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {label ? <LabelBadge label={label} /> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {conf > 0 ? (
                            <div>
                              <span className="text-gray-700">{(conf * 100).toFixed(0)}%</span>
                              <div className="h-1 mt-1 bg-gray-100 rounded-full overflow-hidden w-full">
                                <div className={`h-full rounded-full ${color}`} style={{ width: `${conf * 100}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                          {formatRelative(post.ingestedAt)}
                        </td>
                        <td className="px-3 py-2.5">
                          <ActionButton post={post} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || isFetching}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || isFetching}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
