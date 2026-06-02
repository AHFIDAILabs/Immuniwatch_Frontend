import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import { authApi } from '../api/auth';

type PageState = 'loading' | 'ready' | 'invalid' | 'expired' | 'claimed' | 'success';

function strength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)               score++;
  if (pw.length >= 12)              score++;
  if (/[A-Z]/.test(pw))             score++;
  if (/[0-9]/.test(pw))             score++;
  if (/[^A-Za-z0-9]/.test(pw))     score++;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-emerald-500'];
  return { score, label: labels[score] ?? 'Very weak', color: colors[score] ?? 'bg-red-400' };
}

export default function ClaimOrg() {
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();

  const [state,    setState]    = useState<PageState>('loading');
  const [orgName,  setOrgName]  = useState('');
  const [region,   setRegion]   = useState('');
  const [form,     setForm]     = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    authApi.getOrgClaim(token)
      .then((d) => { setOrgName(d.orgName); setRegion(`${d.region}, ${d.state}`); setState('ready'); })
      .catch((err: unknown) => {
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
        if (code === 'CLAIM_EXPIRED')      setState('expired');
        else if (code === 'CLAIM_ALREADY_USED') setState('claimed');
        else                              setState('invalid');
      });
  }, [token]);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim())             { setError('Name is required.'); return; }
    if (!form.email.trim())            { setError('Email is required.'); return; }
    if (form.password.length < 8)      { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirm){ setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await authApi.acceptOrgClaim({ token: token!, name: form.name, email: form.email, password: form.password });
      setState('success');
      // Auto-navigate to login after 2.5 seconds
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally { setSaving(false); }
  }

  const pw       = strength(form.password);
  const mismatch = form.confirm.length > 0 && form.password !== form.confirm;

  // ── Error states ───────────────────────────────────────────────────────────

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
          <h1 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-sm text-gray-500 mb-2">
            Your administrator account for <strong>{orgName}</strong> has been created. Redirecting to login…
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Sign in with <strong>{form.email}</strong> and the password you just set.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Go to Login now
          </button>
        </div>
      </div>
    );
  }

  if (state !== 'ready') {
    const messages: Record<string, { title: string; body: string }> = {
      invalid: { title: 'Invalid link',          body: 'This invite link is not valid. It may have been revoked or never existed. Contact the platform administrator.' },
      expired: { title: 'Link expired',           body: 'This invite link has expired. Ask the platform admin to generate a new one for your organization.' },
      claimed: { title: 'Already registered',     body: 'An administrator has already been registered for this organization. If you need access, contact your org admin or the platform administrator.' },
    };
    const m = messages[state] ?? messages.invalid;
    return (
      <div className="min-h-screen app-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{m.title}</h1>
          <p className="text-sm text-gray-500 mb-6">{m.body}</p>
          <button onClick={() => navigate('/login')} className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen app-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Set Up Your Admin Account</h1>
            <p className="text-xs text-gray-400">ImmuniWatch Platform</p>
          </div>
        </div>

        {/* Org info strip */}
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
          <Building2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-800">{orgName}</p>
            <p className="text-[11px] text-emerald-600">{region}</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          You're registering as the <strong>Organization Admin</strong> for <strong>{orgName}</strong>.
          Fill in your details and create a secure password to complete setup.
        </p>

        <form onSubmit={submit} className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Your Full Name</label>
            <input
              type="text" value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Dr. Musa Ibrahim"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Your Email Address</label>
            <input
              type="email" value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@healthcenter.gov.ng"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Create Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Min 8 characters"
                required
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.password.length > 0 && (
              <div className="mt-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < pw.score ? pw.color : 'bg-gray-200'}`} />
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{pw.label}</p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password" value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              placeholder="Repeat your password"
              required
              className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mismatch ? 'border-red-400' : 'border-gray-300'}`}
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
            disabled={saving || !form.name || !form.email || form.password.length < 8 || form.password !== form.confirm}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Creating account…' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
