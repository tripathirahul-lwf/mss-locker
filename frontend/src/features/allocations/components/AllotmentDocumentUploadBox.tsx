import React,{ useEffect,useState,useRef } from 'react';
import {
Eye,
Trash2,
FileText,
CheckCircle2,
Camera,
CreditCard,
Receipt
} from 'lucide-react';

export interface AllotmentDocumentUploadBoxProps {
  label: string;
  helperText?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onPreview: (file: File, label: string) => void;
  imagesOnly?: boolean;
  disabled?: boolean;
  category?: 'receipt' | 'photo' | 'id';
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AllotmentDocumentUploadBox({
  label,
  helperText,
  file,
  onFileChange,
  onPreview,
  imagesOnly = false,
  disabled = false,
  category = 'id',
}: AllotmentDocumentUploadBoxProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate and manage thumbnail URL
  useEffect(() => {
    if (!file) {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      setThumbnailUrl(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setThumbnailUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      setThumbnailUrl(null);
    }
  }, [file]);

  const handleSelect = (selected: File | null) => {
    if (disabled) return;
    setFileError('');
    if (!selected) {
      onFileChange(null);
      return;
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      ...(imagesOnly ? [] : ['application/pdf']),
    ];

    if (!allowed.includes(selected.type) || selected.size === 0 || selected.size > 5 * 1024 * 1024) {
      setFileError(`Choose ${imagesOnly ? 'a JPG, PNG or WebP image' : 'a PDF, JPG, PNG or WebP file'} between 1 byte and 5 MB.`);
      return;
    }

    onFileChange(selected);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setFileError('');
    onFileChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'receipt':
        return Receipt;
      case 'photo':
        return Camera;
      default:
        return CreditCard;
    }
  };

  const CategoryIcon = getCategoryIcon();
  const isPdf = file?.type === 'application/pdf';

  return (
    <div className="space-y-1.5 font-sans">
      <div className="flex items-center justify-between">
        <label className="block text-xs sm:text-sm font-bold text-slate-700">
          {label}
        </label>
        {helperText && (
          <span className="text-[11px] text-slate-400 font-medium">
            {helperText}
          </span>
        )}
      </div>

      {/* Hidden native input */}
      <input
        ref={inputRef}
        aria-label={label}
        type="file"
        disabled={disabled}
        accept={
          imagesOnly
            ? 'image/jpeg,image/png,image/webp'
            : 'image/jpeg,image/png,image/webp,application/pdf'
        }
        onChange={(e) => { if (e.target.files?.[0]) handleSelect(e.target.files[0]); e.target.value = ''; }}
        className="hidden"
      />

      {fileError && <p role="alert" className="text-sm text-rose-800">{fileError}</p>}
      {!file ? (
        /* Empty Upload Dropzone */
        <div
          role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={`Upload ${label}`}
          onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
          onClick={() => {
            if (!disabled) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!disabled && e.dataTransfer.files.length > 1) { setFileError('Choose one file at a time.'); return; }
            if (!disabled && e.dataTransfer.files?.[0]) {
              handleSelect(e.dataTransfer.files[0]);
            }
          }}
          className={`p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center select-none ${
            disabled
              ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200'
              : dragOver
              ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
              : 'border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/20'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center mb-1.5 shadow-2xs">
            <CategoryIcon className="w-5 h-5" />
          </div>

          <p className="text-xs sm:text-sm font-bold text-slate-800">
            Click to upload or drag & drop {label.toLowerCase()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {imagesOnly
              ? 'Passport headshot (JPG, PNG, WebP up to 5 MB)'
              : 'Document scan (PDF, JPG, PNG, WebP up to 5 MB)'}
          </p>
        </div>
      ) : (
        /* Attached Document Card */
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-emerald-200/90 shadow-2xs flex items-center justify-between gap-3 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-3 min-w-0">
            {/* Thumbnail or PDF Badge */}
            {thumbnailUrl ? (
              <div
                onClick={() => { if (!disabled) onPreview(file, label); }}
                className="relative group w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 shrink-0 cursor-pointer shadow-2xs"
                title="Click to preview image"
              >
                <img
                  src={thumbnailUrl}
                  alt={file.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div
                onClick={() => { if (!disabled) onPreview(file, label); }}
                className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex flex-col items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:bg-emerald-100 transition-colors"
                title="Click to preview PDF"
              >
                <FileText className="w-5 h-5" />
                <span className="text-[9px] font-bold uppercase mt-0.5">PDF</span>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[280px]"
                  title={file.name}
                >
                  {file.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  {formatBytes(file.size)}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {isPdf ? 'PDF' : 'IMAGE'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Document attached &bull; Ready for allotment
              </p>
            </div>
          </div>

          {/* Action Buttons: Preview & Delete */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => { if (!disabled) onPreview(file, label); }}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              disabled={disabled}
              aria-label={`Preview ${label}`}
              title="Preview document"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-700" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={handleDelete}
              className="p-1.5 rounded-xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-700 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
              title="Delete document"
              aria-label={`Delete ${label}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
