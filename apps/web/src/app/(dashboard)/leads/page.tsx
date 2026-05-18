'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Upload, Link2, Copy, Check,
  Users, Mail, Building2, Clock, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatRelative } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  new: 'info', contacted: 'warning', qualified: 'secondary',
  converted: 'success', lost: 'destructive',
};

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];

export default function LeadsPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', source: '', notes: '' });

  const captureUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/capture/${businessId}`;

  useEffect(() => { if (businessId) loadLeads(); }, [businessId, filter]);

  async function loadLeads() {
    setLoading(true);
    const supabase = createClient();
    let q = supabase.from('leads').select('*').eq('business_id', businessId!).order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setLeads(data ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('leads').insert({ ...form, business_id: businessId });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Lead added');
    setShowCreate(false);
    setForm({ name: '', email: '', company: '', source: '', notes: '' });
    loadLeads();
  }

  async function handleStatusChange(leadId: string, status: string) {
    const supabase = createClient();
    await supabase.from('leads').update({ status }).eq('id', leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, '_'));

    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = { business_id: businessId, status: 'new' };
      headers.forEach((h, i) => {
        if (h.includes('name')) obj.name = vals[i];
        else if (h.includes('email')) obj.email = vals[i];
        else if (h.includes('company') || h.includes('org')) obj.company = vals[i];
        else if (h.includes('source')) obj.source = vals[i];
        else if (h.includes('note')) obj.notes = vals[i];
      });
      return obj;
    }).filter(r => r.name);

    if (rows.length === 0) { toast.error('No valid rows found. Make sure CSV has a "name" column.'); setImporting(false); return; }

    const supabase = createClient();
    const { error } = await supabase.from('leads').insert(rows);
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${rows.length} leads!`);
    setShowImport(false);
    loadLeads();
    if (fileRef.current) fileRef.current.value = '';
  }

  function copyLink() {
    navigator.clipboard.writeText(captureUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Header
        title="Leads"
        description="Track and manage your prospects"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCapture(true)}>
              <Link2 className="h-4 w-4 mr-1" /> Capture link
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add lead
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-3">
          {STATUSES.map(s => (
            <Card key={s} className={`cursor-pointer transition-all ${filter === s ? 'border-primary' : ''}`}
              onClick={() => setFilter(filter === s ? 'all' : s)}>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{leads.filter(l => l.status === s).length}</p>
                <p className="text-xs text-muted-foreground capitalize">{s}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leads table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No leads yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Share your capture link or import a CSV to get started
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setShowCapture(true)}>
                    <Link2 className="h-4 w-4 mr-1" /> Share capture link
                  </Button>
                  <Button variant="outline" onClick={() => setShowImport(true)}>
                    <Upload className="h-4 w-4 mr-1" /> Import CSV
                  </Button>
                  <Button onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add manually
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(lead => (
                      <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {lead.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium">{lead.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.email || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.company || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.source || '—'}</td>
                        <td className="px-4 py-3">
                          <Select value={lead.status} onValueChange={v => handleStatusChange(lead.id, v)}>
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <Badge variant={STATUS_COLORS[lead.status] as any} className="capitalize text-xs">
                                {lead.status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatRelative(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Add Lead Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add lead manually</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input placeholder="Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="jane@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input placeholder="Acme Inc" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue placeholder="Where did this lead come from?" /></SelectTrigger>
                <SelectContent>
                  {['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Twitter/X', 'Website', 'Referral', 'Cold outreach', 'Ad campaign', 'Other'].map(s =>
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Any notes about this lead…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.name || saving}>
                {saving ? 'Adding…' : 'Add lead'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import CSV Dialog ── */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import leads from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-muted p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Drop your CSV file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Columns: name, email, company, source, notes</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
              <Button className="mt-3" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? 'Importing…' : 'Choose file'}
              </Button>
            </div>
            <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
              <p className="font-medium">Example CSV format:</p>
              <code className="text-muted-foreground">name,email,company,source</code><br />
              <code className="text-muted-foreground">Jane Smith,jane@acme.com,Acme Inc,Instagram</code>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Capture Link Dialog ── */}
      <Dialog open={showCapture} onOpenChange={setShowCapture}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead capture link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link anywhere — your website, Instagram bio, WhatsApp, email signature.
              Anyone who fills it out becomes a lead automatically.
            </p>
            <div className="flex gap-2">
              <Input value={captureUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <p className="font-medium">📌 Where to share it:</p>
              <ul className="space-y-1 text-muted-foreground text-xs list-disc pl-4">
                <li>Instagram / TikTok bio link</li>
                <li>Facebook page "Contact" button</li>
                <li>Your website contact / pricing page</li>
                <li>Email signature</li>
                <li>WhatsApp status or group</li>
                <li>LinkedIn profile</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Embed on your website</p>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{`<iframe src="${captureUrl}" width="100%" height="500" frameborder="0" style="border-radius:12px"></iframe>`}</pre>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(`<iframe src="${captureUrl}" width="100%" height="500" frameborder="0" style="border-radius:12px"></iframe>`);
                toast.success('Embed code copied!');
              }}>
                <Copy className="h-3 w-3 mr-1" /> Copy embed code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
