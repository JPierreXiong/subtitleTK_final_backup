import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getApprovedTestimonials } from '@/shared/models/testimonial';
import {
  convertTestimonialsToTestimonialsType,
} from '@/shared/lib/testimonial-helpers';
import { Landing } from '@/shared/types/blocks/landing';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // load page data
  const t = await getTranslations('landing');

  // Get testimonials from database or fallback to JSON
  let testimonialsData;
  try {
    const dbTestimonials = await getApprovedTestimonials({
      language: locale || 'en',
      limit: 100,
    });

    if (dbTestimonials.length > 0) {
      // Use database testimonials
      const jsonTestimonials = t.raw('testimonials') as any;
      testimonialsData = convertTestimonialsToTestimonialsType(
        dbTestimonials,
        jsonTestimonials?.title || 'What Users Say About Subtitle TK',
        jsonTestimonials?.description || 'Hear from content creators and businesses who transformed their video content with Subtitle TK.',
        jsonTestimonials?.id || 'testimonials'
      );
    } else {
      // Fallback to JSON file
      testimonialsData = t.raw('testimonials');
    }
  } catch (error) {
    // On error, fallback to JSON file
    console.error('Error loading testimonials from database:', error);
    testimonialsData = t.raw('testimonials');
  }

  // build page params
  const page: Landing = {
    hero: {
      ...t.raw('hero'),
      // 关闭可能导致误会的"后台截图"图片，符合 Creem 合规要求
      image: undefined,
      image_invert: undefined,
      // 确保不显示虚假用户头像
      show_avatars: false,
    },
    // 明确设为 undefined 阻止 UI 渲染
    logos: undefined,
    introduce: undefined,
    benefits: undefined,
    usage: undefined,
    features: undefined,
    stats: undefined,
    
    // 隐藏用户评价
    testimonials: undefined,
    
    // 可选保留的区块
    subscribe: t.raw('subscribe'),
    faq: t.raw('faq'),
    cta: t.raw('cta'), // 激活 CTA 区块
  };

  // load page component
  const Page = await getThemePage('landing');

  return <Page locale={locale} page={page} />;
}
