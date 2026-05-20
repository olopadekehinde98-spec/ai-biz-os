import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const businessId = searchParams.get('state');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?fb_error=${encodeURIComponent(error)}`);
  }

  if (!code || !businessId) {
    return NextResponse.redirect(`${appUrl}/settings?fb_error=missing_code`);
  }

  try {
    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${appUrl}/api/social/facebook/callback`;

    // Step 1: Exchange code for user access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/settings?fb_error=token_exchange_failed`);
    }

    const userToken = tokenData.access_token;

    // Step 2: Get list of pages managed by the user
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`
    );
    const pagesData = await pagesRes.json();
    const pages = pagesData.data ?? [];

    if (pages.length === 0) {
      return NextResponse.redirect(`${appUrl}/settings?fb_error=no_pages`);
    }

    // Step 3: Store each page in connected_accounts
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

    // Use the first page (most common case — one business page)
    const page = pages[0];

    await supabase.from('connected_accounts').upsert(
      {
        business_id: businessId,
        platform: 'facebook',
        account_name: page.id,
        access_token: page.access_token,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'business_id,platform' }
    );

    // If multiple pages, store them all as separate records with page name
    if (pages.length > 1) {
      for (const p of pages.slice(1)) {
        await supabase.from('connected_accounts').upsert(
          {
            business_id: businessId,
            platform: `facebook_${p.name.toLowerCase().replace(/\s+/g, '_')}`,
            account_name: p.id,
            access_token: p.access_token,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'business_id,platform' }
        );
      }
    }

    return NextResponse.redirect(`${appUrl}/settings?fb_success=true&page_name=${encodeURIComponent(page.name)}`);
  } catch (err: any) {
    return NextResponse.redirect(`${appUrl}/settings?fb_error=${encodeURIComponent(err.message)}`);
  }
}
