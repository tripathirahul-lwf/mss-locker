import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { NAVIGATION_SECTIONS } from '../../constants/navigation';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { hasPermission } = useAuth();

  // Filter sections and items based on logged-in user permissions
  const visibleSections = NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(item.requiredPermission)),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container - Professional Enterprise Theme */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white text-slate-700 border-r border-slate-200/90 shadow-sm transition-all duration-300 ease-in-out font-sans',
          // Desktop/Tablet widths
          collapsed ? 'lg:w-20' : 'lg:w-64',
          // Mobile/Tablet drawer placement
          mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-3.5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-white p-0.5 border border-slate-200 shadow-2xs flex items-center justify-center">
              <img
                src="/logo.jpeg"
                alt="MSS Locker"
                className="h-full w-full object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = '/favicon.svg';
                }}
              />
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm text-slate-900 tracking-tight leading-none">
                  MSS LOCKER
                </span>
                <span className="text-[9.5px] text-emerald-800 font-semibold tracking-wider uppercase truncate mt-1">
                  Custody Operations
                </span>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header collapse toggle button on desktop */}
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Item Lists */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3.5 space-y-5 scrollbar-thin">
          {visibleSections.map((section, idx) => (
            <div key={section.title || idx} className="space-y-1">
              {section.title && (!collapsed || mobileOpen) && (
                <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {section.title}
                </p>
              )}
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={() => {
                        if (mobileOpen) onCloseMobile();
                      }}
                      title={collapsed && !mobileOpen ? item.title : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all select-none',
                          'min-h-[38px] touch-manipulation cursor-pointer',
                          isActive
                            ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200/80 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent',
                          collapsed && !mobileOpen ? 'justify-center px-2' : ''
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              'h-4.5 w-4.5 shrink-0 transition-colors',
                              isActive
                                ? 'text-emerald-700'
                                : 'text-slate-400 group-hover:text-slate-700'
                            )}
                          />
                          {(!collapsed || mobileOpen) && (
                            <div className="flex flex-1 items-center justify-between truncate">
                              <span className="truncate">{item.title}</span>
                              {item.badge && (
                                <span
                                  className={cn(
                                    'ml-auto rounded-md px-1.5 py-0.2 text-[9.5px] font-mono font-bold tracking-tight',
                                    isActive
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300/50'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  )}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer / Workstation & Collapse Toggle */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0 space-y-2">
          {(!collapsed || mobileOpen) && (
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-700 font-semibold">Station 01</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">Vault Core</span>
            </div>
          )}

          {/* Desktop Collapse / Expand Button */}
          <button
            onClick={onToggleCollapse}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl p-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 transition-colors cursor-pointer',
              collapsed ? 'min-h-[36px]' : 'h-8'
            )}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 text-slate-600" />
                <span className="text-[11px]">Collapse Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
