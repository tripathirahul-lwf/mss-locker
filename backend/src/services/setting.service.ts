import mongoose, { Types } from 'mongoose';
import { SystemSetting } from '../models/SystemSetting';
import { TariffPlan } from '../models/TariffPlan';

const DEFAULTS = [
  ['A',1180,2000],['B',1655,2800],['B1',1655,2800],['C',2360,4000],['D',2950,5000],['D1',2950,5000],['E',3780,6400],['F',4605,7800],['F1',5310,9000],['G',7555,12800],['G1',7555,12800],['G2',7555,12800],
] as const;

export class SettingService {
  async get() {
    const settings = await SystemSetting.findOneAndUpdate({ key: 'GLOBAL' }, { $setOnInsert: { key: 'GLOBAL' } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    await TariffPlan.bulkWrite(DEFAULTS.map(([size, annualRent, securityDeposit]) => ({ updateOne: { filter: { size, isActive: true }, update: { $setOnInsert: { size, annualRent, securityDeposit, effectiveFrom: new Date(0), version: 1, isActive: true } }, upsert: true } })), { ordered: false });
    const tariffs = await TariffPlan.find({ isActive: true }).sort({ size: 1 }).lean();
    return { settings, tariffs };
  }
  async updateSettings(data: Record<string, unknown>, userId: string) {
    return SystemSetting.findOneAndUpdate({ key: 'GLOBAL' }, { $set: { ...data, updatedBy: new Types.ObjectId(userId) } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
  }
  async reviseTariff(input: { size: string; annualRent: number; securityDeposit: number; effectiveFrom: Date; notes?: string }, userId: string) {
    return mongoose.connection.transaction(async () => {
      const current = await TariffPlan.findOne({ size: input.size, isActive: true }).sort({ version: -1 });
      if (current && input.effectiveFrom <= current.effectiveFrom) {
        throw Object.assign(new Error('New tariff effective date must be later than the active tariff effective date.'), { statusCode: 409 });
      }
      const version = (current?.version || 0) + 1;
      if (current) { current.isActive = false; current.effectiveTo = new Date(input.effectiveFrom.getTime() - 1); await current.save(); }
      return TariffPlan.create({ ...input, version, isActive: true, createdBy: new Types.ObjectId(userId) });
    });
  }
  history(size: string) { return TariffPlan.find({ size: size.toUpperCase() }).sort({ version: -1 }).lean(); }
}
export const settingService = new SettingService();
