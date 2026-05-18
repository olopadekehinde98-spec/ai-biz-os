'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, Calendar, Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatDate, formatRelative } from '@/lib/utils';

type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

interface ContentPost {
  id: string;
  business_id: string;
  platform: string;
  content: string;
  status: PostStatus;
  scheduled_at: string | null;
  ai_generated: boolean;
  created_at: string;
}

const STATUS_COLOR: Record<PostStatus, 'secondary' | 'info' | 'success' | 'destructive'> = {
  draft: 'secondary',
  scheduled: 'info',
  published: 'success',
  failed: 'destructive',
};

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'Twitter', 'LinkedIn'];

type FilterTab = 'all' | PostStatus;

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

const DEFAULT_FORM = {
  platform: 'Instagram',
  content: '',
  scheduled_at: '',
  status: 'draft' as PostStatus,
};

export default function SocialPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;

  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const supabase = createClient();

  const loadPosts = useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('content_posts')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPosts((data as ContentPost[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, [businessId, filter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleCreate() {
    if (!businessId || !form.content.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('content_posts').insert({
        business_id: businessId,
        platform: form.platform.toLowerCase(),
        content: form.content.trim(),
        status: form.scheduled_at ? 'scheduled' : form.status,
        scheduled_at: form.scheduled_at || null,
        ai_generated: false,
      });
      if (error) throw error;
      toast.success('Post created');
      setShowCreate(false);
      setForm(DEFAULT_FORM);
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('content_posts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Post deleted');
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete post');
    }
  }

  return (
    <div>
      <Header
        title="Social"
        description="Schedule and manage your social media content"
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New post
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-1 border-b">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                filter === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
        ) : posts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No posts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first post to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <Card key={post.id} className="group">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {post.platform}
                      </Badge>
                      {post.ai_generated && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Sparkles className="h-2.5 w-2.5 mr-1" />AI
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={STATUS_COLOR[post.status]} className="text-[10px]">
                        {post.status}
                      </Badge>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete post"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed line-clamp-4">{post.content}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {post.status === 'scheduled' && post.scheduled_at ? (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>Scheduled {formatDate(post.scheduled_at)}</span>
                      </>
                    ) : post.status === 'published' ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span>Published {formatRelative(post.created_at)}</span>
                      </>
                    ) : post.status === 'failed' ? (
                      <>
                        <XCircle className="h-3 w-3 text-red-500" />
                        <span>Failed to publish</span>
                      </>
                    ) : (
                      <span>Draft · {formatRelative(post.created_at)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={showCreate}
        onOpenChange={open => {
          setShowCreate(open);
          if (!open) setForm(DEFAULT_FORM);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select
                value={form.platform}
                onValueChange={v => setForm(f => ({ ...f, platform: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Content *</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
                placeholder="Write your post…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={v => setForm(f => ({ ...f, status: v as PostStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['draft', 'scheduled', 'published'] as PostStatus[]).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Schedule for (optional)</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!form.content.trim() || creating}>
                {creating ? 'Creating…' : 'Create post'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
