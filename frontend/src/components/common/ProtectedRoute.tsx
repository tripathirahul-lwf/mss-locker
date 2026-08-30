import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';

export interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredPermission?: string;
  requiredRole?: string | string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
}) => {
  const { isAuthenticated, isLoading, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" label="Verifying Security Session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-[450px] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
          <p className="text-sm text-slate-500 mb-6">
            Your staff account does not have permission ({requiredPermission}) to access this operational screen.
          </p>
          <Link to="/">
            <Button variant="outline" className="w-full">
              Return to Safe Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-[450px] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Role Not Authorized</h2>
          <p className="text-sm text-slate-500 mb-6">
            This administrative screen requires elevated credentials.
          </p>
          <Link to="/">
            <Button variant="outline" className="w-full">
              Return to Safe Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return children;
};
