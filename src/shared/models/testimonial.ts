import { and, asc, count, desc, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { testimonial } from '@/config/db/schema';

import { appendUserToResult, User } from './user';

export type Testimonial = typeof testimonial.$inferSelect & {
  user?: User;
};
export type NewTestimonial = typeof testimonial.$inferInsert;
export type UpdateTestimonial = Partial<
  Omit<NewTestimonial, 'id' | 'createdAt'>
>;

export enum TestimonialStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// create testimonial
export async function createTestimonial(
  newTestimonial: NewTestimonial
): Promise<Testimonial> {
  const [result] = await db()
    .insert(testimonial)
    .values(newTestimonial)
    .returning();

  return result;
}

// get testimonials
export async function getTestimonials({
  userId,
  status,
  language,
  getUser = false,
  page = 1,
  limit = 30,
}: {
  userId?: string;
  status?: TestimonialStatus;
  language?: string;
  getUser?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<Testimonial[]> {
  const result = await db()
    .select()
    .from(testimonial)
    .where(
      and(
        userId ? eq(testimonial.userId, userId) : undefined,
        status ? eq(testimonial.status, status) : undefined,
        language ? eq(testimonial.language, language) : undefined,
        isNull(testimonial.deletedAt) // Exclude soft-deleted testimonials
      )
    )
    .orderBy(desc(testimonial.sort), desc(testimonial.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

// get approved testimonials for frontend display
export async function getApprovedTestimonials({
  language,
  limit = 100,
}: {
  language: string;
  limit?: number;
}): Promise<Testimonial[]> {
  const result = await db()
    .select()
    .from(testimonial)
    .where(
      and(
        eq(testimonial.status, TestimonialStatus.APPROVED),
        eq(testimonial.language, language),
        isNull(testimonial.deletedAt) // Exclude soft-deleted testimonials
      )
    )
    .orderBy(asc(testimonial.sort), desc(testimonial.approvedAt))
    .limit(limit);

  // Load user data if userId exists
  const testimonialsWithUsers = await appendUserToResult(result);

  return testimonialsWithUsers;
}

// get testimonials count
export async function getTestimonialsCount({
  userId,
  status,
  language,
}: {
  userId?: string;
  status?: TestimonialStatus;
  language?: string;
} = {}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(testimonial)
    .where(
      and(
        userId ? eq(testimonial.userId, userId) : undefined,
        status ? eq(testimonial.status, status) : undefined,
        language ? eq(testimonial.language, language) : undefined,
        isNull(testimonial.deletedAt) // Exclude soft-deleted testimonials
      )
    );

  return result?.count || 0;
}

// find testimonial by id
export async function findTestimonialById(
  id: string
): Promise<Testimonial | undefined> {
  const [result] = await db()
    .select()
    .from(testimonial)
    .where(
      and(eq(testimonial.id, id), isNull(testimonial.deletedAt))
    );

  return result;
}

// update testimonial
export async function updateTestimonial(
  id: string,
  updateTestimonial: UpdateTestimonial
): Promise<Testimonial> {
  const [result] = await db()
    .update(testimonial)
    .set(updateTestimonial)
    .where(eq(testimonial.id, id))
    .returning();

  return result;
}

// delete testimonial (soft delete)
export async function deleteTestimonial(id: string): Promise<Testimonial> {
  const [result] = await db()
    .update(testimonial)
    .set({ deletedAt: new Date() })
    .where(eq(testimonial.id, id))
    .returning();

  return result;
}

// approve testimonial
export async function approveTestimonial(
  id: string,
  approvedBy: string
): Promise<Testimonial> {
  const [result] = await db()
    .update(testimonial)
    .set({
      status: TestimonialStatus.APPROVED,
      approvedAt: new Date(),
      approvedBy: approvedBy,
    })
    .where(eq(testimonial.id, id))
    .returning();

  return result;
}

// reject testimonial
export async function rejectTestimonial(id: string): Promise<Testimonial> {
  const [result] = await db()
    .update(testimonial)
    .set({
      status: TestimonialStatus.REJECTED,
    })
    .where(eq(testimonial.id, id))
    .returning();

  return result;
}
