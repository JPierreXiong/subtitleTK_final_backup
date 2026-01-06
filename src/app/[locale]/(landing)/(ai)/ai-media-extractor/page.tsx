import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader, SEOContent } from '@/shared/blocks/common';
import { MediaExtractor } from '@/shared/blocks/generator';
import { getMetadata } from '@/shared/lib/seo';
import { CTA as CTAType } from '@/shared/types/blocks/landing';
import { CTA, FAQ } from '@/themes/default/blocks';

export const generateMetadata = getMetadata({
  metadataKey: 'ai.media.metadata',
  canonicalUrl: '/ai-media-extractor',
});

export default async function AiMediaExtractorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('landing');
  const tt = await getTranslations('ai.media');

  // Custom CTA for ai-media-extractor page
  const customCta: CTAType = {
    id: 'cta',
    title: 'Try it free，Analyze Your First YouTube and tiktok Video Now',
    description: '',
    tip: '<span style="font-size: 0.75rem; font-weight: 300;">No credit card required</span>',
    buttons: [
      {
        title: 'analyze your first Video Now',
        url: 'https://www.subtitletk.app/ai-media-extractor',
        target: '_self',
        icon: 'Zap',
        variant: 'default',
        className: 'bg-[#FFD700] hover:bg-[#FFC700] text-black font-semibold',
      },
    ],
  };

  return (
    <>
      <PageHeader
        title={tt.raw('page.title')}
        description={tt.raw('page.description')}
        className="mt-16 -mb-32"
      />
      <MediaExtractor srOnlyTitle={tt.raw('extractor.title')} />
      <SEOContent locale={locale} />
      <FAQ faq={t.raw('faq')} />
      <CTA cta={customCta} className="bg-muted" />
    </>
  );
}







