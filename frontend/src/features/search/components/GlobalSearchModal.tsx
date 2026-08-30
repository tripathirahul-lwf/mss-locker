import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  KeyRound,
  Users,
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
  X,
  ArrowRight,
  PlusCircle,
  FileText,
  CreditCard,
  Building2,
  Calendar,
  Lock,
  Receipt,
} from 'lucide-react';
import { searchApi } from '../api/searchApi';
import { GlobalSearchResultData } from '../types';
import { offlineSyncService } from '../../../offline/services/offline-sync.service';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customerId: string) => void;
  onSelectLocker: (lockerId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  onSelectLocker,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResultData>({
    customers: [],
    lockers: [],
    allocations: [],
    invoices: [],
    payments: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const abortControllerRef = useRef<AbortController | null>(null);

  const staticActions = [
    {
      id: 'nav-dashboard',
      title: 'Dashboard Overview',
      subtitle: 'Vault occupancy metrics & daily operations',
      icon: LayoutDashboard,
      category: 'Navigation',
      action: () => navigate('/'),
    },
    {
      id: 'nav-lockers',
      title: 'Lockers Registry',
      subtitle: '1,484 physical lockers directory & rack mapping',
      icon: KeyRound,
      category: 'Navigation',
      action: () => navigate('/lockers'),
    },
    {
      id: 'nav-customers',
      title: 'Customer Directory & KYC',
      subtitle: 'Customer profiles, identification & KYC proofs',
      icon: Users,
      category: 'Navigation',
      action: () => navigate('/customers'),
    },
    {
      id: 'nav-allocations',
      title: 'Locker Allotments',
      subtitle: 'Active and reserved tenancy agreements',
      icon: Building2,
      category: 'Navigation',
      action: () => navigate('/allocations'),
    },
    {
      id: 'nav-renewals',
      title: 'Renewals & Billing',
      subtitle: 'Periodic renewal notices & rental invoicing',
      icon: Calendar,
      category: 'Navigation',
      action: () => navigate('/renewals'),
    },
    {
      id: 'nav-payments',
      title: 'Payments & Receipts',
      subtitle: 'Payment collections & official banking vouchers',
      icon: CreditCard,
      category: 'Navigation',
      action: () => navigate('/payments'),
    },
    {
      id: 'nav-closures',
      title: 'Locker Closures & Surrenders',
      subtitle: 'Tenancy surrender, key inspection & locker release',
      icon: Lock,
      category: 'Navigation',
      action: () => navigate('/closures'),
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({
        customers: [],
        lockers: [],
        allocations: [],
        invoices: [],
        payments: [],
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search with request cancellation
  useEffect(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      setResults({
        customers: [],
        lockers: [],
        allocations: [],
        invoices: [],
        payments: [],
      });
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Fallback to local Dexie search
        const localMatches = await offlineSyncService.searchOffline(cleanQuery);
        setResults({
          customers: localMatches.customers,
          lockers: localMatches.lockers,
          allocations: localMatches.allocations,
          invoices: [],
          payments: [],
        });
        setIsLoading(false);
        return;
      }

      try {
        const data = await searchApi.globalSearch(
          cleanQuery,
          5,
          undefined,
          controller.signal
        );
        setResults(data);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.warn('Network search failed, falling back to offline cache:', err);
          const localMatches = await offlineSyncService.searchOffline(cleanQuery);
          setResults({
            customers: localMatches.customers,
            lockers: localMatches.lockers,
            allocations: localMatches.allocations,
            invoices: [],
            payments: [],
          });
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  if (!isOpen) return null;

  const totalResults =
    results.customers.length +
    results.lockers.length +
    results.allocations.length +
    results.invoices.length +
    results.payments.length;

  const filteredStatic = staticActions.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen flex items-start justify-center pt-14 sm:pt-20 p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, phone, locker #, invoice #, receipt #..."
            className="flex-1 bg-transparent border-0 text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded-md shadow-2xs">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 overflow-y-auto flex-1 space-y-4 text-xs">
          {isLoading && (
            <div className="p-6 text-center text-slate-400 text-xs animate-pulse font-medium">
              Searching Vault Registry across customers, lockers, and billing...
            </div>
          )}

          {!isLoading && query.trim().length >= 2 && totalResults === 0 && (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <p className="font-bold text-slate-700 text-sm">
                No matching records found
              </p>
              <p className="text-xs">
                Try searching by customer name, 10-digit phone, locker number (e.g. 101), or invoice number.
              </p>
            </div>
          )}

          {/* 1. CUSTOMERS GROUP */}
          {results.customers.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-600" /> Customers & KYC ({results.customers.length})
              </div>
              <div className="space-y-1">
                {results.customers.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => {
                      onClose();
                      onSelectCustomer(c._id);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? (
                        <img
                          src={c.photoUrl}
                          alt={c.fullName}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          {c.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 text-xs group-hover:text-emerald-900">
                          {c.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {c.customerCode} &bull; {c.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.status}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. LOCKERS GROUP */}
          {results.lockers.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-blue-600" /> Physical Lockers ({results.lockers.length})
              </div>
              <div className="space-y-1">
                {results.lockers.map((l) => (
                  <div
                    key={l._id}
                    onClick={() => {
                      onClose();
                      onSelectLocker(l._id);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-200/80 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-900 font-mono font-bold text-xs">
                        #{l.lockerNumber}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs group-hover:text-blue-900">
                          Locker #{l.lockerNumber} ({l.lockerCode})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Size {l.size} &bull; Rack {l.rackNumber}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          l.status === 'VACANT'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {l.status}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. ALLOCATIONS GROUP */}
          {results.allocations.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-600" /> Tenancies ({results.allocations.length})
              </div>
              <div className="space-y-1">
                {results.allocations.map((a) => (
                  <div
                    key={a._id}
                    onClick={() => {
                      onClose();
                      navigate('/allocations');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono text-xs">
                        {a.allocationCode}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {a.customerName} &bull; Locker #{a.lockerNumber}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. INVOICES & PAYMENTS */}
          {(results.invoices.length > 0 || results.payments.length > 0) && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Receipt className="w-3 h-3 text-amber-600" /> Invoices & Receipts
              </div>
              <div className="space-y-1">
                {results.invoices.map((inv) => (
                  <div
                    key={inv._id}
                    onClick={() => {
                      onClose();
                      navigate('/renewals');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono text-xs">
                        Invoice {inv.invoiceNumber}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {inv.customerName} &bull; Locker #{inv.lockerNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-xs text-slate-900">
                        ₹{inv.totalAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-rose-600 font-semibold">
                        Bal: ₹{inv.balanceAmount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}

                {results.payments.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => {
                      onClose();
                      navigate('/payments');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 font-mono text-xs">
                        Receipt #{p.receiptNumber}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.customerName} &bull; Ref: {p.paymentNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-xs text-emerald-700">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Navigation Actions if search is empty or matches */}
          {query.trim().length === 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Navigation & Operations
              </div>
              <div className="space-y-1">
                {filteredStatic.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onClose();
                        item.action();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>
            Type at least 2 characters to search across customers, lockers & invoices.
          </span>
          <span className="font-mono">Vault Global Search</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
