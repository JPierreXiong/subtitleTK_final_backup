import { NextRequest } from 'next/server';

import { requireAdminAccess } from '@/core/rbac/permission';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  getTestimonials,
  getTestimonialsCount,
  createTestimonial,
  TestimonialStatus,
  NewTestimonial,
} from '@/shared/models/testimonial';
import { getUuid } from '@/shared/lib/hash';

/**
 * GET /api/admin/testimonials
 * Get testimonials list for admin (with filtering)
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin access
    await requireAdminAccess({
      redirectUrl: '/admin/no-permission',
      locale: 'en', // Default locale, adjust if needed
    });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('pageSize') || '30');
    const status = searchParams.get('status') as TestimonialStatus | null;
    const language = searchParams.get('language') || null;

    const total = await getTestimonialsCount({
      status: status || undefined,
      language: language || undefined,
    });

    const testimonials = await getTestimonials({
      status: status || undefined,
      language: language || undefined,
      getUser: true,
      page,
      limit,
    });

    return respData({
      testimonials,
      total,
      page,
      limit,
    });
  } catch (e: any) {
    console.log('get admin testimonials failed:', e);
    return respErr(e.message || 'Failed to get testimonials');
  }
}

/**
 * POST /api/admin/testimonials
 * Create a new testimonial (admin can create manually)
 */
export async function POST(req: Request) {
  try {
    // Check admin access
    await requireAdminAccess({
      redirectUrl: '/admin/no-permission',
      locale: 'en',
    });

    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json();
    const {
      name,
      email,
      role,
      quote,
      avatarUrl,
      language,
      status,
      rating,
      source,
    } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return respErr('Name is required');
    }

    if (!quote || typeof quote !== 'string' || quote.trim().length === 0) {
      return respErr('Quote is required');
    }

    // Validate language
    const validLanguages = ['en', 'zh', 'fr'];
    const testimonialLanguage = language || 'en';
    if (!validLanguages.includes(testimonialLanguage)) {
      return respErr(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
    }

    // Validate status
    const validStatuses = [
      TestimonialStatus.PENDING,
      TestimonialStatus.APPROVED,
      TestimonialStatus.REJECTED,
    ];
    const testimonialStatus = status || TestimonialStatus.APPROVED; // Default to approved for admin
    if (!validStatuses.includes(testimonialStatus)) {
      return respErr(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      const ratingNum = parseInt(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return respErr('Rating must be between 1 and 5');
      }
    }

    // Create testimonial
    const newTestimonial: NewTestimonial = {
      id: getUuid(),
      userId: null, // Admin-created testimonials may not have a user
      name: name.trim(),
      email: email?.trim() || null,
      role: role?.trim() || null,
      quote: quote.trim(),
      avatarUrl: avatarUrl?.trim() || null,
      language: testimonialLanguage,
      status: testimonialStatus,
      rating: rating ? parseInt(rating) : null,
      source: source || 'manual',
      approvedAt: testimonialStatus === TestimonialStatus.APPROVED ? new Date() : null,
      approvedBy:
        testimonialStatus === TestimonialStatus.APPROVED ? user.id : null,
    };

    await createTestimonial(newTestimonial);

    return respData({
      message: 'Testimonial created successfully',
      testimonial: newTestimonial,
    });
  } catch (e: any) {
    console.log('create admin testimonial failed:', e);
    return respErr(e.message || 'Failed to create testimonial');
  }
}

