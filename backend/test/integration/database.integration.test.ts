import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Sequence } from '../../src/models/Sequence';
import { SyncTombstone } from '../../src/models/SyncTombstone';
import { syncService } from '../../src/services/sync.service';
import { PERMISSIONS } from '../../src/constants/permissions';

let replicaSet: MongoMemoryReplSet;

describe('MongoDB transaction, concurrency and sync integration', () => {
  beforeAll(async () => {
    process.env.MONGOMS_DOWNLOAD_DIR = `${process.cwd()}/.cache/mongodb-binaries`;
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    mongoose.set('transactionAsyncLocalStorage', true);
    await mongoose.connect(replicaSet.getUri(), { dbName: 'vault-ledger-integration' });
  }, 120_000);

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet?.stop();
  });

  it('rolls back every write when a transaction fails', async () => {
    await expect(mongoose.connection.transaction(async () => {
      await Sequence.create({ key: 'rolled-back', value: 1 });
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    expect(await Sequence.countDocuments({ key: 'rolled-back' })).toBe(0);
  });

  it('allocates unique monotonic sequence values under concurrency', async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () =>
      Sequence.findOneAndUpdate(
        { key: 'receipt' },
        { $inc: { value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean()
    ));

    const values = results.map((record) => record!.value).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  });

  it('delivers deletion tombstones once and advances their independent cursor', async () => {
    await SyncTombstone.create({ scope: 'lockers', recordId: 'deleted-locker-id' });

    const first = await syncService.getIncrementalSync(undefined, 20, [PERMISSIONS.LOCKERS_VIEW]);
    expect(first.allowedScopes).toEqual(['lockers']);
    expect(first.data.deleted.lockers).toEqual(['deleted-locker-id']);

    const second = await syncService.getIncrementalSync(first.nextCursor, 20, [PERMISSIONS.LOCKERS_VIEW]);
    expect(second.data.deleted.lockers).toEqual([]);
  });
});
