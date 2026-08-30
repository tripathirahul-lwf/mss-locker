import { ApiResponse } from '../types';

export const successResponse = <T>(message: string, data?: T): ApiResponse<T> => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const errorResponse = (message: string, errors?: unknown): ApiResponse => {
  return {
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  };
};
