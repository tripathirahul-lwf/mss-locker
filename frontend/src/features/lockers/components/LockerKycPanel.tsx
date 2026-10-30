import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, Eye, RefreshCw, Plus, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { CustomerKycDocument } from '../../customers/types';
import { apiClient } from '../../../services/apiClient';
import { usePermission } from '../../../hooks/usePermission';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { DocumentPreviewModal } from '../../customers/components/DocumentPreviewModal';

export interface LockerKycPanelProps {
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  customerPhone?: string;
  photoUrl?: string;
  kycStatus?: string;
  documents: CustomerKycDocument[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}


export function LockerKycPanel({ customerId, customerName = 'Customer', customerCode = '', documents, loading, failed, onRetry, kycStatus }: LockerKycPanelProps) {
  const queryClient = useQueryClient();
  const canManage = usePermission('customers.kyc.manage');
  const inputRef = useRef<HTMLInputElement>(null);
  const replacingRef = useRef<CustomerKycDocument>();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewRequest = useRef<AbortController | null>(null);
  useEffect(() => () => previewRequest.current?.abort(), []);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ doc: CustomerKycDocument; url: string } | null>(null);
  useEffect(() => () => { if (preview?.url.startsWith('blob:')) URL.revokeObjectURL(preview.url); }, [preview]);

  const refresh = () => Promise.all(['customer-kyc', 'locker-allocations', 'lockers', 'customers'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  const chooseFile = (doc?: CustomerKycDocument) => {
    if (!canManage || busyRef.current || loading || failed) return;
    replacingRef.current = doc;
    if (inputRef.current) { inputRef.current.value = ''; inputRef.current.click(); }
  };
  const upload = async (file?: File) => {
    if (!file || !customerId || !canManage || busyRef.current) return;
    setError(''); setNotice('');
    if (file.size > 5 * 1024 * 1024) { setError('File exceeds the 5 MB upload limit.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) { setError('Choose a JPG, PNG, WebP image or PDF.'); return; }
    const existing = replacingRef.current;
    previewRequest.current?.abort(); previewRequest.current = null; setPreviewingId(null);
    busyRef.current = true; setBusy(true);
    try {
      const uploaded = await customerApi.uploadFile(file, 'kyc');
      const attachment = { documentUrl: uploaded.fileUrl, documentName: file.name, mimeType: file.type, fileSize: uploaded.size };
      if (existing) {
        // Keep existing identity metadata when replacing only the attachment.
        await customerApi.updateKycDocument(customerId, existing._id, attachment);
      } else {
        await customerApi.addKycDocument(customerId, { ...attachment, documentType: 'OTHER', documentNumber: '', isPrimary: documents.length === 0 });
      }
      setNotice(existing ? 'KYC document updated successfully.' : 'KYC document uploaded successfully.');
    } catch (err: any) { setError(err.response?.data?.message || 'Could not upload the document. Please retry.'); }
    finally { await refresh(); busyRef.current = false; setBusy(false); }
  };
  const remove = async (doc: CustomerKycDocument) => {
    if (!customerId || !canManage || busyRef.current) return;
    previewRequest.current?.abort(); previewRequest.current = null; setPreviewingId(null);
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await customerApi.deleteKycDocument(customerId, doc._id);
      setDeleting(null); setNotice('KYC document deleted successfully.');
      if (preview?.doc._id === doc._id) setPreview(null);
    } catch (err: any) { setError(err.response?.data?.message || 'Could not delete the document. Please retry.'); }
    finally { await refresh(); busyRef.current = false; setBusy(false); }
  };
  const inspect = async (doc: CustomerKycDocument) => {
    if (busyRef.current) return;
    previewRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    setPreviewingId(doc._id); setError('');
    try {
      let url = doc.documentUrl;
      if (url.startsWith('/uploads/kyc/') || url.startsWith('/api/')) {
        const resource = url.startsWith('/api/') ? url.slice(4) : `/upload/private/${url.split('/').pop()}`;
        const response = await apiClient.get(resource, { responseType: 'blob', signal: controller.signal });
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(response.data);
      }
      if (!controller.signal.aborted) setPreview({ doc, url });
    } catch {
      if (!controller.signal.aborted) setError('Could not load document preview. Please retry.');
    } finally {
      if (previewRequest.current === controller) {
        previewRequest.current = null;
        setPreviewingId(null);
      }
    }
  };
  const card = 'rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-4 min-w-0';
  const action = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50';
  if (!customerId) return <p className="p-6 text-slate-500">Assign this locker to a customer before uploading KYC documents.</p>;
  return (
    <div role="region" aria-label="Locker KYC documents" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div><h3 className="font-bold text-slate-900">KYC Documents</h3><p className="mt-1 text-sm text-slate-500">Upload images or PDFs, up to 5 MB each.</p></div>
        <span className="text-sm font-semibold text-emerald-700">{documents.length} document{documents.length === 1 ? '' : 's'} on record</span>
      </div>
      {!loading && !failed && kycStatus === 'VERIFIED' && documents.length === 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Legacy verification is recorded, but no digital KYC documents are attached. Upload documents to keep this record complete.</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading documents...</p> : failed ? <div role="alert">Could not load documents. <button type="button" onClick={onRetry} className={action}>Retry</button></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc, index) => <div key={doc._id} role="group" aria-label={`KYC document ${index + 1}`} className={`${card} border-emerald-200 bg-emerald-50/20`}>
            <div className="flex items-center justify-between"><FileText className="h-10 w-10 rounded-xl bg-emerald-100 p-2 text-emerald-700" /><span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800"><CheckCircle2 className="h-3 w-3" />Uploaded</span></div>
            <h4 className="font-bold text-slate-900">KYC Document{documents.length > 1 ? ` ${index + 1}` : ''}</h4>
            <div className="rounded-xl border border-emerald-100 bg-white p-3"><p title={doc.documentName} className="truncate text-sm font-semibold text-slate-700">{doc.documentName || 'Uploaded document'}</p><p className="text-xs text-slate-500">{doc.mimeType === 'application/pdf' ? 'PDF' : 'Image'}{doc.fileSize ? ` / ${Math.ceil(doc.fileSize / 1024)} KB` : ''}</p></div>
            <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <button type="button" disabled={busy || previewingId === doc._id} aria-busy={previewingId === doc._id} onClick={() => inspect(doc)} className={`${action} flex-1 bg-emerald-800 text-white`}>{previewingId === doc._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}Preview</button>
              {canManage && <><button type="button" disabled={busy} onClick={() => chooseFile(doc)} className={action}><RefreshCw className="h-4 w-4" />Replace</button><button type="button" disabled={busy} onClick={() => setDeleting(doc._id)} className={`${action} text-red-700`}><Trash2 className="h-4 w-4" />Delete</button></>}
            </div>
          </div>)}
          {canManage && <div className={`${card} border-dashed`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busyRef.current) { replacingRef.current = undefined; void upload(event.dataTransfer.files[0]); } }}>
            <FileText className="h-10 w-10 rounded-xl bg-slate-100 p-2 text-slate-500" />
            <h4 className="font-bold text-slate-900">{documents.length ? 'Add another document' : 'KYC Document'}</h4>
            <p className="text-sm text-slate-500">Click to upload or drag a file here.</p>
            <button type="button" disabled={busy} onClick={() => chooseFile()} className={`${action} mt-auto bg-emerald-800 text-white`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : documents.length ? <Plus className="h-5 w-5" /> : <Upload className="h-4 w-4" />}{documents.length ? 'Add document' : 'Upload document'}</button>
          </div>}
          {!canManage && documents.length === 0 && <p className="text-sm text-slate-500">No documents uploaded.</p>}
        </div>
      )}
      <input ref={inputRef} type="file" aria-label="KYC document file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={busy || !canManage || loading || failed} onChange={event => void upload(event.target.files?.[0])} />
      <ConfirmationModal
        isOpen={Boolean(deleting)}
        title="Delete KYC document?"
        description={<><p>This document will be removed from the customer's KYC records.</p><p className="break-words font-semibold text-slate-800">{documents.find(doc => doc._id === deleting)?.documentName || 'KYC Document'}</p></>}
        confirmText="Delete document"
        variant="danger"
        isLoading={busy}
        onClose={() => { if (!busyRef.current) setDeleting(null); }}
        onConfirm={() => { const doc = documents.find(item => item._id === deleting); if (doc) return remove(doc); }}
      />
      {preview && <DocumentPreviewModal isOpen onClose={() => setPreview(null)} documentUrl={preview.url} documentName={preview.doc.documentName || 'KYC Document'} mimeType={preview.doc.mimeType} customerName={customerName} customerCode={customerCode} documentType="KYC Document" fileSize={preview.doc.fileSize} />}
    </div>
  );
}
