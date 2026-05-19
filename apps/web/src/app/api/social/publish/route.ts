import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list: Array<{ name: string; value: string; options?: any }>) => {
            list.forEach(({ name, value, options }) => {
              try { cookieStore.set(name, value, options); } catch {}
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { businessId, platform, content, postId } = await req.json();

    // Get the stored access token for this platform
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('business_id', businessId)
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (!account) {
      return NextResponse.json({ error: `No connected ${platform} account found. Go to Settings to connect.` }, { status: 400 });
    }

    let publishResult: any = null;
    let success = false;

    if (platform === 'facebook') {
      // Post to Facebook Page
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${account.account_name}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            access_token: account.access_token,
          }),
        }
      );
      publishResult = await res.json();
      success = !!publishResult.id && !publishResult.error;
    }

    if (platform === 'instagram') {
      // Instagram requires a media container first (for images)
      // Text-only posts need image_url — for now we post as Facebook story
      return NextResponse.json({ error: 'Instagram posting requires an image. Please add an image URL to your post.' }, { status: 400 });
    }

    if (platform === 'twitter') {
      // Twitter/X API v2
      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${account.access_token}`,
        },
        body: JSON.stringify({ text: content.slice(0, 280) }),
      });
      publishResult = await res.json();
      success = !!publishResult.data?.id;
    }

    // Update post status in DB
    if (postId) {
      await supabase
        .from('content_posts')
        .update({
          status: success ? 'published' : 'failed',
          published_at: success ? new Date().toISOString() : null,
        })
        .eq('id', postId);
    }

    if (!success) {
      const errMsg = publishResult?.error?.message || 'Failed to publish';
      return NextResponse.json({ error: errMsg, details: publishResult }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: publishResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
