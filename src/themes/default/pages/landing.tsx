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
  return (
    <>
      {page.hero && <Hero hero={page.hero} />}
      {/* 保留：用户评价功能（紧跟在 Hero 后面） */}
      {page.testimonials && <Testimonials testimonials={page.testimonials} />}
      
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
      {/* {page.cta && <CTA cta={page.cta} className="bg-muted" />} */}
    </>
  );
}
