import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  HelpCircle,
  KeyRound,
  Users,
  Layers,
  FileCheck,
  Check,
} from 'lucide-react';
import { importApi } from '../api/importApi';

export const TemplateDownloadCards: React.FC = () => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<string | null>(null);

  const handleDownload = async (
    type: 'full-migration' | 'lockers' | 'customers'
  ) => {
    setDownloading(type);
    try {
      await importApi.downloadTemplate(type);
      setDownloaded(type);
      setTimeout(() => setDownloaded(null), 2500);
    } catch (err) {
      console.error('Error downloading template:', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Informational Guidance Banner */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
        <div className="h-9 w-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 mt-0.5">
          <FileCheck className="w-5 h-5 text-emerald-100" />
        </div>
        <div className="text-xs text-slate-700 space-y-1">
          <p className="font-bold text-sm text-slate-900">
            Standard Safe-Deposit Migration Workbooks
          </p>
          <p className="text-slate-600 leading-relaxed font-normal">
            Download the official pre-formatted Excel workbook templates below. The{' '}
            <strong className="text-emerald-900 font-semibold">Full Migration Workbook</strong> contains both the{' '}
            <code className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded text-emerald-900 font-mono text-[11px]">Lockers</code> sheet and the{' '}
            <code className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded text-emerald-900 font-mono text-[11px]">Renewal History</code> sheet
            to migrate your 1,484 lockers, active tenant profiles, and past annual billing records in a single coordinated run.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Full Migration Template */}
        <div className="p-5 rounded-2xl bg-white border-2 border-emerald-300 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-800 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-xl uppercase tracking-wider">
            Recommended
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Full Migration Workbook
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete multi-sheet workbook for lockers, active KYC tenants, and renewal history.
              </p>
            </div>
            <div className="pt-1 text-[11px] text-slate-600 space-y-1.5 font-medium">
              <div className="flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Lockers &amp; Physical Vault Sheet</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Historical Renewal Billing Sheet</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Field Guidelines &amp; Reference Sheet</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownload('full-migration')}
            disabled={downloading === 'full-migration'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
          >
            {downloaded === 'full-migration' ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>Downloaded Successfully</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{downloading === 'full-migration' ? 'Preparing Download...' : 'Download Template (.xlsx)'}</span>
              </>
            )}
          </button>
        </div>

        {/* 2. Lockers Master Template */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center border border-sky-100">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Locker Master Template
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Single-sheet template for physical lockers, rack mapping, sizes (A to G2), and rent tariffs.
              </p>
            </div>
            <div className="pt-1 text-[11px] text-slate-600 space-y-1.5 font-medium">
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-700" />
                <span>Locker Number &amp; Unique Code</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-700" />
                <span>Sizes A through G2 Categories</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-700" />
                <span>Rack, Section &amp; Rent Tariffs</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownload('lockers')}
            disabled={downloading === 'lockers'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            {downloaded === 'lockers' ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                <span>Downloaded Successfully</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{downloading === 'lockers' ? 'Downloading...' : 'Download Lockers (.xlsx)'}</span>
              </>
            )}
          </button>
        </div>

        {/* 3. Customer Directory Template */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-800 flex items-center justify-center border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Customer Directory Template
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Single-sheet template for bulk importing customer profiles, phones, addresses, and KYC documents.
              </p>
            </div>
            <div className="pt-1 text-[11px] text-slate-600 space-y-1.5 font-medium">
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                <span>Customer Full Name &amp; Contact</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                <span>10-Digit Mobile &amp; Address</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                <span>Aadhaar / PAN Document Number</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownload('customers')}
            disabled={downloading === 'customers'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            {downloaded === 'customers' ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                <span>Downloaded Successfully</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{downloading === 'customers' ? 'Downloading...' : 'Download Customers (.xlsx)'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
