import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import express from 'express';
import cookieParser from 'cookie-parser';
import { AuthController } from '../../src/controllers/auth.controller';
import { errorHandler } from '../../src/middlewares/errorHandler';
const authApp = express();
authApp.use(cookieParser());
authApp.use(express.json());
authApp.post('/api/auth/login', AuthController.login);
authApp.post('/api/auth/refresh', AuthController.refresh);
authApp.use(errorHandler);
import { AuthService } from '../../src/services/auth.service';

afterEach(() => vi.restoreAllMocks());
describe('authentication outage responses', () => {
  it('keeps the refresh cookie during database unavailability', async () => {
    vi.spyOn(AuthService, 'refresh').mockRejectedValue(Object.assign(new Error('server selection failed'), { name: 'MongoServerSelectionError' }));
    const response = await request(authApp).post('/api/auth/refresh').set('Cookie', 'vault_refresh_token=test-token');
    expect(response.status).toBe(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body.message).toContain('temporarily unavailable');
  });
  it('clears a definitively expired refresh token', async () => {
    vi.spyOn(AuthService, 'refresh').mockRejectedValue(new Error('Invalid or expired refresh token'));
    const response = await request(authApp).post('/api/auth/refresh').set('Cookie', 'vault_refresh_token=expired');
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie']).toBeDefined();
  });
  it('rejects missing tokens without an internal error', async () => {
    const response = await request(authApp).post('/api/auth/refresh');
    expect(response.status).toBe(401);
  });
  it('reports disconnected readiness separately from liveness', async () => {
    expect((await request(app).get('/api/health/live')).status).toBe(200);
    const response = await request(app).get('/api/health/ready');
    expect(response.status).toBe(503);
    expect(response.body.readiness).toBe('not_ready');
  });
});


describe('login failure classification', () => {
  it.each([
    ['Invalid credentials', 401],
    ['Account locked due to 5 failed login attempts. Please try again after 15 minutes.', 423],
    ['Account is locked. Please contact your system administrator.', 423],
    ['Account is temporarily locked due to multiple failed attempts.', 423],
    ['Assigned role is unavailable. Please contact your system administrator.', 403],
    ['Account is deactivated. Please contact your system administrator.', 403],
  ])('classifies %s as %s', async (message, status) => {
    vi.spyOn(AuthService, 'login').mockRejectedValue(new Error(message));
    const response = await request(authApp).post('/api/auth/login').send({ identifier: 'operator', password: 'wrong' });
    expect(response.status).toBe(status);
  });
  it('reports database outages instead of invalid credentials', async () => {
    vi.spyOn(AuthService, 'login').mockRejectedValue(Object.assign(new Error('server selection failed'), { name: 'MongoServerSelectionError' }));
    const response = await request(authApp).post('/api/auth/login').send({ identifier: 'operator', password: 'example' });
    expect(response.status).toBe(503);
  });
  it('does not disguise unexpected failures as invalid credentials', async () => {
    vi.spyOn(AuthService, 'login').mockRejectedValue(new Error('Unexpected service failure'));
    const response = await request(authApp).post('/api/auth/login').send({ identifier: 'operator', password: 'example' });
    expect(response.status).toBe(500);
  });
});
