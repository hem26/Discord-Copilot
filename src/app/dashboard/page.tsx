// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { logout } from '@/app/auth/actions'; // Import the logout server action
import ConfigForm from './config-form';

// Helper function to create a Supabase client for Server Components
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
        set(name: string, value: string, options: any) {
          // This set method is typically not used in server components when fetching data
          // but is required by the createServerClient signature.
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          // Similarly, not typically used here.
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

export default async function DashboardPage() {
  const supabase = getSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch agent_config (system_instructions only)
  const { data: configData, error: configError } = await supabase
    .from('agent_config')
    .select('system_instructions') // Only select system_instructions
    .single(); // Assuming a single config row

  if (configError && configError.code !== 'PGRST116') { // PGRST116 means no rows found (expected for first run)
    console.error('Error fetching agent config:', configError.message);
  }

  // Fetch allowed_channels from the dedicated table
  const { data: allowedChannelsData, error: allowedChannelsError } = await supabase
    .from('allowed_channels')
    .select('channel_id');

  if (allowedChannelsError) {
    console.error('Error fetching allowed channels:', allowedChannelsError.message);
  }

  // Default values if no config is found
  const initialSystemInstructions = configData?.system_instructions || 'You are a helpful Discord bot.';
  const initialAllowedChannels = allowedChannelsData ? allowedChannelsData.map(c => c.channel_id) : [];

  // Fetch conversation_memory (for the first allowed channel, if any)
  let initialConversationSummary = 'No memory for current channel.';
  if (initialAllowedChannels.length > 0) {
    const { data: memoryData, error: memoryError } = await supabase
      .from('conversation_memory')
      .select('summary')
      .eq('discord_channel_id', initialAllowedChannels[0]) // Get memory for the first allowed channel
      .single();

    if (memoryError && memoryError.code !== 'PGRST116') {
      console.error('Error fetching conversation memory:', memoryError.message);
    } else if (memoryData) {
      initialConversationSummary = memoryData.summary;
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-12">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl p-10 space-y-10">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <form action={logout}>
            <button
              type="submit"
              className="px-5 py-2.5 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
            >
              Logout ({user.email})
            </button>
          </form>
        </div>

        <ConfigForm
          initialSystemInstructions={initialSystemInstructions}
          initialAllowedChannels={initialAllowedChannels}
          initialConversationSummary={initialConversationSummary}
          // If you need the configId in the form for some reason, pass it.
          // For now, the update action assumes a single config row regardless of ID.
        />
      </div>
    </div>
  );
}
