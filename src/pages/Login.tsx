import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { isAxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';

function apiCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

function apiMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (!isAxiosError(err)) {
        setError('An unexpected error occurred. Please try again.');
        return;
      }

      const code = apiCode(err);

      if (code === 'INVITE_PENDING') {
        setError('You must accept your invite link and set a password before you can sign in. Check your email for the invite link.');
        return;
      }

      if (code === 'ACCOUNT_DEACTIVATED') {
        // Let RequireAuth / AuthContext handle the redirect to /deactivated
        navigate('/deactivated', { replace: true });
        return;
      }

      if (!err.response) {
        setError('Cannot reach the server. Check your internet connection and try again.');
        return;
      }

      if (err.response.status === 401) {
        setError('Invalid email or password.');
        return;
      }

      if (err.response.status === 503) {
        setError('Service temporarily unavailable. Please try again in a moment.');
        return;
      }

      // Show the server's message if available, otherwise generic
      setError(apiMessage(err) ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen app-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">ImmuniWatch</span>
          </div>
          <p className="text-sm text-gray-500">Nigeria · Vaccine Misinformation Monitoring</p>
        </div>

        {/* Card */}
        <div className="glass-card shadow-lg p-6 sm:p-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h1>
          <p className="text-xs text-gray-400 mb-6">Enter your credentials to access the dashboard</p>

          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="you@healthcenter.gov.ng"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? <><Spinner size="sm" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          New to ImmuniWatch?{' '}
          <span className="text-gray-500">Check your email for an invite link from your administrator.</span>
        </p>
      </div>
    </div>
  );
}
