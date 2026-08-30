import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { CreateLockerInput } from '../types';
import { lockerApi } from '../api/lockerApi';
import { Button } from '../../../components/ui/button';

interface LockerImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function LockerImportModal({ onClose, onSuccess }: LockerImportModalProps) {
  const [parsedLockers, setParsedLockers] = useState<CreateLockerInput[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    insertedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);

  // Generate and download sample CSV template
  const handleDownloadTemplate = () => {
    const headers = [
      'lockerNumber',
      'size',
      'rackNumber',
      'section',
      'floor',
      'position',
      'masterKeyReference',
      'annualRent',
      'securityDeposit',
      'remarks',
    ];

    const sampleRows = [
      [
        '701',
        'A',
        'Rack-07',
        'Main Vault',
        'Ground Floor',
        'Row 1 / Col 1',
        'MK-R07-01',
        '3000',
        '10000',
        'Ready for allotment',
      ],
      [
        '702',
        'B',
        'Rack-07',
        'Main Vault',
        'Ground Floor',
        'Row 1 / Col 2',
        'MK-R07-02',
        '4500',
        '15000',
        'Standard drawer unit',
      ],
      [
        '801',
        'C',
        'Rack-08',
        'Left Wing',
        'Ground Floor',
        'Row 2 / Col 1',
        'MK-R08-01',
        '6000',
        '20000',
        'Medium safety box',
      ],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sampleRows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Vault_Ledger_Lockers_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse uploaded CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setResultSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length < 2) {
          setParseError('The uploaded CSV file is empty or missing headers.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const lockerNumIdx = headers.indexOf('lockerNumber');
        const sizeIdx = headers.indexOf('size');
        const rackIdx = headers.indexOf('rackNumber');
        const rentIdx = headers.indexOf('annualRent');
        const depositIdx = headers.indexOf('securityDeposit');
        const sectionIdx = headers.indexOf('section');
        const floorIdx = headers.indexOf('floor');
        const positionIdx = headers.indexOf('position');
        const masterKeyIdx = headers.indexOf('masterKeyReference');
        const remarksIdx = headers.indexOf('remarks');

        if (lockerNumIdx === -1 || sizeIdx === -1 || rackIdx === -1) {
          setParseError(
            'Required headers missing. Required: lockerNumber, size, rackNumber.'
          );
          return;
        }

        const parsed: CreateLockerInput[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 3) continue;

          const lockerNumber = cols[lockerNumIdx] || '';
          const size = cols[sizeIdx]?.toUpperCase() || 'A';
          const rackNumber = cols[rackIdx] || 'Rack-01';
          const annualRent = rentIdx !== -1 ? Number(cols[rentIdx]) || 3000 : 3000;
          const securityDeposit =
            depositIdx !== -1 ? Number(cols[depositIdx]) || 10000 : 10000;
          const section = sectionIdx !== -1 ? cols[sectionIdx] || 'Main Vault' : 'Main Vault';
          const floor = floorIdx !== -1 ? cols[floorIdx] || 'Ground Floor' : 'Ground Floor';
          const position = positionIdx !== -1 ? cols[positionIdx] || '' : '';
          const masterKeyReference =
            masterKeyIdx !== -1 ? cols[masterKeyIdx] || '' : '';
          const remarks = remarksIdx !== -1 ? cols[remarksIdx] || '' : '';

          if (lockerNumber) {
            parsed.push({
              lockerNumber,
              size,
              rackNumber,
              section,
              floor,
              position,
              masterKeyReference,
              annualRent,
              securityDeposit,
              status: 'VACANT',
              operationalStatus: 'ACTIVE',
              remarks,
            });
          }
        }

        if (parsed.length === 0) {
          setParseError('No valid locker rows found in file.');
        } else {
          setParsedLockers(parsed);
        }
      } catch (err: any) {
        setParseError(`Failed to parse CSV file: ${err.message}`);
      }
    };

    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (parsedLockers.length === 0) return;

    setIsSubmitting(true);
    setParseError(null);

    try {
      const result = await lockerApi.bulkImport(parsedLockers);
      setResultSummary(result);
      if (result.insertedCount > 0) {
        setTimeout(() => {
          onSuccess();
        }, 1200);
      }
    } catch (err: any) {
      setParseError(
        err.response?.data?.message || err.message || 'Bulk import failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in-0 duration-150">
      <div
        role="dialog" aria-modal="true"
        className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Bulk Import Master Lockers
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Import physical lockers across racks (A to G2) via formatted CSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Step 1: Download Template */}
          <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-blue-950 text-xs">
                Need the official CSV format template?
              </h4>
              <p className="text-[11px] text-blue-800 mt-0.5 font-medium">
                Download pre-configured column headers mapped for 1,484 safe-deposit lockers.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="bg-white border-blue-300 text-blue-900 hover:bg-blue-100 flex items-center gap-1.5 shrink-0 text-xs font-bold rounded-xl"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </Button>
          </div>

          {/* Step 2: Upload CSV File */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block">
              Upload Filled CSV File
            </label>
            <div className="p-6 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl bg-slate-50 hover:bg-blue-50/20 text-center flex flex-col items-center justify-center cursor-pointer transition-all">
              <Upload className="w-8 h-8 text-blue-500 mb-2" />
              <label className="cursor-pointer">
                <span className="font-bold text-blue-700 hover:underline">
                  Click to choose file
                </span>
                <span className="text-slate-500 font-medium"> or drag and drop</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[10px] text-slate-400 mt-1">
                CSV files only. UTF-8 encoded.
              </p>
            </div>
          </div>

          {parseError && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{parseError}</span>
            </div>
          )}

          {resultSummary && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>
                  Successfully imported {resultSummary.insertedCount} physical lockers!
                </span>
              </div>
              {resultSummary.skippedCount > 0 && (
                <p className="text-[11px] text-amber-800 font-medium">
                  {resultSummary.skippedCount} duplicate locker numbers were skipped.
                </p>
              )}
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedLockers.length > 0 && !resultSummary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  File Preview ({parsedLockers.length} Lockers Detected)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{fileName}</span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Locker</th>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">Rack</th>
                      <th className="p-2.5 text-right">Rent</th>
                      <th className="p-2.5 text-right">Deposit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {parsedLockers.slice(0, 8).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-bold text-slate-900">{row.lockerNumber}</td>
                        <td className="p-2 text-blue-700 font-bold">{row.size}</td>
                        <td className="p-2 text-slate-700">{row.rackNumber}</td>
                        <td className="p-2 text-right">₹{row.annualRent}</td>
                        <td className="p-2 text-right">₹{row.securityDeposit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedLockers.length > 8 && (
                <p className="text-[10px] text-slate-400 text-right font-medium">
                  + {parsedLockers.length - 8} more rows ready for batch insertion
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImportSubmit}
            disabled={parsedLockers.length === 0 || isSubmitting || Boolean(resultSummary)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 min-w-[140px] rounded-xl"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing...</span>
              </span>
            ) : (
              `Import ${parsedLockers.length > 0 ? `${parsedLockers.length} Lockers` : ''}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
