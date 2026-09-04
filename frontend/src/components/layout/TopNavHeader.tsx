import { useState } from 'react';
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Search,
  UserCheck,
  ShieldCheck,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { NetworkStatusBadge } from '../common/NetworkStatusBadge';
import { ChangePasswordModal } from '../common/ChangePasswordModal';

export interface TopNavHeaderProps {
  onOpenCommandPalette: () => void;
}

export function TopNavHeader({ onOpenCommandPalette }: TopNavHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const initials = (user?.name || 'SA').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  // Only genuinely useful management pages
  const managementLinks = [
    {
      label: 'Staff & Operator Users',
      description: 'Accounts, permissions & access control',
      path: '/users',
      icon: UserCheck,
      allowed: hasPermission('users.view'),
    },
    {
      label: 'Audit Trail',
      description: 'Security records & tamper-evident logs',
      path: '/audit',
      icon: FileText,
      allowed: hasPermission('audit.view'),
    },
    {
      label: 'System Settings',
      description: 'Vault tariffs, GST rules & preferences',
      path: '/settings',
      icon: SlidersHorizontal,
      allowed: hasPermission('settings.view'),
    },
    {
      label: 'Reports & Analytics',
      description: 'Occupancy reports & financial statements',
      path: '/reports',
      icon: BarChart3,
      allowed: hasPermission('reports.view'),
    },
  ].filter((item) => item.allowed);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-xs backdrop-blur-xl font-sans select-none">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-8">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <a href="/" className="flex min-w-0 items-center gap-2.5" aria-label="MSS Locker operations home">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-xs">
                <img
                  src="/logo.jpeg"
                  alt=""
                  className="h-full w-full rounded-lg object-contain"
                  onError={(event) => {
                    event.currentTarget.src = '/favicon.svg';
                  }}
                />
              </span>
              <span className="leading-none block">
                <strong className="block whitespace-nowrap text-sm font-bold tracking-tight text-slate-950">
                  MSS LOCKER
                </strong>
                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                  Custody Operations
                </span>
              </span>
            </a>
          </div>

          {/* Center: Global Search & Command Palette */}
          <div className="min-w-0 flex-1 px-1 sm:px-4 lg:px-8">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="mx-auto flex h-10 w-full max-w-xl items-center gap-2 sm:gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 text-left text-xs text-slate-500 transition hover:border-emerald-300 hover:bg-white cursor-pointer shadow-2xs group"
              aria-label="Search lockers, customers and agreements"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              <span className="truncate hidden sm:inline">Search lockers, customers, agreements...</span>
              <span className="truncate inline sm:hidden">Search lockers...</span>
              <kbd className="ml-auto hidden shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 md:inline">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
          </div>

          {/* Right: Network Status & User Profile Menu */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <NetworkStatusBadge className="hidden sm:inline-flex" showText={false} />

            {/* Clean, Non-Bloated User Profile & Management Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className={`flex min-h-[40px] items-center gap-2 rounded-xl p-1 pr-1.5 cursor-pointer transition-all ${
                  profileOpen ? 'bg-slate-100 ring-2 ring-emerald-600/20' : 'hover:bg-slate-100'
                }`}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-800 text-xs font-bold text-white shadow-2xs">
                  {initials}
                </span>
                <span className="hidden max-w-[160px] text-left xl:block">
                  <strong className="block truncate text-xs text-slate-900">{user?.name || 'Staff User'}</strong>
                  <span className="block truncate text-[10px] font-semibold text-emerald-800">
                    {user?.role?.name || (user?.isSuperAdmin ? 'Super Administrator' : 'Staff')}
                  </span>
                </span>
                <ChevronDown
                  className={`hidden h-4 w-4 text-slate-400 sm:block transition-transform duration-150 ${
                    profileOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {profileOpen && (
                <>
                  <button
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setProfileOpen(false)}
                    aria-label="Close user menu"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2.5 w-80 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col"
                  >
                    {/* User Identity Header */}
                    <div className="border-b border-slate-100 bg-slate-50/90 p-4 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-sm font-bold text-white shadow-2xs">
                            {initials}
                          </div>
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"
                            title="Active Session"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900 leading-tight">
                            {user?.name || 'Super Administrator'}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 font-normal">
                            {user?.email || 'admin@vaultledger.com'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-50 text-amber-900 border border-amber-200/70">
                              <ShieldCheck className="w-3 h-3 text-amber-700" />
                              {user?.isSuperAdmin ? 'Super Admin' : (user?.role?.name || 'Staff')}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-medium bg-slate-100 text-slate-600 font-mono">
                              Station 01
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Links Container (Clean & Focused) */}
                    <div className="p-2 space-y-1">
                      {/* Section: Management Links */}
                      {managementLinks.length > 0 && (
                        <div className="space-y-0.5 pb-1 mb-1 border-b border-slate-100">
                          <p className="px-2.5 py-1 text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                            Administration
                          </p>
                          {managementLinks.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname.startsWith(item.path);

                            return (
                              <button
                                key={item.path}
                                role="menuitem"
                                onClick={() => {
                                  setProfileOpen(false);
                                  navigate(item.path);
                                }}
                                className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-emerald-50/80 text-emerald-950 font-bold'
                                    : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${
                                      isActive
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700'
                                    }`}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs truncate ${isActive ? 'font-bold text-emerald-950' : 'font-semibold text-slate-800'}`}>
                                      {item.label}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-normal truncate">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${isActive ? 'text-emerald-700' : 'text-slate-300'}`} />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Section: Account & Security */}
                      <button
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          setChangePasswordOpen(true);
                        }}
                        className="group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                            <KeyRound className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="block text-xs font-semibold text-slate-800 group-hover:text-slate-900">
                              Change Password
                            </span>
                            <span className="block text-[10px] text-slate-400 font-normal">
                              Update login credentials
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>

                    {/* Session Termination Footer */}
                    <div className="border-t border-slate-100 p-2 bg-slate-50/60 shrink-0">
                      <button
                        role="menuitem"
                        onClick={handleLogout}
                        className="group flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-7 w-7 place-items-center rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-200 transition-colors">
                            <LogOut className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-rose-700">
                              Sign Out
                            </span>
                            <span className="block text-[10px] text-rose-500/90 font-normal">
                              Safely end counter session
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </>
  );
}
