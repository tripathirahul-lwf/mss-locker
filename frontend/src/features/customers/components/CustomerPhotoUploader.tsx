import React, { useEffect, useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Eye, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo size exceeds 5MB limit.');
      e.target.value = '';
      return;
    }

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP photo files are allowed.');
      e.target.value = '';
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
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {/* Photo Avatar Preview */}
        <button
          type="button"
          onClick={() => photoUrl && setIsPreviewOpen(true)}
          disabled={!photoUrl || isUploading}
          aria-label={photoUrl ? 'Preview customer photo' : 'No customer photo uploaded'}
          className="group relative w-16 h-16 rounded-2xl overflow-hidden bg-emerald-50/60 border border-emerald-200/80 shrink-0 flex items-center justify-center disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 shadow-2xs cursor-pointer"
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Customer avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <Camera className="w-6 h-6 text-emerald-800" />
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

        {/* Upload & Remove Controls */}
        <div className="space-y-1.5 text-xs">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Choose customer profile photo"
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-busy={isUploading}
              className="h-9 text-xs font-medium flex items-center gap-1.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>{isUploading ? `Uploading ${uploadProgress}%` : photoUrl ? 'Replace Photo' : 'Upload Photo'}</span>
            </Button>

            {photoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(true)}
                disabled={isUploading}
                className="h-9 px-2.5 text-xs font-medium gap-1.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Preview</span>
              </Button>
            )}

            {photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange('')}
                className="h-9 px-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                <span>Remove</span>
              </Button>
            )}
          </div>

          <p className="text-[10.5px] text-slate-400 font-normal">
            JPG, PNG, or WebP. Max 5MB. Photo ID proof required for KYC.
          </p>
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
