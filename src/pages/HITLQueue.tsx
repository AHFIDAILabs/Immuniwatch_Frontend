import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Edit3, Copy, CheckCheck, Loader2, Send, SkipForward } from 'lucide-react';
import { hitlApi } from '../api/hitl';
import { api } from '../api/client';
import { LabelBadge, PriorityBadge, StatusBadge } from '../components/Badge';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { ErrorBanner } from '../components/ErrorBanner';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { dispatchApi } from '../api/dispatch';
import { formatRelative, LANG_LABELS, PLATFORM_LABELS, LABEL_META } from '../lib/utils';
import type { HITLReview, ClassificationLabel, HITLPriority, PostLanguage, PostPlatform } from '../types/api';

const PAGE_SIZE = 20;

// ── Axios error helper ────────────────────────────────────────────────────────

function apiMessage(err: unknown, fallback: string): string {
  const msg =
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return msg ?? fallback;
}

// ── Override modal ────────────────────────────────────────────────────────────

function OverrideModal({ review, onClose }: { review: HITLReview; onClose: () => void }) {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const [label,    setLabel]    = useState<ClassificationLabel>(
    (review.classificationId as { label: ClassificationLabel }).label ?? 'irrelevant',
  );
  const [response, setResponse] = useState('');
  const [note,     setNote]     = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      hitlApi.override(review._id, { overrideLabel: label, editedResponse: response, reviewerNote: note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hitl'] });
      toast.success('Override submitted', `Label corrected to "${label}"`);
      onClose();
    },
    onError: (err) => {
      toast.error('Override failed', apiMessage(err, 'Could not submit the override. Please try again.'));
    },
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
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Corrected Response <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
          placeholder="Enter corrected public response…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Reviewer Note <span className="text-gray-400">(optional)</span>
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for override…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Submit Override
        </button>
      </div>
    </div>
  );
}

// ── Dispatch modal (shown after approve) ──────────────────────────────────────

type CNVersion = 'short' | 'medium' | 'long';

function DispatchModal({ review, onClose }: { review: HITLReview; onClose: () => void }) {
  const toast = useToast().toast;

  const post = review.postId as { _id?: string; platform?: PostPlatform } | null;
  const cls  = review.classificationId as {
    label?: string; confidence?: number;
    kbEvidence?: Array<{ title: string; snippet: string; score: number }>;
  } | null;

  const postId        = post?._id ?? (typeof review.postId === 'string' ? review.postId : '');
  const platformLabel = post?.platform ? (PLATFORM_LABELS[post.platform] ?? post.platform) : 'platform';
  const kbSeed        = cls?.kbEvidence?.[0]?.snippet ?? cls?.kbEvidence?.[0]?.title ?? '';

  const [text,        setText]        = useState(review.approvedResponse ?? '');
  const [version,     setVersion]     = useState<CNVersion>('short');
  const [copied,      setCopied]      = useState(false);
  const [mlAvailable, setMlAvailable] = useState(false);
  const [cnSource,    setCnSource]    = useState<'ml' | 'groq' | 'template' | null>(null);
  const [cnVersions,  setCnVersions]  = useState<Record<CNVersion, string>>({ short: '', medium: '', long: '' });
  const [done,        setDone]        = useState(false);

  // Fetch / generate counter-narrative from ML
  const { data: cnData, isLoading: cnLoading } = useQuery({
    queryKey:  ['counter-narrative', postId],
    queryFn:   () => dispatchApi.getCounterNarrative(postId),
    enabled:   !!postId,
    staleTime: 5 * 60_000,  // cache for 5 min — generation is expensive
    retry:     1,
  });

  useEffect(() => {
    if (!cnData) return;
    if (cnData.available) {
      const versions = {
        short:  cnData.short  ?? cnData.counterNarrative ?? '',
        medium: cnData.medium ?? cnData.counterNarrative ?? '',
        long:   cnData.long   ?? cnData.counterNarrative ?? '',
      };
      setCnVersions(versions);
      setText(versions.short || versions.medium || versions.long);
      setMlAvailable(true);
      setCnSource(cnData.source ?? null);
    } else if (!text && kbSeed) {
      setText(kbSeed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnData]);

  // When analyst switches version, replace text with that version's content
  function switchVersion(v: CNVersion) {
    setVersion(v);
    if (cnVersions[v]) setText(cnVersions[v]);
  }

  const { mutate: deploy, isPending: deploying } = useMutation({
    mutationFn: () => dispatchApi.deployCounterNarrative(postId, text),
    onSuccess: () => {
      toast.success('Response saved', `Counter-narrative recorded. Copy and post to ${platformLabel}.`);
      setDone(true);
    },
    onError: () => {
      toast.warning('Saved locally', 'Response saved. Copy and post manually.');
      setDone(true);
    },
  });

  const { mutate: skip, isPending: skipping } = useMutation({
    mutationFn: () => dispatchApi.skipCounterNarrative(postId),
    onSuccess: () => { toast.info('Skipped', 'No counter-narrative will be sent.'); onClose(); },
    onError:   () => { toast.info('Skipped', 'Marked as reviewed.'); onClose(); },
  });

  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { /* browser may block */ }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700">
            Response saved. Copy and post it manually on <strong>{platformLabel}</strong>.
          </p>
        </div>
        {text && (
          <textarea readOnly value={text} rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-800 resize-none" />
        )}
        <div className="flex justify-end gap-2">
          {text && (
            <button onClick={() => { void copyToClipboard(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${copied ? 'bg-gray-800 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-500 flex-1">
          Edit the counter-narrative below, then <strong>Deploy</strong> to record it,
          or <strong>Skip</strong> if no reply is needed.
        </p>
        {cnLoading && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Generating…
          </span>
        )}
        {mlAvailable && !cnLoading && cnSource === 'ml' && (
          <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
            ML generated
          </span>
        )}
        {mlAvailable && !cnLoading && cnSource === 'groq' && (
          <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">
            AI generated (Groq)
          </span>
        )}
        {mlAvailable && !cnLoading && cnSource === 'template' && (
          <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
            Template — edit before sending
          </span>
        )}
      </div>

      {/* Version selector — only shown when ML returns multiple versions */}
      {mlAvailable && (cnVersions.medium || cnVersions.long) && (
        <div className="flex gap-1.5">
          {(['short', 'medium', 'long'] as CNVersion[]).map((v) => (
            <button
              key={v}
              onClick={() => switchVersion(v)}
              disabled={!cnVersions[v]}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors disabled:opacity-30 ${
                version === v
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'short' ? 'Short ≤280' : v === 'medium' ? 'Medium' : 'Long'}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 self-center ml-1">Select length then edit</span>
        </div>
      )}

      {/* KB evidence reference */}
      {cls?.kbEvidence && cls.kbEvidence.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs flex gap-2">
          <span className="font-semibold text-emerald-700 flex-shrink-0">KB:</span>
          <span className="text-gray-700 line-clamp-2">{cls.kbEvidence[0].snippet || cls.kbEvidence[0].title}</span>
        </div>
      )}

      {/* Editable textarea */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Counter-narrative <span className="font-normal text-gray-400">(editable)</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={cnLoading
            ? 'Generating counter-narrative from ML service…'
            : 'Draft your counter-narrative here. Switch between Short / Medium / Long once the ML response loads…'}
          disabled={cnLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <p className="text-[11px] text-gray-400 mt-1">{text.length} characters</p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        {/* Left: Skip */}
        <button
          onClick={() => skip()}
          disabled={skipping || deploying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {skipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />}
          Skip
        </button>

        {/* Right: Copy + Deploy */}
        <div className="flex gap-2">
          <button
            onClick={() => { void copyToClipboard(); }}
            disabled={!text.trim()}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-40 ${
              copied ? 'bg-gray-800 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            onClick={() => deploy()}
            disabled={!text.trim() || deploying || skipping}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 font-medium"
          >
            {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Deploy to {platformLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Similar-post context strip ────────────────────────────────────────────────

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
  const qc          = useQueryClient();
  const toast       = useToast().toast;
  const { user }    = useAuth();
  // Override (relabelling ML result) — senior_analyst, supervisor, org_admin, super_admin
  // Analysts can only approve or reject — they cannot change the ML label.
  const canOverride = user?.role === 'senior_analyst'
    || user?.role === 'supervisor'
    || user?.role === 'org_admin'
    || user?.role === 'super_admin';

  const [page,           setPage]           = useState(1);
  const [priorityFilter, setPriorityFilter] = useState<HITLPriority | 'all'>('all');
  const [overrideTarget, setOverrideTarget] = useState<HITLReview | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<HITLReview | null>(null);
  const [focusedId,      setFocusedId]      = useState<string | null>(null);
  const [actingIds,      setActingIds]      = useState<Set<string>>(new Set());
  const reviewsRef = useRef<HITLReview[]>([]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['hitl', { page, priority: priorityFilter }],
    queryFn: () =>
      hitlApi.list({
        page,
        limit:    PAGE_SIZE,
        status:   'pending',
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
      }),
    placeholderData: (prev) => prev,
  });

  function startAction(id: string) { setActingIds((s) => new Set(s).add(id)); }
  function endAction(id: string)   { setActingIds((s) => { const n = new Set(s); n.delete(id); return n; }); }

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => hitlApi.approve(id),
    onMutate:   (id) => startAction(id),
    onSuccess:  (approved, id) => {
      endAction(id);
      void qc.invalidateQueries({ queryKey: ['hitl'] });
      toast.success('Review approved', 'The post has been marked for dispatch.');
      setDispatchTarget(approved);
    },
    onError: (err, id) => {
      endAction(id);
      toast.error('Approve failed', apiMessage(err, 'Could not approve the review. Please try again.'));
    },
  });

  const { mutate: reject } = useMutation({
    mutationFn: (id: string) => hitlApi.reject(id),
    onMutate:   (id) => startAction(id),
    onSuccess:  (_data, id) => {
      endAction(id);
      void qc.invalidateQueries({ queryKey: ['hitl'] });
      toast.success('Review rejected', 'Post removed from the queue.');
    },
    onError: (err, id) => {
      endAction(id);
      toast.error('Reject failed', apiMessage(err, 'Could not reject the review. Please try again.'));
    },
  });

  const reviews: HITLReview[] = data?.data ?? [];
  useEffect(() => { reviewsRef.current = reviews; });

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const id = focusedId ?? reviewsRef.current[0]?._id;
    if (!id) return;

    if ((e.key === 'a' || e.key === 'A') && !actingIds.has(id)) {
      e.preventDefault();
      approve(id);
    }
    if ((e.key === 'r' || e.key === 'R') && !actingIds.has(id)) {
      e.preventDefault();
      reject(id);
    }
    if ((e.key === 'o' || e.key === 'O') && canOverride) {
      e.preventDefault();
      const target = reviewsRef.current.find((rv) => rv._id === id);
      if (target) setOverrideTarget(target);
    }
  }, [focusedId, actingIds, approve, reject]);

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
            Keyboard:{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">A</kbd> approve ·{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">R</kbd> reject
            {canOverride && (
              <> · <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">O</kbd> override</>
            )}
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

      {isError && <ErrorBanner message="Failed to load HITL queue." />}

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
              const isActing   = actingIds.has(review._id);
              const postId     = post?._id ?? (typeof review.postId === 'string' ? review.postId : '');

              return (
                <div
                  key={review._id}
                  onMouseEnter={() => setFocusedId(review._id)}
                  onMouseLeave={() => setFocusedId(null)}
                  className={`bg-white rounded-xl border p-4 transition-colors ${
                    isFocused ? 'border-emerald-400 shadow-sm' : 'border-gray-200'
                  } ${isActing ? 'opacity-60' : ''}`}
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
                        onClick={() => { if (!isActing) approve(review._id); }}
                        disabled={isActing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Approve (A)"
                      >
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Approve
                      </button>
                      {canOverride && (
                        <button
                          onClick={() => { if (!isActing) setOverrideTarget(review); }}
                          disabled={isActing}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Override label (O)"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Override label
                        </button>
                      )}
                      <button
                        onClick={() => { if (!isActing) reject(review._id); }}
                        disabled={isActing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Reject (R)"
                      >
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        Reject
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
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >Previous</button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isFetching}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >Next</button>
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
