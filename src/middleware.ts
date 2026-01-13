import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from './lib/supabase.middleware';

export async function middleware(request: NextRequest) {
  try {
    // This `try/catch` block is only for logging errors in Next.js 13.5.4 and earlier
    // Latest versions of Next.js will have a dedicated error page for them
    const response = NextResponse.next();
    const supabase = await createClient(request, response);
    await supabase.auth.getSession();
    return response;
  } catch (e) {
    console.error(e);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
