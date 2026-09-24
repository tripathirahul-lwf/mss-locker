import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Shield,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Layers,
  ArrowRight,
  Server,
  ShieldCheck,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useConnectionStatus } from '../offline/hooks/useConnectionStatus';

const DEV_TEST_CREDENTIALS = import.meta.env.DEV
  ? { identifier: 'superadmin', password: 'VaultAdmin@1234' }
  : null;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { status, isOnline } = useConnectionStatus();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from
    ? ((location.state as any).from.pathname + ((location.state as any).from.search || ''))
    : localStorage.getItem('mss_last_active_route') || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Monitor Caps Lock key
  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ identifier, password });
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.message === 'Network Error' || !err.response) {
        setError(
          'Unable to reach MSS Locker server. Please check your internet connection or verify the server is running.'
        );
      } else if (err.response?.status === 429) {
        setError('Too many login attempts. Please wait a moment before trying again.');
      } else if (err.response?.status === 423) {
        setError(
          err.response?.data?.message || 'Account is temporarily locked due to multiple failed attempts. Please try again after 15 minutes.'
        );
      } else if (err.response?.status === 403) {
        setError(
          err.response?.data?.message || 'This account has been deactivated. Please contact your system administrator.'
        );
      } else if (err.response?.status === 503) {
        setError('Database connection error. Please verify database connectivity.');
      } else {
        setError(
          err.response?.data?.message || 'Incorrect username, email, or password. Please double check and try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillTestCredentials = () => {
    if (!DEV_TEST_CREDENTIALS) return;
    setIdentifier(DEV_TEST_CREDENTIALS.identifier);
    setPassword(DEV_TEST_CREDENTIALS.password);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans selection:bg-emerald-800 selection:text-white">
      {/* Clean Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-6 sm:p-8 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1 shadow-md border border-slate-200 mb-1">
            <img
              src="/logo.jpeg"
              alt="MSS Locker"
              className="h-full w-full object-contain rounded-xl"
              onError={(e) => {
                e.currentTarget.src = '/favicon.svg';
              }}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              MSS Locker
            </h1>
            <p className="text-xs text-slate-500 font-medium font-sans">
              Safe-Deposit Vault System
            </p>
          </div>

          {!isOnline && (
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <WifiOff className="w-3 h-3 text-amber-600" />
                Working Offline ({status})
              </span>
            </div>
          )}
        </div>

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div id="sign-in-error" role="alert" aria-live="assertive" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in-50">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <p className="leading-relaxed font-medium">{error}</p>
            </div>
          )}

          {capsLockActive && (
            <div role="status" aria-live="polite" className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span><strong>Caps Lock</strong> is ON</span>
            </div>
          )}

          {/* Username / Email Input */}
          <div className="space-y-1.5">
            <label htmlFor="login-identifier" className="text-xs font-semibold text-slate-700 font-sans block">
              Username or Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="h-4 w-4" />
              </div>
              <Input
                id="login-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyUp={handleKeyUp}
                placeholder="Enter username or email"
                required
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'sign-in-error' : undefined}
                className="pl-10 h-11 text-sm bg-slate-50/70 border-slate-300 focus:bg-white focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20 transition-all font-medium rounded-xl text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-700 font-sans">
                Password
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={handleKeyUp}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'sign-in-error' : undefined}
                className="pl-10 pr-12 h-11 text-sm bg-slate-50/70 border-slate-300 focus:bg-white focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20 transition-all font-medium rounded-xl text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-0 bottom-0 px-3.5 text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 text-sm font-semibold tracking-wide bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white shadow-xs flex items-center justify-center gap-2 transition-all rounded-xl cursor-pointer font-sans"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Development Quick-Fill Helper */}
        {DEV_TEST_CREDENTIALS && (
          <div className="pt-2">
            <button
              type="button"
              onClick={fillTestCredentials}
              className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
              <span>Fill Dev Credentials (superadmin)</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 text-center">
          <p className="text-[11px] text-slate-400 font-medium font-sans">
            MSS Locker &bull; Authorized Operator Workspace
          </p>
        </div>
      </div>
    </div>
  );
}
