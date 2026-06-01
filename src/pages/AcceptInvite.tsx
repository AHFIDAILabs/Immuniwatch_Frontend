import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { authApi, type InviteInfo } from '../api/auth';

type PageState = 'loading' | 'ready' | 'invalid' | 'expired' | 'used' | 'success';

function strength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)                       score++;
  if (pw.length >= 12)                      score++;
  if (/[A-Z]/.test(pw))                     score++;
  if (/[0-9]/.test(pw))                     score++;
  if (/[^A-Za-z0-9]/.test(pw))             score++;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-emerald-500'];
  return { score, label: labels[score] ?? 'Very weak', color: colors[score] ?? 'bg-red-400' };
}

export default function AcceptInvite() {
  const { token }   = useParams<{ token: string }>();
  const navigate    = useNavigate();

  const [state,    setState]    = useState<PageState>('loading');
  const [info,     setInfo]     = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    authApi.getInvite(token)
      .then((data) => { setInfo(data); setState('ready'); })
      .catch((err: unknown) => {
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
        if (code === 'INVITE_EXPIRED')      setState('expired');
        else if (code === 'INVITE_ALREADY_USED') setState('used');
        else                               setState('invalid');
      });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await authApi.acceptInvite(token!, password);
      setState('success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally { setSaving(false); }
  }

  const pw = strength(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  // ── States ─────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Password set!</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your account is ready. You can now log in with your email and the password you just created.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (state === 'invalid' || state === 'expired' || state === 'used') {
    const messages: Record<string, { title: string; body: string }> = {
      invalid:  { title: 'Invalid invite link',   body: 'This invite link is not valid. It may have been deleted or never existed.' },
      expired:  { title: 'Invite link expired',   body: 'This invite link expired after 72 hours. Ask your administrator to resend a new invite.' },
      used:     { title: 'Already accepted',       body: 'This invite has already been used. If you forgot your password, contact your administrator.' },
    };
    const m = messages[state];
    return (
      <div className="min-h-screen app-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{m.title}</h1>
          <p className="text-sm text-gray-500 mb-6">{m.body}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Ready — show set password form ─────────────────────────────────────────

  return (
    <div className="min-h-screen app-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Welcome to ImmuniWatch</h1>
            <p className="text-xs text-gray-400">
              {info?.orgName ? `${info.orgName} · ` : ''}{info?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* User info strip */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs text-emerald-700">
            Setting password for <strong>{info?.name}</strong> ({info?.email})
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Create Password <span className="text-gray-400">(min 8 characters)</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
                required
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength meter */}
            {password.length > 0 && (
              <div className="mt-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < pw.score ? pw.color : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{pw.label}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                mismatch ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {mismatch && <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || password.length < 8 || password !== confirm}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Setting password…' : 'Set Password & Access Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
