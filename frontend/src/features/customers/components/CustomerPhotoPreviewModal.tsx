import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ExternalLink,
  Copy,
  Check,
  User,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface CustomerPhotoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl?: string | null;
  customerName: string;
  customerCode?: string;
  phone?: string;
  email?: string;
}

export function CustomerPhotoPreviewModal({
  isOpen,
  onClose,
  photoUrl,
  customerName,
  customerCode = '',
  phone = '',
  email = '',
}: CustomerPhotoPreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [copiedCode, setCopiedCode] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Reset transforms whenever opened or photoUrl changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(false);
      setHasError(false);
    }
  }, [isOpen, photoUrl]);

  // Lock background scrolling
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Zoom control helpers
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(0.5, +(s - 0.25).toFixed(2));
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const toggleZoomFit = useCallback(() => {
    if (scale === 1) {
      setScale(2);
    } else {
      resetView();
    }
  }, [scale, resetView]);

  const rotateCw = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        rotateCw();
      } else if (e.key === '0') {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, zoomIn, zoomOut, rotateCw, resetView]);

  // Non-passive wheel event listener
  useEffect(() => {
    if (!isOpen) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setScale((s) => Math.min(4, +(s + 0.15).toFixed(2)));
      } else {
        setScale((s) => {
          const next = Math.max(0.5, +(s - 0.15).toFixed(2));
          if (next <= 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
    };

    viewport.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', onNativeWheel);
    };
  }, [isOpen]);

  // Mouse Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || scale <= 1) return;
    setPosition({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleCopyCode = () => {
    if (!customerCode) return;
    navigator.clipboard.writeText(customerCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownload = async () => {
    if (!photoUrl) return;
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanName = (customerName || 'customer-photo')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      a.download = `${cleanName}-profile-photo.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(photoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen || !photoUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] w-screen h-screen flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customer Profile Image Preview"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col bg-[#0B0F19] text-white rounded-2xl border border-slate-700/60 shadow-[0_25px_70px_rgba(0,0,0,0.85)] ring-1 ring-white/10 w-full max-w-2xl h-[82vh] max-h-[720px] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-900/95 border-b border-white/10 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-xs">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-tight truncate font-sans">
                  {customerName}
                </h3>
                <span className="text-[10px] font-sans font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                  Profile Photo
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-sans mt-0.5 truncate">
                {customerCode && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 font-mono text-[10.5px] hover:text-white transition-colors cursor-pointer"
                    title="Click to copy customer code"
                  >
                    <span>{customerCode}</span>
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-60" />
                    )}
                  </button>
                )}
                {phone && <span>• {phone}</span>}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors border border-white/10"
              title="Download original profile photo"
              aria-label="Download photo"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => window.open(photoUrl, '_blank', 'noopener,noreferrer')}
              className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors border border-white/10"
              title="Open photo in new browser tab"
              aria-label="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <div className="h-5 w-px bg-white/10 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-white/10 hover:bg-rose-600 text-white cursor-pointer transition-all border border-white/10"
              title="Close viewer (ESC)"
              aria-label="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Canvas */}
        <div
          ref={viewportRef}
          onDoubleClick={toggleZoomFit}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 relative flex items-center justify-center overflow-hidden bg-radial from-slate-900 via-[#0B0F19] to-black p-4 select-none ${
            scale > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
        >
          {/* Background grid overlay */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {!imageLoaded && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span className="text-xs font-sans">Loading high-res photo...</span>
            </div>
          )}

          {hasError ? (
            <div className="p-8 text-center space-y-3 z-10">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 grid place-items-center mx-auto">
                <User className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-300">Unable to load profile photo</p>
              <p className="text-xs text-slate-500">The file could not be retrieved from storage.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(photoUrl, '_blank', 'noopener,noreferrer')}
                className="mt-2 text-xs border-white/20 text-white hover:bg-white/10"
              >
                Open Direct Link
              </Button>
            </div>
          ) : (
            <img
              src={photoUrl}
              alt={customerName}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageLoaded(true);
                setHasError(true);
              }}
              draggable={false}
              className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-75 ease-out ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            />
          )}

          {/* Quick Double-click hint */}
          <div className="absolute top-3 left-3 pointer-events-none text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-xs font-sans">
            {scale > 1 ? 'Drag to pan • Double click to fit' : 'Scroll or double-click to zoom'}
          </div>
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="px-4 py-2.5 bg-slate-900/95 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0 font-sans">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="h-8 w-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white font-mono text-[11px] font-semibold transition-colors"
              title="Reset Zoom & Rotation (0)"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= 4}
              className="h-8 w-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button
              type="button"
              onClick={rotateCw}
              className="h-8 w-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
              title="Rotate 90° Clockwise (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="h-8 w-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
              title="Reset View (0)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
