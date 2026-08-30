import { connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { CustomerKycDocument } from '../models/CustomerKycDocument';
import { LockerAllocation } from '../models/LockerAllocation';
import { hashPassword } from '../utils/password';
import { logger } from '../utils/logger';
import {
  SYSTEM_ROLE_CODES,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
} from '../constants/permissions';

export const seedDatabase = async (): Promise<void> => {
  try {
    logger.info('Starting database seeding...');

    // 1. Seed Roles
    const systemRoles = [
      {
        name: 'Super Administrator',
        code: SYSTEM_ROLE_CODES.SUPER_ADMIN,
        description: 'Complete system access, user administration, security controls, and global settings.',
        permissions: ALL_PERMISSIONS,
        isSystemRole: true,
        status: 'ACTIVE',
      },
      {
        name: 'Admin / Vault Manager',
        code: SYSTEM_ROLE_CODES.ADMIN,
        description: 'Branch administrator with operational control over lockers, customers, financials, and reports.',
        permissions: DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLE_CODES.ADMIN],
        isSystemRole: true,
        status: 'ACTIVE',
      },
      {
        name: 'Counter Staff',
        code: SYSTEM_ROLE_CODES.COUNTER_STAFF,
        description: 'Counter tablet operator handling daily allocations, renewals, receipts, and customer lookups.',
        permissions: DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLE_CODES.COUNTER_STAFF],
        isSystemRole: true,
        status: 'ACTIVE',
      },
      {
        name: 'Read Only / Auditor',
        code: SYSTEM_ROLE_CODES.READ_ONLY,
        description: 'Auditor account with read-only visibility into operational reports and compliance logs.',
        permissions: DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLE_CODES.READ_ONLY],
        isSystemRole: true,
        status: 'ACTIVE',
      },
    ];

    for (const roleDef of systemRoles) {
      const existingRole = await Role.findOne({ code: roleDef.code });
      if (!existingRole) {
        await Role.create(roleDef);
        logger.info(`Seeded system role: ${roleDef.name} (${roleDef.code})`);
      } else {
        // Ensure system role flag and updated permissions exist
        existingRole.isSystemRole = true;
        existingRole.permissions =
          roleDef.code === SYSTEM_ROLE_CODES.SUPER_ADMIN
            ? ALL_PERMISSIONS
            : DEFAULT_ROLE_PERMISSIONS[roleDef.code] || existingRole.permissions;
        await existingRole.save();
      }
    }

    // 2. Seed Initial Super Admin
    const superAdminRole = await Role.findOne({ code: SYSTEM_ROLE_CODES.SUPER_ADMIN });
    if (!superAdminRole) {
      throw new Error('Super Admin role could not be resolved during seeding');
    }

    const normalizedAdminEmail = env.INITIAL_ADMIN_EMAIL.trim().toLowerCase();
    const normalizedAdminUsername = env.INITIAL_ADMIN_USERNAME.trim().toLowerCase();

    const existingAdmin = await User.findOne({
      $or: [{ email: normalizedAdminEmail }, { username: normalizedAdminUsername }],
    });

    let adminUser = existingAdmin;

    if (!existingAdmin) {
      const passwordHash = await hashPassword(env.INITIAL_ADMIN_PASSWORD);
      adminUser = await User.create({
        name: env.INITIAL_ADMIN_NAME.trim(),
        email: normalizedAdminEmail,
        username: normalizedAdminUsername,
        phone: '+91 9876543210',
        passwordHash,
        role: superAdminRole._id,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      });

      logger.info(`Initial Super Admin seeded successfully: username='${normalizedAdminUsername}', email='${normalizedAdminEmail}'`);
    } else {
      logger.info(`Super Admin account already exists (username='${existingAdmin.username}').`);
    }

    // 3. Seed Sample Development Lockers (if database has 0 lockers)
    const lockerCount = await Locker.countDocuments();
    if (lockerCount === 0) {
      const sampleLockers = [
        {
          lockerNumber: '101',
          lockerCode: 'LCK-000001',
          size: 'A',
          rackNumber: 'Rack-01',
          section: 'Main Vault',
          floor: 'Ground Floor',
          position: 'Row 1 / Col 1',
          masterKeyReference: 'MK-R01-01',
          annualRent: 3000,
          securityDeposit: 10000,
          status: 'VACANT',
          operationalStatus: 'ACTIVE',
          remarks: 'Standard small drawer unit ready for allotment',
          isActive: true,
          createdBy: adminUser?._id,
        },
        {
          lockerNumber: '102',
          lockerCode: 'LCK-000002',
          size: 'A',
          rackNumber: 'Rack-01',
          section: 'Main Vault',
          floor: 'Ground Floor',
          position: 'Row 1 / Col 2',
          masterKeyReference: 'MK-R01-02',
          annualRent: 3000,
          securityDeposit: 10000,
          status: 'VACANT',
          operationalStatus: 'ACTIVE',
          isActive: true,
          createdBy: adminUser?._id,
        },
        {
          lockerNumber: '201',
          lockerCode: 'LCK-000003',
          size: 'B',
          rackNumber: 'Rack-02',
          section: 'Main Vault',
          floor: 'Ground Floor',
          position: 'Row 2 / Col 1',
          masterKeyReference: 'MK-R02-01',
          annualRent: 4500,
          securityDeposit: 15000,
          status: 'OCCUPIED',
          operationalStatus: 'ACTIVE',
          remarks: 'Legacy customer tenancy',
          isActive: true,
          createdBy: adminUser?._id,
        },
        {
          lockerNumber: '202',
          lockerCode: 'LCK-000004',
          size: 'B',
          rackNumber: 'Rack-02',
          section: 'Main Vault',
          floor: 'Ground Floor',
          position: 'Row 2 / Col 2',
          masterKeyReference: 'MK-R02-02',
          annualRent: 4500,
          securityDeposit: 15000,
          status: 'VACANT',
          operationalStatus: 'ACTIVE',
          isActive: true,
          createdBy: adminUser?._id,
        },
        {
          lockerNumber: '301',
          lockerCode: 'LCK-000005',
          size: 'C',
          rackNumber: 'Rack-03',
          section: 'Left Wing',
          floor: 'Ground Floor',
          position: 'Row 1 / Col 1',
          masterKeyReference: 'MK-R03-01',
          annualRent: 6000,
          securityDeposit: 20000,
          status: 'RESERVED',
          operationalStatus: 'ACTIVE',
          remarks: 'Customer KYC under review',
          isActive: true,
          createdBy: adminUser?._id,
        },
        {
          lockerNumber: '401',
          lockerCode: 'LCK-000006',
          size: 'D',
          rackNumber: 'Rack-04',
          section: 'Left Wing',
          floor: 'Ground Floor',
          position: 'Row 1 / Col 1',
          masterKeyReference: 'MK-R04-01',
          annualRent: 8500,
          securityDeposit: 25000,
          status: 'BLOCKED',
          operationalStatus: 'ACTIVE',
          remarks: 'Physical drawer inspection notice',
          isActive: true,
          createdBy: adminUser?._id,
        },
        {
          lockerNumber: '501',
          lockerCode: 'LCK-000007',
          size: 'E',
          rackNumber: 'Rack-05',
          section: 'Executive Suite',
          floor: 'First Floor',
          position: 'Cabinet 1 / Top',
          masterKeyReference: 'MK-R05-01',
          annualRent: 12000,
          securityDeposit: 35000,
          status: 'VACANT',
          operationalStatus: 'MAINTENANCE',
          remarks: 'Lock barrel replacement underway',
          isActive: true,
          createdBy: adminUser?._id,
        },
        {
          lockerNumber: '601',
          lockerCode: 'LCK-000008',
          size: 'F',
          rackNumber: 'Rack-06',
          section: 'Executive Suite',
          floor: 'First Floor',
          position: 'Cabinet 2 / Top',
          masterKeyReference: 'MK-R06-01',
          annualRent: 16000,
          securityDeposit: 50000,
          status: 'VACANT',
          operationalStatus: 'ACTIVE',
          isActive: true,
          createdBy: adminUser?._id,
        },
      ];

      await Locker.insertMany(sampleLockers);
      logger.info(`Seeded ${sampleLockers.length} sample development lockers.`);
    }

    // 4. Seed Sample Development Customers & KYC (if database has 0 customers)
    const customerCount = await Customer.countDocuments();
    if (customerCount === 0 && adminUser) {
      // Customer 1: Ramesh Kumar Sharma (KYC Verified)
      const cus1 = await Customer.create({
        customerCode: 'CUS-000001',
        fullName: 'Ramesh Kumar Sharma',
        firstName: 'Ramesh',
        lastName: 'Sharma',
        phone: '+91 9820012345',
        email: 'ramesh.sharma@example.com',
        dateOfBirth: '1982-05-14',
        gender: 'MALE',
        address: 'Flat 402, Sea Green Heights, Worli Sea Face',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400018',
        country: 'India',
        kycStatus: 'VERIFIED',
        kycVerifiedAt: new Date(),
        kycVerifiedBy: adminUser._id,
        notes: 'High-net-worth client. Primary operator with wife as nominee.',
        status: 'ACTIVE',
        isActive: true,
        createdBy: adminUser._id,
      });

      await CustomerKycDocument.create([
        {
          customerId: cus1._id,
          documentType: 'AADHAAR',
          documentNumber: '548912345678',
          documentUrl: '/uploads/kyc/sample-aadhaar.pdf',
          documentName: 'Aadhaar Card Front-Back.pdf',
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedBy: adminUser._id,
          isPrimary: true,
          createdBy: adminUser._id,
        },
        {
          customerId: cus1._id,
          documentType: 'PAN',
          documentNumber: 'AAAPL1234F',
          documentUrl: '/uploads/kyc/sample-pan.jpg',
          documentName: 'PAN Card Copy.jpg',
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedBy: adminUser._id,
          isPrimary: false,
          createdBy: adminUser._id,
        },
      ]);

      // Customer 2: Priya Patel (KYC Incomplete / Partial)
      const cus2 = await Customer.create({
        customerCode: 'CUS-000002',
        fullName: 'Priya Patel',
        firstName: 'Priya',
        lastName: 'Patel',
        phone: '+91 9879954321',
        email: 'priya.patel@example.com',
        dateOfBirth: '1990-11-20',
        gender: 'FEMALE',
        address: 'B-12, Green Avenue, Navrangpura',
        city: 'Ahmedabad',
        state: 'Gujarat',
        postalCode: '380009',
        country: 'India',
        kycStatus: 'PARTIAL',
        notes: 'Aadhaar uploaded; awaiting counter officer review.',
        status: 'ACTIVE',
        isActive: true,
        createdBy: adminUser._id,
      });

      await CustomerKycDocument.create({
        customerId: cus2._id,
        documentType: 'AADHAAR',
        documentNumber: '987654321098',
        documentUrl: '/uploads/kyc/sample-aadhaar-2.pdf',
        documentName: 'Aadhaar Card Copy.pdf',
        verificationStatus: 'PENDING',
        isPrimary: true,
        createdBy: adminUser._id,
      });

      // Customer 3: Rajesh Verma (KYC Pending)
      await Customer.create({
        customerCode: 'CUS-000003',
        fullName: 'Rajesh Verma',
        firstName: 'Rajesh',
        lastName: 'Verma',
        phone: '+91 9415098765',
        email: 'rajesh.verma@example.com',
        dateOfBirth: '1975-08-30',
        gender: 'MALE',
        address: 'House 14, Civil Lines',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        postalCode: '226001',
        country: 'India',
        kycStatus: 'PENDING',
        status: 'ACTIVE',
        isActive: true,
        createdBy: adminUser._id,
      });

      // Customer 4: Sunita Rao (KYC Rejected)
      const cus4 = await Customer.create({
        customerCode: 'CUS-000004',
        fullName: 'Sunita Rao',
        firstName: 'Sunita',
        lastName: 'Rao',
        phone: '+91 9845011223',
        email: 'sunita.rao@example.com',
        dateOfBirth: '1988-02-15',
        gender: 'FEMALE',
        address: 'Plot 88, Jubilee Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500033',
        country: 'India',
        kycStatus: 'REJECTED',
        notes: 'Aadhaar copy unreadable. Requested original at counter.',
        status: 'ACTIVE',
        isActive: true,
        createdBy: adminUser._id,
      });

      await CustomerKycDocument.create({
        customerId: cus4._id,
        documentType: 'AADHAAR',
        documentNumber: '112233445566',
        documentUrl: '/uploads/kyc/sample-aadhaar-rejected.jpg',
        documentName: 'Blurred Aadhaar.jpg',
        verificationStatus: 'REJECTED',
        verifiedAt: new Date(),
        verifiedBy: adminUser._id,
        rejectionReason: 'Scanned document copy blurred and name does not match bank record.',
        isPrimary: true,
        createdBy: adminUser._id,
      });

      logger.info('Seeded 4 sample development customers with KYC documents.');
    }

    // 5. Seed Sample Development Allocations (if database has 0 allocations)
    const allocationCount = await LockerAllocation.countDocuments();
    if (allocationCount === 0 && adminUser) {
      const ramesh = await Customer.findOne({ customerCode: 'CUS-000001' });
      const priya = await Customer.findOne({ customerCode: 'CUS-000002' });
      const rajesh = await Customer.findOne({ customerCode: 'CUS-000003' });

      const locker201 = await Locker.findOne({ lockerNumber: '201' });
      const locker301 = await Locker.findOne({ lockerNumber: '301' });
      const locker102 = await Locker.findOne({ lockerNumber: '102' });

      if (ramesh && locker201) {
        await LockerAllocation.create({
          allocationCode: 'ALC-000001',
          customerId: ramesh._id,
          lockerId: locker201._id,
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          billingCycle: 'ANNUAL',
          annualRent: locker201.annualRent,
          securityDeposit: locker201.securityDeposit,
          rentSnapshot: locker201.annualRent,
          depositSnapshot: locker201.securityDeposit,
          status: 'ACTIVE',
          allocationType: 'NEW',
          remarks: 'Annual locker agreement with dual key handover',
          createdBy: adminUser._id,
          isActive: true,
        });

        locker201.status = 'OCCUPIED';
        await locker201.save();
      }

      if (priya && locker301) {
        await LockerAllocation.create({
          allocationCode: 'ALC-000002',
          customerId: priya._id,
          lockerId: locker301._id,
          startDate: new Date(),
          reservationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          billingCycle: 'ANNUAL',
          annualRent: locker301.annualRent,
          securityDeposit: locker301.securityDeposit,
          rentSnapshot: locker301.annualRent,
          depositSnapshot: locker301.securityDeposit,
          status: 'RESERVED',
          allocationType: 'NEW',
          remarks: 'Unit held on 7-day reservation pending KYC verification',
          createdBy: adminUser._id,
          isActive: true,
        });

        locker301.status = 'RESERVED';
        await locker301.save();
      }

      if (rajesh && locker102) {
        await LockerAllocation.create({
          allocationCode: 'ALC-000003',
          customerId: rajesh._id,
          lockerId: locker102._id,
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          billingCycle: 'ANNUAL',
          annualRent: locker102.annualRent,
          securityDeposit: locker102.securityDeposit,
          rentSnapshot: locker102.annualRent,
          depositSnapshot: locker102.securityDeposit,
          status: 'CLOSED',
          allocationType: 'NEW',
          remarks: 'Tenancy concluded normally upon key surrender and deposit refund.',
          createdBy: adminUser._id,
          closedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          closedBy: adminUser._id,
          isActive: false,
        });
      }

      logger.info('Seeded sample development allocations (ACTIVE, RESERVED, CLOSED).');
    }

    logger.info('Database seeding completed successfully.');
  } catch (error) {
    logger.error('Error during database seeding:', error);
    throw error;
  }
};

// If run directly via CLI (npm run seed)
if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      await seedDatabase();
      await disconnectDatabase();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  })();
}
