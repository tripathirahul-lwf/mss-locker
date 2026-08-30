import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, Clock, CreditCard, KeyRound, Layers, LayoutDashboard,
  LogOut, Menu, Search, Settings, Shield, Users, X, UserCog, ScrollText,
  ArrowUpDown, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { NetworkStatusBadge } from '../common/NetworkStatusBadge';
import { ChangePasswordModal } from '../common/ChangePasswordModal';
import { cn } from '../../lib/utils';

export interface TopNavHeaderProps { onOpenCommandPalette: () => void; }

export function TopNavHeader({ onOpenCommandPalette }: TopNavHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const systemButtonRef = useRef<HTMLButtonElement>(null);
  const systemMenuRef = useRef<HTMLDivElement>(null);

  const primaryItems = useMemo(() => [
    { title: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
    { title: 'Lockers', href: '/lockers', icon: KeyRound, permission: 'lockers.view' },
    { title: 'Customers', href: '/customers', icon: Users, permission: 'customers.view' },
    { title: 'Allocations', href: '/allocations', icon: Layers, permission: 'allocations.view' },
    { title: 'Renewals', href: '/renewals', icon: Clock, permission: 'renewals.view' },
    { title: 'Payments', href: '/payments', icon: CreditCard, permission: 'payments.view' },
  ].filter((item) => hasPermission(item.permission)), [hasPermission]);

  const systemItems = useMemo(() => [
    { title: 'Operator Users', description: 'Staff accounts and access', href: '/users', permission: 'users.view', icon: UserCog, exact: true },
    { title: 'Roles & RBAC', description: 'Roles and permission policies', href: '/users/roles', permission: 'roles.view', icon: Shield, exact: false },
    { title: 'Audit Trail', description: 'Security and activity records', href: '/audit-logs', permission: 'audit_logs.view', icon: ScrollText, exact: false },
    { title: 'Import / Export', description: 'Bulk data operations', href: '/import-export', permission: 'imports.view', icon: ArrowUpDown, exact: false },
    { title: 'System Settings', description: 'Business and billing setup', href: '/settings', permission: 'settings.view', icon: SlidersHorizontal, exact: false },
  ].filter((item) => hasPermission(item.permission)), [hasPermission]);

  const currentItem = [...primaryItems, ...systemItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href));
  const systemActive = systemItems.some((item) => item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href));

  useEffect(() => {
    setDrawerOpen(false); setProfileOpen(false); setSystemOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', close); };
  }, [drawerOpen]);

  useEffect(() => {
    if (!systemOpen) return;
    const firstItem = systemMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(systemMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === 'Escape') { event.preventDefault(); setSystemOpen(false); systemButtonRef.current?.focus(); }
      if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1 + items.length) % items.length]?.focus(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
      if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
      if (event.key === 'End') { event.preventDefault(); items[items.length - 1]?.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [systemOpen]);

  const handleLogout = async () => { setProfileOpen(false); await logout(); navigate('/login', { replace: true }); };
  const initials = (user?.name || 'SA').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-3 sm:px-5 lg:px-8">
          <button type="button" onClick={() => setDrawerOpen(!drawerOpen)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 sm:hidden" aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={drawerOpen} aria-controls="responsive-navigation">
            {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <NavLink to="/" className="flex min-w-0 shrink-0 items-center gap-2.5" aria-label="MSS Locker home">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20"><Shield className="h-5 w-5" /></span>
            <span className="hidden leading-none sm:block">
              <strong className="block whitespace-nowrap text-sm font-black tracking-tight text-slate-950">MSS LOCKER</strong>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-blue-700">Safe-deposit operations</span>
            </span>
          </NavLink>

          <div className="mx-1 h-7 w-px bg-slate-200 sm:hidden" aria-hidden="true" />
          <div className="min-w-0 flex-1 sm:hidden">
            <p className="truncate text-sm font-bold text-slate-900">{currentItem?.title || 'MSS Locker'}</p>
            <p className="hidden truncate text-[10px] text-slate-500 sm:block">Operations workspace</p>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex lg:px-6">
            <button type="button" onClick={onOpenCommandPalette} className="flex h-10 w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white hover:shadow-sm" aria-label="Open global search">
              <Search className="h-4 w-4 shrink-0" /><span className="truncate">Search lockers, customers, agreements…</span><kbd className="ml-auto shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold">Ctrl K</kbd>
            </button>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <button type="button" onClick={onOpenCommandPalette} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-700 md:hidden" aria-label="Open global search"><Search className="h-5 w-5" /></button>
            <NetworkStatusBadge className="hidden lg:inline-flex" showText={false} />
            <button type="button" className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Notifications">
              <Bell className="h-[18px] w-[18px]" /><span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </button>

            <div className="relative">
              <button type="button" onClick={() => setProfileOpen(!profileOpen)} className="flex min-h-[44px] items-center gap-2 rounded-xl p-1 pr-1.5 hover:bg-slate-100" aria-expanded={profileOpen} aria-haspopup="true">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">{initials}</span>
                <span className="hidden max-w-[150px] text-left 2xl:block"><strong className="block truncate text-xs text-slate-900">{user?.name || 'Staff User'}</strong><span className="block truncate text-[10px] font-semibold text-blue-700">{user?.role?.name || (user?.isSuperAdmin ? 'Super Administrator' : 'Staff')}</span></span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>
              {profileOpen && <><button className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileOpen(false)} aria-label="Close user menu" /><div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="border-b border-slate-100 bg-slate-50 p-4"><p className="truncate text-sm font-bold text-slate-900">{user?.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p><span className="mt-2 inline-flex rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{user?.role?.name || 'Super Administrator'}</span></div>
                <div className="p-1.5"><button onClick={() => { setProfileOpen(false); setChangePasswordOpen(true); }} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><KeyRound className="h-4 w-4" />Change password</button><button onClick={handleLogout} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-xs font-bold text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" />Sign out & lock session</button></div>
              </div></>}
            </div>
          </div>
        </div>

        <div className="hidden border-t border-slate-100 sm:block">
          <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-3 px-5 lg:px-8">
            <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Primary navigation">
              {primaryItems.map((item) => { const Icon = item.icon; return <NavLink key={item.href} to={item.href} className={({ isActive }) => cn('flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition', isActive ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950')}><Icon className="h-4 w-4" />{item.title}</NavLink>; })}
            </nav>
            {systemItems.length > 0 && <div className="relative shrink-0">
              <button ref={systemButtonRef} type="button" onClick={() => setSystemOpen(!systemOpen)} className={cn('flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition', systemActive || systemOpen ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950')} aria-expanded={systemOpen} aria-haspopup="menu" aria-controls="system-navigation"><Settings className="h-4 w-4" /><span className="hidden md:inline">System</span><ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', systemOpen && 'rotate-180')} /></button>
              {systemOpen && <><button className="fixed inset-0 z-40 cursor-default" onClick={() => setSystemOpen(false)} aria-label="Close system navigation" /><div ref={systemMenuRef} id="system-navigation" role="menu" aria-label="System management" className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,.28)]">
                <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3"><p className="text-xs font-bold text-slate-900">System administration</p><p className="mt-0.5 text-[10px] text-slate-500">Manage access, governance and configuration</p></div>
                <div className="p-1.5">{systemItems.map((item) => { const Icon = item.icon; return <NavLink role="menuitem" tabIndex={-1} end={item.exact} key={item.href} to={item.href} onClick={() => setSystemOpen(false)} className={({isActive}) => cn('group flex min-h-[58px] items-center gap-3 rounded-xl px-3 outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500', isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950')}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-white group-hover:text-blue-700 group-aria-[current=page]:bg-blue-100 group-aria-[current=page]:text-blue-700"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-xs font-bold">{item.title}</span><span className="mt-0.5 block truncate text-[10px] font-normal text-slate-500">{item.description}</span></span><ChevronDown className="ml-auto h-3.5 w-3.5 -rotate-90 text-slate-300 group-hover:text-slate-500" /></NavLink>; })}</div>
                <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[9px] font-medium text-slate-400">Use ↑ ↓ to navigate · Esc to close</div>
              </div></>}
            </div>}
          </div>
        </div>

        {drawerOpen && <><button className="fixed inset-0 top-16 z-30 bg-slate-950/40 backdrop-blur-[2px] sm:hidden" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" /><section id="responsive-navigation" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-slate-50 p-4 pb-24 shadow-2xl sm:hidden" aria-label="Mobile navigation">
          <div className="mx-auto max-w-lg">
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><NetworkStatusBadge /><button onClick={onOpenCommandPalette} className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"><Search className="h-4 w-4" />Search</button></div>
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Operations</p>
            <nav className="grid grid-cols-2 gap-2" aria-label="Mobile primary navigation">{primaryItems.map((item) => { const Icon = item.icon; return <NavLink key={item.href} to={item.href} className={({isActive}) => cn('flex min-h-[64px] items-center gap-3 rounded-2xl border bg-white px-3 text-sm font-bold shadow-sm', isActive ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700')}><Icon className="h-5 w-5" />{item.title}</NavLink>; })}</nav>
            {systemItems.length > 0 && <><p className="mb-2 mt-6 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Management & system</p><nav className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Mobile system navigation">{systemItems.map((item) => { const Icon = item.icon; return <NavLink end={item.exact} key={item.href} to={item.href} className={({isActive}) => cn('flex min-h-[58px] items-center gap-3 border-b border-slate-100 px-4 text-sm font-semibold last:border-0', isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700')}><Icon className="h-4 w-4" /><span><span className="block">{item.title}</span><span className="block text-[10px] font-normal text-slate-500">{item.description}</span></span></NavLink>; })}</nav></>}
          </div>
        </section></>}
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,.08)] backdrop-blur-md sm:hidden" aria-label="Quick navigation">
        {primaryItems.slice(0, 4).map((item) => { const Icon = item.icon; return <NavLink key={item.href} to={item.href} className={({isActive}) => cn('flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold', isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500')}><Icon className="h-5 w-5" /><span>{item.title}</span></NavLink>; })}
      </nav>
      <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </>
  );
}
