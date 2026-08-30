export const LOCKER_SIZES = [
  { code: 'A', label: 'Size A (Small)', dimensions: '125 x 175 x 492 mm', defaultRent: 3000, defaultDeposit: 10000, sortOrder: 1 },
  { code: 'B', label: 'Size B (Medium)', dimensions: '159 x 210 x 492 mm', defaultRent: 4500, defaultDeposit: 15000, sortOrder: 2 },
  { code: 'C', label: 'Size C (Large)', dimensions: '189 x 263 x 492 mm', defaultRent: 6000, defaultDeposit: 20000, sortOrder: 3 },
  { code: 'D', label: 'Size D (XL)', dimensions: '278 x 352 x 492 mm', defaultRent: 8500, defaultDeposit: 25000, sortOrder: 4 },
  { code: 'E', label: 'Size E (Executive)', dimensions: '385 x 410 x 492 mm', defaultRent: 12000, defaultDeposit: 35000, sortOrder: 5 },
  { code: 'F', label: 'Size F (Jumbo)', dimensions: '450 x 500 x 492 mm', defaultRent: 16000, defaultDeposit: 50000, sortOrder: 6 },
  { code: 'G', label: 'Size G (Vault Deluxe)', dimensions: '550 x 600 x 492 mm', defaultRent: 22000, defaultDeposit: 65000, sortOrder: 7 },
  { code: 'G1', label: 'Size G1 (Custom Double)', dimensions: '600 x 700 x 492 mm', defaultRent: 28000, defaultDeposit: 80000, sortOrder: 8 },
  { code: 'G2', label: 'Size G2 (Master Suite)', dimensions: '750 x 850 x 492 mm', defaultRent: 35000, defaultDeposit: 100000, sortOrder: 9 },
] as const;

export type LockerSizeCode = typeof LOCKER_SIZES[number]['code'];

export const LOCKER_STATUS = {
  VACANT: 'VACANT',
  RESERVED: 'RESERVED',
  OCCUPIED: 'OCCUPIED',
  BLOCKED: 'BLOCKED',
} as const;

export type LockerStatus = typeof LOCKER_STATUS[keyof typeof LOCKER_STATUS];

export const OPERATIONAL_STATUS = {
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  DAMAGED: 'DAMAGED',
  DECOMMISSIONED: 'DECOMMISSIONED',
} as const;

export type OperationalStatus = typeof OPERATIONAL_STATUS[keyof typeof OPERATIONAL_STATUS];
