import { NextRequest } from 'next/server';

import { requireAdminAccess } from '@/core/rbac/permission';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  findTestimonialById,
  updateTestimonial,
  deleteTestimonial,
  UpdateTestimonial,
} from '@/shared/models/testimonial';

/**
 * GET /api/admin/testimonials/[id]
 * Get a single testimonial by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin access
    await requireAdminAccess({
      redirectUrl: '/admin/no-permission',
      locale: 'en',
    });

    const { id } = await params;
    const testimonial = await findTestimonialById(id);

    if (!testimonial) {
      return respErr('Testimonial not found');
    }

    return respData({ testimonial });
  } catch (e: any) {
    console.log('get testimonial failed:', e);
    return respErr(e.message || 'Failed to get testimonial');
  }
}

/**
 * PUT /api/admin/testimonials/[id]
 * Update a testimonial
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();

    // Check if testimonial exists
    const existing = await findTestimonialById(id);
    if (!existing) {
      return respErr('Testimonial not found');
    }

    // Build update object
    const update: UpdateTestimonial = {};

    if (body.name !== undefined) {
      update.name = body.name.trim();
    }
    if (body.email !== undefined) {
      update.email = body.email?.trim() || null;
    }
    if (body.role !== undefined) {
      update.role = body.role?.trim() || null;
    }
    if (body.quote !== undefined) {
      update.quote = body.quote.trim();
    }
    if (body.avatarUrl !== undefined) {
      update.avatarUrl = body.avatarUrl?.trim() || null;
    }
    if (body.language !== undefined) {
      const validLanguages = ['en', 'zh', 'fr'];
      if (!validLanguages.includes(body.language)) {
        return respErr(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
      }
      update.language = body.language;
    }
    if (body.status !== undefined) {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(body.status)) {
        return respErr(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      update.status = body.status;

      // Update approvedAt and approvedBy if status changed to approved
      if (body.status === 'approved' && existing.status !== 'approved') {
        update.approvedAt = new Date();
        update.approvedBy = user.id;
      }
    }
    if (body.rating !== undefined) {
      if (body.rating === null || body.rating === '') {
        update.rating = null;
      } else {
        const ratingNum = parseInt(body.rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
          return respErr('Rating must be between 1 and 5');
        }
        update.rating = ratingNum;
      }
    }
    if (body.source !== undefined) {
      update.source = body.source;
    }
    if (body.sort !== undefined) {
      update.sort = parseInt(body.sort) || 0;
    }

    const updated = await updateTestimonial(id, update);

    return respData({
      message: 'Testimonial updated successfully',
      testimonial: updated,
    });
  } catch (e: any) {
    console.log('update testimonial failed:', e);
    return respErr(e.message || 'Failed to update testimonial');
  }
}

/**
 * DELETE /api/admin/testimonials/[id]
 * Delete a testimonial (soft delete)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin access
    await requireAdminAccess({
      redirectUrl: '/admin/no-permission',
      locale: 'en',
    });

    const { id } = await params;

    // Check if testimonial exists
    const existing = await findTestimonialById(id);
    if (!existing) {
      return respErr('Testimonial not found');
    }

    await deleteTestimonial(id);

    return respData({
      message: 'Testimonial deleted successfully',
    });
  } catch (e: any) {
    console.log('delete testimonial failed:', e);
    return respErr(e.message || 'Failed to delete testimonial');
  }
}

