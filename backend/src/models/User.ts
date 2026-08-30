import { Schema, model, Document, Types } from 'mongoose';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  username: string;
  phone?: string;
  passwordHash: string;
  role: Types.ObjectId;
  permissionsOverride: {
    grant: string[];
    revoke: string[];
  };
  status: UserStatus;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Do not return password hash by default
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
    },
    permissionsOverride: {
      grant: {
        type: [String],
        default: [],
      },
      revoke: {
        type: [String],
        default: [],
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'LOCKED'],
      default: 'ACTIVE',
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const User = model<IUser>('User', userSchema);
