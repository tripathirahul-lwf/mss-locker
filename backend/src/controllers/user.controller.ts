import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { successResponse, errorResponse } from '../utils/apiResponse';

export class UserController {
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, role, status, page, limit } = req.query;
      const result = await UserService.getUsers({
        search: search as string,
        role: role as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      });

      res.status(200).json(successResponse('Users retrieved successfully', result));
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const user = await UserService.getUserById(id);
      res.status(200).json(successResponse('User details retrieved', user));
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message || 'User not found'));
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('Authentication required'));
        return;
      }

      const { name, email, username, phone, roleId, password, status } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await UserService.createUser({
        name,
        email,
        username,
        phone,
        roleId,
        password,
        status,
        actorUserId: req.user.userId,
        actorUsername: req.user.username,
        isActorSuperAdmin: req.user.isSuperAdmin,
        ipAddress,
        userAgent,
      });

      res.status(201).json(successResponse('Staff user created successfully', user));
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message || 'Failed to create user'));
    }
  }

  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('Authentication required'));
        return;
      }

      const id = req.params.id as string;
      const { name, phone, roleId, status, permissionsOverride } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await UserService.updateUser({
        userId: id,
        name,
        phone,
        roleId,
        status,
        permissionsOverride,
        actorUserId: req.user.userId,
        actorUsername: req.user.username,
        isActorSuperAdmin: req.user.isSuperAdmin,
        ipAddress,
        userAgent,
      });

      res.status(200).json(successResponse('User updated successfully', user));
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message || 'Failed to update user'));
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('Authentication required'));
        return;
      }

      const id = req.params.id as string;
      const { newPassword } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await UserService.resetPassword(
        id,
        newPassword,
        req.user.userId,
        req.user.username,
        req.user.isSuperAdmin,
        ipAddress,
        userAgent
      );

      res.status(200).json(successResponse('User password reset successfully. User sessions invalidated.'));
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message || 'Failed to reset password'));
    }
  }
}
