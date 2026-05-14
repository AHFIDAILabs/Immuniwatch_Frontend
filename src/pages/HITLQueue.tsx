import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Edit3, Copy, CheckCheck } from 'lucide-react';
import { hitlApi } from '../api/hitl';
import { api } from '../api/client';
import { LabelBadge, PriorityBadge, StatusBadge } from '../components/Badge';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatRelative, LANG_LABELS, PLATFORM_LABELS, LABEL_META } from '../lib/utils';
import type { HITLReview, ClassificationLabel, HITLPriority, PostLanguage, PostPlatform } from '../types/api';

const PAGE_SIZE = 20;

// ── Override modal ────────────────────────────────────────────────────────────

function OverrideModal({ review, onClose }: { review: HITLReview; onClose: () => void }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState<ClassificationLabel>(
    (review.classificationId as { label: ClassificationLabel }).label ?? 'irrelevant',
  );
  const [response, setResponse] = useState('');
  const [note, setNote]         = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      hitlApi.override(review._id, { overrideLabel: label, editedResponse: response, reviewerNote: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hitl'] }); onClose(); },
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Override Label</label>
        <select
          value={label}
          onChange={(e) => setLabel(e.target.value as ClassificationLabel)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {(Object.keys(LABEL_META) as ClassificationLabel[]).map((l) => (
            <option key={l} value={l}>{LABEL_META[l].label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Corrected Response <span className="text-gray-400">(optional)</span></label>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
          placeholder="Enter corrected public response…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Reviewer Note</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for override…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >Submit Override</button>
      </div>
    </div>
  );
}

// ── Dispatch copy modal (shown after approve) ─────────────────────────────────

function DispatchModal({
  review,
  onClose,
}: {
  review: HITLReview;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const cls = review.classificationId as { suggestedResponse?: string } | null;
  const post = review.postId as { platform?: PostPlatform } | null;
  const response = cls?.suggestedResponse ?? '';
  const platformLabel = post?.platform ? (PLATFORM_LABELS[post.platform] ?? post.platform) : 'platform';

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback — select the textarea content
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Review approved. Post the counter-narrative below manually on <strong>{platformLabel}</strong>.
      </p>
      {response ? (
        <>
          <textarea
            readOnly
            value={response}
            rows={5}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-800 resize-none focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy response'}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              Done
            </button>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          No suggested response generated. Draft your own response before posting.
        </div>
      )}
      {!response && (
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Done</button>
        </div>
      )}
    </div>
  );
}

// ── Context strip (similar posts in 24 h) ─────────────────────────────────────

function ContextStrip({ postId }: { postId: string }) {
  const { data } = useQuery({
    queryKey: ['posts', 'similar-count', postId],
    queryFn: () =>
      api.get<{ label: string; count: number; platforms: Array<{ platform: string; count: number }> }>(
        '/posts/similar-count',
        { params: { postId } },
      ).then((r) => r.data),
    staleTime: 60_000,
  });

  if (!data || data.count === 0) return null;

  const topPlatforms = data.platforms.slice(0, 3)
    .map((p) => `${PLATFORM_LABELS[p.platform as PostPlatform] ?? p.platform} (${p.count})`)
    .join(' · ');

  return (
    <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
      <span>
        <strong>{data.count.toLocaleString()}</strong> similar{' '}
        {data.label} posts in the last 24 h — {topPlatforms || 'multiple platforms'}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HITLQueue() {
  const qc = useQueryClient();
  const [page, setPage]                       = useState(1);
  const [priorityFilter, setPriorityFilter]   = useState<HITLPriority | 'all'>('all');
  const [overrideTarget, setOverrideTarget]   = useState<HITLReview | null>(null);
  const [dispatchTarget, setDispatchTarget]   = useState<HITLReview | null>(null);
  const [focusedId, setFocusedId]             = useState<string | null>(null);
  const [mutationError, setMutationError]     = useState('');
  const reviewsRef = useRef<HITLReview[]>([]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['hitl', { page, priority: priorityFilter }],
    queryFn: () =>
      hitlApi.list({
        page,
        limit:    PAGE_SIZE,
        status:   'pending' as never,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => hitlApi.approve(id),
    onSuccess: (approved) => {
      setMutationError('');
      qc.invalidateQueries({ queryKey: ['hitl'] });
      setDispatchTarget(approved);
    },
    onError: () => setMutationError('Failed to approve. Please try again.'),
  });

  const { mutate: reject } = useMutation({
    mutationFn: (id: string) => hitlApi.reject(id),
    onSuccess: () => { setMutationError(''); qc.invalidateQueries({ queryKey: ['hitl'] }); },
    onError:   () => setMutationError('Failed to reject. Please try again.'),
  });

  const reviews: HITLReview[] = data?.data ?? [];
  reviewsRef.current = reviews;

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  const handleKey = useCallback((e: KeyboardEvent) => {
    // Don't fire when user is typing in an input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const id = focusedId ?? reviewsRef.current[0]?._id;
    if (!id) return;

    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); approve(id); }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); reject(id); }
    if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      const target = reviewsRef.current.find((rv) => rv._id === id);
      if (target) setOverrideTarget(target);
    }
  }, [focusedId, approve, reject]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const TABS: { key: HITLPriority | 'all'; label: string }[] = [
    { key: 'all',      label: `All (${total})` },
    { key: 'high',     label: 'High priority' },
    { key: 'standard', label: 'Standard' },
  ];

  return (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-semibold text-gray-900">HITL review queue</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Keyboard: <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">A</kbd> approve ·{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">R</kbd> reject ·{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">O</kbd> override
          </p>
        </div>
        <div className="flex gap-2">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setPriorityFilter(key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                priorityFilter === key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {isError       && <ErrorBanner message="Failed to load HITL queue." />}
      {mutationError && <ErrorBanner message={mutationError} />}

      {isLoading ? (
        <FullPageSpinner />
      ) : reviews.length === 0 ? (
        <EmptyState title="Queue is clear" description="No pending reviews at this priority level." />
      ) : (
        <>
          <div className="space-y-3">
            {reviews.map((review) => {
              const cls = review.classificationId as {
                label: ClassificationLabel;
                confidence: number;
                suggestedResponse?: string;
                kbEvidence?: Array<{ title: string; summary?: string }>;
              } | null;
              const post = review.postId as {
                _id?: string;
                content: string;
                platform: PostPlatform;
                language: PostLanguage;
              } | null;

              const confidence = cls?.confidence ?? 0;
              const kbEvidence = cls?.kbEvidence ?? [];
              const isFocused  = focusedId === review._id;
              const postId     = (post as { _id?: string })?._id ?? (typeof review.postId === 'string' ? review.postId : '');

              return (
                <div
                  key={review._id}
                  onMouseEnter={() => setFocusedId(review._id)}
                  onMouseLeave={() => setFocusedId(null)}
                  className={`bg-white rounded-xl border p-4 transition-colors ${
                    isFocused ? 'border-emerald-400 shadow-sm' : 'border-gray-200'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {cls && <LabelBadge label={cls.label} />}
                    <PriorityBadge priority={review.priority} />
                    {post && (
                      <span className="text-xs text-gray-400">
                        {PLATFORM_LABELS[post.platform] ?? post.platform}
                        {' · '}
                        {LANG_LABELS[post.language] ?? post.language}
                        {' · '}
                        {formatRelative(review.createdAt)}
                      </span>
                    )}
                    {confidence > 0 && (
                      <span className="ml-auto text-xs text-gray-500">
                        Confidence <strong>{(confidence * 100).toFixed(0)}%</strong>
                      </span>
                    )}
                  </div>

                  {/* Post content */}
                  {post && (
                    <div className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2.5 mb-3 leading-relaxed">
                      "{post.content}"
                    </div>
                  )}

                  {/* Similar-post context strip */}
                  {postId && (cls?.label === 'misinformation' || cls?.label === 'disinformation') && (
                    <ContextStrip postId={postId} />
                  )}

                  {/* KB evidence */}
                  {kbEvidence.length > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3 text-xs flex gap-2">
                      <span className="font-semibold text-emerald-700 flex-shrink-0">KB</span>
                      <span className="text-gray-700">{kbEvidence[0].summary ?? kbEvidence[0].title}</span>
                    </div>
                  ) : cls && (cls.label === 'misinformation' || cls.label === 'disinformation') ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3 text-xs flex gap-2">
                      <span className="font-semibold text-emerald-700 flex-shrink-0">KB</span>
                      <span className="text-gray-500">No knowledge base evidence found — enrich the KB to improve auto-responses.</span>
                    </div>
                  ) : null}

                  {/* Proposed response */}
                  {cls?.suggestedResponse && (
                    <div className="border border-gray-200 rounded-lg px-3 py-2.5 mb-3 text-xs text-gray-600 bg-gray-50 leading-relaxed">
                      <span className="font-medium text-gray-700">Proposed: </span>
                      {cls.suggestedResponse}
                    </div>
                  )}

                  {review.reviewerNote && (
                    <p className="text-xs text-gray-500 italic mb-3">Note: {review.reviewerNote}</p>
                  )}

                  {/* Actions */}
                  {review.status === 'pending' ? (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => approve(review._id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        title="Approve (A)"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => setOverrideTarget(review)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-50"
                        title="Override label (O)"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Override label
                      </button>
                      <button
                        onClick={() => reject(review._id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50"
                        title="Reject (R)"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    <StatusBadge status={review.status} />
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between glass-card px-4 py-3">
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

      {/* Override modal */}
      {overrideTarget && (
        <Modal open onClose={() => setOverrideTarget(null)} title="Override Classification" size="md">
          <OverrideModal review={overrideTarget} onClose={() => setOverrideTarget(null)} />
        </Modal>
      )}

      {/* Dispatch copy modal */}
      {dispatchTarget && (
        <Modal open onClose={() => setDispatchTarget(null)} title="Review Approved — Dispatch Response" size="md">
          <DispatchModal review={dispatchTarget} onClose={() => setDispatchTarget(null)} />
        </Modal>
      )}
    </div>
  );
}
