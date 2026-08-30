import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';
import { successResponse, errorResponse } from '../utils/apiResponse';

export class RoleController {
  static async getRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RoleService.getRoles();
      res.status(200).json(successResponse('Roles retrieved successfully', result));
    } catch (error) {
      next(error);
    }
  }

  static async getRoleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const role = await RoleService.getRoleById(id);
      res.status(200).json(successResponse('Role details retrieved', role));
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message || 'Role not found'));
    }
  }

  static async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse('Authentication required'));
        return;
      }

      const id = req.params.id as string;
      const { name, description, permissions } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const role = await RoleService.updateRole(
        id,
        { name, description, permissions },
        req.user.userId,
        req.user.username,
        ipAddress,
        userAgent
      );

      res.status(200).json(successResponse('Role updated successfully', role));
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message || 'Failed to update role'));
    }
  }
}
