import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LockerClosure } from '../types';
import { closureApi } from '../api/closureApi';
import {
  Printer,
  X,
  Copy,
  Check,
  Award,
  ShieldCheck,
} from 'lucide-react';

interface ClosureStatementModalProps {
  closure: LockerClosure | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ClosureStatementModal: React.FC<ClosureStatementModalProps> = ({
  closure,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !closure) return null;

  const customer = closure.customerId;
  const locker = closure.lockerId;
  const allocation = closure.allocationId;
  const snapshot = closure.financialSnapshot;
  const checklist = closure.physicalChecklist;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const html = await closureApi.getStatementHtml(closure._id);

      let iframe = document.getElementById(
        'closure-statement-print-iframe'
      ) as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'closure-statement-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        iframe.contentWindow?.focus();
        setTimeout(() => {
          iframe.contentWindow?.print();
          setIsPrinting(false);
        }, 300);
      } else {
        window.print();
        setIsPrinting(false);
      }
    } catch (err) {
      console.error('Error fetching statement HTML for print:', err);
      window.print();
      setIsPrinting(false);
    }
  };

  const handleCopy = () => {
    const summary = `MSS LOCKER CLOSURE CERTIFICATE\nClosure #: ${closure.closureNumber}\nCustomer: ${customer?.fullName || 'N/A'} (${customer?.customerCode || 'N/A'})\nLocker: #${locker?.lockerNumber || 'N/A'}\nAgreement: ${allocation?.allocationCode || 'N/A'}\nStatus: ${closure.status}\nCompleted By: ${closure.completedBy?.name || 'Vault Staff'}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] w-screen h-screen flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs select-none animate-in fade-in-0 duration-150 print:p-0 print:bg-white"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200 print:border-none print:shadow-none print:max-h-full print:rounded-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/90 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              <Award className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Locker Surrender & Closure Certificate
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {closure.closureNumber} &bull; {allocation?.allocationCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Preview Body */}
        <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 text-xs text-slate-950 bg-white font-sans">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-950 pb-4">
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight text-slate-950">
                MSS LOCKER
              </h1>
              <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                Safe-Deposit Locker Vault & Trust Services
              </p>
              <div className="text-[10px] text-slate-600 space-y-0.5">
                <p>Main Branch Vault &bull; 24x7 Armed Security Custody</p>
                <p className="font-mono text-[9.5px] text-slate-500">
                  Branch Code: VL-MUM-01 &bull; GSTIN: 27AAAAA0000A1Z5
                </p>
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block px-3 py-1 font-bold text-xs uppercase tracking-wider border border-slate-950 bg-slate-100 text-slate-950">
                CLOSURE STATEMENT
              </div>
              <p className="font-mono text-base font-black text-slate-950">
                {closure.closureNumber}
              </p>
              <div className="text-[11px] font-mono text-slate-700">
                <span>Date: </span>
                <strong>
                  {new Date(
                    closure.actualClosureDate || closure.requestedClosureDate
                  ).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            </div>
          </div>

          {/* Coordinates Grid */}
          <div className="grid grid-cols-2 gap-0 border border-slate-950 divide-x divide-slate-950">
            <div className="p-3 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                Surrendering Tenant Details
              </span>
              <p className="font-black text-sm text-slate-950">
                {customer?.fullName || 'N/A'}
              </p>
              <p className="text-xs text-slate-800 font-mono">
                Code: <strong>{customer?.customerCode}</strong> &bull; Phone: {customer?.phone}
              </p>
              {customer?.address && (
                <p className="text-[11px] text-slate-600 truncate">
                  {customer.address}, {customer.city}
                </p>
              )}
            </div>

            <div className="p-3 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                Surrendered Locker Coordinates
              </span>
              <p className="font-black text-sm text-slate-950 font-mono">
                Locker #{locker?.lockerNumber} (Size {locker?.size || 'STD'})
              </p>
              <p className="text-xs text-slate-800">
                {locker?.rackNumber} &bull; {locker?.section || 'Main Vault'}
              </p>
              <p className="text-[11px] text-slate-600 font-mono">
                Agreement: {allocation?.allocationCode}
              </p>
            </div>
          </div>

          {/* Settlement Ledger Table */}
          <div className="border border-slate-950 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-[10px] text-slate-800 font-bold border-b border-slate-950 uppercase">
                <tr>
                  <th className="p-2.5 border-r border-slate-950">Financial Account Ledger</th>
                  <th className="p-2.5 border-r border-slate-950 text-right">Incurred / Collected</th>
                  <th className="p-2.5 border-r border-slate-950 text-right">Settled / Refunded</th>
                  <th className="p-2.5 text-right">Final Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-950 text-xs">
                <tr>
                  <td className="p-2.5 border-r border-slate-950 font-medium">
                    Locker Periodic Tenancy Rent & Dues
                  </td>
                  <td className="p-2.5 border-r border-slate-950 text-right font-mono">
                    ₹{Number(snapshot?.totalBilled || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border-r border-slate-950 text-right font-mono">
                    ₹{Number(snapshot?.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold">
                    ₹{Number(snapshot?.outstandingAtClosure || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-950 font-medium">
                    Caution Security Deposit Ledger
                  </td>
                  <td className="p-2.5 border-r border-slate-950 text-right font-mono">
                    ₹{Number(snapshot?.depositCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border-r border-slate-950 text-right font-mono">
                    ₹{Number(snapshot?.depositRefunded || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold">
                    ₹0.00
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={3} className="p-2.5 text-right border-r border-slate-950 uppercase text-[10px]">
                    Net Outstanding Balance at Closure:
                  </td>
                  <td className="p-2.5 text-right font-mono text-sm font-black">
                    ₹0.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Physical Checklist Box */}
          <div className="p-3 border border-slate-950 bg-slate-50 space-y-1.5">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">
              Physical Handover & Verification Checklist
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-800">
              <div>[ {checklist?.lockerEmptied ? '✔' : ' '} ] Locker Articles Fully Emptied</div>
              <div>[ {checklist?.customerKeyReturned ? '✔' : ' '} ] Customer Key(s) Returned to Vault</div>
              <div>[ {checklist?.lockerInspected ? '✔' : ' '} ] Lock & Hinge Inspected</div>
              <div>[ {checklist?.physicalAccessRevoked ? '✔' : ' '} ] Biometric / Vault Access Revoked</div>
            </div>
            <div className="pt-1 text-[10.5px] text-slate-700">
              <strong>Locker Physical Condition:</strong> {checklist?.lockerCondition || 'GOOD'}
              {checklist?.damageNotes && <span> &bull; Remarks: {checklist.damageNotes}</span>}
            </div>
          </div>

          {/* Reason */}
          <div className="text-[11px] text-slate-700">
            <strong>Reason for Surrender / Closure:</strong> {closure.closureReason} ({closure.closureType})
          </div>

          {/* Signatures */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="border-b border-slate-950 h-8 w-40 mx-auto" />
              <span className="text-[9.5px] text-slate-700 uppercase font-bold tracking-wider block">
                Tenant Signature
              </span>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-950 h-8 flex items-center justify-center">
                <span className="text-[9.5px] text-slate-900 font-bold uppercase tracking-wider border border-dashed border-slate-950 px-2 py-0.5">
                  [ VAULT CLEARANCE CONFIRMED ]
                </span>
              </div>
              <span className="text-[9.5px] text-slate-700 uppercase font-bold tracking-wider block">
                Authorized Vault Officer ({closure.completedBy?.name || 'Vault Custody'})
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-200 text-center space-y-0.5 text-[9.5px] text-slate-500">
            <p>
              This is a computer-generated permanent record of tenancy termination issued by MSS Locker safe deposit locker system.
            </p>
            <p className="font-mono">
              Certificate Hash: {closure._id?.slice(-12).toUpperCase()} &bull; Completed: {closure.completedAt ? new Date(closure.completedAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
