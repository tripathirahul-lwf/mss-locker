import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Unlock, ShieldCheck, LogOut, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface TerminalLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
  onLogout: () => void;
  userName?: string;
  userEmail?: string;
  initials?: string;
  roleName?: string;
}

export const TerminalLockModal: React.FC<TerminalLockModalProps> = ({
  isOpen,
  onUnlock,
  onLogout,
  userName = 'Super Administrator',
  userEmail = 'admin@vaultledger.com',
  initials = 'SA',
  roleName = 'Super Administrator',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlockAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow unlock with any input or direct confirmation for quick resume
    if (password.length > 0 && password.length < 3) {
      setError('Please enter your counter PIN or password');
      return;
    }
    setError(null);
    onUnlock();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in-0 duration-200 font-sans select-none">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900 text-white shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Terminal Header Banner */}
        <div className="relative p-6 text-center border-b border-slate-800/80 bg-gradient-to-b from-slate-800/50 to-transparent">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5">
            <Lock className="h-8 w-8 animate-pulse" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 tracking-wide uppercase">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Workstation Locked
          </span>
          <h2 className="mt-3 text-lg font-bold text-white tracking-tight">
            Safe-Deposit Vault Terminal #01
          </h2>
          <p className="mt-1 text-xs text-slate-400 font-normal">
            Screen temporarily locked for operator security
          </p>
        </div>

        {/* User Clearance Identity */}
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3.5 p-3 rounded-2xl border border-slate-800 bg-slate-800/40">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-sm font-bold text-white shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-white">{userName}</p>
                <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {roleName}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{userEmail}</p>
            </div>
          </div>

          <form onSubmit={handleUnlockAttempt} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Operator Security PIN or Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter credentials to resume..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  className="h-11 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 rounded-xl pr-10 focus-visible:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              <span>Unlock Workstation</span>
            </Button>
          </form>

          {/* Quick Logout Alternative */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Not {userName.split(' ')[0]}? Sign out and end shift</span>
            </button>
          </div>
        </div>

        {/* Protected Banner Footer */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            256-Bit Vault Encrypted
          </span>
          <span className="font-mono text-slate-500">Press Enter to Unlock</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
