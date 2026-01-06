'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock, FileText, Video, Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import moment from 'moment';

import { Link, usePathname, useRouter } from '@/core/i18n/navigation';
import { LocaleSelector, Pagination } from '@/shared/blocks/common';
import { Empty } from '@/shared/blocks/common/empty';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppContext } from '@/shared/contexts/app';
import { MediaTaskStatus } from '@/shared/models/media_task';

interface MediaTaskItem {
  id: string;
  title?: string | null;
  platform?: string | null;
  status: string;
  progress: number;
  sourceLang?: string | null;
  targetLang?: string | null;
  subtitleRaw?: string | null;
  subtitleTranslated?: string | null;
  videoUrlInternal?: string | null;
  expiresAt?: Date | string | null;
  outputType?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

interface MediaHistoryResponse {
  list: MediaTaskItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function MediaHistory() {
  const t = useTranslations('ai.media');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isCheckSign } = useAppContext();

  const page = useMemo(() => {
    const value = Number(searchParams.get('page') || '1');
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, [searchParams]);

  const limit = useMemo(() => {
    const value = Number(searchParams.get('limit') || '20');
    return Number.isFinite(value) && value > 0 ? value : 20;
  }, [searchParams]);

  const [tasks, setTasks] = useState<MediaTaskItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    if (limit <= 0) {
      return 1;
    }
    const pages = Math.ceil(total / limit);
    return pages > 0 ? pages : 1;
  }, [limit, total]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      const resp = await fetch(`/api/media/history?${params.toString()}`);
      if (!resp.ok) {
        throw new Error(`Request failed with status: ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message || 'Failed to fetch history');
      }

      const history = data as MediaHistoryResponse;
      setTasks(history.list || []);
      setTotal(history.total || 0);
    } catch (err: any) {
      console.error('Failed to fetch media history:', err);
      setError(err.message || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  }, [user, page, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const safePage = Math.min(Math.max(nextPage, 1), totalPages);
      if (safePage === page) {
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (safePage === 1) {
        params.delete('page');
      } else {
        params.set('page', String(safePage));
      }
      params.set('limit', String(limit));
      const queryString = params.toString();
      const target = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(target);
    },
    [limit, page, pathname, router, searchParams, totalPages]
  );

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('limit', String(newLimit));
      params.delete('page'); // Reset to page 1
      const queryString = params.toString();
      const target = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(target);
    },
    [pathname, router, searchParams]
  );

  const handleRetry = useCallback(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      completed: { variant: 'default', label: 'Completed' },
      extracted: { variant: 'default', label: 'Extracted' },
      failed: { variant: 'destructive', label: 'Failed' },
      processing: { variant: 'secondary', label: 'Processing' },
      translating: { variant: 'secondary', label: 'Translating' },
      pending: { variant: 'outline', label: 'Pending' },
    };

    const config = statusMap[status] || { variant: 'outline' as const, label: status };
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const isVideoExpired = (expiresAt: Date | string | null | undefined): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const downloadSRT = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleVideoDownload = async (taskId: string) => {
    try {
      const resp = await fetch(`/api/media/video-download?id=${taskId}`);
      if (!resp.ok) {
        throw new Error('Failed to get download URL');
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message || 'Failed to get download URL');
      }

      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = `video-${taskId}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('Failed to download video:', error);
    }
  };

  const renderContent = () => {
    if (isCheckSign) {
      return (
        <div className="flex h-[40vh] items-center justify-center">
          <Skeleton className="h-6 w-40" />
        </div>
      );
    }

    if (!user) {
      return <Empty message="Please sign in to view history" />;
    }

    if (loading) {
      return (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            Retry
          </Button>
        </div>
      );
    }

    if (tasks.length === 0) {
      return <Empty message="No media tasks found" />;
    }

    return (
      <ul className="flex flex-col gap-3">
        {tasks.map((task) => (
          <li key={task.id}>
            <Card className="hover:border-primary/60 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(task.status)}
                        {task.platform && (
                          <Badge variant="outline" className="text-xs">
                            {task.platform}
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {moment(task.createdAt).fromNow()}
                        </span>
                      </div>
                      <h3 className="text-base font-medium">
                        {task.title || 'Untitled Media Task'}
                      </h3>
                      {task.sourceLang && (
                        <p className="text-muted-foreground text-sm">
                          Source: {task.sourceLang}
                          {task.targetLang && ` → Target: ${task.targetLang}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {task.subtitleRaw && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadSRT(
                            task.subtitleRaw!,
                            `subtitle-${task.id}.srt`
                          )
                        }
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download Original SRT
                      </Button>
                    )}

                    {task.subtitleTranslated && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadSRT(
                            task.subtitleTranslated!,
                            `translated-${task.id}-${task.targetLang}.srt`
                          )
                        }
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download Translated SRT
                      </Button>
                    )}

                    {task.videoUrlInternal && task.outputType === 'video' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVideoDownload(task.id)}
                        disabled={isVideoExpired(task.expiresAt)}
                      >
                        <Video className="mr-2 h-4 w-4" />
                        {isVideoExpired(task.expiresAt)
                          ? 'Video Expired'
                          : 'Download Video'}
                      </Button>
                    )}

                    {isVideoExpired(task.expiresAt) && task.videoUrlInternal && (
                      <span className="text-muted-foreground text-xs">
                        Video expired on {moment(task.expiresAt).format('MMM DD, YYYY')}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="bg-background sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-3">
        <SidebarTrigger className="size-7" />
        <div className="flex-1" />
        <LocaleSelector />
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Clock className="h-6 w-6" />
              Media Task History
            </h1>
            <p className="text-muted-foreground text-sm">
              View and download your previously extracted media tasks
            </p>
          </div>
          <section>{renderContent()}</section>
          {user && !loading && tasks.length > 0 && (
            <div className="px-2 py-4">
              <Pagination
                page={page}
                total={total}
                limit={limit}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


