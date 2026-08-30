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

  const from = (location.state as any)?.from?.pathname || '/';

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
          'MSS Locker is currently unable to reach the authentication service. Check your connection and try again.'
        );
      } else {
        setError(
          err.response?.data?.message || 'Sign-in failed. Check your credentials or contact an administrator.'
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
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background ambient subtle elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-slate-300/40 rounded-full blur-3xl" />
      </div>

      {/* Main Dual-Panel Enterprise Card */}
      <div className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10">
        {/* ========================================================================= */}
        {/* LEFT PANEL: Vault Security Hero (Light Slate Theme) (5 cols)              */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-slate-50/90 p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 relative overflow-hidden">
          {/* Subtle Grid Pattern Accent */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#0f172a_1px,transparent_1px)] [background-size:16px_16px]"
            aria-hidden="true"
          />

          {/* Top Brand Header */}
          <div className="space-y-6 relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-wider uppercase">
                  MSS Locker
                </h1>
                <p className="text-xs text-blue-700 font-semibold tracking-tight">
                  Safe-Deposit Locker Operations
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                Secure Locker Operations System
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Authorized workspace for locker inventory, customer custody records, allocations, billing and audited counter operations.
              </p>
            </div>
          </div>

          {/* Security Features Bullet Cards */}
          <div className="space-y-3 my-8 relative">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700 shrink-0 mt-0.5 border border-blue-100">
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">Central Locker Register</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Structured rack, size and operational-status records</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0 mt-0.5 border border-emerald-100">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">Dual-Custody Key Control</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Strict operator authorization with full audit trails</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shrink-0 mt-0.5 border border-amber-100">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">Resilient PWA Workspace</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Cached application shell with online authentication required</p>
              </div>
            </div>
          </div>

          {/* Terminal & Compliance Status Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 relative">
            <div className="flex items-center gap-1.5 font-semibold">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Terminal: CTR-01</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Session Controls Active</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: Authentication Form (Pure White Light Surface) (7 cols)      */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 lg:p-12 flex flex-col justify-between">
          {/* Top Bar inside Form: Status & Portal Title */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                Counter Access Portal
              </span>
            </div>
            <div
              role="status"
              aria-live="polite"
              aria-label={`Service connection: ${status.toLowerCase()}`}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide ${
                isOnline
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {isOnline ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{status}</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="py-6 space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Staff Operator Sign-In
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Provide your authorized operator username or email to begin session.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div id="sign-in-error" role="alert" aria-live="assertive" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in-50">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <div className="space-y-1">
                  <p className="leading-relaxed font-bold">{error}</p>
                </div>
              </div>
            )}

            {capsLockActive && (
              <div role="status" aria-live="polite" className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span><strong>Caps Lock</strong> is ON. Passwords are case-sensitive.</span>
              </div>
            )}

            {/* Username or Email Input */}
            <div className="space-y-1.5">
              <label htmlFor="login-identifier" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Username or Email</span>
                <span className="text-[11px] text-slate-400 font-normal">Registered ID</span>
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
                  placeholder="Enter your registered username or email"
                  required
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'sign-in-error' : undefined}
                  className="pl-10 h-12 text-sm bg-slate-50/70 border-slate-300 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all font-medium rounded-xl"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Account Password
                </label>
                <span className="text-[11px] text-slate-400 font-normal">Case-Sensitive</span>
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
                  placeholder="Enter your security password"
                  required
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'sign-in-error' : undefined}
                  className="pl-10 pr-12 h-12 text-sm bg-slate-50/70 border-slate-300 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all font-medium rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 px-3.5 text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-sm font-bold tracking-wider uppercase bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all rounded-xl cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Access Counter</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {DEV_TEST_CREDENTIALS && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-slate-700">Development testing</p>
                <p className="text-[11px] text-slate-500">Fill the local test administrator credentials.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={fillTestCredentials}
                className="h-9 shrink-0 border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 hover:bg-blue-50"
              >
                Auto-fill credentials
              </Button>
            </div>
          )}

          {/* Security Notice Footer */}
          <div className="pt-6 mt-4 border-t border-slate-100 space-y-3">
            <p className="text-[11px] text-center text-slate-500 leading-normal font-medium">
              Authentication attempts are rate-limited and recorded in the security audit trail. Use only your assigned operator account.
            </p>
          </div>
        </div>
      </div>

      {/* External Footer */}
      <footer className="mt-6 text-center text-xs text-slate-500 font-medium">
        MSS Locker &copy; {new Date().getFullYear()} &bull; Authorized staff access only
      </footer>
    </div>
  );
}
