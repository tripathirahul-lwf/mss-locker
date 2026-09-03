import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  KeyRound,
  LogOut,
  Shield,
} from 'lucide-react';
import { ALL_NAV_ITEMS } from '../../constants/navigation';
import { NetworkStatusBadge } from '../common/NetworkStatusBadge';
import { Avatar } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useAuth } from '../../hooks/useAuth';
import { ChangePasswordModal } from '../common/ChangePasswordModal';

export interface TopHeaderProps {
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
}

export function TopHeader({
  onOpenMobileMenu,
  onOpenCommandPalette,
}: TopHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const currentNav = ALL_NAV_ITEMS.find((item) => item.href === location.pathname) || {
    title: location.pathname === '/offline' ? 'Offline Mode' : 'MSS Locker',
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80 select-none">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
            aria-label="Open Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {currentNav.title}
            </h1>
            <span className="text-[11px] text-slate-500 hidden sm:inline-block font-medium">
              Locker Business Operations (1,484 Units)
            </span>
          </div>
        </div>

        {/* Center: Global Search Trigger Button */}
        <div className="hidden md:flex items-center flex-1 max-w-lg mx-6">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="relative w-full h-10 pl-9 pr-3 text-left text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-500 transition-all flex items-center justify-between shadow-2xs group"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-emerald-700 transition-colors" />
              <span className="truncate">
                Search locker number, customer, phone, agreement #...
              </span>
            </div>
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs shrink-0 ml-2">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: Actions & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile search trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Network Status Badge */}
          <NetworkStatusBadge />

          {/* Notifications Placeholder */}
          <button
            className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            title="Notifications & Vault Alerts"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
          </button>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 min-h-[44px] transition-colors select-none"
              aria-expanded={profileOpen}
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {(user?.name || 'SA').slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {user?.name || 'Staff User'}
                </span>
                <span className="text-[10px] text-emerald-800 font-semibold">
                  {user?.role?.name || (user?.isSuperAdmin ? 'Super Administrator' : 'Staff')}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-2xl py-1 z-50 animate-in fade-in-50 zoom-in-95">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      @{user?.username} ({user?.email})
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md w-fit border border-emerald-200/60">
                      <Shield className="w-3 h-3 text-emerald-700" />
                      <span>{user?.role?.name || 'Super Administrator'}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setChangePasswordOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 min-h-[38px] font-medium transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      <span>Change Password</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 min-h-[38px] font-semibold transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Sign Out (Lock Session)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
