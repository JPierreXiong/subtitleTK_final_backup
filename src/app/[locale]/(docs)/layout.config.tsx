import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { i18n } from '@/core/docs/source';
import { envConfigs } from '@/config';

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    links: [],
    nav: {
      title: (
        <span className="text-primary text-lg font-bold">
          Subtitle TK
        </span>
      ),
      transparentMode: 'top',
    },
    i18n,
  };
}
