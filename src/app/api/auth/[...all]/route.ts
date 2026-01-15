import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    const handler = toNextJsHandler(auth.handler);
    return handler.POST(request);
  } catch (error) {
    console.error('Auth POST error:', error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      console.error('Error name:', error.name);
    }
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {})
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    const handler = toNextJsHandler(auth.handler);
    return handler.GET(request);
  } catch (error) {
    console.error('Auth GET error:', error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      console.error('Error name:', error.name);
    }
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {})
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
