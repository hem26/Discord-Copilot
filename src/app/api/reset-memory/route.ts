import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase.admin';

export async function POST(request: Request) {
  const { error, status } = await getSupabaseAdminClient();

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  // TODO: Implement actual logic to reset conversation memory
  console.log('Conversation memory reset initiated.');

  return NextResponse.json({ message: 'Conversation memory reset successfully' }, { status: 200 });
}
