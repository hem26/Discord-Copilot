import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// This function creates a Supabase client and checks if the authenticated user is an admin.
// For demonstration, it assumes a hardcoded admin email. In a real application,
// this should be managed via roles in your Supabase database or environment variables.
export async function getSupabaseAdminClient() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  // TODO: Implement proper admin role checking from your Supabase database
  // For now, let's assume a specific email for admin access.
  // This should ideally be loaded from environment variables or a user_roles table.
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'; 

  if (user.email !== ADMIN_EMAIL) {
    return { error: 'Forbidden: Not an admin', status: 403 };
  }

  return { supabase, user, error: null, status: 200 };
}
