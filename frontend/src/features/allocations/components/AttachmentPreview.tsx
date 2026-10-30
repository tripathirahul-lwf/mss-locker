import { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';

/** Local preview: no upload or saved allotment is needed to inspect an attachment. */
export function AttachmentPreview({ file, label }: { file: File; label: string }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl); setOpen(false); setFailed(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const pdf = file.type === 'application/pdf';
  return <div className="mt-2">
    <button type="button" aria-expanded={open} aria-label={open ? `Close ${label} preview` : `Preview ${label}`} onClick={() => setOpen(value => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
      {open ? <X size={16} /> : <Eye size={16} />}{open ? 'Close preview' : 'Preview document'}
    </button>
    {open && url && <section aria-label={`Preview of ${file.name}`} className="mt-3 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-3 break-all text-sm font-medium text-slate-700">{file.name}</p>
      {failed ? <p role="alert" className="text-sm text-red-700">This file could not be displayed. Choose a valid image or PDF.</p> : pdf ?
        <iframe title={`${label} preview`} src={url} className="h-[420px] w-full rounded-lg border-0 bg-white" /> :
        <img src={url} alt={`${label} preview`} onError={() => setFailed(true)} className="mx-auto max-h-[420px] max-w-full rounded-lg object-contain" />}
    </section>}
  </div>;
}
