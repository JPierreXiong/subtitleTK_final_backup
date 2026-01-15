import { envConfigs } from '..';

export const localeNames: any = {
  en: 'English',
  zh: '中文',
  fr: 'Français',
};

export const locales = ['en', 'zh', 'fr'];

export const defaultLocale = envConfigs.locale;

export const localePrefix = 'as-needed';

export const localeDetection = false;

export const localeMessagesRootPath = '@/config/locale/messages';

export const localeMessagesPaths = [
  'common',
  'landing',
  'showcases',
  'blog',
  'pricing',
  'settings/sidebar',
  'settings/profile',
  'settings/security',
  'settings/billing',
  'settings/payments',
  'settings/credits',
  'settings/apikeys',
  'admin/sidebar',
  'admin/users',
  'admin/roles',
  'admin/permissions',
  'admin/categories',
  'admin/posts',
  'admin/payments',
  'admin/subscriptions',
  'admin/credits',
  'admin/settings',
  'admin/apikeys',
  'admin/ai-tasks',
  'admin/chats',
  'admin/testimonials',
  'ai/music',
  'ai/chat',
  'ai/image',
  'ai/media',
  'activity/sidebar',
  'activity/ai-tasks',
  'activity/chats',
];
