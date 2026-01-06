/**
 * Plan configuration constants
 * Defines all plan types, limits, and pricing
 */

export type PlanType = 'free' | 'base' | 'pro' | 'on_demand';

export interface PlanConfig {
  name: string;
  price?: number; // USD
  credits?: number; // Base credits
  creditsBonus?: number; // Bonus credits
  validDays?: number; // Validity period in days
  freeTrialCount?: number; // Free trial count (for free plan)
  // Cost per operation
  creditsCost: {
    extract: number; // Subtitle extraction
    video: number; // Video download
    translate: number; // Translation
  };
  // Plan limits
  maxVideoDuration: number | null; // Video duration limit in seconds (null = unlimited)
  concurrentLimit: number | null; // Concurrent task limit (null = unlimited)
  exportFormats: string[]; // Available export formats
  storageHours: number; // Storage duration in hours
  translationCharLimit: number | null; // Translation character limit (null = unlimited)
  supportedLanguages: number; // Number of supported languages
  supportLevel: string; // Support level description
}

export const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    freeTrialCount: 1,
    creditsCost: {
      extract: 10,
      video: 15,
      translate: 5,
    },
    maxVideoDuration: null, // No limit for free plan
    concurrentLimit: 2, // Allow 2 concurrent tasks for better user experience
    exportFormats: ['SRT', 'CSV'],
    storageHours: 24,
    translationCharLimit: 1000,
    supportedLanguages: 12,
    supportLevel: 'Community',
  },
  base: {
    name: 'Base',
    price: 9.9,
    credits: 200,
    creditsBonus: 50,
    validDays: 30,
    creditsCost: {
      extract: 10,
      video: 15,
      translate: 5,
    },
    maxVideoDuration: 600, // 10 minutes
    concurrentLimit: 2, // Allow 2 concurrent tasks for better user experience
    exportFormats: ['SRT', 'CSV'],
    storageHours: 24,
    translationCharLimit: null, // No limit
    supportedLanguages: 12,
    supportLevel: 'Email Support',
  },
  pro: {
    name: 'Pro',
    price: 19.9,
    credits: 500,
    creditsBonus: 100,
    validDays: 30,
    creditsCost: {
      extract: 10,
      video: 15,
      translate: 5,
    },
    maxVideoDuration: null, // Unlimited
    concurrentLimit: null, // Unlimited
    exportFormats: ['SRT', 'CSV', 'VTT', 'TXT'],
    storageHours: 72,
    translationCharLimit: null, // Unlimited
    supportedLanguages: 12,
    supportLevel: 'Priority Human Support',
  },
  on_demand: {
    name: 'On-demand',
    price: 4.9,
    credits: 50,
    creditsBonus: 25,
    validDays: 365, // 1 year
    creditsCost: {
      extract: 10,
      video: 15,
      translate: 5,
    },
    maxVideoDuration: null, // No limit
    concurrentLimit: null, // No limit
    exportFormats: ['SRT', 'CSV'],
    storageHours: 24,
    translationCharLimit: null, // No limit
    supportedLanguages: 12,
    supportLevel: 'Email Support',
  },
};

/**
 * Get plan configuration by plan type
 */
export function getPlanConfig(planType: PlanType): PlanConfig {
  return PLAN_CONFIG[planType] || PLAN_CONFIG.free;
}

/**
 * Calculate estimated credits cost for a media task
 * @param outputType - 'subtitle' for subtitle extraction, 'video' for video download only
 * @param includeTranslation - Whether to include translation cost
 * @param videoOnly - If true and outputType is 'video', only charge for video download (not subtitle extraction)
 */
export function calculateEstimatedCredits(
  outputType: 'subtitle' | 'video',
  includeTranslation: boolean = false,
  videoOnly: boolean = false
): number {
  const baseCost = PLAN_CONFIG.free.creditsCost.extract;
  const videoCost = PLAN_CONFIG.free.creditsCost.video;
  const translateCost = PLAN_CONFIG.free.creditsCost.translate;

  let total = 0;
  
  if (outputType === 'video' && videoOnly) {
    // Video download only: only charge for video download (15 credits)
    total = videoCost;
  } else if (outputType === 'video') {
    // Video download + subtitle extraction: charge for both (10 + 15 = 25 credits)
    total = baseCost + videoCost;
  } else {
    // Subtitle extraction only: charge for extraction (10 credits)
    total = baseCost;
  }
  
  if (includeTranslation) {
    total += translateCost;
  }

  return total;
}

/**
 * Alias for calculateEstimatedCredits (for consistency)
 */
export function getEstimatedCreditsCost(
  outputType: 'subtitle' | 'video',
  includeTranslation: boolean = false,
  videoOnly: boolean = false
): number {
  return calculateEstimatedCredits(outputType, includeTranslation, videoOnly);
}

