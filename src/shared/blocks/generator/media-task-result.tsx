'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { LazyImage } from '@/shared/blocks/common';
import { Badge } from '@/shared/components/ui/badge';

interface MediaTaskResultProps {
  mediaTaskId: string;
  taskId: string;
}

interface MediaTaskData {
  id: string;
  status: string;
  progress: number;
  srtUrl?: string;
  translatedSrtUrl?: string;
  resultVideoUrl?: string;
  errorMessage?: string;
  sourceLang?: string;
  targetLang?: string;
  title?: string;
  platform?: string;
  thumbnailUrl?: string;
  author?: string;
}

interface SrtPreviewItem {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
}

export function MediaTaskResult({
  mediaTaskId,
  taskId,
}: MediaTaskResultProps) {
  const t = useTranslations('ai.media.extractor');
  const [open, setOpen] = useState(false);
  const [taskData, setTaskData] = useState<MediaTaskData | null>(null);
  const [srtPreview, setSrtPreview] = useState<SrtPreviewItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTaskData();
    }
  }, [open, mediaTaskId]);

  const fetchTaskData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/media/status?id=${mediaTaskId}`);
      if (!resp.ok) throw new Error('Failed to fetch task data');
      const { code, data } = await resp.json();
      if (code === 0 && data) {
        setTaskData(data);
        if (data.translatedSrtUrl || data.srtUrl) {
          await fetchSrtPreview(data.translatedSrtUrl || data.srtUrl);
        }
      }
    } catch (error) {
      console.error('Failed to fetch media task:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSrtPreview = async (srtUrl: string) => {
    try {
      const resp = await fetch(srtUrl);
      const srtContent = await resp.text();
      const items = parseSrtContent(srtContent);
      setSrtPreview(items.slice(0, 10)); // First 10 items
    } catch (error) {
      console.error('Failed to fetch SRT preview:', error);
    }
  };

  const parseSrtContent = (content: string): SrtPreviewItem[] => {
    const items: SrtPreviewItem[] = [];
    const blocks = content.split(/\n\s*\n/).filter(Boolean);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const id = parseInt(lines[0]);
      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
      if (!timeMatch) continue;

      const text = lines.slice(2).join(' ').trim();
      items.push({
        id,
        startTime: timeMatch[1],
        endTime: timeMatch[2],
        text,
      });
    }

    return items;
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      extracting: 'secondary',
      translating: 'secondary',
      failed: 'destructive',
      pending: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <Video className="h-4 w-4" />
        View Details
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Media Extraction Details</SheetTitle>
            <SheetDescription>
              View subtitle extraction and translation results
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : taskData ? (
            <div className="mt-6 space-y-6">
              {/* Video Info */}
              {taskData.thumbnailUrl && (
                <div className="space-y-2">
                  <LazyImage
                    src={taskData.thumbnailUrl}
                    alt={taskData.title || 'Video thumbnail'}
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              )}

              {taskData.title && (
                <div>
                  <h3 className="font-semibold text-lg">{taskData.title}</h3>
                  {taskData.author && (
                    <p className="text-sm text-muted-foreground">
                      By {taskData.author}
                    </p>
                  )}
                  {taskData.platform && (
                    <Badge variant="outline" className="mt-2">
                      {taskData.platform}
                    </Badge>
                  )}
                </div>
              )}

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(taskData.status)}
                {taskData.progress !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    ({taskData.progress}%)
                  </span>
                )}
              </div>

              {/* Languages */}
              {(taskData.sourceLang || taskData.targetLang) && (
                <div className="flex gap-4 text-sm">
                  {taskData.sourceLang && (
                    <div>
                      <span className="text-muted-foreground">Source: </span>
                      <span className="font-medium">{taskData.sourceLang}</span>
                    </div>
                  )}
                  {taskData.targetLang && (
                    <div>
                      <span className="text-muted-foreground">Target: </span>
                      <span className="font-medium">{taskData.targetLang}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {taskData.status === 'failed' && taskData.errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-600">
                    Error: {taskData.errorMessage}
                  </p>
                </div>
              )}

              {/* SRT Preview */}
              {srtPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Subtitle Preview (First 10 entries)</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Text</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {srtPreview.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.id}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {item.startTime} → {item.endTime}
                            </TableCell>
                            <TableCell>{item.text}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              {taskData.status === 'completed' && (
                <div className="space-y-3">
                  <h4 className="font-semibold">Downloads</h4>
                  <div className="flex flex-wrap gap-2">
                    {taskData.srtUrl && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleDownload(
                            taskData.srtUrl!,
                            `native-subtitle-${taskData.id}.srt`
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('download_native_srt')}
                      </Button>
                    )}

                    {taskData.translatedSrtUrl && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleDownload(
                            taskData.translatedSrtUrl!,
                            `translated-subtitle-${taskData.id}-${taskData.targetLang}.srt`
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('download_translated_srt')}
                      </Button>
                    )}

                    {taskData.resultVideoUrl && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleDownload(
                            taskData.resultVideoUrl!,
                            `video-${taskData.id}.mp4`
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('download_video')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No data available
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}







