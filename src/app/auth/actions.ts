// src/app/auth/actions.ts
'use server';

// import { createClient } from '@/lib/supabase.server'; // Removed original import
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Import directly
import { cookies } from 'next/headers'; // Import cookies directly

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Helper function to create a Supabase client configured for Server Actions
function getSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
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
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login Error:', error.message);
    return redirect(`/login?message=Error: ${error.message}`);
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Signup Error:', error.message);
    return redirect(`/login?message=Error: ${error.message}`);
  }

  revalidatePath('/', 'layout');
  redirect('/login?message=Check email to continue sign in process');
}

export async function logout() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}