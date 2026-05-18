'use client';

import { useState, useEffect } from 'react';
import { FileText, BarChart2, TrendingUp, CheckSquare, HeadphonesIcon, Users } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatDate } from '@/lib/utils';

export default function ReportsPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (businessId) load(); }, [businessId]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('business_id', businessId!)
      .order('report_date', { ascending: false });
    setReports(data ?? []);
    if (data && data.length > 0) setSelected(data[0]);
    setLoading(false);
  }

  return (
    <div>
      <Header title="Reports" description="Daily AI-generated business briefings" />
      <div className="p-6">
        {loading ? (
          <div className="grid lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
            </div>
            <div className="lg:col-span-3 h-64 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">No reports yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Daily CEO briefings will appear here once you connect your AI keys and have business activity.
              Reports are auto-generated every morning.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-4 gap-6 min-h-[600px]">
            {/* Report list */}
            <div className="lg:col-span-1 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Past Reports</p>
              {reports.map(r => (
                <button key={r.id} onClick={() => setSelected(r)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50 ${selected?.id === r.id ? 'border-primary bg-primary/5' : ''}`}>
                  <p className="text-sm font-medium">{formatDate(r.report_date)}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.summary || 'Daily briefing'}</p>
                  {r.sent_at && <Badge variant="success" className="mt-1 text-[10px]">Sent</Badge>}
                </button>
              ))}
            </div>

            {/* Report detail */}
            <div className="lg:col-span-3">
              {selected && (
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">CEO Briefing — {formatDate(selected.report_date)}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">{selected.summary}</p>
                      </div>
                      {selected.sent_at && <Badge variant="success">Emailed</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    {selected.key_insights?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" /> Key Insights
                        </p>
                        <ul className="space-y-1.5">
                          {selected.key_insights.map((insight: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-primary font-bold shrink-0">·</span> {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selected.action_items?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                          <CheckSquare className="h-3.5 w-3.5" /> Action Items
                        </p>
                        <ul className="space-y-1.5">
                          {selected.action_items.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="h-4 w-4 rounded border border-muted-foreground shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selected.content && Object.keys(selected.content).length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selected.content).map(([key, val]: any) => (
                          <div key={key} className="rounded-lg bg-muted p-3">
                            <p className="text-xs font-medium capitalize text-muted-foreground mb-1">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm">{val}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
