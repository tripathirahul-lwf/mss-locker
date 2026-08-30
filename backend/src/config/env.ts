import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  MONGODB_URI: z
    .string()
    .min(1, { message: 'MONGODB_URI is required' })
    .default('mongodb://127.0.0.1:27017/vault_ledger'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, { message: 'JWT_ACCESS_SECRET must be at least 16 characters' })
    .default('default_development_access_secret_key_32_chars!'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, { message: 'JWT_REFRESH_SECRET must be at least 16 characters' })
    .default('default_development_refresh_secret_key_32_chars!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  STORAGE_REFERENCE_SECRET: z.string().min(32).optional(),
  CLOUDINARY_KYC_FOLDER: z.string().regex(/^[a-zA-Z0-9/_-]+$/).default('vault-ledger/kyc'),
  CLOUDINARY_PHOTO_FOLDER: z.string().regex(/^[a-zA-Z0-9/_-]+$/).default('vault-ledger/photos'),
  INITIAL_ADMIN_NAME: z.string().default('Super Administrator'),
  INITIAL_ADMIN_EMAIL: z.string().email().default('admin@vaultledger.com'),
  INITIAL_ADMIN_USERNAME: z.string().default('superadmin'),
  INITIAL_ADMIN_PASSWORD: z.string().min(12).default('VaultAdmin@1234'),
}).superRefine((value, ctx) => {
  const cloudinaryValues = [value.CLOUDINARY_CLOUD_NAME, value.CLOUDINARY_API_KEY, value.CLOUDINARY_API_SECRET];
  if (cloudinaryValues.some(Boolean) && !cloudinaryValues.every(Boolean)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOUDINARY_CLOUD_NAME'], message: 'Cloudinary cloud name, API key and API secret must be configured together' });
  }
  if (cloudinaryValues.every(Boolean) && !value.STORAGE_REFERENCE_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['STORAGE_REFERENCE_SECRET'], message: 'An independent storage reference signing secret is required with Cloudinary' });
  }
  if (value.NODE_ENV !== 'production') return;

  const insecureDefaults = [
    'default_development_access_secret_key_32_chars!',
    'default_development_refresh_secret_key_32_chars!',
  ];
  if (insecureDefaults.includes(value.JWT_ACCESS_SECRET)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_ACCESS_SECRET'], message: 'Production access secret must be explicitly configured' });
  }
  if (insecureDefaults.includes(value.JWT_REFRESH_SECRET)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'Production refresh secret must be explicitly configured' });
  }
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'Access and refresh secrets must be different' });
  }
  if (value.INITIAL_ADMIN_PASSWORD === 'VaultAdmin@1234') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['INITIAL_ADMIN_PASSWORD'], message: 'Default administrator password is forbidden in production' });
  }
  if (value.CLIENT_URL === '*' || !value.CLIENT_URL.startsWith('https://')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLIENT_URL'], message: 'Production CLIENT_URL must be one explicit HTTPS origin' });
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.error('Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const env: EnvConfig = parsedEnv.data;
