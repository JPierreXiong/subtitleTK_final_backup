import { setRequestLocale } from 'next-intl/server';

import { requireAdminAccess } from '@/core/rbac/permission';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { getUuid } from '@/shared/lib/hash';
import {
  createTestimonial,
  NewTestimonial,
  TestimonialStatus,
} from '@/shared/models/testimonial';
import { getUserInfo } from '@/shared/models/user';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function TestimonialAddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Check admin access
  await requireAdminAccess({
    redirectUrl: '/admin/no-permission',
    locale: locale || '',
  });

  // Hardcoded translations (should be moved to locale files later)
  const t = {
    'add.title': 'Add Testimonial',
    'add.crumbs.admin': 'Admin',
    'add.crumbs.testimonials': 'Testimonials',
    'add.crumbs.add': 'Add',
    'add.buttons.submit': 'Create',
    'fields.name': 'Name',
    'fields.email': 'Email',
    'fields.role': 'Role',
    'fields.quote': 'Quote',
    'fields.avatar_url': 'Avatar URL',
    'fields.language': 'Language',
    'fields.status': 'Status',
    'fields.rating': 'Rating (1-5)',
    'fields.source': 'Source',
    'fields.sort': 'Sort Order',
  };

  const crumbs: Crumb[] = [
    { title: t['add.crumbs.admin'], url: '/admin' },
    { title: t['add.crumbs.testimonials'], url: '/admin/testimonials' },
    { title: t['add.crumbs.add'], is_active: true },
  ];

  const form: Form = {
    fields: [
      {
        name: 'name',
        type: 'text',
        title: t['fields.name'],
        validation: { required: true },
      },
      {
        name: 'email',
        type: 'email',
        title: t['fields.email'],
      },
      {
        name: 'role',
        type: 'text',
        title: t['fields.role'],
      },
      {
        name: 'quote',
        type: 'textarea',
        title: t['fields.quote'],
        validation: { required: true },
      },
      {
        name: 'avatarUrl',
        type: 'text',
        title: t['fields.avatar_url'],
        tip: 'URL to the avatar image',
      },
      {
        name: 'language',
        type: 'select',
        title: t['fields.language'],
        options: [
          { title: 'English', value: 'en' },
          { title: 'Chinese', value: 'zh' },
          { title: 'French', value: 'fr' },
        ],
        validation: { required: true },
      },
      {
        name: 'status',
        type: 'select',
        title: t['fields.status'],
        options: [
          { title: 'Pending', value: TestimonialStatus.PENDING },
          { title: 'Approved', value: TestimonialStatus.APPROVED },
          { title: 'Rejected', value: TestimonialStatus.REJECTED },
        ],
        validation: { required: true },
      },
      {
        name: 'rating',
        type: 'number',
        title: t['fields.rating'],
        tip: 'Optional: 1 to 5',
        attributes: {
          min: 1,
          max: 5,
        },
      },
      {
        name: 'source',
        type: 'select',
        title: t['fields.source'],
        options: [
          { title: 'Manual', value: 'manual' },
          { title: 'Landing', value: 'landing' },
          { title: 'Billing', value: 'billing' },
        ],
      },
      {
        name: 'sort',
        type: 'number',
        title: t['fields.sort'],
        tip: 'Lower numbers appear first',
        attributes: {
          min: 0,
        },
      },
    ],
    passby: {},
    data: {},
    submit: {
      button: {
        title: t['add.buttons.submit'],
      },
      handler: async (data) => {
        'use server';

        const user = await getUserInfo();
        if (!user) {
          throw new Error('no auth');
        }

        const name = data.get('name') as string;
        const email = data.get('email') as string;
        const role = data.get('role') as string;
        const quote = data.get('quote') as string;
        const avatarUrl = data.get('avatarUrl') as string;
        const language = data.get('language') as string;
        const status = data.get('status') as string;
        const rating = data.get('rating') as string;
        const source = data.get('source') as string;
        const sort = data.get('sort') as string;

        if (!name?.trim() || !quote?.trim()) {
          throw new Error('name and quote are required');
        }

        const newTestimonial: NewTestimonial = {
          id: getUuid(),
          userId: null,
          name: name.trim(),
          email: email?.trim() || null,
          role: role?.trim() || null,
          quote: quote.trim(),
          avatarUrl: avatarUrl?.trim() || null,
          language: language,
          status: status as TestimonialStatus,
          rating: rating ? parseInt(rating) : null,
          source: source || 'manual',
          sort: sort ? parseInt(sort) : 0,
          approvedAt:
            status === TestimonialStatus.APPROVED ? new Date() : null,
          approvedBy:
            status === TestimonialStatus.APPROVED ? user.id : null,
        };

        await createTestimonial(newTestimonial);

        return {
          status: 'success',
          message: 'Testimonial created',
          redirect_url: '/admin/testimonials',
        };
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t['add.title']} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}

