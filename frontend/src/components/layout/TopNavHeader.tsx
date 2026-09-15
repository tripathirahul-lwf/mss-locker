import { useState, useEffect } from 'react';
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Search,
  UserCheck,
  ShieldCheck,
  FileText,
  ChevronRight,
  LayoutGrid,
  Archive,
  X,
  RotateCcw,
  Users,
  Menu,
  Clock,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ChangePasswordModal } from '../common/ChangePasswordModal';
import { ConfirmationModal } from '../common/ConfirmationModal';

export interface TopNavHeaderProps {
  onOpenCommandPalette?: () => void;
}

export function TopNavHeader({ onOpenCommandPalette }: TopNavHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const initials = (user?.name || 'SA').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  // Clean real-time branch timestamp for safe deposit operations
  const [currentTime, setCurrentTime] = useState(() => {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Intl.DateTimeFormat('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(new Date())
      );
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Avoid repetitive "Super Administrator / Super Administrator"
  const roleDisplay = user?.isSuperAdmin ? 'Super Admin' : (user?.role?.name || 'Staff');
  const userDisplayName = user?.name || 'Staff User';
  const isDuplicateRole =
    userDisplayName.toLowerCase().replace(/\s+/g, '') === roleDisplay.toLowerCase().replace(/\s+/g, '') ||
    (userDisplayName.toLowerCase().includes('admin') && roleDisplay.toLowerCase().includes('admin'));
  const userSubtext = isDuplicateRole ? 'Main Vault • Station 01' : roleDisplay;

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setProfileOpen(false);
    setMobileMenuOpen(false);
    setLogoutConfirmOpen(true);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  };

  // Only genuinely useful management pages: Staff & Operator Users and Audit Trail
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
  ].filter((item) => item.allowed);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] backdrop-blur-xl font-sans select-none">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-8">
          {/* Left: Brand Logo, Title & Vault Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="/" className="group flex min-w-0 items-center gap-2.5" aria-label="MSS Locker operations home">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs group-hover:border-emerald-500/40 group-hover:shadow-xs transition-all">
                <img
                  src="/logo.jpeg"
                  alt=""
                  className="h-full w-full rounded-lg object-contain"
                  onError={(event) => {
                    event.currentTarget.src = '/favicon.svg';
                  }}
                />
              </span>
              <div className="leading-none">
                <strong className="block whitespace-nowrap text-sm font-black tracking-tight text-slate-950 group-hover:text-emerald-950 transition-colors">
                  MSS LOCKER
                </strong>
                <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-800">
                  Custody Operations
                </span>
              </div>
            </a>

          </div>

          {/* Center: Live Operational Session Pulse & Real-time Clock */}
          <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-100/60 border border-slate-200/60 text-xs text-slate-500 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700 font-mono tracking-tight text-[11.5px]">{currentTime}</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-800 font-medium text-[11px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Vault Active
            </span>
          </div>

          {/* Right: User Profile & Controls */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {/* Clean, Non-Bloated User Profile & Management Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className={`flex h-9 items-center gap-2 rounded-xl p-1 pr-2 cursor-pointer transition-all border ${
                  profileOpen
                    ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-600/10'
                    : 'border-transparent hover:bg-slate-100 hover:border-slate-200/70'
                }`}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                title="User Profile & Settings"
              >
                <div className="relative shrink-0">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-800 to-teal-900 text-[11px] font-bold text-white shadow-2xs">
                    {initials}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500" />
                </div>
                <div className="hidden max-w-[130px] text-left xl:block">
                  <strong className="block truncate text-xs font-bold text-slate-900 leading-tight">
                    {userDisplayName}
                  </strong>
                  <span className="block truncate text-[10px] font-semibold text-emerald-800 leading-tight">
                    {userSubtext}
                  </span>
                </div>
                <ChevronDown
                  className={`hidden h-3.5 w-3.5 text-slate-400 xl:block transition-transform duration-150 ${
                    profileOpen ? 'rotate-180 text-emerald-700' : ''
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

            {/* Mobile Menu Toggle Button: Horizontal Sibling in Right Header Controls */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 md:hidden cursor-pointer shadow-2xs shrink-0"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer Backdrop & Sheet */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 top-16 bg-slate-950/50 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-150"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation overlay"
            />

            {/* Mobile Sheet Container */}
            <div className="fixed top-16 left-0 right-0 max-h-[calc(100dvh-4rem)] overflow-y-auto bg-white border-b border-slate-200 shadow-2xl z-40 md:hidden animate-in slide-in-from-top-2 duration-200 font-sans divide-y divide-slate-100">
              {/* User Identity & Search Header */}
              <div className="p-3.5 bg-gradient-to-r from-slate-50 to-emerald-50/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-800 text-xs font-bold text-white shadow-2xs shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {user?.name || 'Staff User'}
                      </div>
                      <div className="text-[10px] text-emerald-800 font-medium truncate flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        {user?.role?.name || (user?.isSuperAdmin ? 'Super Administrator' : 'Staff')}
                      </div>
                    </div>
                  </div>

                  {/* Quick Search Shortcut inside Drawer */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenCommandPalette?.();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 hover:text-emerald-700 hover:border-emerald-300 shadow-2xs shrink-0 cursor-pointer active:scale-95 transition"
                  >
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-[11px]">Search</span>
                  </button>
                </div>
              </div>

              {/* Core Custody Operations */}
              <div className="p-3.5 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Custody Operations
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* View Lockers */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/lockers');
                    }}
                    className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      location.pathname.startsWith('/lockers')
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                        : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className={`p-1.5 rounded-lg ${
                          location.pathname.startsWith('/lockers')
                            ? 'bg-emerald-800 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </div>
                      {location.pathname.startsWith('/lockers') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-800 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold leading-tight">View Lockers</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Matrix & Racks</span>
                  </button>

                  {/* Customers */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/customers');
                    }}
                    className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      location.pathname.startsWith('/customers')
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                        : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className={`p-1.5 rounded-lg ${
                          location.pathname.startsWith('/customers')
                            ? 'bg-emerald-800 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        <Users className="h-4 w-4" />
                      </div>
                      {location.pathname.startsWith('/customers') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-800 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold leading-tight">Customers</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">KYC & Profiles</span>
                  </button>

                  {/* Closed Lockers */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/closed-lockers');
                    }}
                    className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      location.pathname.startsWith('/closed-lockers') || location.pathname.startsWith('/closures')
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                        : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className={`p-1.5 rounded-lg ${
                          location.pathname.startsWith('/closed-lockers') || location.pathname.startsWith('/closures')
                            ? 'bg-emerald-800 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        <Archive className="h-4 w-4" />
                      </div>
                      {(location.pathname.startsWith('/closed-lockers') || location.pathname.startsWith('/closures')) && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-800 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold leading-tight">Closed Lockers</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Surrender & Release</span>
                  </button>

                  {/* Renewals */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/renewal-lockers');
                    }}
                    className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      location.pathname.startsWith('/renewal-lockers') || location.pathname.startsWith('/renewals')
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                        : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className={`p-1.5 rounded-lg ${
                          location.pathname.startsWith('/renewal-lockers') || location.pathname.startsWith('/renewals')
                            ? 'bg-emerald-800 text-white'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </div>
                      {(location.pathname.startsWith('/renewal-lockers') || location.pathname.startsWith('/renewals')) && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-800 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold leading-tight">Locker Renewals</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">Due Leases & Invoices</span>
                  </button>
                </div>
              </div>

              {/* Administration & Security */}
              {managementLinks.length > 0 && (
                <div className="p-3.5 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    Administration & Security
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {managementLinks.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            navigate(item.path);
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-slate-50/60 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div
                            className={`p-1 rounded-lg shrink-0 ${
                              isActive
                                ? 'bg-emerald-800 text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold truncate leading-tight">
                              {item.label}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Account & Session Controls */}
              <div className="p-3 bg-slate-50/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setChangePasswordOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  <span>Password</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={logoutConfirmOpen}
        onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Confirm Sign Out"
        message="Are you sure you want to end your active session? Any unsaved custody form entries will be lost."
        confirmLabel="Sign Out Now"
        cancelLabel="Stay Signed In"
        variant="danger"
        isLoading={isLoggingOut}
      />
    </>
  );
}
