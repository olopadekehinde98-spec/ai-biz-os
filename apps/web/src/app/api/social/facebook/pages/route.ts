import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Takes a user access token, fetches their pages, stores the first page token
export async function POST(req: NextRequest) {
  try {
    const { userToken, businessId } = await req.json();
    if (!userToken || !businessId) {
      return NextResponse.json({ error: 'Missing userToken or businessId' }, { status: 400 });
    }

    // Get pages the user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      return NextResponse.json({ error: pagesData.error.message }, { status: 400 });
    }

    const pages = pagesData.data ?? [];
    if (pages.length === 0) {
      return NextResponse.json({ error: 'No Facebook Pages found. Create a Facebook Page first.' }, { status: 400 });
    }

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

    // Store first page (most common: one business page)
    const page = pages[0];
    const { error } = await supabase.from('connected_accounts').upsert(
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

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true, pageName: page.name, pageId: page.id, pages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
