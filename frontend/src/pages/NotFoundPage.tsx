import { FileQuestion, Home } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-[500px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Page Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">
          The requested operational screen does not exist or has been relocated.
        </p>
        <Link to="/">
          <Button className="w-full flex items-center justify-center gap-2">
            <Home className="w-4 h-4" />
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
