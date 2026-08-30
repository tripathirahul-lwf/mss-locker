import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/apiResponse';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json(
    errorResponse(`Cannot ${req.method} ${req.originalUrl} - Route Not Found`)
  );
};
