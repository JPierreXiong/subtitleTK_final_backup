import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
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

  // build page params
  const page: Landing = {
    hero: t.raw('hero'),
    // 明确设为 undefined 阻止 UI 渲染
    logos: undefined,
    introduce: undefined,
    benefits: undefined,
    usage: undefined,
    features: undefined,
    stats: undefined,
    
    // 保留：用户评价功能（紧跟在 Hero 后面）
    testimonials: t.raw('testimonials'),
    
    // 可选保留的区块
    subscribe: t.raw('subscribe'),
    faq: t.raw('faq'),
    cta: undefined, // 已隐藏 CTA 区块
  };

  // load page component
  const Page = await getThemePage('landing');

  return <Page locale={locale} page={page} />;
}
