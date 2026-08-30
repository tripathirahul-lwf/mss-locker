import { LucideIcon, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';

export interface PlaceholderPageProps {
  title: string;
  icon: LucideIcon;
  description: string;
  modulePhase: string;
  keyFeatures: string[];
}

export function PlaceholderPage({
  title,
  icon: Icon,
  description,
  modulePhase,
  keyFeatures,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {title}
              </h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                {modulePhase}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
              {description}
            </p>
          </div>
        </div>

        <Link to="/">
          <Button variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Module Overview Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <CardTitle className="text-base font-semibold">
              Planned Capabilities & Architecture
            </CardTitle>
          </div>
          <CardDescription>
            This section foundation and routing shell is configured and ready for implementation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {keyFeatures.map((feature, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3.5 rounded-md bg-slate-50 border border-slate-200/80"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-200 text-slate-700 text-xs font-mono font-bold">
                  {idx + 1}
                </span>
                <span className="text-xs font-medium text-slate-700 leading-relaxed">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
