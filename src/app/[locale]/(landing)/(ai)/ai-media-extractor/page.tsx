import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/shared/blocks/common';
import { MediaExtractor } from '@/shared/blocks/generator';
import { getMetadata } from '@/shared/lib/seo';
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

  return (
    <>
      <PageHeader
        title={tt.raw('page.title')}
        description={tt.raw('page.description')}
        className="mt-16 -mb-32"
      />
      <MediaExtractor srOnlyTitle={tt.raw('extractor.title')} />
      <FAQ faq={t.raw('faq')} />
      <CTA cta={t.raw('cta')} className="bg-muted" />
    </>
  );
}







