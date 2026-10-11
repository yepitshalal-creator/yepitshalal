import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { sameSitePath } from '@/lib/safePath';

// Supabase magic-link redirect target: exchanges the emailed code for a
// session cookie, then sends the user on to wherever they were headed, as
// long as that is somewhere on this site.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sameSitePath(searchParams.get('next'), origin);

  if (code) {
    const supabase = createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
