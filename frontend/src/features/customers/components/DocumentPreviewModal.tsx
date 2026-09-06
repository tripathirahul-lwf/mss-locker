import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  ShieldCheck,
  FileSearch,
  Info,
  Copy,
  Check,
  Calendar,
  User,
  Hash,
  FileCode,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  documentName?: string;
  documentType?: string;
  documentNumber?: string;
  customerName?: string;
  customerCode?: string;
  mimeType?: string;
  fileSize?: number;
  expiryDate?: string;
  remarks?: string;
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  documentUrl,
  documentName = 'KYC Document',
  documentType = 'Document',
  documentNumber = '',
  customerName = '',
  customerCode = '',
  mimeType = '',
  fileSize = 0,
  expiryDate = '',
  remarks = '',
}: DocumentPreviewModalProps) {
  // Zoom, Pan & Rotation State
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  // UI Panels & Modal Window State
  const [showInspector, setShowInspector] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const isPdf =
    mimeType === 'application/pdf' ||
    documentUrl.toLowerCase().includes('.pdf') ||
    documentName.toLowerCase().endsWith('.pdf');

  // Reset zoom, rotation, pan and window size whenever opened or documentUrl changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(false);
      setHasError(false);
      setNaturalDimensions(null);
      setIsMaximized(false);
    }
  }, [isOpen, documentUrl]);

  // Lock background body scroll
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
    setScale((s) => Math.min(5, +(s + 0.25).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(0.25, +(s - 0.25).toFixed(2));
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

  const rotateCcw = useCallback(() => {
    setRotation((r) => (r - 90 + 360) % 360);
  }, []);

  // Keyboard navigation (+, -, r, 0, i, f, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
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
        if (e.shiftKey) rotateCcw();
        else rotateCw();
      } else if (e.key === '0') {
        e.preventDefault();
        resetView();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowInspector((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsMaximized((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, zoomIn, zoomOut, rotateCw, rotateCcw, resetView]);

  // Non-passive wheel event listener attached directly to viewport
  // Fixes: "Unable to preventDefault inside passive event listener invocation"
  useEffect(() => {
    if (!isOpen || isPdf) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault(); // Active listener with { passive: false } -> legal, prevents background scroll!
      if (e.deltaY < 0) {
        setScale((s) => Math.min(5, +(s + 0.15).toFixed(2)));
      } else {
        setScale((s) => {
          const next = Math.max(0.25, +(s - 0.15).toFixed(2));
          if (next <= 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
    };

    viewport.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', onNativeWheel);
    };
  }, [isOpen, isPdf]);

  // Double click to toggle 100% / 200%
  const handleDoubleClick = () => {
    if (isPdf) return;
    toggleZoomFit();
  };

  // Mouse Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || isPdf) return;
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

  // Copy document number to clipboard
  const handleCopyNumber = () => {
    if (!documentNumber) return;
    navigator.clipboard.writeText(documentNumber.replace(/\s+/g, ''));
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  // Safe file download handler
  const handleDownload = async () => {
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = documentName || `kyc-${documentType.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(documentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const modalContent = (
    /* 1. Backdrop Overlay */
    <div
      className="fixed inset-0 z-[150] w-screen h-screen flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${documentName} Preview`}
    >
      {/* 2. Elevated Modal Popup Window */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex flex-col bg-[#0B0F19] transition-all duration-200 ease-out overflow-hidden ${
          isMaximized
            ? 'fixed inset-0 w-screen h-screen rounded-none border-0'
            : 'w-full max-w-5xl h-[86vh] max-h-[880px] rounded-2xl border border-slate-700/60 shadow-[0_25px_70px_rgba(0,0,0,0.85)] ring-1 ring-white/10'
        }`}
      >
        {/* 1. Header Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900/95 border-b border-white/10 text-white shrink-0 gap-3 z-20 backdrop-blur-md">
          {/* Document Info Left */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-xs">
              {isPdf ? <FileText className="w-5 h-5 text-rose-400" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-tight truncate max-w-[200px] sm:max-w-md" title={documentName}>
                  {documentName}
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                  {isPdf ? 'PDF' : documentType}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-normal mt-0.5 truncate">
                {customerName && <span>{customerName} • </span>}
                {customerCode && <span className="font-mono">{customerCode} • </span>}
                {formatSize(fileSize) && <span>{formatSize(fileSize)} • </span>}
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  ✓ Cloud Vault Secured
                </span>
              </div>
            </div>
          </div>

          {/* Header Actions Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Inspector / Details Drawer */}
            {(documentNumber || customerName || remarks) && (
              <button
                type="button"
                onClick={() => setShowInspector((prev) => !prev)}
                className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                  showInspector
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                    : 'bg-white/10 hover:bg-white/15 border-white/10 text-slate-300 hover:text-white'
                }`}
                title="Toggle Document Details Inspector (I)"
                aria-label="Toggle Document Details Inspector"
              >
                <Info className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{showInspector ? 'Hide Details' : 'Details'}</span>
              </button>
            )}

            {/* Maximize / Restore Window Toggle */}
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors border border-white/10"
              title={isMaximized ? 'Restore to Popup Window (M)' : 'Maximize Window (M)'}
              aria-label="Toggle Window Size"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download Original Copy */}
            <button
              type="button"
              onClick={handleDownload}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors border border-white/10"
              title="Download original document file"
              aria-label="Download document"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Open in New Browser Tab */}
            <button
              type="button"
              onClick={() => window.open(documentUrl, '_blank', 'noopener,noreferrer')}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors border border-white/10"
              title="Open in new browser window"
              aria-label="Open in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-white/10 mx-1" />

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-rose-600 text-white cursor-pointer transition-all border border-white/10"
              title="Close viewer (Esc)"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Main Content Body: Viewport + Optional Inspector Drawer */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Canvas Viewport with Subtle Precision Dot Grid */}
          <div
            ref={viewportRef}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 overflow-hidden relative flex items-center justify-center p-3 sm:p-6 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] bg-slate-950 ${
              !isPdf && scale > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {isPdf ? (
              /* PDF Document Viewer */
              <div className="w-full h-full rounded-xl overflow-hidden bg-white shadow-2xl flex flex-col border border-white/20">
                <iframe
                  src={`${documentUrl}#toolbar=1&navpanes=0`}
                  title={documentName}
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            ) : hasError ? (
              /* Fallback when image fails to load */
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300 max-w-md bg-slate-900/95 rounded-2xl border border-white/15 shadow-2xl backdrop-blur-xl">
                <FileSearch className="w-12 h-12 text-slate-500 mb-3" />
                <h4 className="text-sm font-semibold text-white mb-1">Preview Direct Render Unavailable</h4>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  The image couldn't be displayed directly in the canvas. You can open or download the original file safely.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(documentUrl, '_blank', 'noopener,noreferrer')}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" /> Open in New Tab
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>
            ) : (
              /* High-Definition True-Paper Image Presentation */
              <div
                className="transition-transform duration-75 ease-out select-none flex items-center justify-center max-w-full max-h-full"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  src={documentUrl}
                  alt={documentName}
                  onLoad={(e) => {
                    setImageLoaded(true);
                    const img = e.currentTarget;
                    setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                  }}
                  onError={() => setHasError(true)}
                  draggable={false}
                  className={`${
                    isMaximized ? 'max-h-[82vh] max-w-[90vw]' : 'max-h-[66vh] max-w-full'
                  } object-contain rounded-sm shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border border-white/20 pointer-events-none bg-white transition-all`}
                />
              </div>
            )}

            {/* 3. Floating Island Frosted Glass Toolbar (Center Bottom) */}
            {!isPdf && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/15 text-white shadow-2xl transition-all hover:bg-slate-900">
                {/* Zoom Out */}
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={scale <= 0.25}
                  className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Zoom out (-)"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

              {/* Reset to 100% chip */}
              <button
                type="button"
                onClick={resetView}
                className="min-w-14 h-8 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono font-bold text-slate-200 cursor-pointer flex items-center justify-center transition-colors"
                title="Reset zoom to 100% (0)"
              >
                {Math.round(scale * 100)}%
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={zoomIn}
                disabled={scale >= 5}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Zoom in (+)"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-white/15 mx-1" />

              {/* Rotate Counter-Clockwise */}
              <button
                type="button"
                onClick={rotateCcw}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="Rotate 90° counter-clockwise (Shift + R)"
                aria-label="Rotate counter-clockwise"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Rotate Clockwise */}
              <button
                type="button"
                onClick={rotateCw}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="Rotate 90° clockwise (R)"
                aria-label="Rotate clockwise"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-white/15 mx-1" />

              {/* Double click toggle hint */}
              <button
                type="button"
                onClick={toggleZoomFit}
                className="h-8 px-2.5 rounded-lg hover:bg-white/15 text-xs font-medium text-slate-300 hover:text-white cursor-pointer flex items-center gap-1 transition-colors"
                title="Toggle 200% Zoom or Fit View (Double Click)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{scale > 1 ? 'Reset' : 'Zoom 2x'}</span>
              </button>
            </div>
          )}

          {/* Quick Keyboard Shortcuts Badge (Bottom Left) */}
          {!isPdf && (
            <div className="absolute bottom-4 left-4 z-20 hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-[11px] text-slate-400">
              <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px] text-slate-300">+</kbd>/<kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px] text-slate-300">-</kbd> Zoom</span>
              <span>•</span>
              <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px] text-slate-300">Scroll</kbd> Zoom</span>
              <span>•</span>
              <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px] text-slate-300">R</kbd> Rotate</span>
              <span>•</span>
              <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px] text-slate-300">Double-Click</kbd> 2x</span>
              <span>•</span>
              <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px] text-slate-300">Drag</kbd> Pan</span>
            </div>
          )}
        </div>

        {/* 4. Collapsible Document & Customer Inspection Sidebar */}
        {showInspector && (
          <div className="w-80 sm:w-96 bg-slate-900/98 border-l border-white/10 flex flex-col z-30 shrink-0 shadow-2xl animate-in slide-in-from-right duration-200 backdrop-blur-xl">
            {/* Inspector Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Compliance Inspector
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowInspector(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Close Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs text-slate-300">
              {/* Document Identity Verification Card */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Document Type
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold font-mono">
                    {documentType}
                  </span>
                </div>

                {documentNumber && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">
                      Recorded ID Number (Verify against scan)
                    </span>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-white/10 font-mono font-bold text-sm text-emerald-300 tracking-wider">
                      <span>{documentNumber}</span>
                      <button
                        type="button"
                        onClick={handleCopyNumber}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy document number"
                      >
                        {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Association */}
              {(customerName || customerCode) && (
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Account Holder
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      {customerName ? customerName.slice(0, 2).toUpperCase() : 'CU'}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-xs">{customerName || 'Customer'}</p>
                      {customerCode && <p className="font-mono text-[11px] text-slate-400">{customerCode}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Expiry & Remarks */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Validity & Records
                </span>

                <div className="flex items-center justify-between text-[11.5px] py-1 border-b border-white/5">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Expiry Date
                  </span>
                  <span className="font-medium text-white">
                    {expiryDate
                      ? new Date(expiryDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Lifelong / No Expiry'}
                  </span>
                </div>

                {remarks && (
                  <div className="pt-1">
                    <span className="text-[10.5px] text-slate-400 block mb-0.5">Verification Notes</span>
                    <p className="text-[11.5px] text-slate-200 italic bg-white/5 p-2 rounded-lg border border-white/5">
                      "{remarks}"
                    </p>
                  </div>
                )}
              </div>

              {/* Technical File Metadata */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-[11px]">
                <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Technical Specifications
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">File Format</span>
                  <span className="font-mono text-slate-200">{mimeType || (isPdf ? 'application/pdf' : 'image')}</span>
                </div>
                {naturalDimensions && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Resolution</span>
                    <span className="font-mono text-slate-200">
                      {naturalDimensions.width} × {naturalDimensions.height} px
                    </span>
                  </div>
                )}
                {fileSize > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">File Size</span>
                    <span className="font-mono text-slate-200">{formatSize(fileSize)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Vault Location</span>
                  <span className="font-mono text-emerald-400">Cloudinary Authenticated</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

  return createPortal(modalContent, document.body);
}
