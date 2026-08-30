import { Sequence } from '../models/Sequence';

const nextNumber = async (kind: string, prefix: string): Promise<string> => {
  const year = new Date().getFullYear();
  const sequence = await Sequence.findOneAndUpdate(
    { key: `${kind}:${year}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `${prefix}-${year}-${String(sequence.value).padStart(6, '0')}`;
};

export const generatePaymentNumber = (): Promise<string> => nextNumber('payment', 'PAY');
export const generateReceiptNumber = (): Promise<string> => nextNumber('receipt', 'RCT');
