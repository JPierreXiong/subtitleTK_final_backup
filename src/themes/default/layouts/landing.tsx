import { ReactNode } from 'react';

import {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import { Footer, Header } from '@/themes/default/blocks';

export default async function LandingLayout({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header header={header} />
      <main className="flex-1">
        {children}
      </main>
      <Footer footer={footer} />
    </div>
  );
}
