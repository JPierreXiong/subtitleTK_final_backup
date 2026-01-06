import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  createTestimonial,
  TestimonialStatus,
  NewTestimonial,
} from '@/shared/models/testimonial';
import { getUuid } from '@/shared/lib/hash';

/**
 * POST /api/testimonials/submit
 * Submit a new testimonial (will be pending until approved)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, role, quote, avatarUrl, language, rating, source } =
      body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return respErr('Name is required');
    }

    if (!quote || typeof quote !== 'string' || quote.trim().length === 0) {
      return respErr('Quote is required');
    }

    if (quote.trim().length > 1000) {
      return respErr('Quote is too long (max 1000 characters)');
    }

    // Validate language
    const validLanguages = ['en', 'zh', 'fr'];
    const testimonialLanguage = language || 'en';
    if (!validLanguages.includes(testimonialLanguage)) {
      return respErr(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return respErr('Rating must be between 1 and 5');
      }
    }

    // Get current user (optional - testimonial can be submitted by anonymous users)
    const user = await getUserInfo();
    const userId = user?.id || null;

    // Create testimonial
    const newTestimonial: NewTestimonial = {
      id: getUuid(),
      userId: userId,
      name: name.trim(),
      email: email?.trim() || null,
      role: role?.trim() || null,
      quote: quote.trim(),
      avatarUrl: avatarUrl?.trim() || null,
      language: testimonialLanguage,
      status: TestimonialStatus.PENDING, // Will need admin approval
      rating: rating ? parseInt(rating) : null,
      source: source || 'landing', // Default to 'landing' if not specified
    };

    await createTestimonial(newTestimonial);

    return respData({
      message: 'Testimonial submitted successfully. It will be reviewed by our team before publishing.',
      id: newTestimonial.id,
    });
  } catch (e: any) {
    console.log('submit testimonial failed:', e);
    return respErr(e.message || 'Failed to submit testimonial');
  }
}

