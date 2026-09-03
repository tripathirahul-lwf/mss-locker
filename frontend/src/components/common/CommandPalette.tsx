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
} from 'lucide-react';
import { lockerApi } from '../../features/lockers/api/lockerApi';
import { customerApi } from '../../features/customers/api/customerApi';
import { Locker } from '../../features/lockers/types';
import { Customer } from '../../features/customers/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const staticItems = [
    {
      id: 'nav-dashboard',
      title: 'Dashboard Overview',
      subtitle: 'Vault occupancy metrics & daily routines',
      icon: LayoutDashboard,
      category: 'Navigation',
      action: () => navigate('/'),
    },
    {
      id: 'nav-lockers',
      title: 'Lockers Master Registry',
      subtitle: '1,484 physical lockers directory & racks',
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
      id: 'nav-users',
      title: 'Operator User Management',
      subtitle: 'Staff accounts and RBAC access roles',
      icon: ShieldCheck,
      category: 'Navigation',
      action: () => navigate('/users'),
    },
    {
      id: 'action-add-locker',
      title: 'Add New Physical Locker',
      subtitle: 'Register locker unit with rack & size',
      icon: PlusCircle,
      category: 'Quick Action',
      action: () => navigate('/lockers?action=create'),
    },
    {
      id: 'action-add-customer',
      title: 'Register New Customer Profile',
      subtitle: 'Add customer with phone & photo',
      icon: UserPlus,
      category: 'Quick Action',
      action: () => navigate('/customers?action=create'),
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setLockers([]);
      setCustomers([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setLockers([]);
      setCustomers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const [lockerRes, customerRes] = await Promise.allSettled([
          lockerApi.getLockers({ search: query.trim(), limit: 4 }),
          customerApi.getCustomers({ search: query.trim(), limit: 4 }),
        ]);

        if (lockerRes.status === 'fulfilled') {
          setLockers(lockerRes.value.lockers);
        }
        if (customerRes.status === 'fulfilled') {
          setCustomers(customerRes.value.customers);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredStatic = staticItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const allItems = [
    ...lockers.map((l) => ({
      id: `locker-${l._id}`,
      title: `Locker #${l.lockerNumber} (${l.lockerCode})`,
      subtitle: `Size ${l.size} • ${l.rackNumber} • Status: ${l.status}`,
      icon: KeyRound,
      category: 'Physical Lockers',
      action: () => navigate(`/lockers/${l._id}`),
    })),
    ...customers.map((c) => ({
      id: `customer-${c._id}`,
      title: `${c.fullName} (${c.customerCode})`,
      subtitle: `${c.phone} • KYC: ${c.kycStatus}`,
      icon: Users,
      category: 'Customers & KYC',
      action: () => navigate(`/customers/${c._id}`),
    })),
    ...filteredStatic,
  ];

  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(allItems[selectedIndex].action);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-5 h-5 text-emerald-700 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a locker number, customer name, phone or action..."
            className="flex-1 bg-transparent border-0 text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
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
        <div className="p-2 overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
          {isLoading && (
            <div className="p-4 text-center text-slate-400 text-xs animate-pulse font-medium">
              Searching Vault Registry...
            </div>
          )}

          {allItems.length === 0 && !isLoading && (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <p className="font-bold text-slate-700 text-sm">No matching results</p>
              <p className="text-xs">
                Try searching by locker number (e.g. 101), customer phone, or full name.
              </p>
            </div>
          )}

          {allItems.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.action)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-colors ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-950 shadow-2xs border border-emerald-200/80'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-sm truncate">{item.title}</p>
                    <p
                      className={`text-[11px] truncate font-medium ${
                        isSelected ? 'text-emerald-800' : 'text-slate-500'
                      }`}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-emerald-200/60 text-emerald-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.category}
                  </span>
                  <ArrowRight
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span>
              Use <kbd className="font-mono font-bold">↑</kbd>{' '}
              <kbd className="font-mono font-bold">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono font-bold">Enter</kbd> to select
            </span>
          </div>
          <span>Vault Command Palette</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
