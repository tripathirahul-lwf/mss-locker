import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  username: string;
  roleCode: string;
  tokenVersion?: number;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): DecodedToken => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedToken;
};

export const verifyRefreshToken = (token: string): DecodedToken => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as DecodedToken;
};

/**
 * SHA256 hash for securely storing refresh tokens in MongoDB sessions
 */
export const hashRefreshToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
