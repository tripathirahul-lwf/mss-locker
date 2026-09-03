import { NavLink } from 'react-router-dom';
import { Shield, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container - Professional Enterprise Theme */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white text-slate-700 border-r border-slate-200 shadow-2xs transition-all duration-300 ease-in-out',
          // Desktop/Tablet widths
          collapsed ? 'lg:w-20' : 'lg:w-64',
          // Mobile/Tablet drawer placement
          mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-white p-0.5 border border-emerald-100 shadow-xs flex items-center justify-center">
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
                <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                  MSS LOCKER
                </span>
                <span className="text-[10px] text-emerald-800 font-semibold tracking-wider uppercase truncate">
                  Safe-Deposit Vault v1.0
                </span>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Item Lists */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {visibleSections.map((section, idx) => (
            <div key={section.title || idx} className="space-y-1">
              {section.title && (!collapsed || mobileOpen) && (
                <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {section.title}
                </p>
              )}
              <nav className="space-y-1">
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
                          'group flex items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all select-none',
                          'min-h-[42px] touch-manipulation',
                          isActive
                            ? 'bg-emerald-50/90 text-emerald-800 font-bold border border-emerald-200/80 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                          collapsed && !mobileOpen ? 'justify-center px-2' : ''
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              'h-5 w-5 shrink-0 transition-colors',
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
                                    'ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-tight',
                                    isActive
                                      ? 'bg-emerald-200/60 text-emerald-900'
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

        {/* Footer / Collapse Toggle */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/40 shrink-0 hidden lg:block">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 rounded-xl p-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 min-h-[40px] transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 text-slate-600" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
