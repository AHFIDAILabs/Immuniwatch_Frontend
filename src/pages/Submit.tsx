import { useState } from 'react';
import { ShieldCheck, Send, CheckCircle } from 'lucide-react';
import axios from 'axios';

type Platform = 'twitter' | 'facebook' | 'youtube' | 'submission';
type Language = 'en' | 'pcm' | 'ha' | 'yo' | 'ig';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'twitter',    label: 'Twitter / X'    },
  { value: 'facebook',   label: 'Facebook'       },
  { value: 'youtube',    label: 'YouTube'        },
  { value: 'submission', label: 'Other / Unknown'},
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en',  label: 'English'       },
  { value: 'pcm', label: 'Nigerian Pidgin'},
  { value: 'ha',  label: 'Hausa'         },
  { value: 'yo',  label: 'Yoruba'        },
  { value: 'ig',  label: 'Igbo'          },
];

export default function Submit() {
  const [content,       setContent]       = useState('');
  const [platformSeen,  setPlatformSeen]  = useState<Platform>('facebook');
  const [language,      setLanguage]      = useState<Language>('en');
  const [sourceUrl,     setSourceUrl]     = useState('');
  const [submitterNote, setSubmitterNote] = useState('');
  const [loading,       setLoading]       = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [error,         setError]         = useState('');

  async function handleSubmit() {
    setError('');
    if (content.trim().length < 10) {
      setError('Please provide at least 10 characters of content.');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/submit', { content, platformSeen, language, sourceUrl, submitterNote });
      setSuccess(true);
    } catch (err) {
      const data = axios.isAxiosError(err) ? (err.response?.data as Record<string, unknown> | undefined) : undefined;
      const apiMsg = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : null;
      setError(apiMsg ?? 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setContent(''); setSourceUrl(''); setSubmitterNote('');
    setPlatformSeen('facebook'); setLanguage('en');
    setSuccess(false); setError('');
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Submission received</h2>
          <p className="text-sm text-gray-500 mb-6">
            Thank you for helping protect public health. Our team will review this claim and take appropriate action.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Report Health Misinformation</h1>
            <p className="text-xs text-gray-500">NPHCDA · ImmuniWatch Nigeria</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-5">
            Seen a false health claim online? Report it here. Your submission will be reviewed by our team
            and may result in an official correction.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-4">
            {/* Content */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Claim or post content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Paste or type the false health claim here…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">{content.length} / 5000 characters</p>
            </div>

            {/* Platform + Language */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Seen on</label>
                <select
                  value={platformSeen}
                  onChange={(e) => setPlatformSeen(e.target.value as Platform)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* Source URL */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Link to the post <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Additional context <span className="text-gray-400">(optional)</span>
              </label>
              <input
                value={submitterNote}
                onChange={(e) => setSubmitterNote(e.target.value)}
                placeholder="e.g. spreading rapidly in my community, shared by a known account…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              <Send className="h-4 w-4" />
              {loading ? 'Submitting…' : 'Submit report'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          Submissions are anonymous. We do not store your personal information.
          This service is operated by NPHCDA under the ImmuniWatch programme.
        </p>
      </div>
    </div>
  );
}
