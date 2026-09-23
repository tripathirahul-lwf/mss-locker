import { LockerSizeItem, LockerStatus, OperationalStatus } from '../types';

export const LOCKER_SIZES: LockerSizeItem[] = [
  { code: 'A', label: 'Size A (Small)', dimensions: '125 x 175 x 492 mm', baseRent: 1000, defaultRent: 1180, defaultDeposit: 2000, sortOrder: 1 },
  { code: 'B', label: 'Size B (Medium)', dimensions: '159 x 210 x 492 mm', baseRent: 1400, defaultRent: 1655, defaultDeposit: 2800, sortOrder: 2 },
  { code: 'B1', label: 'Size B1 (Medium Extended)', dimensions: '159 x 230 x 492 mm', baseRent: 1400, defaultRent: 1655, defaultDeposit: 2800, sortOrder: 3 },
  { code: 'C', label: 'Size C (Large)', dimensions: '189 x 263 x 492 mm', baseRent: 2000, defaultRent: 2360, defaultDeposit: 4000, sortOrder: 4 },
  { code: 'D', label: 'Size D (XL)', dimensions: '278 x 352 x 492 mm', baseRent: 2500, defaultRent: 2950, defaultDeposit: 5000, sortOrder: 5 },
  { code: 'D1', label: 'Size D1 (XL Extended)', dimensions: '278 x 380 x 492 mm', baseRent: 2500, defaultRent: 2950, defaultDeposit: 5000, sortOrder: 6 },
  { code: 'E', label: 'Size E (Executive)', dimensions: '385 x 410 x 492 mm', baseRent: 3200, defaultRent: 3780, defaultDeposit: 6400, sortOrder: 7 },
  { code: 'F', label: 'Size F (Jumbo)', dimensions: '450 x 500 x 492 mm', baseRent: 3900, defaultRent: 4605, defaultDeposit: 7800, sortOrder: 8 },
  { code: 'F1', label: 'Size F1 (Jumbo Extended)', dimensions: '450 x 550 x 492 mm', baseRent: 4500, defaultRent: 5310, defaultDeposit: 9000, sortOrder: 9 },
  { code: 'G', label: 'Size G (Vault Deluxe)', dimensions: '550 x 600 x 492 mm', baseRent: 6400, defaultRent: 7555, defaultDeposit: 12800, sortOrder: 10 },
  { code: 'G1', label: 'Size G1 (Custom Double)', dimensions: '600 x 700 x 492 mm', baseRent: 6400, defaultRent: 7555, defaultDeposit: 12800, sortOrder: 11 },
  { code: 'G2', label: 'Size G2 (Master Suite)', dimensions: '750 x 850 x 492 mm', baseRent: 6400, defaultRent: 7555, defaultDeposit: 12800, sortOrder: 12 },
];

export const LOCKER_STATUS_CONFIG: Record<
  LockerStatus,
  { label: string; bg: string; text: string; border: string; dot: string; description: string }
> = {
  VACANT: {
    label: 'Vacant',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Available for immediate customer allotment',
  },
  OCCUPIED: {
    label: 'Occupied',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    description: 'Active allotment held by customer',
  },
  RESERVED: {
    label: 'Reserved',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    description: 'Temporarily held for allocation application',
  },
  BLOCKED: {
    label: 'Blocked',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
    description: 'Unavailable due to business or legal notice',
  },
};

export const OPERATIONAL_STATUS_CONFIG: Record<
  OperationalStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  ACTIVE: {
    label: 'Active Unit',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-emerald-500',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  DAMAGED: {
    label: 'Damaged',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  DECOMMISSIONED: {
    label: 'Decommissioned',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
};
