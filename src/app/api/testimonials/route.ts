import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getApprovedTestimonials } from '@/shared/models/testimonial';

/**
 * GET /api/testimonials
 * Get approved testimonials for public display
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') || 'en'; // Default to English
    const limit = parseInt(searchParams.get('limit') || '100');

    // Validate language
    const validLanguages = ['en', 'zh', 'fr'];
    if (!validLanguages.includes(language)) {
      return respErr(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
    }

    // Get approved testimonials
    const testimonials = await getApprovedTestimonials({
      language,
      limit,
    });

    return respData({
      testimonials,
      count: testimonials.length,
    });
  } catch (e: any) {
    console.log('get testimonials failed:', e);
    return respErr(e.message || 'Failed to get testimonials');
  }
}

