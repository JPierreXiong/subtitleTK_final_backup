import { requireAdminAccess } from '@/core/rbac/permission';
import { respData, respErr } from '@/shared/lib/resp';
import {
  findTestimonialById,
  rejectTestimonial,
} from '@/shared/models/testimonial';

/**
 * POST /api/admin/testimonials/[id]/reject
 * Reject a testimonial
 */
export async function POST(
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

    const rejected = await rejectTestimonial(id);

    return respData({
      message: 'Testimonial rejected successfully',
      testimonial: rejected,
    });
  } catch (e: any) {
    console.log('reject testimonial failed:', e);
    return respErr(e.message || 'Failed to reject testimonial');
  }
}

