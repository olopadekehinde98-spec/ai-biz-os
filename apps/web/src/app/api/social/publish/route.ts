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

    const { businessId, platform, content, postId, videoUrl } = await req.json();

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
      if (videoUrl) {
        // Post video to Facebook Page
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${account.account_name}/videos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_url: videoUrl,
              description: content,
              access_token: account.access_token,
            }),
          }
        );
        publishResult = await res.json();
        success = !!publishResult.id && !publishResult.error;
      } else {
        // Post text to Facebook Page
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
    }

    if (platform === 'instagram') {
      if (!videoUrl) {
        return NextResponse.json({ error: 'Instagram posting requires a video or image URL. Switch to Video Post and add a URL.' }, { status: 400 });
      }
      // Instagram video: create media container then publish
      const pageId = account.account_name;
      const token = account.access_token;

      // Step 1: Get Instagram Business Account ID
      const igAccountRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${token}`
      );
      const igAccountData = await igAccountRes.json();
      const igId = igAccountData?.instagram_business_account?.id;

      if (!igId) {
        return NextResponse.json({ error: 'No Instagram Business account linked to this Facebook Page. Link it in Meta Business Suite.' }, { status: 400 });
      }

      // Step 2: Create media container
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_url: videoUrl,
            caption: content,
            media_type: 'REELS',
            access_token: token,
          }),
        }
      );
      const container = await containerRes.json();
      if (!container.id) {
        return NextResponse.json({ error: container.error?.message || 'Failed to create Instagram media container' }, { status: 400 });
      }

      // Step 3: Wait a moment then publish
      await new Promise(r => setTimeout(r, 5000));

      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: container.id,
            access_token: token,
          }),
        }
      );
      publishResult = await publishRes.json();
      success = !!publishResult.id && !publishResult.error;
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

    if (platform === 'linkedin') {
      // LinkedIn Share API
      const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${account.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: `urn:li:person:${account.account_name}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: content },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      });
      publishResult = await res.json();
      success = !!publishResult.id && !publishResult.status;
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
