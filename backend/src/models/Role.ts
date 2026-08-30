import { Schema, model, Document, Types } from 'mongoose';

export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

export const Role = model<IRole>('Role', roleSchema);
