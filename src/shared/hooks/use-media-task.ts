'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getSupabaseClient } from '@/core/supabase/client';

export interface MediaTaskStatus {
  id: string;
  status: 'pending' | 'processing' | 'extracted' | 'translating' | 'completed' | 'failed';
  progress: number;
  srtUrl?: string;
  translatedSrtUrl?: string;
  resultVideoUrl?: string;
  errorMessage?: string;
  sourceLang?: string;
  targetLang?: string;
  title?: string;
  platform?: string;
  // New fields
  subtitleRaw?: string;
  subtitleTranslated?: string;
  subtitleRewritten?: string;
  videoUrlInternal?: string;
  expiresAt?: string;
  outputType?: 'subtitle' | 'video';
  // Metadata
  author?: string;
  likes?: number;
  views?: number;
  shares?: number;
  thumbnailUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 前端轮询策略（防尸体任务）
const POLL_BACKOFF = [2000, 5000, 10000, 20000]; // 2s, 5s, 10s, 20s
const HARD_TIMEOUT = 120000; // 2 minutes (前端硬超时，防止无限等待)
const REALTIME_FALLBACK_DELAY = 20000; // 20 seconds

export function useMediaTask() {
  const [task, setTask] = useState<MediaTaskStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptRef = useRef<number>(0);
  const generationStartTimeRef = useRef<number | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  const realtimeFallbackRef = useRef<NodeJS.Timeout | null>(null);
  const isFinalizedRef = useRef<boolean>(false);
  const expectedFinalRef = useRef<'extracted' | 'completed'>('extracted');
  const lastUpdatedAtRef = useRef<number | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollAttemptRef.current = 0;
    setIsPolling(false);
  }, []);

  const cleanupRealtime = useCallback(() => {
    if (realtimeFallbackRef.current) {
      clearTimeout(realtimeFallbackRef.current);
      realtimeFallbackRef.current = null;
    }
    if (realtimeChannelRef.current) {
      try {
        const supabase = getSupabaseClient();
        supabase.removeChannel(realtimeChannelRef.current);
      } catch {
        // Ignore cleanup errors
      }
      realtimeChannelRef.current = null;
    }
  }, []);

  const isFinalStatus = useCallback((taskData: MediaTaskStatus) => {
    if (taskData.status === 'failed' || taskData.status === 'completed') {
      return true;
    }
    if (taskData.status === 'extracted' && expectedFinalRef.current === 'extracted') {
      return true;
    }
    return false;
  }, []);

  const handleTaskUpdate = useCallback(
    (taskData: MediaTaskStatus, _source: 'poll' | 'realtime') => {
      if (taskData.updatedAt) {
        const updatedAt = Date.parse(taskData.updatedAt);
        const lastUpdatedAt = lastUpdatedAtRef.current;
        if (lastUpdatedAt && updatedAt <= lastUpdatedAt) {
          return;
        }
        lastUpdatedAtRef.current = updatedAt;
      }

      setTask(taskData);
      setError(null);

      if (isFinalStatus(taskData)) {
        if (!isFinalizedRef.current) {
          isFinalizedRef.current = true;
          stopPolling();
          cleanupRealtime();

          if (taskData.status === 'failed') {
            const isTimeout =
              taskData.errorMessage?.includes('timeout') &&
              taskData.errorMessage?.includes('watchdog');
            if (isTimeout) {
              setError('Task timed out. Your credits were not consumed.');
              toast.error(
                'The task took too long and was stopped. Your credits were not consumed.'
              );
            } else {
              setError(taskData.errorMessage || 'Task failed');
              toast.error(`Task failed: ${taskData.errorMessage || 'Unknown error'}`);
            }
          } else if (taskData.status === 'extracted') {
            toast.success('Extraction completed! You can now translate.');
          } else if (taskData.status === 'completed') {
            toast.success('Translation completed successfully!');
          }
        }
      }
    },
    [cleanupRealtime, isFinalStatus, stopPolling]
  );

  // Poll status function (防尸体任务版)
  const pollStatus = useCallback(async (taskId: string): Promise<'stop' | 'continue' | 'retry'> => {
    try {
      // ⛔ 前端硬超时检查（防尸体核心）
      // 前端永远不能假设后端一定活着，只相信时间和最终态
      if (generationStartTimeRef.current) {
        const elapsedTime = Date.now() - generationStartTimeRef.current;
        if (elapsedTime > HARD_TIMEOUT) {
          stopPolling();
          setError('Task timed out. Your credits were not consumed. Please try again.');
          toast.error('The task took too long and was stopped. Your credits were not consumed.');
          return 'stop';
        }
      }

      const resp = await fetch(`/api/media/status?id=${taskId}`);
      if (!resp.ok) {
        const error = new Error(`Request failed with status: ${resp.status}`);
        (error as any).status = resp.status;
        throw error;
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        const error = new Error(message || 'Query task failed');
        (error as any).code = code;
        throw error;
      }

      const taskData = data as MediaTaskStatus;
      handleTaskUpdate(taskData, 'poll');

      if (isFinalStatus(taskData)) {
        return 'stop';
      }

      // pending / processing → 继续轮询
      // 前端只相信时间和最终态，不假设 processing 一定会结束

      return 'continue'; // Continue polling
    } catch (err: any) {
      const status = err?.status as number | undefined;
      const message = err?.message || 'Failed to query task status';
      const isAuthTimeout = typeof message === 'string' && message.includes('Auth Timeout');
      const isServerError = status !== undefined && status >= 500;

      console.error('Polling error:', { message, status });

      // 对 500 或 Auth Timeout 做重试，避免直接报错给用户
      if (isAuthTimeout || isServerError) {
        setError(null);
        return 'retry';
      }

      // 其他错误直接停止
      cleanupRealtime();
      stopPolling();
      setError(message);
      toast.error('Failed to query task status: ' + message);
      return 'stop';
    }
  }, [cleanupRealtime, handleTaskUpdate, isFinalStatus, stopPolling]);

  const scheduleNextPoll = useCallback((taskId: string) => {
    const index = Math.min(pollAttemptRef.current, POLL_BACKOFF.length - 1);
    const delay = POLL_BACKOFF[index];
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    pollTimeoutRef.current = setTimeout(() => {
      pollStatus(taskId).then((result) => {
        if (result === 'stop') {
          return;
        }
        pollAttemptRef.current += 1;
        scheduleNextPoll(taskId);
      });
    }, delay);
  }, [pollStatus]);

  const startPolling = useCallback(
    (taskId: string) => {
      if (pollTimeoutRef.current || isFinalizedRef.current) {
        return;
      }
      stopPolling();
      setIsPolling(true);
      pollAttemptRef.current = 0;
      scheduleNextPoll(taskId);
    },
    [scheduleNextPoll, stopPolling]
  );

  const startRealtime = useCallback(
    (taskId: string) => {
      cleanupRealtime();
      isFinalizedRef.current = false;
      lastUpdatedAtRef.current = null;
      setIsPolling(true);

      let supabase;
      try {
        supabase = getSupabaseClient();
      } catch (error: any) {
        console.warn('[Realtime] Supabase client unavailable, fallback to polling', {
          error: error.message,
        });
        startPolling(taskId);
        return;
      }

      const scheduleFallback = () => {
        if (realtimeFallbackRef.current) {
          clearTimeout(realtimeFallbackRef.current);
        }
        realtimeFallbackRef.current = setTimeout(() => {
          realtimeFallbackRef.current = null;
          if (!isFinalizedRef.current) {
            startPolling(taskId);
          }
        }, REALTIME_FALLBACK_DELAY);
      };

      // Bootstrap: fetch once to display progress immediately
      // Do not start polling immediately on retry; wait for fallback timer.
      pollStatus(taskId).catch(() => {
        // Ignore bootstrap errors; fallback timer handles polling if needed.
      });

      const channel = supabase
        .channel(`task-status-${taskId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'media_tasks',
            filter: `id=eq.${taskId}`,
          },
          (payload: any) => {
            const taskData = payload.new as MediaTaskStatus;
            handleTaskUpdate(taskData, 'realtime');
            scheduleFallback();
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            scheduleFallback();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            startPolling(taskId);
          }
        });

      realtimeChannelRef.current = channel;
    },
    [cleanupRealtime, handleTaskUpdate, pollStatus, startPolling]
  );

  // Submit task (Phase 1: Extraction)
  const submitTask = useCallback(
    async (
      url: string,
      outputType: 'subtitle' | 'video',
      targetLang?: string
    ): Promise<string | null> => {
      try {
        setError(null);
        
        // Set immediate loading state to show feedback right away
        setIsPolling(true);
        setTask({
          id: 'pending',
          status: 'pending',
          progress: 0,
        } as MediaTaskStatus);

        const resp = await fetch('/api/media/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url.trim(),
            outputType,
            targetLang: targetLang || undefined,
          }),
        });

        if (!resp.ok) {
          throw new Error(`Request failed with status: ${resp.status}`);
        }

        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message || 'Failed to submit task');
        }

        const taskId = data.taskId;
        if (!taskId) {
          throw new Error('No task ID returned');
        }

        // Start realtime first, polling will be used as fallback
        expectedFinalRef.current = 'extracted';
        generationStartTimeRef.current = Date.now();
        startRealtime(taskId);
        return taskId;
      } catch (err: any) {
        setIsPolling(false);
        setTask(null);
        setError(err.message || 'Failed to submit task');
        toast.error('Failed to submit task: ' + err.message);
        return null;
      }
    },
    [startRealtime]
  );

  // Start translation (Phase 2: Translation)
  const startTranslation = useCallback(
    async (taskId: string, targetLanguage: string): Promise<boolean> => {
      try {
        setError(null);
        generationStartTimeRef.current = Date.now();
        expectedFinalRef.current = 'completed';
        setIsPolling(true);

        const resp = await fetch('/api/media/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId,
            targetLanguage,
          }),
        });

        if (!resp.ok) {
          throw new Error(`Request failed with status: ${resp.status}`);
        }

        const { code, message } = await resp.json();
        if (code !== 0) {
          throw new Error(message || 'Failed to start translation');
        }

        // Restart realtime (polling fallback) for translation
        startRealtime(taskId);
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to start translation');
        toast.error('Failed to start translation: ' + err.message);
        return false;
      }
    },
    [startRealtime]
  );

  // Get video download URL (presigned URL) with caching and timeout protection
  const signedUrlCacheRef = useRef<Record<string, string>>({});
  const getVideoDownloadUrl = useCallback(
    async (taskId: string): Promise<string | null> => {
      // 1. 缓存命中检查，避免重复请求
      if (signedUrlCacheRef.current[taskId]) {
        return signedUrlCacheRef.current[taskId];
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒硬熔断

      try {
        const resp = await fetch(`/api/media/video-download?id=${taskId}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
          throw new Error(`Request failed with status: ${resp.status}`);
        }

        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message || 'Failed to get download URL');
        }

        const downloadUrl = data.downloadUrl || null;
        if (downloadUrl) {
          // 存入缓存
          signedUrlCacheRef.current[taskId] = downloadUrl;
        }
        return downloadUrl;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          // 超时：静默失败，返回 null（用户仍可通过下载按钮使用 proxy）
          console.warn('[Video Download] Request timeout, URL will be fetched on-demand via download button');
          return null;
        }
        // 其他错误：也返回 null，不抛出（避免干扰用户体验）
        console.warn('[Video Download] Failed to get URL, will use proxy on download:', err.message);
        return null;
      }
    },
    []
  );

  // Reset task state (for starting a new task)
  const resetTask = useCallback(() => {
    stopPolling();
    setTask(null);
    setError(null);
    generationStartTimeRef.current = null;
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      cleanupRealtime();
    };
  }, [cleanupRealtime, stopPolling]);

  return {
    task,
    isPolling,
    error,
    submitTask,
    startTranslation,
    getVideoDownloadUrl,
    resetTask,
  };
}


