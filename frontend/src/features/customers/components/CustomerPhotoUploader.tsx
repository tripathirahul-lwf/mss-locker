import React, { useEffect, useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Eye, ZoomIn, ZoomOut, RotateCcw, CheckCircle2 } from 'lucide-react';
import { customerApi } from '../api/customerApi';
import { Button } from '../../../components/ui/button';

interface CustomerPhotoUploaderProps {
  photoUrl?: string;
  onChange: (url: string) => void;
}

export function CustomerPhotoUploader({
  photoUrl,
  onChange,
}: CustomerPhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPreviewOpen(false);
      if (event.key === '+' || event.key === '=') setPreviewScale((scale) => Math.min(3, scale + 0.25));
      if (event.key === '-') setPreviewScale((scale) => Math.max(0.5, scale - 0.25));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  const processFile = async (file: File) => {
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo size exceeds 5MB limit.');
      return;
    }

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP photo files are allowed.');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await customerApi.uploadFile(file, 'photos', setUploadProgress);
      onChange(result.fileUrl);
      setUploadProgress(100);
    } catch (err: any) {
      const isTimeout = err.code === 'ECONNABORTED';
      const isNetworkError = !err.response;
      setError(
        err.response?.data?.message ||
        (isTimeout ? 'Upload timed out. Check your connection and try again.' : '') ||
        (isNetworkError ? 'Upload service is unreachable. Check the backend connection and retry.' : '') ||
        'Failed to upload photo.'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Choose customer profile photo"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col sm:flex-row items-center sm:items-stretch gap-4 p-3 sm:p-3.5 rounded-2xl border transition-all ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
            : photoUrl
            ? 'border-slate-200/90 bg-white shadow-2xs'
            : 'border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
        }`}
      >
        {/* Photo Avatar Preview */}
        <div className="relative shrink-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => photoUrl && setIsPreviewOpen(true)}
            disabled={!photoUrl || isUploading}
            aria-label={photoUrl ? 'Preview customer photo' : 'No customer photo uploaded'}
            className="group relative w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200/80 border border-slate-200 shrink-0 flex items-center justify-center disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 shadow-2xs cursor-pointer transition-transform active:scale-95"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Customer avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-emerald-800 transition-colors">
                <Camera className="w-6 h-6 stroke-[1.75]" />
              </div>
            )}

            {isUploading && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center text-white">
                <Loader2 className="w-5 h-5 animate-spin text-white" aria-hidden="true" />
              </div>
            )}
            {photoUrl && !isUploading && (
              <span className="absolute inset-0 grid place-items-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/45 group-hover:opacity-100 group-focus-visible:bg-slate-950/45 group-focus-visible:opacity-100">
                <Eye className="h-5 w-5" />
              </span>
            )}
          </button>

          {photoUrl && !isUploading && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border-2 border-white">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Upload & Remove Controls */}
        <div className="flex-1 flex flex-col justify-between text-center sm:text-left min-w-0">
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-semibold text-slate-800">
                {photoUrl ? 'Customer Photograph Attached' : 'Customer KYC Photo'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[10px] font-medium text-slate-600">
                Passport 1:1 • Max 5MB
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
              {photoUrl
                ? 'High-resolution photo on file for locker agreement & biometric identification.'
                : isDragging
                ? 'Drop image file here to upload directly'
                : 'Upload recent passport-size photograph (JPG, PNG, or WebP).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-busy={isUploading}
              className="h-8 text-xs font-medium flex items-center gap-1.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>{isUploading ? `Uploading ${uploadProgress}%` : photoUrl ? 'Replace Photo' : 'Upload Photo'}</span>
            </Button>

            {photoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(true)}
                disabled={isUploading}
                className="h-8 px-2.5 text-xs font-medium gap-1.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Zoom View</span>
              </Button>
            )}

            {photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange('')}
                className="h-8 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                <span>Remove</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {isUploading && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Photo upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
          <div className="h-full rounded-full bg-emerald-800 transition-[width]" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-rose-600 font-normal">{error}</p>
      )}

      {isPreviewOpen && photoUrl && (
        <div data-customer-photo-preview="true" className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Customer photo preview" onMouseDown={(event) => event.target === event.currentTarget && setIsPreviewOpen(false)}>
          <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
              <div><h3 className="text-sm font-bold">Customer Photo Preview</h3><p className="text-[11px] text-slate-300">Use + / − keys or controls to zoom</p></div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPreviewScale((scale) => Math.max(0.5, scale - 0.25))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
                <span className="min-w-14 text-center text-xs font-semibold" aria-live="polite">{Math.round(previewScale * 100)}%</span>
                <button type="button" onClick={() => setPreviewScale((scale) => Math.min(3, scale + 0.25))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
                <button type="button" onClick={() => setPreviewScale(1)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Reset zoom"><RotateCcw className="h-4 w-4" /></button>
                <button type="button" autoFocus onClick={() => setIsPreviewOpen(false)} className="ml-2 grid h-10 w-10 place-items-center rounded-lg bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close photo preview"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,_#334155_0,_#0f172a_70%)] p-6">
              <img src={photoUrl} alt="Full size customer preview" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-150" style={{ transform: `scale(${previewScale})` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
