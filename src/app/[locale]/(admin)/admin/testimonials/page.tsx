import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireAdminAccess } from '@/core/rbac/permission';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import {
  getTestimonials,
  getTestimonialsCount,
  Testimonial,
  TestimonialStatus,
} from '@/shared/models/testimonial';
import { Button, Crumb, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function TestimonialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    status?: string;
    language?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Check admin access (using general admin access for now)
  await requireAdminAccess({
    redirectUrl: '/admin/no-permission',
    locale: locale || '',
  });

  const { page: pageNum, pageSize, status, language } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 30;

  // Get translations
  const t = await getTranslations('admin.testimonials');

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.testimonials'), is_active: true },
  ];

  // Status tabs
  const tabs: Tab[] = [
    {
      name: 'all',
      title: t('list.tabs.all'),
      url: '/admin/testimonials',
      is_active: !status || status === 'all',
    },
    {
      name: 'pending',
      title: t('list.tabs.pending'),
      url: '/admin/testimonials?status=pending',
      is_active: status === 'pending',
    },
    {
      name: 'approved',
      title: t('list.tabs.approved'),
      url: '/admin/testimonials?status=approved',
      is_active: status === 'approved',
    },
    {
      name: 'rejected',
      title: t('list.tabs.rejected'),
      url: '/admin/testimonials?status=rejected',
      is_active: status === 'rejected',
    },
  ];

  const testimonialStatus =
    status && status !== 'all'
      ? (status as TestimonialStatus)
      : undefined;

  const total = await getTestimonialsCount({
    status: testimonialStatus,
    language: language || undefined,
  });

  const testimonials = await getTestimonials({
    status: testimonialStatus,
    language: language || undefined,
    getUser: true,
    page,
    limit,
  });

  const table: Table = {
    columns: [
      { name: 'name', title: t('fields.name') },
      { name: 'role', title: t('fields.role') },
      {
        name: 'quote',
        title: t('fields.quote'),
        callback: (item: Testimonial) => {
          const quote = item.quote || '';
          return quote.length > 100 ? `${quote.substring(0, 100)}...` : quote;
        },
      },
      { name: 'language', title: t('fields.language') },
      {
        name: 'status',
        title: t('fields.status'),
        type: 'label',
        callback: (item: Testimonial) => {
          const statusColors: Record<string, string> = {
            pending: 'yellow',
            approved: 'green',
            rejected: 'red',
          };
          return {
            label: item.status || 'pending',
            color: statusColors[item.status || 'pending'] || 'gray',
          };
        },
      },
      {
        name: 'rating',
        title: t('fields.rating'),
        callback: (item: Testimonial) => {
          return item.rating ? `${item.rating}/5` : '-';
        },
      },
      { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
      {
        name: 'actions',
        title: t('fields.actions'),
        type: 'dropdown',
        callback: (item: Testimonial) => {
          const actions = [];
          
          // Edit action
          actions.push({
            name: 'edit',
            title: t('list.buttons.edit'),
            icon: 'RiEditLine',
            url: `/admin/testimonials/${item.id}/edit`,
          });

          // Approve action (only for pending)
          if (item.status === TestimonialStatus.PENDING) {
            actions.push({
              name: 'approve',
              title: t('list.buttons.approve'),
              icon: 'RiCheckLine',
              url: `/admin/testimonials/${item.id}/approve`,
              method: 'POST',
            });
          }

          // Reject action (only for pending or approved)
          if (
            item.status === TestimonialStatus.PENDING ||
            item.status === TestimonialStatus.APPROVED
          ) {
            actions.push({
              name: 'reject',
              title: t('list.buttons.reject'),
              icon: 'RiCloseLine',
              url: `/admin/testimonials/${item.id}/reject`,
              method: 'POST',
            });
          }

          // Delete action
          actions.push({
            name: 'delete',
            title: t('list.buttons.delete'),
            icon: 'RiDeleteBinLine',
            url: `/admin/testimonials/${item.id}/delete`,
            variant: 'destructive',
          });

          return actions;
        },
      },
    ],
    data: testimonials,
    pagination: {
      total,
      page,
      limit,
    },
  };

  const actions: Button[] = [
    {
      id: 'add',
      title: t('list.buttons.add'),
      icon: 'RiAddLine',
      url: '/admin/testimonials/add',
    },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('list.title')} actions={actions} tabs={tabs} />
        <TableCard table={table} />
      </Main>
    </>
  );
}

