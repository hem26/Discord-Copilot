import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase.admin';

export async function PUT(request: Request) {
  const { error, status } = await getSupabaseAdminClient();

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  const { instructions } = await request.json();

  if (!instructions) {
    return NextResponse.json({ error: 'System instructions are required' }, { status: 400 });
  }

  // TODO: Implement actual logic to update system instructions
  console.log('Updating system instructions to:', instructions);

  return NextResponse.json({ message: 'System instructions updated successfully' }, { status: 200 });
}
