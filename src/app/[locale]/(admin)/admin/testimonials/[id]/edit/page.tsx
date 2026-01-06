import { setRequestLocale } from 'next-intl/server';

import { requireAdminAccess } from '@/core/rbac/permission';
import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import {
  findTestimonialById,
  updateTestimonial,
  UpdateTestimonial,
  TestimonialStatus,
} from '@/shared/models/testimonial';
import { getUserInfo } from '@/shared/models/user';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function TestimonialEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Check admin access
  await requireAdminAccess({
    redirectUrl: '/admin/no-permission',
    locale: locale || '',
  });

  const testimonial = await findTestimonialById(id);
  if (!testimonial) {
    return <Empty message="Testimonial not found" />;
  }

  // Hardcoded translations (should be moved to locale files later)
  const t = {
    'edit.title': 'Edit Testimonial',
    'edit.crumbs.admin': 'Admin',
    'edit.crumbs.testimonials': 'Testimonials',
    'edit.crumbs.edit': 'Edit',
    'edit.buttons.submit': 'Update',
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
    { title: t['edit.crumbs.admin'], url: '/admin' },
    { title: t['edit.crumbs.testimonials'], url: '/admin/testimonials' },
    { title: t['edit.crumbs.edit'], is_active: true },
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
    passby: {
      testimonial: testimonial,
    },
    data: testimonial,
    submit: {
      button: {
        title: t['edit.buttons.submit'],
      },
      handler: async (data, passby) => {
        'use server';

        const user = await getUserInfo();
        if (!user) {
          throw new Error('no auth');
        }

        const { testimonial } = passby;
        if (!testimonial) {
          throw new Error('testimonial not found');
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

        const update: UpdateTestimonial = {
          name: name.trim(),
          email: email?.trim() || null,
          role: role?.trim() || null,
          quote: quote.trim(),
          avatarUrl: avatarUrl?.trim() || null,
          language: language,
          status: status as TestimonialStatus,
          rating: rating ? parseInt(rating) : null,
          source: source || null,
          sort: sort ? parseInt(sort) : 0,
        };

        // Update approvedAt and approvedBy if status changed to approved
        if (status === TestimonialStatus.APPROVED && testimonial.status !== TestimonialStatus.APPROVED) {
          update.approvedAt = new Date();
          update.approvedBy = user.id;
        }

        await updateTestimonial(testimonial.id, update);

        return {
          status: 'success',
          message: 'Testimonial updated',
          redirect_url: '/admin/testimonials',
        };
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t['edit.title']} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}

