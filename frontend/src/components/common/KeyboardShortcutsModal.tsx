import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Keyboard } from 'lucide-react';
import { Button } from '../ui/button';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutGroups = [
    {
      title: 'Global Operations',
      shortcuts: [
        {
          keys: [modKey, 'K'],
          description: 'Spotlight search (Lockers, Customers, Invoices)',
        },
        {
          keys: ['Esc'],
          description: 'Dismiss open modal, drawer, or dropdown menu',
        },
        {
          keys: ['?'],
          description: 'Show keyboard shortcuts cheat-sheet',
        },
      ],
    },
    {
      title: 'Menu & Modal Navigation',
      shortcuts: [
        {
          keys: ['↑', '↓'],
          description: 'Navigate up/down between menu items or records',
        },
        {
          keys: ['Enter'],
          description: 'Select highlighted item or confirm action',
        },
        {
          keys: ['Tab'],
          description: 'Cycle focus across interactive fields',
        },
      ],
    },
    {
      title: 'Vault Counter Clearance',
      shortcuts: [
        {
          keys: [modKey, 'Shift', 'L'],
          description: 'Quickly lock terminal screen when stepping away',
        },
        {
          keys: [modKey, '/'],
          description: 'Open System administration menu',
        },
      ],
    },
  ];

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in-0 duration-150 font-sans">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
              <Keyboard className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-sm font-bold text-slate-900">
                Keyboard Shortcuts Cheat-Sheet
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Speed up vault counter operations with hotkeys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer transition-colors"
            aria-label="Close shortcuts dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </h3>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 divide-y divide-slate-200/60 overflow-hidden">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-white transition-colors"
                  >
                    <span className="text-xs text-slate-700 font-medium">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {shortcut.keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-[24px] text-center px-2 py-0.5 text-xs font-bold font-mono text-slate-700 bg-white rounded-md border border-slate-300 shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200/90 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active on all vault workstations
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 rounded-xl px-4 text-xs font-semibold cursor-pointer"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
