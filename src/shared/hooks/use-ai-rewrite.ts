import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export type RewriteStyle =
  | 'tiktok'
  | 'youtube'
  | 'redbook'
  | 'emotional'
  | 'script';

export interface UseAIRewriteReturn {
  output: string;
  isProcessing: boolean;
  error: string | null;
  generateRewrite: (taskId: string, style: RewriteStyle, userRequirement?: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for AI content rewriting with streaming support
 */
export function useAIRewrite(): UseAIRewriteReturn {
  const [output, setOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateRewrite = useCallback(
    async (taskId: string, style: RewriteStyle, userRequirement?: string) => {
      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setIsProcessing(true);
      setOutput('');
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch('/api/media/rewrite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            taskId, 
            style,
            userRequirement: userRequirement?.trim() || undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Request failed with status: ${response.status}`
          );
        }

        // Handle SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE format: data: {...}\n\n
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.done) {
                  // Stream completed
                  break;
                }

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.text) {
                  setOutput((prev) => prev + data.text);
                }
              } catch (e) {
                // Skip invalid JSON or continue on parse error
                if (e instanceof Error && e.message.includes('error')) {
                  throw e;
                }
              }
            }
          }
        }

        toast.success('AI 改写完成！');
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled, don't show error
          return;
        }

        const errorMessage = err.message || 'Failed to generate rewrite';
        setError(errorMessage);
        toast.error(errorMessage);
        console.error('Rewrite error:', err);
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setOutput('');
    setError(null);
    setIsProcessing(false);
    abortControllerRef.current = null;
  }, []);

  return {
    output,
    isProcessing,
    error,
    generateRewrite,
    reset,
  };
}
