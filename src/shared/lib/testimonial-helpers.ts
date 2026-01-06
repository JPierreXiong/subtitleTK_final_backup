import { Testimonial } from '@/shared/models/testimonial';
import { Testimonials, TestimonialsItem } from '@/shared/types/blocks/landing';
import { Image } from '@/shared/types/blocks/common';

/**
 * Convert database Testimonial to TestimonialsItem format for UI
 * Handles avatar logic: if avatarUrl is empty but userId exists, use user's image
 */
export function convertTestimonialToTestimonialsItem(
  testimonial: Testimonial
): TestimonialsItem {
  // Determine avatar URL
  let avatarUrl = testimonial.avatarUrl;
  
  // If no avatarUrl but userId exists, use user's image
  if (!avatarUrl && testimonial.userId && testimonial.user?.image) {
    avatarUrl = testimonial.user.image;
  }

  // Create image object if avatarUrl exists
  // Use 'image' field for backward compatibility with JSON format
  const imageObj: Image | undefined = avatarUrl
    ? {
        src: avatarUrl,
        alt: testimonial.name || 'User avatar',
      }
    : undefined;

  // TestimonialsItem extends SectionItem (which extends NavItem)
  // NavItem has 'image' field, TestimonialsItem also defines 'avatar' field
  // JSON files and component use 'image' field, so we set 'image' for compatibility
  const item: TestimonialsItem = {
    name: testimonial.name,
    role: testimonial.role || undefined,
    quote: testimonial.quote,
    image: imageObj, // Used by component (from NavItem, also in JSON format)
    avatar: imageObj, // Also set 'avatar' as defined in TestimonialsItem interface
  };
  
  return item;
}

/**
 * Convert database Testimonials array to Testimonials format for UI
 */
export function convertTestimonialsToTestimonialsType(
  testimonials: Testimonial[],
  title: string,
  description: string,
  id: string = 'testimonials'
): Testimonials {
  const items: TestimonialsItem[] = testimonials.map(
    convertTestimonialToTestimonialsItem
  );

  return {
    id,
    title,
    description,
    items,
  };
}

