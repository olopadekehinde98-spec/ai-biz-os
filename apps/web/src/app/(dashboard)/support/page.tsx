'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, HeadphonesIcon, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatRelative } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  open: 'destructive', ai_replied: 'info', escalated: 'warning', resolved: 'success',
};
const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'success', neutral: 'secondary', frustrated: 'warning', angry: 'destructive',
};

export default function SupportPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_name: '', customer_email: '', platform: 'website', message: '' });

  useEffect(() => { if (businessId) load(); }, [businessId, filter]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    let q = supabase.from('support_tickets').select('*').eq('business_id', businessId!).order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setTickets(data ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.customer_name || !form.message) { toast.error('Name and message required'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('support_tickets').insert({
      ...form, business_id: businessId, status: 'open', sentiment: 'neutral',
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Ticket created');
    setShowCreate(false);
    setForm({ customer_name: '', customer_email: '', platform: 'website', message: '' });
    load();
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from('support_tickets').update({ status }).eq('id', id);
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    if (selected?.id === id) setSelected((p: any) => ({ ...p, status }));
    toast.success('Status updated');
  }

  const filtered = tickets.filter(t =>
    !search || t.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.message?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Open', value: tickets.filter(t => t.status === 'open').length, color: 'text-red-500' },
    { label: 'AI Replied', value: tickets.filter(t => t.status === 'ai_replied').length, color: 'text-blue-500' },
    { label: 'Escalated', value: tickets.filter(t => t.status === 'escalated').length, color: 'text-orange-500' },
    { label: 'Angry', value: tickets.filter(t => t.sentiment === 'angry').length, color: 'text-red-600' },
  ];

  return (
    <div>
      <Header title="Support" description="Manage customer tickets"
        action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" />New ticket</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {stats.map(s => (
            <Card key={s.label}><CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent></Card>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="ai_replied">AI Replied</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid lg:grid-cols-5 gap-4 min-h-[500px]">
          <div className="lg:col-span-2 space-y-2">
            {loading ? [1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />) :
             filtered.length === 0 ? (
              <div className="text-center py-12">
                <HeadphonesIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No tickets yet</p>
                <Button size="sm" className="mt-3" onClick={() => setShowCreate(true)}>Create first ticket</Button>
              </div>
            ) : filtered.map(t => (
              <button key={t.id} onClick={() => setSelected(t)}
                className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 ${selected?.id === t.id ? 'border-primary bg-primary/5' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium truncate">{t.customer_name}</p>
                  <Badge variant={STATUS_COLORS[t.status] as any} className="text-xs shrink-0">{t.status.replace('_',' ')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={SENTIMENT_COLORS[t.sentiment] as any} className="text-[10px]">{t.sentiment}</Badge>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(t.created_at)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {selected ? (
              <Card className="h-full">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{selected.customer_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{selected.customer_email || 'No email'} · via {selected.platform}</p>
                    </div>
                    <Select value={selected.status} onValueChange={v => updateStatus(selected.id, v)}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="ai_replied">AI Replied</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Customer message</p>
                    <p className="text-sm">{selected.message}</p>
                  </div>
                  {selected.ai_response && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs text-primary mb-1 font-medium">AI Response</p>
                      <p className="text-sm">{selected.ai_response}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Badge variant={SENTIMENT_COLORS[selected.sentiment] as any}>Sentiment: {selected.sentiment}</Badge>
                    <Badge variant="outline">{formatRelative(selected.created_at)}</Badge>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center border rounded-lg">
                <div className="text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Select a ticket to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create support ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer name *</Label>
                <Input placeholder="Jane Smith" value={form.customer_name} onChange={e => setForm(f => ({...f, customer_name: e.target.value}))} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="jane@example.com" value={form.customer_email} onChange={e => setForm(f => ({...f, customer_email: e.target.value}))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({...f, platform: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['website','instagram','facebook','whatsapp','email','phone','other'].map(p =>
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Message *</Label>
              <Textarea placeholder="What did the customer say?" value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.customer_name || !form.message || saving}>
                {saving ? 'Creating…' : 'Create ticket'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
