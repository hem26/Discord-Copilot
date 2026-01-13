require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// --- Environment Variables & Constants ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const LLM_TIMEOUT = 15000; // 15 seconds

if (!DISCORD_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GROQ_API_KEY) {
    console.error('FATAL: Missing environment variables. Please check your .env file.');
    process.exit(1);
}

// --- Supabase Client ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const AGENT_CONFIG_TABLE = 'agent_config';
const CONVERSATION_MEMORY_TABLE = 'conversation_memory';
const ALLOWED_CHANNELS_TABLE = 'allowed_channels'; // New constant

// --- Bot Configuration ---
let agent_config = {
    system_instructions: "You are a helpful assistant. Please be concise.",
};
let allowedChannelIds = new Set();

async function fetchAgentConfig() {
    try {
        console.log('Fetching agent configuration from Supabase...');
        // Fetch system instructions from agent_config
        const { data, error } = await supabase
            .from(AGENT_CONFIG_TABLE)
            .select('system_instructions') // Only select system_instructions
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching agent configuration:', error.message);
            console.warn('Using default system instructions.');
        }

        if (data) {
            agent_config.system_instructions = data.system_instructions || agent_config.system_instructions;
            console.log('Successfully loaded system instructions.');
            console.log('System Instructions:', agent_config.system_instructions);
        } else {
            console.warn('No agent configuration found in Supabase. Using default system instructions.');
        }

        // Fetch allowed channels from the dedicated allowed_channels table
        const { data: channelsData, error: channelsError } = await supabase
            .from(ALLOWED_CHANNELS_TABLE)
            .select('channel_id');

        if (channelsError) {
            console.error('Error fetching allowed channels:', channelsError.message);
            console.warn('No allowed channels loaded.');
        } else if (channelsData) {
            allowedChannelIds = new Set(channelsData.map(c => c.channel_id));
            console.log('Successfully loaded allowed channels.');
            console.log('Allowed channel IDs:', Array.from(allowedChannelIds));
        }

    } catch (e) {
        console.error('An unexpected error occurred in fetchAgentConfig:', e.message);
        console.warn('Using default configuration.');
    }
}

// --- Conversation Memory Functions ---
async function getConversationSummary(channelId) {
    try {
        const { data, error } = await supabase
            .from(CONVERSATION_MEMORY_TABLE)
            .select('summary')
            .eq('discord_channel_id', channelId)
            .single();

        if (error && error.code !== 'PGRST116') { // Ignore 'single row not found'
            console.error('Error fetching conversation summary:', error.message);
            return '';
        }
        return data ? data.summary : '';
    } catch (e) {
        console.error('An unexpected error occurred in getConversationSummary:', e.message);
        return '';
    }
}

async function updateConversationSummary(channelId, summary) {
    try {
        // Step 1: Check if a record already exists for this channelId
        const { data: existing, error: selectError } = await supabase
            .from(CONVERSATION_MEMORY_TABLE)
            .select('discord_channel_id')
            .eq('discord_channel_id', channelId)
            .limit(1);

        if (selectError) {
            console.error('Error checking for existing summary:', selectError.message);
            return;
        }

        let queryError;

        if (existing && existing.length > 0) {
            // Step 2a: Record exists, so UPDATE it
            console.log(`Found existing summary for channel ${channelId}. Updating...`);
            const { error } = await supabase
                .from(CONVERSATION_MEMORY_TABLE)
                .update({ summary: summary, updated_at: new Date().toISOString() })
                .eq('discord_channel_id', channelId);
            queryError = error;
        } else {
            // Step 2b: Record does not exist, so INSERT it
            console.log(`No summary found for channel ${channelId}. Inserting...`);
            const { error } = await supabase
                .from(CONVERSATION_MEMORY_TABLE)
                .insert({ discord_channel_id: channelId, summary: summary, updated_at: new Date().toISOString() });
            queryError = error;
        }

        if (queryError) {
            console.error('Error saving conversation summary:', queryError.message);
        } else {
            console.log(`Summary saved successfully for channel ${channelId}`);
        }

    } catch (e) {
        console.error('An unexpected error occurred in updateConversationSummary:', e.message);
    }
}

// --- LLM Integration ---

async function callLlmApi(prompt) {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant', // Recommended replacement for 'llama3-8b-8192'
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                },
                timeout: LLM_TIMEOUT,
            }
        );

        if (response.data?.choices?.[0]?.message?.content) {
            return response.data.choices[0].message.content;
        } else {
            console.error('Invalid LLM API response structure:', response.data);
            return 'Sorry, I received an unexpected response from the AI.';
        }
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('Error calling LLM API: Request timed out.');
            return 'Sorry, the request took too long and timed out.';
        }
        console.error('Error calling LLM API:', error.response ? error.response.data : error.message);
        return 'Sorry, I encountered an error while trying to process your request.';
    }
}

// --- Main Message Handler ---
async function handleMention(message) {
    try {
        const userMessage = message.content.slice(message.content.indexOf('>') + 1).trim();
        if (!userMessage) {
            await message.reply('Yes? How can I help you?');
            return;
        }

        await message.channel.sendTyping();

        const conversationSummary = await getConversationSummary(message.channel.id);

        const prompt = `System Instructions: ${agent_config.system_instructions}\nConversation Summary: ${conversationSummary}\nUser message: ${userMessage}`;
        const llmResponse = await callLlmApi(prompt);

        try {
            await message.reply(llmResponse);
        } catch (discordError) {
            console.error(`Failed to send Discord reply in channel ${message.channel.id}:`, discordError.message);
            // Optionally, try to inform the user in a different way or just log it.
            return; // Stop further processing if we can't even reply.
        }

        const conversationToSummarize = `Previous summary:\n${conversationSummary}\n\nUser's message:\n"${userMessage}"\n\nYour response:\n"${llmResponse}"`;
        const summarizationPrompt = `Summarize the conversation so far in 3-4 concise lines preserving important context.\n\n${conversationToSummarize}`;
        const newSummary = await callLlmApi(summarizationPrompt);

        // Only update summary if the summarization call was successful
        if (newSummary && !newSummary.startsWith('Sorry')) {
            await updateConversationSummary(message.channel.id, newSummary);
        }

    } catch (e) {
        console.error(`An unexpected error occurred in handleMention for message ${message.id}:`, e.message);
        try {
            await message.reply("Sorry, something went wrong while processing your request.");
        } catch (finalError) {
            console.error(`Failed to send final error message to Discord in channel ${message.channel.id}:`, finalError.message);
        }
    }
}

// --- Real-time Configuration Subscription ---
function subscribeToConfigChanges() {
    console.log('Subscribing to real-time configuration changes...');

    // Subscription for System Instructions
    supabase.channel('agent_config_changes')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: AGENT_CONFIG_TABLE },
            (payload) => {
                if (payload.new && payload.new.system_instructions) {
                    agent_config.system_instructions = payload.new.system_instructions;
                    console.log('Real-time: System instructions updated.');
                    console.log('New System Instructions:', agent_config.system_instructions);
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to agent_config updates.');
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Failed to subscribe to agent_config updates:', err ? err.message : 'No error details');
            }
        });

    // Subscription for Allowed Channels
    supabase.channel('allowed_channels_changes')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: ALLOWED_CHANNELS_TABLE },
            (payload) => {
                if (payload.new && payload.new.channel_id) {
                    allowedChannelIds.add(payload.new.channel_id);
                    console.log(`Real-time: Channel ${payload.new.channel_id} ADDED.`);
                    console.log('Current allowed channels:', Array.from(allowedChannelIds));
                }
            }
        )
        .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: ALLOWED_CHANNELS_TABLE },
            (payload) => {
                // In a DELETE event for a single-PK table, the channel_id is in payload.old
                if (payload.old && payload.old.channel_id) {
                    allowedChannelIds.delete(payload.old.channel_id);
                    console.log(`Real-time: Channel ${payload.old.channel_id} REMOVED.`);
                    console.log('Current allowed channels:', Array.from(allowedChannelIds));
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('Successfully subscribed to allowed_channels updates.');
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Failed to subscribe to allowed_channels updates:', err ? err.message : 'No error details');
            }
        });
}


// --- Discord Client Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // Subscriptions are now handled after login
});

client.on('messageCreate', async message => {
    if (message.author.bot || !allowedChannelIds.has(message.channel.id)) {
        return;
    }

    const botMention = `<@${client.user.id}>`;
    if (message.content.startsWith(botMention)) {
        await handleMention(message);
    }
});

// --- Bot Startup ---
(async () => {
    try {
        // 1. Fetch initial config before logging in
        await fetchAgentConfig();

        // 2. Log in to Discord
        await client.login(DISCORD_TOKEN);
        console.log('Successfully logged into Discord.');

        // 3. Subscribe to real-time updates after a successful login
        subscribeToConfigChanges();

    } catch (error) {
        console.error('FATAL: An error occurred during startup.', error.message);
        process.exit(1);
    }
})();
