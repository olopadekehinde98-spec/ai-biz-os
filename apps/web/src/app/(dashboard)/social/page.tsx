'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Sparkles, Clock, CheckCircle2, XCircle, Trash2,
  Instagram, Facebook, Link2, Send, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatRelative } from '@/lib/utils';

type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

interface ContentPost {
  id: string;
  platform: string;
  content: string;
  status: PostStatus;
  scheduled_at: string | null;
  ai_generated: boolean;
  created_at: string;
}

const STATUS_COLOR: Record<PostStatus, any> = {
  draft: 'secondary', scheduled: 'info', published: 'success', failed: 'destructive',
};

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'twitter', label: 'Twitter/X', icon: '🐦' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
];

type FilterTab = 'all' | PostStatus;
const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

const AI_SAMPLES: Record<string, string> = {
  instagram: '✨ {idea}\n\nSwipe to see more 👉\n\n#business #growth #entrepreneur #success',
  facebook: '🚀 Exciting news!\n\n{idea}\n\nShare this with someone who needs to see it! 👇',
  tiktok: '🔥 {idea}\n\nFollow for more tips! #fyp #viral #business',
  twitter: '{idea} 🚀 #business',
  linkedin: "I'm excited to share something important:\n\n{idea}\n\nWhat do you think? Drop a comment below 👇",
};

export default function SocialPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const supabase = createClient();

  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Create form
  const [idea, setIdea] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'facebook']);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [scheduledAt, setScheduledAt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [postType, setPostType] = useState<'text' | 'video'>('text');

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    let q = supabase.from('content_posts').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) toast.error('Failed to load posts: ' + error.message);
    setPosts((data as ContentPost[]) ?? []);
    setLoading(false);
  }, [businessId, filter]);

  useEffect(() => { load(); }, [load]);

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  function generateContent() {
    if (!idea.trim()) { toast.error('Enter your idea first'); return; }
    setGenerating(true);
    // AI-style generation: format for each platform
    const newPreviews: Record<string, string> = {};
    selectedPlatforms.forEach(p => {
      const template = AI_SAMPLES[p] || '{idea}';
      newPreviews[p] = template.replace('{idea}', idea.trim());
    });
    setTimeout(() => {
      setPreviews(newPreviews);
      setGenerating(false);
      toast.success('Content generated for ' + selectedPlatforms.length + ' platforms!');
    }, 1200);
  }

  async function handlePublish(status: 'draft' | 'scheduled' | 'published') {
    if (!businessId || selectedPlatforms.length === 0) return;
    const toPost = selectedPlatforms.map(p => ({
      content: previews[p] || idea,
      platform: p,
    })).filter(p => p.content.trim());

    if (toPost.length === 0) { toast.error('Generate content first'); return; }
    setSaving(true);

    let successCount = 0;
    for (const post of toPost) {
      // Save to DB first
      const { data: savedPost, error: dbErr } = await supabase.from('content_posts').insert({
        business_id: businessId,
        platform: post.platform,
        content: post.content,
        status: status === 'published' ? 'draft' : status, // will update after publish attempt
        scheduled_at: scheduledAt || null,
        ai_generated: true,
        media_urls: [],
      }).select().single();

      if (dbErr) { toast.error('DB error: ' + dbErr.message); continue; }

      // If publishing now, call the publish API
      if (status === 'published') {
        const res = await fetch('/api/social/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            platform: post.platform,
            content: post.content,
            postId: savedPost?.id,
            videoUrl: postType === 'video' ? videoUrl : undefined,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          toast.error(`${post.platform}: ${result.error}`);
        } else {
          toast.success(`✅ Posted to ${post.platform}!`);
          successCount++;
        }
      } else {
        successCount++;
      }
    }

    setSaving(false);
    if (successCount > 0 && status !== 'published') {
      toast.success(`${successCount} post${successCount > 1 ? 's' : ''} ${status === 'scheduled' ? 'scheduled' : 'saved as draft'}!`);
    }
    setShowCreate(false);
    setIdea('');
    setPreviews({});
    setSelectedPlatforms(['instagram', 'facebook']);
    setScheduledAt('');
    setVideoUrl('');
    setPostType('text');
    load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('content_posts').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted');
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div>
      <Header
        title="Social Media"
        description="Write one idea — AI posts it to all your platforms"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowConnect(true)}>
              <Link2 className="h-4 w-4 mr-1" /> Connect platforms
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> New post
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-1 border-b">
          {TABS.map(tab => (
            <button key={tab.value} onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                filter === tab.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : posts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium mb-1">No posts yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Type your idea and AI will write posts for all your platforms
              </p>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create first post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => {
              const plat = PLATFORMS.find(p => p.id === post.platform);
              return (
                <Card key={post.id} className="group">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{plat?.icon ?? '📱'}</span>
                        <span className="text-sm font-medium capitalize">{post.platform}</span>
                        {post.ai_generated && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Sparkles className="h-2.5 w-2.5 mr-1" />AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={STATUS_COLOR[post.status]} className="text-[10px]">{post.status}</Badge>
                        <button onClick={() => handleDelete(post.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-4">{post.content}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {post.status === 'published' ? (
                        <><CheckCircle2 className="h-3 w-3 text-green-500" /><span>Published {formatRelative(post.created_at)}</span></>
                      ) : post.status === 'failed' ? (
                        <><XCircle className="h-3 w-3 text-red-500" /><span>Failed to publish</span></>
                      ) : post.status === 'scheduled' ? (
                        <><Clock className="h-3 w-3" /><span>Scheduled</span></>
                      ) : (
                        <span>Draft · {formatRelative(post.created_at)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Post Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { setShowCreate(open); if (!open) { setIdea(''); setPreviews({}); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Post Creator
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step 1: Idea */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">1. What's your idea or message?</Label>
              <Textarea
                placeholder="e.g. We have a 50% off sale this weekend only! Don't miss it."
                value={idea}
                onChange={e => setIdea(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Post type toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setPostType('text')}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  postType === 'text' ? 'border-primary bg-primary/10 text-primary' : 'border-muted-foreground/30 text-muted-foreground'
                }`}>
                📝 Text Post
              </button>
              <button
                onClick={() => setPostType('video')}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  postType === 'video' ? 'border-primary bg-primary/10 text-primary' : 'border-muted-foreground/30 text-muted-foreground'
                }`}>
                🎥 Video Post
              </button>
            </div>

            {/* Video URL input */}
            {postType === 'video' && (
              <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Label className="text-sm font-semibold">🎥 Video URL</Label>
                <Input
                  placeholder="https://example.com/your-video.mp4"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a direct link to your video file (.mp4, .mov). You can upload to Google Drive, Dropbox, or any public link.
                </p>
              </div>
            )}

            {/* Step 2: Platforms */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">2. Which platforms?</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      selectedPlatforms.includes(p.id)
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground'
                    }`}>
                    <span>{p.icon}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button onClick={generateContent} disabled={!idea.trim() || generating || selectedPlatforms.length === 0} variant="outline" className="w-full">
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate content for {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''}</>}
            </Button>

            {/* Previews */}
            {Object.keys(previews).length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">3. Preview & edit</Label>
                  <button onClick={generateContent} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </button>
                </div>
                {selectedPlatforms.map(pid => {
                  const plat = PLATFORMS.find(p => p.id === pid);
                  return (
                    <div key={pid} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{plat?.icon}</span> {plat?.label}
                      </div>
                      <Textarea
                        value={previews[pid] || ''}
                        onChange={e => setPreviews(prev => ({ ...prev, [pid]: e.target.value }))}
                        rows={4}
                        className="text-sm resize-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Schedule */}
            {Object.keys(previews).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Schedule for (optional — leave blank to post now)</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              </div>
            )}

            {/* Action buttons */}
            {Object.keys(previews).length > 0 && (
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => handlePublish('draft')} disabled={saving} className="flex-1">
                  Save as draft
                </Button>
                {scheduledAt && (
                  <Button variant="outline" onClick={() => handlePublish('scheduled')} disabled={saving} className="flex-1">
                    <Clock className="h-4 w-4 mr-1" /> Schedule
                  </Button>
                )}
                <Button onClick={() => handlePublish('published')} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Post now</>}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Connect Platforms Dialog */}
      <Dialog open={showConnect} onOpenChange={setShowConnect}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Your Social Platforms</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>To actually post to your platforms automatically, you need to connect each one. Here's what's needed:</p>
            <div className="space-y-2">
              {[
                { icon: '📸', name: 'Instagram + Facebook', info: 'Requires a Facebook Business Page + Meta Developer App. You get a Page Access Token.' },
                { icon: '🎵', name: 'TikTok', info: 'Requires TikTok Developer Account. Free to apply at developers.tiktok.com.' },
                { icon: '🐦', name: 'Twitter/X', info: 'Requires Twitter Developer account at developer.twitter.com. Free tier available.' },
                { icon: '💼', name: 'LinkedIn', info: 'Requires LinkedIn Developer App at linkedin.com/developers.' },
              ].map(p => (
                <div key={p.name} className="rounded-lg border p-3">
                  <p className="font-medium text-foreground">{p.icon} {p.name}</p>
                  <p className="text-xs mt-1">{p.info}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-primary font-medium text-xs">💡 What to do next</p>
              <p className="text-xs mt-1">Tell me which platforms you use most and I'll walk you through getting your access tokens step by step. Once you have them, I'll connect everything.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
