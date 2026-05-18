'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Zap, ArrowRight, Globe, Instagram, Facebook, Twitter, Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo',
  'Asia/Singapore', 'Australia/Sydney', 'Africa/Lagos',
];

const INDUSTRIES = [
  'E-commerce', 'SaaS / Software', 'Consulting', 'Marketing Agency',
  'Real Estate', 'Healthcare', 'Education', 'Finance', 'Retail', 'Other',
];

const STEPS = ['Business Info', 'Online Presence'];

export default function OnboardingPage() {
  const router = useRouter();
  const { setBusinesses, setActiveBusiness } = useBusinessStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    description: '',
    timezone: 'UTC',
    website_url: '',
    instagram_url: '',
    facebook_url: '',
    twitter_url: '',
    linkedin_url: '',
    tiktok_url: '',
  });

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleCreate() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not logged in — please refresh and sign in again'); return; }

      // Ensure public.users record exists
      await supabase.from('users').upsert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      }, { onConflict: 'id' });

      // Create business
      const payload = Object.fromEntries(
        Object.entries({ ...form, user_id: user.id }).filter(([, v]) => v !== '')
      );
      const { data, error } = await supabase.from('businesses').insert(payload).select().single();
      if (error) throw new Error(error.message);

      setBusinesses([data]);
      setActiveBusiness(data);
      toast.success(`"${data.name}" is ready! Welcome to AI BizOS.`);
      router.push('/dashboard');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create business');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Set up your business</h1>
          <p className="text-muted-foreground mt-1 text-sm">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="bg-card border rounded-2xl p-6 space-y-5">

          {/* STEP 1 — Business Info */}
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label>Business name *</Label>
                <Input placeholder="Acme Inc" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={form.industry} onValueChange={v => set('industry', v)}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={form.timezone} onValueChange={v => set('timezone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>What does your business do?</Label>
                <Textarea
                  placeholder="We sell handmade leather bags online to professionals aged 25–45. We also run paid ads on Meta and Instagram…"
                  rows={4}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The more detail you give, the smarter your AI becomes.</p>
              </div>
              <Button
                className="w-full" size="lg"
                disabled={!form.name.trim()}
                onClick={() => setStep(1)}
              >
                Next: Online presence <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {/* STEP 2 — Online Presence */}
          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">Add your links so your AI can help manage your social presence and understand where your customers come from.</p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Website</Label>
                  <Input placeholder="https://yourbusiness.com" value={form.website_url} onChange={e => set('website_url', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-500" /> Instagram
                  </Label>
                  <Input placeholder="https://instagram.com/yourbusiness" value={form.instagram_url} onChange={e => set('instagram_url', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-500" /> Facebook
                  </Label>
                  <Input placeholder="https://facebook.com/yourbusiness" value={form.facebook_url} onChange={e => set('facebook_url', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-sky-400" /> X / Twitter
                  </Label>
                  <Input placeholder="https://x.com/yourbusiness" value={form.twitter_url} onChange={e => set('twitter_url', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-blue-600" /> LinkedIn
                  </Label>
                  <Input placeholder="https://linkedin.com/company/yourbusiness" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <span className="text-sm font-bold">TT</span> TikTok
                  </Label>
                  <Input placeholder="https://tiktok.com/@yourbusiness" value={form.tiktok_url} onChange={e => set('tiktok_url', e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1" size="lg" onClick={handleCreate} disabled={loading}>
                  {loading ? 'Creating…' : (
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Create business
                    </span>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can always update these in Settings later.
        </p>
      </div>
    </div>
  );
}
