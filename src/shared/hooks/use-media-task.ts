'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

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

const POLL_INTERVAL = 3000; // 3 seconds
const GENERATION_TIMEOUT = 300000; // 5 minutes

export function useMediaTask() {
  const [task, setTask] = useState<MediaTaskStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generationStartTimeRef = useRef<number | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Poll status function
  const pollStatus = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      // Check timeout
      if (generationStartTimeRef.current) {
        const elapsedTime = Date.now() - generationStartTimeRef.current;
        if (elapsedTime > GENERATION_TIMEOUT) {
          stopPolling();
          setError('Task timed out. Please try again.');
          toast.error('Task timed out. Please try again.');
          return true;
        }
      }

      const resp = await fetch(`/api/media/status?id=${taskId}`);
      if (!resp.ok) {
        throw new Error(`Request failed with status: ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message || 'Query task failed');
      }

      const taskData = data as MediaTaskStatus;
      setTask(taskData);
      setError(null);

      // Stop polling for final states
      if (
        taskData.status === 'completed' ||
        taskData.status === 'failed' ||
        taskData.status === 'extracted'
      ) {
        stopPolling();

        if (taskData.status === 'failed') {
          setError(taskData.errorMessage || 'Task failed');
          toast.error(`Task failed: ${taskData.errorMessage || 'Unknown error'}`);
        } else if (taskData.status === 'extracted') {
          toast.success('Extraction completed! You can now translate.');
        } else if (taskData.status === 'completed') {
          toast.success('Translation completed successfully!');
        }
        return true;
      }

      return false; // Continue polling
    } catch (err: any) {
      console.error('Polling error:', err);
      stopPolling();
      setError(err.message || 'Failed to query task status');
      toast.error('Failed to query task status: ' + err.message);
      return true;
    }
  }, [stopPolling]);

  // Start polling
  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling(); // Clear any existing polling
      setIsPolling(true);
      generationStartTimeRef.current = Date.now();

      // Immediate first poll
      pollStatus(taskId).then((shouldStop) => {
        if (shouldStop) return;

        // Start interval polling
        pollIntervalRef.current = setInterval(() => {
          pollStatus(taskId).then((shouldStop) => {
            if (shouldStop && pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          });
        }, POLL_INTERVAL);
      });
    },
    [pollStatus, stopPolling]
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

        // Start polling (this will update the task with real data)
        startPolling(taskId);
        return taskId;
      } catch (err: any) {
        setIsPolling(false);
        setTask(null);
        setError(err.message || 'Failed to submit task');
        toast.error('Failed to submit task: ' + err.message);
        return null;
      }
    },
    [startPolling]
  );

  // Start translation (Phase 2: Translation)
  const startTranslation = useCallback(
    async (taskId: string, targetLanguage: string): Promise<boolean> => {
      try {
        setError(null);
        generationStartTimeRef.current = Date.now();

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

        // Restart polling for translation
        startPolling(taskId);
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to start translation');
        toast.error('Failed to start translation: ' + err.message);
        return false;
      }
    },
    [startPolling]
  );

  // Get video download URL (presigned URL)
  const getVideoDownloadUrl = useCallback(
    async (taskId: string): Promise<string | null> => {
      try {
        const resp = await fetch(`/api/media/video-download?id=${taskId}`);
        if (!resp.ok) {
          throw new Error(`Request failed with status: ${resp.status}`);
        }

        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message || 'Failed to get download URL');
        }

        return data.downloadUrl || null;
      } catch (err: any) {
        console.error('Failed to get video download URL:', err);
        toast.error('Failed to get video download URL');
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
    };
  }, [stopPolling]);

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


