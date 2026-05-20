'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Plus, Save, Globe, Instagram, Facebook, Twitter, Linkedin, Link2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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

const EMPTY_FORM = {
  name: '', industry: '', description: '', timezone: 'UTC',
  website_url: '', instagram_url: '', facebook_url: '',
  twitter_url: '', linkedin_url: '', tiktok_url: '',
};

const SOCIAL_PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: '👥', color: 'text-blue-600', hint: 'Page ID (numbers only, e.g. 123456789)', tokenHint: 'Page Access Token from Facebook Developer App' },
  { id: 'instagram', label: 'Instagram', icon: '📸', color: 'text-pink-500', hint: 'Instagram Business Account ID', tokenHint: 'Instagram Access Token (via Meta Business)' },
  { id: 'twitter', label: 'Twitter/X', icon: '🐦', color: 'text-sky-500', hint: 'Twitter @username', tokenHint: 'Bearer Token from Twitter Developer Portal' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', color: 'text-foreground', hint: 'TikTok username', tokenHint: 'Access Token from TikTok Developer App' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', color: 'text-blue-700', hint: 'LinkedIn Page ID', tokenHint: 'Access Token from LinkedIn Developer App' },
];

export default function SettingsPage() {
  const { activeBusiness, setBusinesses, setActiveBusiness } = useBusinessStore();
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bizList, setBizList] = useState<any[]>([]);
  const [newBiz, setNewBiz] = useState(EMPTY_FORM);
  const [form, setForm] = useState(EMPTY_FORM);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [platformToken, setPlatformToken] = useState('');
  const [platformAccountName, setPlatformAccountName] = useState('');
  const [savingPlatform, setSavingPlatform] = useState(false);

  // Handle Facebook OAuth callback result
  useEffect(() => {
    const fbSuccess = searchParams.get('fb_success');
    const fbError = searchParams.get('fb_error');
    const pageName = searchParams.get('page_name');
    if (fbSuccess) {
      toast.success(`✅ Facebook connected! Page: ${pageName ?? 'Your Page'}`);
      window.history.replaceState({}, '', '/settings');
    }
    if (fbError) {
      const messages: Record<string, string> = {
        no_pages: 'No Facebook Pages found. Create a Facebook Page first.',
        token_exchange_failed: 'Facebook login failed. Please try again.',
        missing_code: 'Facebook login cancelled.',
      };
      toast.error(messages[fbError] ?? `Facebook error: ${fbError}`);
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  // Sync form when active business changes
  useEffect(() => {
    if (activeBusiness) {
      setForm({
        name: activeBusiness.name ?? '',
        industry: (activeBusiness as any).industry ?? '',
        description: (activeBusiness as any).description ?? '',
        timezone: (activeBusiness as any).timezone ?? 'UTC',
        website_url: (activeBusiness as any).website_url ?? '',
        instagram_url: (activeBusiness as any).instagram_url ?? '',
        facebook_url: (activeBusiness as any).facebook_url ?? '',
        twitter_url: (activeBusiness as any).twitter_url ?? '',
        linkedin_url: (activeBusiness as any).linkedin_url ?? '',
        tiktok_url: (activeBusiness as any).tiktok_url ?? '',
      });
    }
  }, [activeBusiness?.id]);

  // Load all businesses
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from('businesses').select('*');
      if (data && data.length > 0) {
        setBizList(data);
        setBusinesses(data);
        if (!activeBusiness) setActiveBusiness(data[0]);
      }
    }
    load();
  }, []);

  // Load connected accounts
  useEffect(() => {
    if (!activeBusiness) return;
    async function loadAccounts() {
      const supabase = createClient();
      const { data } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('business_id', activeBusiness!.id);
      setConnectedAccounts(data ?? []);
    }
    loadAccounts();
  }, [activeBusiness?.id]);

  async function handleConnectPlatform() {
    if (!activeBusiness || !platformToken || !platformAccountName) return;
    setSavingPlatform(true);
    const supabase = createClient();
    const { error } = await supabase.from('connected_accounts').upsert({
      business_id: activeBusiness.id,
      platform: connectingPlatform,
      access_token: platformToken,
      account_name: platformAccountName,
      is_active: true,
    }, { onConflict: 'business_id,platform' });
    setSavingPlatform(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${connectingPlatform} connected!`);
    setConnectingPlatform(null);
    setPlatformToken('');
    setPlatformAccountName('');
    // Reload accounts
    const { data } = await supabase.from('connected_accounts').select('*').eq('business_id', activeBusiness.id);
    setConnectedAccounts(data ?? []);
  }

  async function handleDisconnect(platform: string) {
    if (!activeBusiness) return;
    const supabase = createClient();
    await supabase.from('connected_accounts').update({ is_active: false })
      .eq('business_id', activeBusiness.id).eq('platform', platform);
    setConnectedAccounts(prev => prev.map(a => a.platform === platform ? { ...a, is_active: false } : a));
    toast.success(`${platform} disconnected`);
  }

  async function handleUpdate() {
    if (!activeBusiness || !form.name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const cleaned = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]));
    const { data, error } = await supabase
      .from('businesses').update(cleaned).eq('id', activeBusiness.id).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Business updated');
    setActiveBusiness(data);
    const updated = bizList.map(b => b.id === data.id ? data : b);
    setBizList(updated);
    setBusinesses(updated);
  }

  async function handleCreate() {
    if (!newBiz.name.trim()) { toast.error('Business name is required'); return; }
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not logged in'); setCreating(false); return; }

    // Ensure public.users row exists
    await supabase.from('users').upsert({
      id: user.id, email: user.email!,
      full_name: user.user_metadata?.full_name ?? null,
    }, { onConflict: 'id' });

    const cleaned = Object.fromEntries(
      Object.entries({ ...newBiz, user_id: user.id }).map(([k, v]) => [k, v || null])
    );
    const { data, error } = await supabase.from('businesses').insert(cleaned).select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Business created');
    const updated = [...bizList, data];
    setBizList(updated);
    setBusinesses(updated);
    setActiveBusiness(data);
    setShowCreate(false);
    setNewBiz(EMPTY_FORM);
  }

  const SocialLinks = ({ values, onChange }: { values: any; onChange: (f: string, v: string) => void }) => (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Website</Label>
        <Input placeholder="https://yourbusiness.com" value={values.website_url} onChange={e => onChange('website_url', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-500" /> Instagram</Label>
          <Input placeholder="https://instagram.com/…" value={values.instagram_url} onChange={e => onChange('instagram_url', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Facebook className="h-4 w-4 text-blue-500" /> Facebook</Label>
          <Input placeholder="https://facebook.com/…" value={values.facebook_url} onChange={e => onChange('facebook_url', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Twitter className="h-4 w-4 text-sky-400" /> X / Twitter</Label>
          <Input placeholder="https://x.com/…" value={values.twitter_url} onChange={e => onChange('twitter_url', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Linkedin className="h-4 w-4 text-blue-600" /> LinkedIn</Label>
          <Input placeholder="https://linkedin.com/company/…" value={values.linkedin_url} onChange={e => onChange('linkedin_url', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-2"><span className="text-xs font-bold bg-foreground text-background rounded px-1">TT</span> TikTok</Label>
        <Input placeholder="https://tiktok.com/@…" value={values.tiktok_url} onChange={e => onChange('tiktok_url', e.target.value)} />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Settings" description="Manage your businesses and account" />

      <div className="p-6 space-y-6 max-w-2xl">
        {/* Business switcher */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Your Businesses</CardTitle>
                <CardDescription>Switch between or create businesses</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> New
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {bizList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No businesses yet — create one!</p>
            )}
            {bizList.map((biz) => (
              <button key={biz.id} onClick={() => setActiveBusiness(biz)}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${activeBusiness?.id === biz.id ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {biz.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{biz.name}</p>
                  <p className="text-xs text-muted-foreground">{biz.industry ?? 'No industry set'}</p>
                </div>
                {activeBusiness?.id === biz.id && <span className="text-xs text-primary font-medium">Active</span>}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Edit active business */}
        {activeBusiness && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Business Info
                </CardTitle>
                <CardDescription>Update {activeBusiness.name}'s profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Business name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Industry</Label>
                    <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <Select value={form.timezone} onValueChange={v => setForm(f => ({ ...f, timezone: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>What does your business do?</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe your business — the more detail, the smarter your AI." rows={3} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Online Presence
                </CardTitle>
                <CardDescription>Links your AI uses to understand and manage your social media</CardDescription>
              </CardHeader>
              <CardContent>
                <SocialLinks values={form} onChange={(f, v) => setForm(prev => ({ ...prev, [f]: v }))} />
              </CardContent>
            </Card>

            {/* Connected Platforms for Auto-Posting */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> Connected Platforms
                </CardTitle>
                <CardDescription>Connect your accounts so AI can post automatically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {SOCIAL_PLATFORMS.map(plat => {
                  const account = connectedAccounts.find(a => a.platform === plat.id);
                  const isConnected = account?.is_active;
                  return (
                    <div key={plat.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{plat.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{plat.label}</p>
                          {isConnected && <p className="text-xs text-muted-foreground">@{account.account_name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <>
                            <Badge variant="success" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>
                            <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => handleDisconnect(plat.id)}>Disconnect</Button>
                          </>
                        ) : (
                          plat.id === 'facebook' ? (
                            <Button
                              size="sm"
                              className="text-xs h-7 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => {
                                if (!activeBusiness) { toast.error('Select a business first'); return; }
                                window.location.href = `/api/social/facebook/auth?businessId=${activeBusiness.id}`;
                              }}
                            >
                              <Facebook className="h-3 w-3 mr-1" /> Sign in with Facebook
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setConnectingPlatform(plat.id); setPlatformToken(''); setPlatformAccountName(''); }}>
                              Connect
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleUpdate} disabled={!form.name || saving} size="lg">
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Saving…' : 'Save all changes'}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Connect Platform Dialog */}
      <Dialog open={!!connectingPlatform} onOpenChange={open => { if (!open) setConnectingPlatform(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {SOCIAL_PLATFORMS.find(p => p.id === connectingPlatform)?.label}</DialogTitle>
          </DialogHeader>
          {connectingPlatform && (() => {
            const plat = SOCIAL_PLATFORMS.find(p => p.id === connectingPlatform)!;
            return (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-sm space-y-2">
                  <p className="font-medium">How to get your {plat.label} token:</p>
                  {connectingPlatform === 'facebook' && (
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                      <li>Go to <strong>developers.facebook.com</strong> → My Apps → Create App</li>
                      <li>Add the <strong>Pages API</strong> product</li>
                      <li>Go to <strong>Tools → Graph API Explorer</strong></li>
                      <li>Select your app + select your Page</li>
                      <li>Click <strong>Generate Access Token</strong> → grant permissions</li>
                      <li>Copy the token and your Page ID (from your Facebook Page URL)</li>
                    </ol>
                  )}
                  {connectingPlatform === 'twitter' && (
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                      <li>Go to <strong>developer.twitter.com</strong> → Create Project & App</li>
                      <li>Under <strong>Keys and Tokens</strong>, generate a Bearer Token</li>
                      <li>Enable Read and Write permissions</li>
                    </ol>
                  )}
                  {(connectingPlatform === 'instagram' || connectingPlatform === 'tiktok' || connectingPlatform === 'linkedin') && (
                    <p className="text-muted-foreground text-xs">Go to the {plat.label} Developer portal, create an app, and generate an access token with posting permissions.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{plat.hint}</Label>
                  <Input placeholder={plat.id === 'facebook' ? '123456789012345' : '@yourhandle'} value={platformAccountName} onChange={e => setPlatformAccountName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Access Token</Label>
                  <Input placeholder="Paste your access token here…" value={platformToken} onChange={e => setPlatformToken(e.target.value)} type="password" />
                  <p className="text-xs text-muted-foreground">{plat.tokenHint}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConnectingPlatform(null)}>Cancel</Button>
                  <Button onClick={handleConnectPlatform} disabled={!platformToken || !platformAccountName || savingPlatform}>
                    {savingPlatform ? 'Connecting…' : 'Save & Connect'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create Business Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create new business</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Business name *</Label>
              <Input value={newBiz.name} onChange={e => setNewBiz(f => ({ ...f, name: e.target.value }))} placeholder="Acme Inc" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={newBiz.industry} onValueChange={v => setNewBiz(f => ({ ...f, industry: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={newBiz.timezone} onValueChange={v => setNewBiz(f => ({ ...f, timezone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={newBiz.description} onChange={e => setNewBiz(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe your business…" rows={2} />
            </div>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Online Presence (optional)</p>
            <SocialLinks values={newBiz} onChange={(f, v) => setNewBiz(prev => ({ ...prev, [f]: v }))} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newBiz.name || creating}>
                {creating ? 'Creating…' : 'Create business'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
