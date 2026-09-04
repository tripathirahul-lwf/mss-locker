import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  History,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Building2,
  MapPin,
  FileText,
  Hash,
  Bell,
  HardDrive,
  Info,
  Edit3,
  Calendar,
  Layers,
  Search,
  Sparkles,
  Receipt,
} from 'lucide-react';
import { settingService, SystemSettings, TariffPlan } from '../services/settingService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { usePermission } from '../hooks/usePermission';

const EMPTY: SystemSettings = {
  businessName: '',
  branchName: '',
  address: '',
  gstin: '',
  invoicePrefix: 'INV',
  receiptPrefix: 'RCP',
  renewalReminderDays: 30,
  offlineCacheHours: 24,
};

const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

const formatDate = (val: string) => {
  if (!val || new Date(val).getTime() === 0) return 'Initial Baseline';
  return new Date(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Size descriptions for better UX context
const SIZE_DESCRIPTIONS: Record<string, string> = {
  A: 'Compact Document Unit',
  B: 'Standard Small Box',
  C: 'Medium Valuables Locker',
  D: 'Deep Jewelry Drawer',
  E: 'Large Family Safe',
  F: 'Executive Vault Unit',
  G1: 'Commercial Master Locker',
  G2: 'Heavy Dual-Custody Safe',
};

export function SettingsPage() {
  const canManage = usePermission('settings.manage');
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['system-settings'],
    queryFn: settingService.get,
    staleTime: 60_000,
  });

  const [activeTab, setActiveTab] = useState<'config' | 'tariffs'>('config');
  const [form, setForm] = useState<SystemSettings>(EMPTY);
  const [tariffSearch, setTariffSearch] = useState('');
  const [editingTariff, setEditingTariff] = useState<TariffPlan | null>(null);
  const [historySize, setHistorySize] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const historyQuery = useQuery({
    queryKey: ['tariff-history', historySize],
    queryFn: () => settingService.history(historySize!),
    enabled: Boolean(historySize),
  });

  const data = settingsQuery.data;
  const tariffs = data?.tariffs || [];

  // Track if form has unsaved modifications
  const isDirty = useMemo(() => {
    if (!data?.settings) return false;
    return JSON.stringify(form) !== JSON.stringify(data.settings);
  }, [form, data?.settings]);

  // Tariff metrics calculations
  const tariffMetrics = useMemo(() => {
    if (!tariffs.length) return { avgRent: 0, avgDeposit: 0, totalSizes: 0 };
    const avgRent = Math.round(tariffs.reduce((acc, t) => acc + t.annualRent, 0) / tariffs.length);
    const avgDeposit = Math.round(tariffs.reduce((acc, t) => acc + t.securityDeposit, 0) / tariffs.length);
    return { avgRent, avgDeposit, totalSizes: tariffs.length };
  }, [tariffs]);

  // Filtered tariffs based on search query
  const filteredTariffs = useMemo(() => {
    const q = tariffSearch.trim().toLowerCase();
    if (!q) return tariffs;
    return tariffs.filter(
      (t) =>
        t.size.toLowerCase().includes(q) ||
        (SIZE_DESCRIPTIONS[t.size] || '').toLowerCase().includes(q) ||
        String(t.annualRent).includes(q)
    );
  }, [tariffs, tariffSearch]);

  // Sync loaded settings to form
  useEffect(() => {
    if (data?.settings) {
      setForm(data.settings);
    }
  }, [data?.settings]);

  // Warn on page close if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: settingService.update,
    onSuccess: (updated) => {
      setErrorMessage('');
      setSuccessMessage('System configuration saved successfully.');
      queryClient.setQueryData(['system-settings'], (old: any) => ({
        ...old,
        settings: updated,
      }));
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save settings.');
    },
  });

  const reviseMutation = useMutation({
    mutationFn: settingService.revise,
    onSuccess: () => {
      setEditingTariff(null);
      setErrorMessage('');
      setSuccessMessage('New tariff version activated. Prior active agreements preserve locked rates.');
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || err.message || 'Tariff revision could not be saved.');
    },
  });

  const handleFieldChange = (key: keyof SystemSettings, val: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: typeof prev[key] === 'number' ? Number(val) || 0 : val,
    }));
  };

  const handleDiscard = () => {
    if (data?.settings) setForm(data.settings);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSettingsSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!form.businessName.trim()) {
      setErrorMessage('Business / Entity name is mandatory for invoicing.');
      return;
    }
    if (!/^[A-Z0-9-]{2,12}$/.test(form.invoicePrefix) || !/^[A-Z0-9-]{2,12}$/.test(form.receiptPrefix)) {
      setErrorMessage('Invoice and receipt prefixes must be 2–12 uppercase alphanumeric characters or hyphens.');
      return;
    }
    if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(form.gstin.trim())) {
      setErrorMessage('Please enter a valid 15-character Indian GSTIN format (e.g. 08AAAAA0000A1Z5) or leave blank.');
      return;
    }

    updateMutation.mutate(form);
  };

  const handleTariffSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTariff) return;

    const fd = new FormData(e.currentTarget);
    const annualRent = Number(fd.get('annualRent'));
    const securityDeposit = Number(fd.get('securityDeposit'));
    const effectiveFrom = String(fd.get('effectiveFrom'));
    const notes = String(fd.get('notes') || '').trim();

    if (annualRent <= 0) {
      setErrorMessage('Annual rental tariff must be greater than zero.');
      return;
    }

    reviseMutation.mutate({
      size: editingTariff.size,
      annualRent,
      securityDeposit,
      effectiveFrom,
      notes,
    });
  };

  // State code preview from GSTIN
  const gstinStateInfo = useMemo(() => {
    if (!form.gstin || form.gstin.length < 2) return null;
    const code = form.gstin.slice(0, 2);
    const states: Record<string, string> = {
      '01': 'Jammu & Kashmir',
      '02': 'Himachal Pradesh',
      '03': 'Punjab',
      '06': 'Haryana',
      '07': 'Delhi',
      '08': 'Rajasthan',
      '09': 'Uttar Pradesh',
      '10': 'Bihar',
      '19': 'West Bengal',
      '24': 'Gujarat',
      '27': 'Maharashtra',
      '29': 'Karnataka',
      '32': 'Kerala',
      '33': 'Tamil Nadu',
      '36': 'Telangana',
      '37': 'Andhra Pradesh',
    };
    return states[code] ? `State ${code} (${states[code]})` : `State code ${code}`;
  }, [form.gstin]);

  return (
    <div className="space-y-5 font-sans pb-12">
      {/* Top Header Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-800" aria-hidden="true" />
        <div className="flex items-center gap-3.5 pl-1.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                Administration Master
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
              System Settings &amp; Tariff Master
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Manage enterprise entity identity, billing prefixes, and versioned locker rental tariffs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto pl-1.5 sm:pl-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
            Config Audit Trail Active
          </span>
        </div>
      </section>

      {/* Global Notifications */}
      {successMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs font-medium text-emerald-900 shadow-2xs animate-in fade-in-0"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {(settingsQuery.isError || errorMessage) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs font-medium text-rose-900 shadow-2xs animate-in fade-in-0"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
            <span>
              {errorMessage ||
                (settingsQuery.error instanceof Error
                  ? settingsQuery.error.message
                  : 'Settings could not be loaded.')}
            </span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-700 hover:text-rose-950 p-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Segmented Tab Switcher */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Business &amp; Operational Config</span>
            {isDirty && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tariffs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tariffs'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Locker Tariffs &amp; Pricing Master</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                activeTab === 'tariffs' ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tariffs.length}
            </span>
          </button>
        </div>

        {/* Unsaved Changes Header Trigger (when in config tab) */}
        {activeTab === 'config' && isDirty && canManage && (
          <div className="hidden sm:flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              className="h-8 rounded-xl text-xs font-medium text-slate-700 border-slate-300 gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSettingsSubmit}
              disabled={updateMutation.isPending}
              className="h-8 rounded-xl text-xs font-medium bg-emerald-800 hover:bg-emerald-900 text-white gap-1.5 cursor-pointer shadow-2xs"
            >
              <Save className="h-3.5 w-3.5" />
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {/* TAB 1: Business Identity & Operational Policies */}
      {activeTab === 'config' && (
        <form onSubmit={handleSettingsSubmit} className="space-y-5">
          {/* Card 1: Business Legal Identity */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    Business Entity &amp; Invoicing Identity
                  </h2>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Printed on counter receipts, legal lease agreements, and tax invoices
                  </p>
                </div>
              </div>
            </div>

            <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Business Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Business Legal Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={form.businessName}
                  onChange={(e) => handleFieldChange('businessName', e.target.value)}
                  placeholder="e.g. MSS Safe Deposit Vaults Pvt Ltd"
                  className="h-10 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-emerald-600"
                  required
                />
                <span className="block text-[10.5px] text-slate-400 font-normal">
                  Primary business name on invoices &amp; legal contracts.
                </span>
              </div>

              {/* Branch Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Branch / Vault Station Name
                </label>
                <Input
                  value={form.branchName}
                  onChange={(e) => handleFieldChange('branchName', e.target.value)}
                  placeholder="e.g. Main Vault Station, Sector 12"
                  className="h-10 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-emerald-600"
                />
                <span className="block text-[10.5px] text-slate-400 font-normal">
                  Physical location identifier for multi-counter systems.
                </span>
              </div>

              {/* GSTIN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    GSTIN Identifier
                  </label>
                  {gstinStateInfo && (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      {gstinStateInfo}
                    </span>
                  )}
                </div>
                <Input
                  value={form.gstin}
                  onChange={(e) => handleFieldChange('gstin', e.target.value.toUpperCase())}
                  placeholder="e.g. 08AAAAA0000A1Z5"
                  maxLength={15}
                  className="h-10 rounded-xl bg-slate-50/50 border-slate-200 font-mono focus:bg-white focus:border-emerald-600"
                />
                <span className="block text-[10.5px] text-slate-400 font-normal">
                  Optional 15-character GST identification number for tax invoices.
                </span>
              </div>

              {/* Registered Address */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold text-slate-700">
                  Registered Office &amp; Vault Premises Address
                </label>
                <Input
                  value={form.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  placeholder="e.g. 45-B, Commercial Vault Complex, M.G. Road, Jaipur, Rajasthan - 302001"
                  className="h-10 rounded-xl bg-slate-50/50 border-slate-200 focus:bg-white focus:border-emerald-600"
                />
                <span className="block text-[10.5px] text-slate-400 font-normal">
                  Full premises address printed on rental payment receipts and clearance certs.
                </span>
              </div>
            </fieldset>
          </section>

          {/* Card 2: Document Numbering Policies */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                  <Hash className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    Document Numbering Formats
                  </h2>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Serial identifier prefixes for invoices, billing receipts and payment vouchers
                  </p>
                </div>
              </div>
            </div>

            <fieldset disabled={!canManage} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Invoice Prefix */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Invoice Series Prefix
                  </label>
                  <Input
                    value={form.invoicePrefix}
                    onChange={(e) => handleFieldChange('invoicePrefix', e.target.value.toUpperCase())}
                    placeholder="INV"
                    maxLength={12}
                    className="h-10 rounded-xl bg-slate-50/50 border-slate-200 font-mono focus:bg-white focus:border-emerald-600"
                  />
                  <span className="block text-[10.5px] text-slate-400 font-normal">
                    2–12 alphanumeric characters (e.g. INV, MSS-INV).
                  </span>
                </div>

                {/* Receipt Prefix */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Payment Receipt Prefix
                  </label>
                  <Input
                    value={form.receiptPrefix}
                    onChange={(e) => handleFieldChange('receiptPrefix', e.target.value.toUpperCase())}
                    placeholder="RCP"
                    maxLength={12}
                    className="h-10 rounded-xl bg-slate-50/50 border-slate-200 font-mono focus:bg-white focus:border-emerald-600"
                  />
                  <span className="block text-[10.5px] text-slate-400 font-normal">
                    2–12 alphanumeric characters (e.g. RCP, MSS-RCP).
                  </span>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-200/70 bg-emerald-50/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-800 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-950">
                    Live Numbering Sample Preview:
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 font-bold text-emerald-900 shadow-2xs">
                    {form.invoicePrefix || 'INV'}-2026-000189
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 font-bold text-emerald-900 shadow-2xs">
                    {form.receiptPrefix || 'RCP'}-2026-000189
                  </span>
                </div>
              </div>
            </fieldset>
          </section>

          {/* Card 3: Operational & Cache Policies */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    Operational Notice &amp; Workstation Cache Policies
                  </h2>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Renewal reminder horizons and offline counter caching parameters
                  </p>
                </div>
              </div>
            </div>

            <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
              {/* Reminder Days */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Renewal Notice Horizon (Days in Advance)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={form.renewalReminderDays}
                    onChange={(e) => handleFieldChange('renewalReminderDays', e.target.value)}
                    className="h-10 rounded-xl bg-slate-50/50 border-slate-200 font-mono pr-12 focus:bg-white focus:border-emerald-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                    Days
                  </span>
                </div>
                <span className="block text-[10.5px] text-slate-400 font-normal">
                  Invoices are automatically tagged for collection review this many days prior to expiry.
                </span>
              </div>

              {/* Cache Retention Hours */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Offline Station Storage Age (Hours)
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={form.offlineCacheHours}
                    onChange={(e) => handleFieldChange('offlineCacheHours', e.target.value)}
                    className="h-10 rounded-xl bg-slate-50/50 border-slate-200 font-mono pr-14 focus:bg-white focus:border-emerald-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                    Hours
                  </span>
                </div>
                <span className="block text-[10.5px] text-slate-400 font-normal">
                  Maximum valid age of local indexedDB locker matrices when disconnected.
                </span>
              </div>
            </fieldset>
          </section>

          {/* Bottom Save Action Bar */}
          {canManage && (
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <div className="flex items-center gap-2">
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    You have unsaved changes
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Configuration synced and up to date
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDiscard}
                    className="h-9 px-4 rounded-xl text-xs font-semibold border-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Discard
                  </Button>
                )}

                <Button
                  type="submit"
                  disabled={updateMutation.isPending || !isDirty}
                  className="h-9 px-5 rounded-xl text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs cursor-pointer disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {updateMutation.isPending ? 'Saving Config…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* TAB 2: Active Tariff Matrix & Pricing Master */}
      {activeTab === 'tariffs' && (
        <div className="space-y-5">
          {/* Key Metrics Cards */}
          <section className="grid gap-3.5 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Configured Size Classes</span>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{tariffMetrics.totalSizes}</p>
              <span className="text-[11px] text-slate-400 font-normal">Sizes A through G2 Master</span>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Average Annual Rent</span>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-800">
                  <Receipt className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(tariffMetrics.avgRent)}
              </p>
              <span className="text-[11px] text-slate-400 font-normal">Across all active tier sizes</span>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Average Security Deposit</span>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-800">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCurrency(tariffMetrics.avgDeposit)}
              </p>
              <span className="text-[11px] text-slate-400 font-normal">Refundable collateral baseline</span>
            </div>
          </section>

          {/* Tariff Table Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            {/* Table Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Active Locker Tariff Matrix
                  </h2>
                  <p className="text-[11px] text-slate-500 font-normal">
                    New revisions increment version numbers; existing customer contracts retain locked rates
                  </p>
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={tariffSearch}
                  onChange={(e) => setTariffSearch(e.target.value)}
                  placeholder="Filter size (e.g. A, G1)..."
                  className="h-8.5 pl-8 text-xs rounded-xl bg-white border-slate-200 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Size Class</th>
                    <th className="py-3 px-4 text-right">Annual Rent</th>
                    <th className="py-3 px-4 text-right">Refundable Deposit</th>
                    <th className="py-3 px-4 text-center">Version</th>
                    <th className="py-3 px-4">Effective Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTariffs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs font-medium">
                        No tariff plans matching &ldquo;{tariffSearch}&rdquo;
                      </td>
                    </tr>
                  ) : (
                    filteredTariffs.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/80 font-bold font-mono text-xs">
                              {t.size}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">Size {t.size}</p>
                              <p className="text-[10.5px] text-slate-400 font-normal">
                                {SIZE_DESCRIPTIONS[t.size] || 'Standard Vault Compartment'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono text-xs">
                          {formatCurrency(t.annualRent)}
                          <span className="text-[10px] text-slate-400 font-normal font-sans ml-1">/yr</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700 font-mono text-xs">
                          {formatCurrency(t.securityDeposit)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                            v{t.version}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          <span className="flex items-center gap-1.5 text-xs">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(t.effectiveFrom)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setHistorySize(t.size)}
                              className="h-8 rounded-lg px-2.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 gap-1 cursor-pointer"
                            >
                              <History className="h-3.5 w-3.5 text-slate-500" />
                              <span>History</span>
                            </Button>

                            {canManage && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingTariff(t)}
                                className="h-8 rounded-lg px-3 text-xs font-semibold text-emerald-800 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 gap-1 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-emerald-700" />
                                <span>Revise</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Revision Dialog Modal */}
      {editingTariff && (
        <RevisionDialog
          tariff={editingTariff}
          pending={reviseMutation.isPending}
          close={() => setEditingTariff(null)}
          submit={handleTariffSubmit}
        />
      )}

      {/* History Dialog Modal */}
      {historySize && (
        <HistoryDialog
          size={historySize}
          rows={historyQuery.data || []}
          loading={historyQuery.isLoading}
          failed={historyQuery.isError}
          close={() => setHistorySize(null)}
        />
      )}
    </div>
  );
}

// Subcomponent: Enhanced Revision Dialog Modal
function RevisionDialog({
  tariff,
  pending,
  close,
  submit,
}: {
  tariff: TariffPlan;
  pending: boolean;
  close: () => void;
  submit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const [rent, setRent] = useState<number>(tariff.annualRent);
  const [deposit, setDeposit] = useState<number>(tariff.securityDeposit);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [close]);

  // Dynamic calculations & deltas
  const rentDiff = rent - tariff.annualRent;
  const rentPercent = tariff.annualRent ? ((rentDiff / tariff.annualRent) * 100).toFixed(1) : '0';
  const depositDiff = deposit - tariff.securityDeposit;
  const depositRatio = rent > 0 ? (deposit / rent).toFixed(1) : '0';
  const monthlyEquivalent = Math.round(rent / 12);

  const applyPercent = (pct: number) => {
    const updated = Math.round(tariff.annualRent * (1 + pct / 100));
    setRent(updated);
  };

  const applyAdd = (amt: number) => {
    setRent(tariff.annualRent + amt);
  };

  const setDepositMultiplier = (multiplier: number) => {
    setDeposit(Math.round(rent * multiplier));
  };

  const setToFirstOfNextMonth = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    setEffectiveDate(nextMonth.toISOString().slice(0, 10));
  };

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs font-sans overflow-y-auto"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-modal-title"
        onSubmit={submit}
        className="w-full max-w-xl sm:max-w-2xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="revision-modal-title" className="text-sm font-bold text-slate-900 leading-tight">
                  Revise Size {tariff.size} Tariff Rate
                </h2>
                <span className="px-2 py-0.2 rounded-md text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300/60">
                  v{tariff.version} ➔ v{tariff.version + 1}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                Size {tariff.size} • {SIZE_DESCRIPTIONS[tariff.size] || 'Standard Vault Compartment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body with Live Rate Matrix & Delta Comparison */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Live Side-by-Side Comparison Card */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-emerald-100 pb-2">
              <span>Current Rate (v{tariff.version})</span>
              <span className="text-emerald-900">Proposed Rate (v{tariff.version + 1})</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Current Active */}
              <div className="space-y-1">
                <span className="text-[10.5px] text-slate-500 block font-medium">Annual Rent</span>
                <p className="font-mono font-bold text-slate-800 text-sm">
                  {formatCurrency(tariff.annualRent)}
                  <span className="text-[10px] font-sans text-slate-400 ml-1">/yr</span>
                </p>
                <span className="text-[10.5px] text-slate-500 block font-medium pt-1">Security Deposit</span>
                <p className="font-mono text-xs text-slate-700">
                  {formatCurrency(tariff.securityDeposit)}
                </p>
              </div>

              {/* Proposed Revision */}
              <div className="space-y-1 text-right">
                <span className="text-[10.5px] text-emerald-800 block font-medium">Proposed Rent</span>
                <p className="font-mono font-bold text-emerald-950 text-sm">
                  {formatCurrency(rent)}
                  <span className="text-[10px] font-sans text-emerald-700 ml-1">/yr</span>
                </p>
                <span className="text-[10.5px] text-emerald-800 block font-medium pt-1">Proposed Deposit</span>
                <p className="font-mono text-xs font-semibold text-emerald-900">
                  {formatCurrency(deposit)}
                </p>
              </div>
            </div>

            {/* Delta & Metrics Strip */}
            <div className="pt-2 border-t border-emerald-100/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-600 font-medium">Rent Delta:</span>
                {rentDiff === 0 ? (
                  <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono bg-slate-200 text-slate-700">
                    No change (0%)
                  </span>
                ) : rentDiff > 0 ? (
                  <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
                    +₹{rentDiff.toLocaleString('en-IN')} (+{rentPercent}%)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                    -₹{Math.abs(rentDiff).toLocaleString('en-IN')} ({rentPercent}%)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span>~{formatCurrency(monthlyEquivalent)}/mo</span>
                <span>•</span>
                <span>Deposit {depositRatio}x rent</span>
              </div>
            </div>
          </div>

          {/* Quick Increment Presets for Rent */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Quick Rate Adjustments:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPercent(5)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 border border-slate-200 transition-all cursor-pointer"
              >
                +5% Inflation
              </button>
              <button
                type="button"
                onClick={() => applyPercent(10)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 border border-slate-200 transition-all cursor-pointer"
              >
                +10% Index
              </button>
              <button
                type="button"
                onClick={() => applyAdd(500)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 border border-slate-200 transition-all cursor-pointer"
              >
                +₹500 Flat
              </button>
              <button
                type="button"
                onClick={() => setRent(tariff.annualRent)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all cursor-pointer ml-auto"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Input 1: Annual Rent */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              New Annual Rent (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                ₹
              </span>
              <Input
                name="annualRent"
                type="number"
                min="1"
                step="1"
                value={rent}
                onChange={(e) => setRent(Number(e.target.value) || 0)}
                className="h-10 pl-8 rounded-xl font-mono text-sm font-bold text-slate-900 focus:border-emerald-600 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          {/* Input 2: Security Deposit */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                New Security Deposit (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDepositMultiplier(2)}
                  className="text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                >
                  Set to 2x Rent
                </button>
                <button
                  type="button"
                  onClick={() => setDepositMultiplier(1.5)}
                  className="text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                >
                  Set to 1.5x
                </button>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                ₹
              </span>
              <Input
                name="securityDeposit"
                type="number"
                min="0"
                step="1"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value) || 0)}
                className="h-10 pl-8 rounded-xl font-mono text-sm font-medium text-slate-900 focus:border-emerald-600 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          {/* Input 3: Effective Date */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Effective From Date <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEffectiveDate(new Date().toISOString().slice(0, 10))}
                  className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={setToFirstOfNextMonth}
                  className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                >
                  1st of Next Month
                </button>
              </div>
            </div>
            <Input
              name="effectiveFrom"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="h-10 rounded-xl focus:border-emerald-600 focus:ring-emerald-500/20"
              required
            />
          </div>

          {/* Input 4: Revision Reason & Board Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Revision Reason / Board Resolution Reference
            </label>
            <textarea
              name="notes"
              rows={2}
              maxLength={400}
              placeholder="e.g. Approved in Board Resolution #2026/BR-14 dated 01-Sep-2026 for annual inflation indexation."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Compliance Safe-Deposit Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-200/80 bg-blue-50/50 text-[11px] text-blue-900">
            <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Non-Destructive Versioning:</strong> Active locker agreements retain their locked historical rate snapshot. This revision will only take effect for new allocations and subsequent lease renewals from the effective date.
            </p>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-5 py-3.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={close}
            className="h-9 px-4 rounded-xl text-xs font-semibold border-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={pending || rent <= 0}
            className="h-9 px-5 rounded-xl text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer shadow-2xs disabled:opacity-60"
          >
            {pending ? 'Activating Rate…' : `Activate Version ${tariff.version + 1}`}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// Subcomponent: Enhanced History Dialog Modal
function HistoryDialog({
  size,
  rows,
  loading,
  failed,
  close,
}: {
  size: string;
  rows: TariffPlan[];
  loading: boolean;
  failed: boolean;
  close: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [close]);

  const handleCopyHistory = () => {
    const text = rows
      .map(
        (r) =>
          `Size ${size} v${r.version}: Rent ${formatCurrency(r.annualRent)}/yr, Deposit ${formatCurrency(r.securityDeposit)} (Effective ${formatDate(r.effectiveFrom)})${r.notes ? ` - "${r.notes}"` : ''}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs font-sans overflow-y-auto"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
        className="w-full max-w-2xl sm:max-w-3xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[88vh] my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
              <History className="h-5 w-5 text-emerald-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="history-modal-title" className="text-sm font-bold text-slate-900 leading-tight">
                  Size {size} Tariff Revision History
                </h2>
                <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 font-mono">
                  {rows.length} {rows.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                {SIZE_DESCRIPTIONS[size] || 'Vault Box'} • Immutable chronological audit trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleCopyHistory}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 cursor-pointer transition-colors"
                title="Copy audit history to clipboard"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <FileText className="h-3.5 w-3.5 text-slate-500" />}
                <span>{copied ? 'Copied' : 'Copy Audit Trail'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <div className="h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-500">Retrieving certified revision records…</p>
            </div>
          ) : failed ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Unable to load tariff revision history for Size {size}.</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">No revision logs found</p>
              <p className="text-[11px]">Size {size} has no registered pricing history.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chronological Timeline Track */}
              <div className="relative border-l-2 border-slate-200/80 ml-3.5 pl-5 space-y-4">
                {rows.map((r, i) => {
                  const isCurrent = i === 0;
                  const prevRecord = rows[i + 1];
                  const diffRent = prevRecord ? r.annualRent - prevRecord.annualRent : 0;
                  const diffDeposit = prevRecord ? r.securityDeposit - prevRecord.securityDeposit : 0;

                  return (
                    <div key={r._id} className="relative group">
                      {/* Timeline Node Point */}
                      <span
                        className={`absolute -left-[27px] top-3.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ${
                          isCurrent
                            ? 'bg-emerald-600 ring-emerald-500/30 animate-pulse'
                            : 'bg-slate-400 ring-slate-300'
                        }`}
                        aria-hidden="true"
                      />

                      {/* Version Card */}
                      <div
                        className={`rounded-2xl border p-4 transition-all ${
                          isCurrent
                            ? 'border-emerald-200/90 bg-emerald-50/40 shadow-xs'
                            : 'border-slate-200/90 bg-white hover:border-slate-300'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs font-mono text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                              Version {r.version}
                            </span>
                            {isCurrent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                Active Baseline
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Archived Version
                              </span>
                            )}
                          </div>

                          <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            Effective: {formatDate(r.effectiveFrom)}
                          </span>
                        </div>

                        {/* Financial Figures */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                              Annual Rent
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="font-mono font-bold text-slate-900 text-sm">
                                {formatCurrency(r.annualRent)}
                              </span>
                              <span className="text-[10px] text-slate-400">/yr</span>
                            </div>
                            {diffRent !== 0 && (
                              <span
                                className={`inline-block mt-1 text-[10px] font-mono font-bold ${
                                  diffRent > 0 ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {diffRent > 0 ? `+${formatCurrency(diffRent)}` : `-${formatCurrency(Math.abs(diffRent))}`} from v{prevRecord.version}
                              </span>
                            )}
                          </div>

                          <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                              Security Deposit
                            </span>
                            <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                              {formatCurrency(r.securityDeposit)}
                            </p>
                            {diffDeposit !== 0 && (
                              <span
                                className={`inline-block mt-1 text-[10px] font-mono font-bold ${
                                  diffDeposit > 0 ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {diffDeposit > 0 ? `+${formatCurrency(diffDeposit)}` : `-${formatCurrency(Math.abs(diffDeposit))}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Notes / Board Reference */}
                        {r.notes ? (
                          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-600">
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <p className="italic leading-relaxed">
                              &ldquo;{r.notes}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2.5 text-[10.5px] text-slate-400 italic">
                            Initial vault commissioning baseline; no board notes appended.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Single version indicator note */}
              {rows.length === 1 && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 text-[11px] text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>
                    Size {size} is running on its initial commissioning baseline rate. No revisions have superseded it yet.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-5 py-3 shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            Protected Vault Ledger Audit Trail
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={close}
            className="h-8.5 px-4 rounded-xl text-xs font-semibold border-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
