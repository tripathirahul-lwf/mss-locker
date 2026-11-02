import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { FormEvent,useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { Check,Loader2,X } from 'lucide-react';
import { LockerAllocation } from '../../allocations/types';
import { apiClient } from '../../../services/apiClient';
import { customerApi } from '../../customers/api/customerApi';
import { AttachmentPreview } from '../../allocations/components/AttachmentPreview';
import { Button } from '../../../components/ui/button';
import { ledgerDate } from '../../lockers/components/OccupiedLockerSummary';
interface ReceiptAsset { fileUrl:string; fileName:string; mimeType:string; size:number }
interface CollectionPayload { requestId:string; allocationId:string; expectedRenewalDate:string; nextRenewalDueDate:string; billingCycle:string; amount:number; receiptNumber:string; receiptDate:string; cashReceived:boolean; receipt?:ReceiptAsset }
const terms: Record<string,number> = {ANNUAL:12,TRIENNIAL:36,HALF_YEARLY:6,QUARTERLY:3,MONTHLY:1};
const day = (v?:string) => v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString().slice(0,10) : '';
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function tenureDate(start:string,term:string) {
  if(!start)return '';
  const date=new Date(start+'T00:00:00Z'), n=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+(terms[term]||12));
  date.setUTCDate(Math.min(n,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));return day(date.toISOString());
}
export function RenewLockerModal({allocation,onClose,onComplete}:{allocation:LockerAllocation;onClose:()=>void;onComplete:()=>void}) {
  const paidThrough=day(allocation.paidThroughDate);
  const start=day(allocation.nextRenewalDueDate)||(paidThrough?day(new Date(Date.parse(paidThrough)+86400000).toISOString()):'');
  const initialTerm=terms[allocation.billingCycle]?allocation.billingCycle:'ANNUAL',annual=allocation.rentSnapshot??allocation.annualRent;
  const [term,setTerm]=useState<string>(initialTerm),[amount,setAmount]=useState(Number.isFinite(annual)&&annual>=0?String(Math.round(annual*terms[initialTerm]/12*100)/100):'');
  const [next,setNext]=useState(tenureDate(start,initialTerm)),[receipt,setReceipt]=useState(''),[receiptDate,setReceiptDate]=useState(today);
  const [file,setFile]=useState<File|null>(null),[fileError,setFileError]=useState(''),[error,setError]=useState('');
  const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[uploadProgress,setUploadProgress]=useState<number|null>(null);
  const annualRate=useRef<number|null>(Number.isFinite(annual)&&annual>=0?annual:null);
  const root=useRef<HTMLDivElement>(null),lock=useRef(false),requestId=useRef(crypto.randomUUID()),frozen=useRef<CollectionPayload|null>(null),uploaded=useRef<ReceiptAsset|null>(null);
  const live=useRef({busy,onClose});live.current={busy,onClose};
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const backdrop=root.current?.parentElement;
    const background=Array.from(document.body.children).filter(node=>node!==backdrop&&!node.hasAttribute('inert'));
    background.forEach(node=>node.setAttribute('inert',''));
    const releaseScroll = lockBodyScroll();root.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).at(-1)!==root.current)return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!live.current.busy)live.current.onClose();}
      if(e.key!=='Tab')return;
      const items=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')||[]).filter(v=>v.getClientRects().length&&!v.closest('fieldset:disabled'));
      const first=items[0],last=items.at(-1);if(!first){e.preventDefault();return;}
      if(e.shiftKey&&(document.activeElement===first||!root.current?.contains(document.activeElement)||document.activeElement===root.current)){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!root.current?.contains(document.activeElement)||document.activeElement===root.current)){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key,true);return()=>{releaseScroll();document.removeEventListener('keydown',key,true);background.forEach(node=>node.removeAttribute('inert'));if(previous?.isConnected)previous.focus();};
  },[]);
  const validDay=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&day(v)===v;
  const amountIssue=amount.trim()===''||!Number.isFinite(Number(amount))||Number(amount)<=0||Number(amount)>100000000||Math.abs(Number(amount)*100-Math.round(Number(amount)*100))>=.00001?'Enter a positive amount with at most two decimal places.':'';
  const nextIssue=!validDay(next)||!validDay(start)||next<=start?'Next renewal date must be after the current renewal date.':'';
  const receiptDateIssue=!validDay(receiptDate)||receiptDate>today()||!validDay(day(allocation.startDate))||receiptDate<day(allocation.startDate)?'Receipt date must be between the opening date and today.':'';
  const readiness=allocation.status!=='ACTIVE'?'This agreement is not active.':!validDay(start)?'The current renewal date needs review.':amountIssue||nextIssue||receiptDateIssue||(!receipt.trim()?'Enter a receipt number to enable Renew.':fileError);
  const valid=!readiness;
  const customPeriod=validDay(start)&&validDay(next)&&next>start&&next!==tenureDate(start,term);
  const coverageEnd=validDay(next)?day(new Date(Date.parse(next)-86400000).toISOString()):'';
  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(lock.current||(!valid&&!uncertain))return;
    lock.current=true;setBusy(true);setError('');let posted=false,saved=false;
    try{
      if(!frozen.current){
        if(file&&!uploaded.current){setUploadProgress(0);const asset=await customerApi.uploadFile(file,'payments',setUploadProgress);uploaded.current={fileUrl:asset.fileUrl,fileName:asset.fileName,mimeType:asset.mimeType||file.type,size:asset.size};setUploadProgress(null);}
        frozen.current={requestId:requestId.current,allocationId:allocation._id,expectedRenewalDate:start,nextRenewalDueDate:next,billingCycle:next===tenureDate(start,term)?term:'CUSTOM',amount:Number(amount),receiptNumber:receipt.trim(),receiptDate,cashReceived:true,...(uploaded.current?{receipt:uploaded.current}:{})};
      }
      posted=true;await apiClient.post('/renewals/collect',frozen.current);saved=true;
    }catch(err:any){
      const ambiguous=posted&&(uncertain||!err.response||err.response.status>=500);
      setUncertain(ambiguous);setError(ambiguous?'Could not confirm the saved renewal. Do not collect cash again. Check & retry using this same request.':err.response?.data?.message||err.message||'Could not renew this locker.');
      if(!ambiguous){frozen.current=null;requestId.current=crypto.randomUUID();}
    }finally{lock.current=false;setBusy(false);setUploadProgress(null);}
    if(saved)onComplete();
  };
  const input='mt-2 w-full min-h-14 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-700 sm:text-xl';
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="renew-cash-title" tabIndex={-1} className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl outline-none">
      <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-6 sm:px-8 sm:pt-8"><div><h2 id="renew-cash-title" className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Renew &mdash; Locker {allocation.lockerId?.lockerNumber}</h2><p className="mt-3 text-base text-slate-600 sm:text-lg">{allocation.customerId?.fullName||'Customer'} &middot; current renewal {ledgerDate(start)}</p></div><button type="button" aria-label="Close renewal" disabled={busy} onClick={onClose} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><X/></button></header>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 space-y-5 overflow-y-auto px-5 py-3 sm:px-8">
        {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
        <fieldset disabled={busy||uncertain} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2"><label className="block font-bold text-slate-950">Amount paid (&#8377;)<input aria-label="Amount paid" className={input} type="number" min="0.01" max="100000000" step="0.01" required aria-invalid={Boolean(amountIssue)} aria-describedby={amountIssue?"renew-amount-error":undefined} value={amount} onChange={e=>{setAmount(e.target.value);annualRate.current=e.target.value.trim()!==''&&Number.isFinite(Number(e.target.value))&&Number(e.target.value)>0?Number(e.target.value)*12/terms[term]:null;}}/></label><label className="block font-bold text-slate-950">Next tenure<select aria-label="Next tenure" className={input} value={term} onChange={e=>{const value=e.target.value;setTerm(value);setNext(tenureDate(start,value));setAmount(annualRate.current===null?'':String(Math.round(annualRate.current*terms[value]/12*100)/100));}}><option value="ANNUAL">1 Year</option><option value="TRIENNIAL">3 Years</option><option value="HALF_YEARLY">6 Months</option><option value="QUARTERLY">3 Months</option><option value="MONTHLY">1 Month</option></select></label></div>
          {amountIssue&&<p id="renew-amount-error" className="text-sm text-rose-800">{amountIssue}</p>}
          <div className="rounded-2xl bg-emerald-100 px-4 py-4 text-emerald-900"><label className="flex flex-wrap items-center gap-3 text-lg font-bold">Next renewal date:<input aria-label="Next renewal date" type="date" required aria-invalid={Boolean(nextIssue)} aria-describedby="renew-coverage" value={next} min={start?day(new Date(Date.parse(start)+86400000).toISOString()):undefined} onChange={e=>setNext(e.target.value)} className="min-h-11 max-w-full rounded-lg border border-emerald-300 bg-white/80 px-3 text-lg font-bold text-emerald-900"/></label></div>
          <div id="renew-coverage" className="space-y-2 text-sm text-slate-600">{nextIssue?<p className="text-rose-800">{nextIssue}</p>:<p>Coverage: {ledgerDate(start)} to {ledgerDate(coverageEnd)}.</p>}{customPeriod&&<p className="text-amber-900">Custom renewal date selected. The amount has not been changed. <button type="button" className="font-semibold underline" onClick={()=>setNext(tenureDate(start,term))}>Use tenure date</button></p>}{start>today()&&<p className="rounded-xl bg-amber-50 p-3 text-amber-950">Advance renewal: new coverage starts on {ledgerDate(start)}. Today is the collection date.</p>}</div>
          <div className="grid gap-5 sm:grid-cols-2"><label className="block font-bold text-slate-950">Receipt number <span aria-hidden="true" className="text-red-700">*</span><input aria-label="Receipt number" className={input} required aria-describedby={readiness?"renew-readiness":undefined} maxLength={100} value={receipt} onChange={e=>setReceipt(e.target.value)}/></label><label className="block font-bold text-slate-950">Receipt date<input className={input} type="date" required min={day(allocation.startDate)} max={today()} aria-invalid={Boolean(receiptDateIssue)} aria-describedby={receiptDateIssue?"renew-receipt-date-error":undefined} value={receiptDate} onChange={e=>setReceiptDate(e.target.value)}/></label></div>
          {receiptDateIssue&&<p id="renew-receipt-date-error" className="text-sm text-rose-800">{receiptDateIssue}</p>}
          <div><label className="block font-bold text-slate-950">Receipt image or PDF (optional)<input aria-label="Receipt attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-2 w-full min-w-0 rounded-2xl border border-slate-300 p-3 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold" onChange={e=>{const selected=e.target.files?.[0]||null;setFileError('');if(selected&&(!['image/jpeg','image/png','image/webp','application/pdf'].includes(selected.type)||selected.size===0||selected.size>5*1024*1024)){setFileError('Choose a JPG, PNG, WebP or PDF up to 5 MB.');e.target.value='';setFile(null);uploaded.current=null;return;}setFile(selected);uploaded.current=null;}}/></label><p className="mt-2 text-xs text-slate-500">Images or PDF, up to 5 MB. Amount includes GST; deposit is not collected again.</p>{fileError&&<p role="alert" className="mt-2 text-sm text-red-700">{fileError} <button type="button" onClick={()=>setFileError('')} className="underline">Continue without attachment</button></p>}{file&&<><AttachmentPreview file={file} label="renewal receipt"/><button type="button" onClick={()=>{setFile(null);uploaded.current=null;const control=root.current?.querySelector<HTMLInputElement>('input[type="file"]');if(control)control.value='';}} className="mt-2 text-sm text-red-700 underline">Remove attachment</button></>}</div>
        </fieldset>{uploadProgress!==null&&<p role="status" className="text-sm font-semibold text-emerald-800">Uploading receipt: {uploadProgress}%</p>}{!busy&&!uncertain&&readiness&&<p id="renew-readiness" role="status" className="text-sm font-medium text-slate-700">{readiness}</p>}<p className="text-sm text-slate-600">Select Renew only after receiving this amount in cash. Renewal and receipt are saved together.</p>
      </div><footer className="flex shrink-0 flex-wrap gap-3 px-5 pb-6 pt-5 sm:px-8 sm:pb-8"><Button type="submit" disabled={busy||(!valid&&!uncertain)} className="min-h-14 rounded-2xl bg-emerald-700 px-8 text-lg font-bold text-white hover:bg-emerald-800">{busy?<Loader2 className="mr-2 h-5 w-5 animate-spin"/>:<Check className="mr-2 h-5 w-5"/>}{busy?(uploadProgress!==null?'Uploading receipt...':'Saving...'):uncertain?'Check & retry renewal':'Renew'}</Button><Button type="button" disabled={busy} variant="secondary" onClick={onClose} className="min-h-14 rounded-2xl px-7 text-lg font-bold">Close</Button></footer></form>
    </div>
  </div>,document.body);
}
