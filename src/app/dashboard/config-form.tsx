// src/app/dashboard/config-form.tsx
'use client';

import { useState, useEffect } from 'react';
import { updateAgentConfig, resetConversationMemory } from './actions';
import { useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom'; // Import useFormStatus

interface ConfigFormProps {
  initialSystemInstructions: string;
  initialAllowedChannels: string[];
  initialConversationSummary: string;
}

// Sub-component for the submit button to use useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="w-full flex justify-center py-2.5 px-5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-disabled={pending}
      disabled={pending}
    >
      {pending ? 'Saving...' : 'Save Configuration'}
    </button>
  );
}

export default function ConfigForm({
  initialSystemInstructions,
  initialAllowedChannels,
  initialConversationSummary,
}: ConfigFormProps) {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const discordChannelId = searchParams.get('discord_channel_id');
  const conversationSummary = searchParams.get('conversationSummary') || initialConversationSummary;

  // Use the discordChannelId from the query string if present, else fallback to initialAllowedChannels[0]
  const [systemInstructions, setSystemInstructions] = useState(initialSystemInstructions);
  const [discordChannelIdInput, setDiscordChannelIdInput] = useState(discordChannelId || initialAllowedChannels[0] || '');
  const [currentMemory, setCurrentMemory] = useState(conversationSummary);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    // If discordChannelId changes in the query string, update the input and memory
    if (discordChannelId) {
      setDiscordChannelIdInput(discordChannelId);
      setCurrentMemory(conversationSummary);
    }
  }, [discordChannelId, conversationSummary]);

  // When discordChannelIdInput changes (user types), clear memory until next save/refresh
  useEffect(() => {
    if (!discordChannelIdInput || discordChannelIdInput !== discordChannelId) {
      setCurrentMemory('');
    }
  }, [discordChannelIdInput, discordChannelId]);

  // Update currentMemory whenever initialConversationSummary prop changes (from parent)
  useEffect(() => {
    setCurrentMemory(initialConversationSummary);
  }, [initialConversationSummary]); // This useEffect listens for prop changes

  const handleResetMemory = async () => {
    if (!discordChannelIdInput) return; // Don't do anything if there's no channel ID

    setIsResetting(true);
    setCurrentMemory(''); // Optimistically clear the memory in the UI

    try {
      // The server action will still run to delete from the DB and revalidate
      await resetConversationMemory(discordChannelIdInput);
      // The page will be redirected by the server action on success.
    } catch (error) {
      // If the server action fails, we should ideally show an error message.
      // For now, we'll just log it. The page redirect on error will handle messaging.
      console.error('Failed to reset memory on the server:', error);
    } finally {
      // This might not even be reached if the redirect happens, but it's good practice.
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      {message && (
        <div className={`py-3 px-4 rounded-md border-l-4 ${message.startsWith('Error') ? 'bg-red-50 border-red-400 text-red-600' : 'bg-green-50 border-green-400 text-green-600'}`}>
          <p className="text-center font-medium">{message}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6">Agent Configuration</h3>
        <form action={updateAgentConfig} className="space-y-6">
          <div>
            <label htmlFor="system-instructions" className="block text-sm font-medium text-slate-700">
              System Instructions
            </label>
            <textarea
              id="system-instructions"
              name="system_instructions"
              rows={5}
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              className="mt-1 block w-full appearance-none rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              required
            ></textarea>
          </div>
          <div>
            <label htmlFor="discord-channel-id" className="block text-sm font-medium text-slate-700">
              Discord Channel ID
            </label>
            <input
              id="discord-channel-id"
              name="discord_channel_id"
              type="text"
              value={discordChannelIdInput}
              onChange={(e) => setDiscordChannelIdInput(e.target.value)}
              className="mt-1 block w-full appearance-none rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g., 1234567890"
              required
            />
          </div>
          <SubmitButton />
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6">Conversation Memory</h3>
        <div className="space-y-6">
          <div>
            <label htmlFor="conversation-summary" className="block text-sm font-medium text-slate-700">
              Current Conversation Summary
            </label>
            <textarea
              id="conversation-summary"
              rows={5}
              value={currentMemory}
              readOnly
              className="mt-1 block w-full appearance-none rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm bg-slate-50 resize-none sm:text-sm"
            ></textarea>
          </div>
          <button
            onClick={handleResetMemory}
            className="w-full flex justify-center py-2.5 px-5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isResetting}
          >
            {isResetting ? 'Resetting...' : 'Reset Memory (Current Channel)'}
          </button>
        </div>
      </div>
    </div>
  );
}
