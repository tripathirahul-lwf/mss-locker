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
    <div className="min-h-screen bg-slate-100/80 flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans selection:bg-emerald-800 selection:text-white">
      {/* Main Dual-Panel Enterprise Workstation Container */}
      <div className="w-full max-w-5xl bg-white rounded-2xl lg:rounded-3xl shadow-xl shadow-slate-200/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-200/80">
        
        {/* ========================================================================= */}
        {/* LEFT PANEL: Vault Identity & Infrastructure (5 cols on desktop, compact on mobile) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#043327] via-[#064e3b] to-[#022319] text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-emerald-900/60">
          {/* Subtle Security Lattice Watermark */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none bg-[radial-gradient(#a7f3d0_1px,transparent_1px)] [background-size:20px_20px]"
            aria-hidden="true"
          />

          {/* Top Brand Identity */}
          <div className="space-y-4 lg:space-y-6 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl bg-white p-1 shadow-md border border-emerald-900/30 flex items-center justify-center">
                <img
                  src="/logo.jpeg"
                  alt="MSS Locker - Marudhar Safe Deposit"
                  className="h-full w-full object-contain rounded-xl"
                  onError={(e) => {
                    e.currentTarget.src = '/favicon.svg';
                  }}
                />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase font-sans">
                  MSS LOCKER
                </h1>
                <p className="text-[11px] font-semibold text-emerald-300/90 tracking-wide uppercase font-sans">
                  Safe-Deposit Vault System
                </p>
              </div>
            </div>

            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider bg-emerald-900/70 text-emerald-200 border border-emerald-700/50">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Custody Operations &bull; v2.4.0
              </span>
              <p className="mt-2.5 text-xs text-emerald-100/80 leading-relaxed font-normal">
                Authorized workstation for physical locker inventory, dual-custody customer records, billing registers, and audited counter actions.
              </p>
            </div>
          </div>

          {/* Operational Terminal Context (Hidden on small mobile, visible on tablet & desktop) */}
          <div className="hidden sm:block my-6 lg:my-8 space-y-2.5 relative z-10">
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-sans text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  Terminal Station
                </span>
                <span className="text-emerald-300 font-medium">CTR-01 / Main Vault</span>
              </div>
              <p className="text-[11px] text-emerald-200/70">Branch: Mumbai Central (VL-MUM-01)</p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-sans text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  Dual-Custody Key Control
                </span>
                <span className="text-emerald-300 font-medium">Enforced</span>
              </div>
              <p className="text-[11px] text-emerald-200/70">Master key pairing verification required for all allotments</p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-sans text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Locker Master Register
                </span>
                <span className="text-emerald-300 font-medium">1,484 Units Capacity</span>
              </div>
              <p className="text-[11px] text-emerald-200/70">Racks A through G2 &bull; Active telemetry</p>
            </div>
          </div>

          {/* Compliance Notice Footer (Desktop only) */}
          <div className="hidden lg:block pt-4 border-t border-emerald-800/50 text-[10.5px] text-emerald-300/75 leading-normal relative z-10">
            <p>
              Session activity is cryptographically signed and logged for security compliance. Unauthorized access attempts are monitored and reported.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: Operator Sign-In Form (7 cols)                              */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 lg:p-12 flex flex-col justify-between">
          
          {/* Top Bar: Station Header & Connection Badge */}
          <div className="flex items-center justify-between pb-5 sm:pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                Operator Station Sign-In
              </span>
            </div>
            <div
              role="status"
              aria-live="polite"
              aria-label={`Service connection: ${status.toLowerCase()}`}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide font-sans ${
                isOnline
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
              {isOnline ? <Wifi className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />}
              <span>{isOnline ? 'System Online' : status}</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="py-5 sm:py-6 space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-sans">
              Sign In to Terminal
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-normal font-sans">
              Enter your authorized staff credentials to initiate your counter session.
            </p>
          </div>

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div id="sign-in-error" role="alert" aria-live="assertive" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in-50">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="space-y-1">
                  <p className="leading-relaxed font-semibold">{error}</p>
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
              <label htmlFor="login-identifier" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between font-sans">
                <span>Operator Identifier</span>
                <span className="text-[11px] text-slate-400 font-normal font-sans">Username or Email</span>
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
                  placeholder="e.g. operator_01 or staff@locker.local"
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
                <label htmlFor="login-password" className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                  Security Password
                </label>
                <span className="text-[11px] text-slate-400 font-normal font-sans">Encrypted</span>
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
                  placeholder="Enter security password"
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

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 text-sm font-semibold tracking-wide uppercase bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white shadow-sm flex items-center justify-center gap-2 transition-all rounded-xl cursor-pointer font-sans"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Authenticating Session...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Development Quick-Fill Helper */}
          {DEV_TEST_CREDENTIALS && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5">
              <div className="text-xs">
                <p className="font-bold text-slate-700 font-sans">Development Quick-Fill</p>
                <p className="text-[11px] text-slate-500 font-sans">Auto-fill test administrator credentials</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={fillTestCredentials}
                className="h-8 shrink-0 border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer rounded-lg font-sans"
              >
                Fill Credentials
              </Button>
            </div>
          )}

          {/* Security Notice Footer */}
          <div className="pt-5 sm:pt-6 mt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium font-sans">
              MSS Locker Safe-Deposit System &bull; Authorized Operator Workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
