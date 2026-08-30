import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  HelpCircle,
  KeyRound,
  Users,
  History,
} from 'lucide-react';
import { importApi } from '../api/importApi';

export const TemplateDownloadCards: React.FC = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (
    type: 'full-migration' | 'lockers' | 'customers'
  ) => {
    setDownloading(type);
    try {
      await importApi.downloadTemplate(type);
    } catch (err) {
      console.error('Error downloading template:', err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 space-y-1">
          <p className="font-bold text-sm">
            Official Data Migration Templates
          </p>
          <p className="text-emerald-800 leading-relaxed">
            Download the pre-formatted Excel workbook templates below. The{' '}
            <strong>Full Migration Template</strong> contains both the{' '}
            <code>Lockers</code> sheet and the <code>Renewal History</code> sheet
            to migrate your 1,484 lockers, active tenant KYC records, and past
            annual billing records in a single coordinated run.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Full Migration Template */}
        <div className="p-5 rounded-3xl bg-white border border-emerald-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              Full Migration Workbook
            </h3>
            <p className="text-xs text-slate-500">
              Multi-sheet Excel workbook containing <strong>Lockers</strong> and{' '}
              <strong>Renewal History</strong> sheets with sample data and guidelines.
            </p>
            <div className="pt-2 text-[11px] text-slate-600 space-y-1 font-mono">
              <div>✓ Lockers sheet</div>
              <div>✓ Renewal History sheet</div>
              <div>✓ Instructions sheet</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownload('full-migration')}
            disabled={downloading === 'full-migration'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading === 'full-migration'
              ? 'Downloading...'
              : 'Download Template (.xlsx)'}
          </button>
        </div>

        {/* 2. Lockers Master Template */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              Locker Master Template
            </h3>
            <p className="text-xs text-slate-500">
              Single-sheet template for physical lockers, rack mapping, size
              categories (A to G2), and rent/deposit tariffs.
            </p>
            <div className="pt-2 text-[11px] text-slate-600 space-y-1 font-mono">
              <div>✓ Locker Number & Code</div>
              <div>✓ Sizes A to G2</div>
              <div>✓ Rack, Section & Tariffs</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownload('lockers')}
            disabled={downloading === 'lockers'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading === 'lockers'
              ? 'Downloading...'
              : 'Download Lockers (.xlsx)'}
          </button>
        </div>

        {/* 3. Customer Directory Template */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              Customer Roster Template
            </h3>
            <p className="text-xs text-slate-500">
              Single-sheet template for bulk importing customer profiles,
              10-digit mobile numbers, addresses, and KYC documents.
            </p>
            <div className="pt-2 text-[11px] text-slate-600 space-y-1 font-mono">
              <div>✓ Customer Full Name</div>
              <div>✓ 10-Digit Mobile & Address</div>
              <div>✓ Aadhaar / PAN Proof Number</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownload('customers')}
            disabled={downloading === 'customers'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading === 'customers'
              ? 'Downloading...'
              : 'Download Customers (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  );
};
