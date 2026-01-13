// src/app/dashboard/actions.ts
'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
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

export async function updateAgentConfig(formData: FormData) {
  const supabase = getSupabaseClient();

  // Get values from form
  const system_instructions = formData.get('system_instructions') as string;
  const discord_channel_id = formData.get('discord_channel_id') as string;

  // --- 1. Handle agent_config (singleton) ---
  const { data: existingConfig, error: selectAgentError } = await supabase
    .from('agent_config')
    .select('id')
    .limit(1)
    .single();

  let agentConfigId: string | null = null;

  if (selectAgentError && selectAgentError.code !== 'PGRST116') {
    console.error('Error selecting agent config:', selectAgentError.message);
    redirect(`/dashboard?message=Error checking for config: ${selectAgentError.message}`);
  }

  if (existingConfig) {
    const { error: updateError } = await supabase
      .from('agent_config')
      .update({
        system_instructions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingConfig.id);
    if (updateError) {
      console.error('Error updating agent config:', updateError.message);
      redirect(`/dashboard?message=Error updating config: ${updateError.message}`);
    }
    agentConfigId = existingConfig.id;
  } else {
    const { data: insertedConfig, error: insertError } = await supabase
      .from('agent_config')
      .insert({
        system_instructions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insertError) {
      console.error('Error inserting agent config:', insertError.message);
      redirect(`/dashboard?message=Error inserting config: ${insertError.message}`);
    }
    agentConfigId = insertedConfig.id;
  }

  if (!agentConfigId) {
    console.error('Agent config ID not found after save operation.');
    redirect('/dashboard?message=Error: Agent config ID not available.');
  }

  // --- 2. Handle allowed_channels table ---
  // Delete all existing allowed channels
  await supabase.from('allowed_channels').delete();

  // Insert only the provided discord_channel_id
  let allowedChannelRow = null;
  if (discord_channel_id) {
    const insertData = [{
      channel_id: discord_channel_id,
      created_at: new Date().toISOString(),
    }];
    const { data: allowedData, error: insertNewError } = await supabase
      .from('allowed_channels')
      .insert(insertData)
      .select('channel_id')
      .single();
    if (insertNewError) {
      console.error('Error inserting new allowed channel:', insertNewError.message);
      redirect(`/dashboard?message=Error adding new channel: ${insertNewError.message}`);
    }
    allowedChannelRow = allowedData ? allowedData.channel_id : discord_channel_id;
  }

  // --- 3. Fetch current conversation memory for this channel ---
  let conversationSummary = '';
  if (discord_channel_id) {
    const { data: memoryData, error: memoryError } = await supabase
      .from('conversation_memory')
      .select('summary')
      .eq('discord_channel_id', discord_channel_id)
      .single();
    if (memoryError && memoryError.code !== 'PGRST116') {
      console.error('Error fetching conversation memory:', memoryError.message);
      redirect(`/dashboard?message=Error fetching conversation memory: ${memoryError.message}`);
    }
    conversationSummary = memoryData ? memoryData.summary : '';
  }

  revalidatePath('/dashboard');
  redirect(`/dashboard?message=Agent config and channel updated!&discord_channel_id=${allowedChannelRow}&conversationSummary=${encodeURIComponent(conversationSummary)}`);
}

export async function resetConversationMemory(channelId: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('conversation_memory')
    .delete()
    .eq('discord_channel_id', channelId);

  if (error) {
    console.error(`Error resetting memory for channel ${channelId}:`, error.message);
    redirect(`/dashboard?message=Error resetting memory: ${error.message}`);
  }

  revalidatePath('/dashboard');
  redirect(`/dashboard?message=Memory for channel ${channelId} reset successfully!`);
}
