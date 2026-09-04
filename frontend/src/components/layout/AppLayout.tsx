import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNavHeader } from './TopNavHeader';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { GlobalSearchModal } from '../../features/search/components/GlobalSearchModal';
import { CustomerQuickPreviewModal } from '../../features/search/components/CustomerQuickPreviewModal';
import { LockerQuickPreviewModal } from '../../features/search/components/LockerQuickPreviewModal';
import { OfflineBanner } from '../../offline/components/OfflineBanner';
import { useAuth } from '../../hooks/useAuth';

export function AppLayout() {
  const { user } = useAuth();
  const userPermissions = (user as any)?.role?.permissions || [];

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);
  const [previewLockerId, setPreviewLockerId] = useState<string | null>(null);

  // Global shortcut handler for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <a
        href="#operations-top"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to operations
      </a>
      {/* Persistent Offline Notification Banner */}
      <OfflineBanner />

      {/* Top Navigation Header without sidebar */}
      <TopNavHeader
        onOpenCommandPalette={() => setSearchModalOpen(true)}
      />

      {/* Full-Width Canvas Main Body */}
      <main id="operations-top" className="flex-1 w-full max-w-[1600px] mx-auto px-3 py-4 sm:p-5 sm:pb-8 lg:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Global Spotlight Search & Command Palette */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectCustomer={(id) => setPreviewCustomerId(id)}
        onSelectLocker={(id) => setPreviewLockerId(id)}
      />

      {/* Walk-in Customer Quick Preview Dossier */}
      <CustomerQuickPreviewModal
        customerId={previewCustomerId}
        isOpen={Boolean(previewCustomerId)}
        onClose={() => setPreviewCustomerId(null)}
        userPermissions={userPermissions}
      />

      {/* Locker Quick Preview Modal */}
      <LockerQuickPreviewModal
        lockerId={previewLockerId}
        isOpen={Boolean(previewLockerId)}
        onClose={() => setPreviewLockerId(null)}
        userPermissions={userPermissions}
      />
    </div>
  );
}
