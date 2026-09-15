import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';

export type ConfirmationVariant = 'danger' | 'warning' | 'info' | 'emerald';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string | React.ReactNode;
  message?: string | React.ReactNode;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  variant = 'danger',
  isLoading = false,
  children,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const displayDescription = message ?? description ?? '';
  const displayConfirmText = confirmLabel ?? confirmText ?? 'Confirm';
  const displayCancelText = cancelLabel ?? cancelText ?? 'Cancel';

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => {
      confirmBtnRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
      iconBox: 'bg-rose-50 border-rose-200 text-rose-700',
      confirmButton: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
    },
    warning: {
      icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
      iconBox: 'bg-amber-50 border-amber-200 text-amber-700',
      confirmButton: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-600" />,
      iconBox: 'bg-blue-50 border-blue-200 text-blue-700',
      confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs',
    },
    emerald: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-700" />,
      iconBox: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      confirmButton: 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs',
    },
  }[variant];

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150 font-sans"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
        className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`h-10 w-10 rounded-xl shrink-0 border flex items-center justify-center shadow-2xs ${variantStyles.iconBox}`}
          >
            {variantStyles.icon}
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3
                id="confirmation-modal-title"
                className="text-base font-semibold text-slate-900 tracking-tight"
              >
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              id="confirmation-modal-description"
              className="text-xs text-slate-600 leading-relaxed font-normal space-y-2"
            >
              {typeof displayDescription === 'string' ? <p>{displayDescription}</p> : displayDescription}
            </div>
          </div>
        </div>

        {children && <div className="pt-2">{children}</div>}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9 px-4 hover:bg-slate-50 cursor-pointer"
          >
            {displayCancelText}
          </Button>
          <Button
            ref={confirmBtnRef}
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-xl font-semibold text-xs h-9 px-4 cursor-pointer gap-1.5 transition-all active:scale-[0.98] ${variantStyles.confirmButton}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{displayConfirmText}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
