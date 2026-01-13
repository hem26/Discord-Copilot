// src/lib/supabase.utils.ts
import { createClient as createClientBrowser } from './supabase.client';
import { createClient as createClientServer } from './supabase.server';
import { createClient as createClientMiddleware } from './supabase.middleware';

// This utility helps to choose the right client based on the environment.
// For client components and API routes (client-side context in browser)
export const getBrowserClient = () => createClientBrowser();

// For server components, server actions, and API routes (server-side context)
export const getServerClient = () => createClientServer();

// For Next.js Middleware
export const getMiddlewareClient = (req: any, res: any) => createClientMiddleware(req, res);
