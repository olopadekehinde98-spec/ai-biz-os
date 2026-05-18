'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

export default function CaptureFormPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [business, setBusiness] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', source: '', message: '' });

  useEffect(() => {
    async function loadBusiness() {
      const supabase = createClient();
      const { data } = await supabase
        .from('businesses')
        .select('name, description, website_url, industry')
        .eq('id', businessId)
        .single();
      setBusiness(data);
    }
    if (businessId) loadBusiness();
  }, [businessId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('leads').insert({
      business_id: businessId,
      name: form.name,
      email: form.email || null,
      company: form.company || null,
      source: form.source || 'Capture form',
      notes: form.message || null,
      status: 'new',
    });
    setSaving(false);
    if (error) { alert('Something went wrong. Please try again.'); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">You're all set!</h1>
          <p className="text-slate-400">
            Thanks for reaching out to <strong className="text-white">{business?.name}</strong>.
            We'll be in touch with you soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mx-auto mb-4">
            <Zap className="h-6 w-6 text-white" />
          </div>
          {business ? (
            <>
              <h1 className="text-2xl font-bold text-white">{business.name}</h1>
              {business.description && (
                <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">{business.description}</p>
              )}
            </>
          ) : (
            <div className="h-8 w-48 bg-slate-700 animate-pulse rounded mx-auto" />
          )}
        </div>

        {/* Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Get in touch</h2>
          <p className="text-slate-400 text-sm mb-5">Fill out the form and we'll get back to you.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Full name *</Label>
              <Input
                placeholder="Jane Smith"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Email address</Label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Company / Business name</Label>
              <Input
                placeholder="Acme Inc (optional)"
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">How did you hear about us?</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Twitter/X', 'Google', 'Friend / Referral', 'WhatsApp', 'Other'].map(s =>
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Message</Label>
              <Textarea
                placeholder="Tell us what you're looking for…"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={3}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={!form.name || saving}>
              {saving ? 'Sending…' : 'Send message'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Powered by AI BizOS
        </p>
      </div>
    </div>
  );
}
