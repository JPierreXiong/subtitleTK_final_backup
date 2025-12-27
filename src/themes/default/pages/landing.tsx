import Script from 'next/script';

import { envConfigs } from '@/config';
import { Landing } from '@/shared/types/blocks/landing';
import {
  CTA,
  FAQ,
  // Features,
  // FeaturesAccordion,
  // FeaturesList,
  // FeaturesStep,
  Hero,
  // Logos,
  // Stats,
  Subscribe,
  Testimonials,
} from '@/themes/default/blocks';

export default async function LandingPage({
  locale,
  page,
}: {
  locale?: string;
  page: Landing;
}) {
  // JSON-LD structured data for SEO and AdSense
  const appUrl = envConfigs.app_url || 'https://subtitletk.app';
  
  // SoftwareApplication JSON-LD
  const jsonLdSoftware = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Subtitle TK',
    description:
      'Professional tool to extract, download, and translate subtitles from YouTube and TikTok videos. Support for 12+ languages with AI-powered translation.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'YouTube transcript extraction',
      'TikTok video download',
      'Auto-translation to 12+ languages',
      'High-speed processing',
      'SRT format export',
      'No watermark videos',
    ],
    // aggregateRating removed to ensure compliance with Creem requirements - no false information
    url: appUrl,
  };

  // FAQPage JSON-LD (if FAQ exists)
  const jsonLdFAQ = page.faq?.items
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faq.items.map((item) => ({
          '@type': 'Question',
          name: item.question || '',
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer || '',
          },
        })),
      }
    : null;

  return (
    <>
      {/* JSON-LD structured data for SEO */}
      <Script
        id="json-ld-software-application"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }}
      />
      
      {/* FAQPage JSON-LD structured data */}
      {jsonLdFAQ && (
        <Script
          id="json-ld-faq-page"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFAQ) }}
        />
      )}

      {page.hero && <Hero hero={page.hero} />}
      {/* 已隐藏：用户评价功能 - 确保不会因为任何原因显示，符合 Creem 合规要求 */}
      {/* {page.testimonials && <Testimonials testimonials={page.testimonials} />} */}
      
      {/* 已注释：不需要的区块 */}
      {/* {page.logos && <Logos logos={page.logos} />} */}
      {/* {page.introduce && <FeaturesList features={page.introduce} />} */}
      {/* {page.benefits && <FeaturesAccordion features={page.benefits} />} */}
      {/* {page.usage && <FeaturesStep features={page.usage} />} */}
      {/* {page.features && <Features features={page.features} />} */}
      {/* {page.stats && <Stats stats={page.stats} className="bg-muted" />} */}
      
      {/* 可选保留的区块 */}
      {/* {page.subscribe && (
        <Subscribe subscribe={page.subscribe} className="bg-muted" />
      )} */}
      {page.faq && <FAQ faq={page.faq} />}
      {page.cta && <CTA cta={page.cta} className="bg-muted" />}
    </>
  );
}
