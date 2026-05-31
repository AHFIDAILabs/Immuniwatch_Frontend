import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, RefreshCw, Search } from 'lucide-react';
import { kbApi } from '../api/kb';
import { FullPageSpinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { ErrorBanner } from '../components/ErrorBanner';
import { useToast } from '../context/ToastContext';
import { formatDateTime, LANG_FLAGS } from '../lib/utils';
import type { KBDocument, PostLanguage } from '../types/api';

const PAGE_SIZE = 20;

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const fileRef = useRef<HTMLInputElement>(null);
  const [title,     setTitle]     = useState('');
  const [source,    setSource]    = useState('');
  const [language,  setLanguage]  = useState<PostLanguage>('en');
  const [file,      setFile]      = useState<File | null>(null);
  const [immediate, setImmediate] = useState(false);

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => kbApi.upload(file!, { title, source, language, immediate }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kb'] });
      toast.success('Document uploaded', immediate ? 'Indexing started immediately.' : 'Document queued for indexing.');
      onClose();
    },
  });

  const langs = Object.keys(LANG_FLAGS) as PostLanguage[];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Document Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. WHO COVID-19 Vaccine FAQ"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Source / Organization</label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. WHO, NCDC"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as PostLanguage)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {langs.map((l) => (
            <option key={l} value={l}>{LANG_FLAGS[l]} {l.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">File (PDF, DOCX, TXT)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-xs file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={immediate}
          onChange={(e) => setImmediate(e.target.checked)}
          className="rounded"
        />
        Process immediately (index now)
      </label>

      {isError && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">Upload failed. Please check the file and try again.</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={() => mutate()}
          disabled={isPending || !file || !title || !source}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  );
}

export default function KnowledgeBase() {
  const qc    = useQueryClient();
  const toast = useToast().toast;
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [uploadOpen,  setUploadOpen]  = useState(false);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['kb', { page, search }],
    queryFn: () => kbApi.list({ page, limit: PAGE_SIZE, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const { mutate: deleteDoc } = useMutation({
    mutationFn: (id: string) => kbApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kb'] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Delete failed', 'Could not remove the document. Please try again.'),
  });

  const { mutate: reindex, isPending: reindexing } = useMutation({
    mutationFn: () => kbApi.reindex(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['kb'] });
      toast.success('Reindex complete', 'All documents have been re-indexed.');
    },
    onError: () => toast.error('Reindex failed', 'Please try again in a moment.'),
  });

  const docs: KBDocument[] = data?.data ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Knowledge Base</h1>
        <div className="flex gap-2">
          <button
            onClick={() => reindex()}
            disabled={reindexing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${reindexing ? 'animate-spin' : ''}`} />
            Reindex
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      </div>

      {isError && <ErrorBanner message="Failed to load documents." />}

      <div className="glass-card p-4">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search documents…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
            Search
          </button>
        </form>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <FullPageSpinner />
        ) : docs.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Upload WHO guidelines, NCDC advisories, or fact-check articles."
            action={
              <button
                onClick={() => setUploadOpen(true)}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Upload first document
              </button>
            }
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lang</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Uploaded</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((doc) => (
                  <tr key={doc._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{doc.title}</p>
                      {doc.chunkCount !== undefined && (
                        <p className="text-xs text-gray-400">{doc.chunkCount} chunks</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{doc.source}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {LANG_FLAGS[doc.language] ?? ''} {doc.language?.toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${
                        doc.status === 'ready'
                          ? 'bg-green-100 text-green-700'
                          : doc.status === 'processing'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {doc.status ?? 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(doc.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteDoc(doc._id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
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
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document" size="md">
        <UploadModal onClose={() => setUploadOpen(false)} />
      </Modal>
    </div>
  );
}
