import { requireAdminAccess } from '@/core/rbac/permission';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  findTestimonialById,
  approveTestimonial,
} from '@/shared/models/testimonial';

/**
 * POST /api/admin/testimonials/[id]/approve
 * Approve a testimonial
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

    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const { id } = await params;

    // Check if testimonial exists
    const existing = await findTestimonialById(id);
    if (!existing) {
      return respErr('Testimonial not found');
    }

    const approved = await approveTestimonial(id, user.id);

    return respData({
      message: 'Testimonial approved successfully',
      testimonial: approved,
    });
  } catch (e: any) {
    console.log('approve testimonial failed:', e);
    return respErr(e.message || 'Failed to approve testimonial');
  }
}


