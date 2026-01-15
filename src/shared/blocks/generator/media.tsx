'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  FileVideo,
  Info,
  Loader2,
  Sparkles,
  Type,
  User,
  Video,
  X,
  Zap,
  Send,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Progress } from '@/shared/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useAppContext } from '@/shared/contexts/app';
import { useMediaTask } from '@/shared/hooks/use-media-task';
import { useDynamicStatus } from '@/shared/hooks/use-dynamic-status';
import { cn } from '@/shared/lib/utils';
import { getEstimatedCreditsCost } from '@/shared/config/plans';
import {
  downloadSRT,
  downloadTXT,
  downloadVTT,
  sanitizeFileName,
} from '@/shared/utils/subtitle-download';
import { useAIRewrite, RewriteStyle } from '@/shared/hooks/use-ai-rewrite';

interface MediaExtractorProps {
  srOnlyTitle?: string;
  className?: string;
}

// MediaTaskStatus is now imported from use-media-task hook

const TARGET_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'it', label: 'Italian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];

// AI Rewrite Center Component
interface AIRewriteCenterProps {
  taskId: string;
  originalText: string;
  rewrittenText?: string;
  title?: string;
  author?: string;
}

function AIRewriteCenter({
  taskId,
  originalText,
  rewrittenText: initialRewrittenText,
  title,
  author,
}: AIRewriteCenterProps) {
  const t = useTranslations('ai.media.extractor.rewrite');
  const { output, isProcessing, error, generateRewrite, reset } = useAIRewrite();
  const [selectedStyle, setSelectedStyle] = useState<RewriteStyle>('tiktok');
  const [hasCopied, setHasCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [userRequirement, setUserRequirement] = useState<string>('');
  
  // Quick requirement tags - using translations
  const quickTags = [
    { key: 'more_humorous', tag: t('custom_requirement.quick_tags.more_humorous') },
    { key: 'shorter', tag: t('custom_requirement.quick_tags.shorter') },
    { key: 'more_professional', tag: t('custom_requirement.quick_tags.more_professional') },
    { key: 'more_emojis', tag: t('custom_requirement.quick_tags.more_emojis') },
    { key: 'question_style', tag: t('custom_requirement.quick_tags.question_style') },
    { key: 'stronger_cta', tag: t('custom_requirement.quick_tags.stronger_cta') },
  ];
  
  // Character limit (500 chars)
  const MAX_REQUIREMENT_LENGTH = 500;
  const charCount = userRequirement.length;
  const isNearLimit = charCount > MAX_REQUIREMENT_LENGTH * 0.8; // 80% = 400 chars
  const isOverLimit = charCount > MAX_REQUIREMENT_LENGTH;

  // Priority: output (streaming) > initialRewrittenText (saved) > empty
  const displayText = output || initialRewrittenText || '';
  const hasExistingRewrite = !!initialRewrittenText && !output;

  const styles: Array<{ id: RewriteStyle; label: string; icon: string }> = [
    { id: 'tiktok', label: t('styles.tiktok'), icon: '🔥' },
    { id: 'youtube', label: t('styles.youtube'), icon: '📺' },
    { id: 'redbook', label: t('styles.redbook'), icon: '📖' },
    { id: 'emotional', label: t('styles.emotional'), icon: '💫' },
    { id: 'script', label: t('styles.script'), icon: '🎬' },
  ];

  const handleRewrite = async () => {
    reset();
    await generateRewrite(taskId, selectedStyle, userRequirement.trim() || undefined);
  };
  
  const handleQuickTag = (tag: string) => {
    if (userRequirement.trim()) {
      setUserRequirement((prev) => `${prev}，${tag}`);
    } else {
      setUserRequirement(tag);
    }
  };

  const handleCopy = async () => {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      setHasCopied(true);
      toast.success(t('actions.copy_success'));
      setTimeout(() => setHasCopied(false), 2000);
    } catch (error) {
      toast.error(t('actions.copy_failed'));
    }
  };

  const handleExport = (format: 'txt' | 'srt') => {
    if (!displayText) return;
    const blob = new Blob([displayText], {
      type: format === 'txt' ? 'text/plain' : 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Use friendly filename based on title and author
    const safeAuthor = (author || 'User').trim();
    const safeTitle = (title || 'Video').trim();
    const fileName = sanitizeFileName(safeAuthor, safeTitle, format);
    link.download = fileName.replace(`.${format}`, `_rewritten_${selectedStyle}.${format}`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(t('actions.export_success', { format: format.toUpperCase() }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold">{t('title')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {isProcessing
            ? t('status.generating')
            : hasExistingRewrite
            ? t('status.saved')
            : displayText
            ? t('status.completed')
            : t('status.pending')}
        </Badge>
      </div>

      {/* Style Selector */}
      <div className="flex flex-wrap gap-2">
        {styles.map((style) => (
          <Button
            key={style.id}
            variant={selectedStyle === style.id ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setSelectedStyle(style.id)}
            disabled={isProcessing}
          >
            <span className="mr-1">{style.icon}</span>
            {style.label}
          </Button>
        ))}
      </div>

      {/* Custom Requirement Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <label className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-3 bg-purple-500 rounded-full" />
            {t('custom_requirement.label')}
          </label>
          <span className="text-[10px] text-muted-foreground italic">
            {t('custom_requirement.example')}
          </span>
        </div>

        {/* Requirement Input Box with Breathing Light Effect */}
        <div className="relative group">
          {/* Breathing light background layer - purple gradient */}
          <div 
            className={`absolute -inset-0.5 rounded-xl blur transition-all duration-1000 ${
              isOverLimit 
                ? 'bg-gradient-to-r from-red-600 to-orange-600 opacity-40 animate-pulse' 
                : isNearLimit
                ? 'bg-gradient-to-r from-orange-600 to-yellow-600 opacity-30'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 opacity-20 group-hover:opacity-40 group-focus-within:animate-pulse'
            }`}
          />
          
          {/* Actual textarea */}
          <Textarea
            value={userRequirement}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= MAX_REQUIREMENT_LENGTH) {
                setUserRequirement(value);
              }
            }}
            placeholder={t('custom_requirement.placeholder')}
            className={`relative w-full min-h-[100px] bg-background/60 backdrop-blur-xl border border-primary/20 rounded-xl p-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none ${
              isOverLimit ? 'border-red-500/50' : isNearLimit ? 'border-orange-500/50' : ''
            }`}
            disabled={isProcessing}
          />
          
          {/* Character count and reset button */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {userRequirement.length > 0 && (
              <button 
                onClick={() => setUserRequirement('')}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors bg-background/50 px-2 py-1 rounded-md"
                disabled={isProcessing}
              >
                {t('custom_requirement.reset')}
              </button>
            )}
            <div className={`text-[10px] px-2 py-1 rounded-md ${
              isOverLimit 
                ? 'text-red-500 bg-red-500/10' 
                : isNearLimit 
                ? 'text-orange-500 bg-orange-500/10'
                : 'text-muted-foreground bg-background/50'
            }`}>
              {charCount}/{MAX_REQUIREMENT_LENGTH}
            </div>
            <div className={`w-1.5 h-1.5 rounded-full ${
              userRequirement 
                ? isOverLimit 
                  ? 'bg-red-500 animate-ping' 
                  : isNearLimit
                  ? 'bg-orange-500 animate-pulse'
                  : 'bg-purple-500 animate-pulse'
                : 'bg-muted-foreground/20'
            }`} />
          </div>
        </div>

        {/* Quick Requirement Tags */}
        <div className="flex flex-wrap gap-2 pt-1">
          {quickTags.map(({ key, tag }) => (
            <button
              key={key}
              onClick={() => handleQuickTag(tag)}
              disabled={isProcessing || isOverLimit}
              className="text-[10px] px-2 py-1 rounded-md border border-border bg-background/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Content Preview Area */}
      <div className="relative min-h-[200px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
        {!displayText && !isProcessing && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center space-y-3 text-center">
            <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-muted-foreground">
              {t('custom_requirement.start_rewrite')}
            </p>
            {hasExistingRewrite && (
              <p className="text-xs text-muted-foreground/70">
                💡 {t('status.saved')}
              </p>
            )}
          </div>
        )}

        {isProcessing && !displayText && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('status.generating')}</p>
          </div>
        )}

        {displayText && (
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed"
            aria-live="polite"
          >
            {displayText}
            {isProcessing && (
              <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-3 mt-2">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            onClick={handleRewrite}
            disabled={isProcessing || isOverLimit}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('status.generating')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {userRequirement.trim() ? t('custom_requirement.rewrite_with_requirement') : t('custom_requirement.start_rewrite')}
              </>
            )}
          </Button>

          {displayText && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {hasCopied ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    {t('actions.copy_success')}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    {t('actions.copy')}
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('txt')}
              >
                <FileText className="mr-2 h-4 w-4" />
                {t('actions.export_txt')}
              </Button>
            </>
          )}
        </div>

        {originalText && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginal(!showOriginal)}
          >
            {showOriginal ? t('actions.hide_original', { defaultValue: 'Hide' }) : t('actions.show_original', { defaultValue: 'Show' })} {t('actions.original_text', { defaultValue: 'Original' })}
          </Button>
        )}
      </div>

      {/* Original Text Preview (Collapsible) */}
      {showOriginal && originalText && (
        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('actions.original_text', { defaultValue: 'Original Text' })}:</p>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
            {originalText}
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaExtractor({
  className,
  srOnlyTitle,
}: MediaExtractorProps) {
  const t = useTranslations('ai.media');
  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits, fetchUserInfo } =
    useAppContext();

  // Use media task hook
  const {
    task: taskStatus,
    isPolling,
    error: taskError,
    submitTask,
    startTranslation,
    getVideoDownloadUrl,
    resetTask,
  } = useMediaTask();

  // Form state
  const [url, setUrl] = useState('');
  const [targetLang, setTargetLang] = useState<string>('');
  const [outputType, setOutputType] = useState<'subtitle' | 'video'>(
    'subtitle'
  );
  const [selectedTranslationLang, setSelectedTranslationLang] = useState<string>('');
  const [directDownloadUrl, setDirectDownloadUrl] = useState<string | null>(null);
  
  // Plan and check-in state
  const [userPlanInfo, setUserPlanInfo] = useState<{
    planType?: string;
    freeTrialUsed?: number;
    freeTrialCount?: number;
    planLimits?: {
      maxVideoDuration?: number | null;
      concurrentLimit?: number | null;
      translationCharLimit?: number | null;
    };
  } | null>(null);
  const [canCheckIn, setCanCheckIn] = useState<boolean>(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  
  // Computed: is extracting (processing or pending)
  const isExtracting = isPolling && (taskStatus?.status === 'processing' || taskStatus?.status === 'pending');
  
  // Dynamic status for extraction/translation process
  const dynamicStatus = useDynamicStatus({
    isProcessing: isPolling && (taskStatus?.status === 'processing' || taskStatus?.status === 'translating' || taskStatus?.status === 'pending'),
    mode: taskStatus?.status === 'translating' ? 'translation' : 'extraction',
  });
  
  // Calculate estimated credits cost
  // For video output type, assume video-only (no subtitle extraction)
  // User can still get subtitles if available, but won't be charged for extraction
  const videoOnly = outputType === 'video';
  const estimatedCredits = getEstimatedCreditsCost(outputType, false, videoOnly);
  const estimatedCreditsWithTranslation = getEstimatedCreditsCost(outputType, true, videoOnly);
  
  // Fetch user plan info and check-in status
  useEffect(() => {
    if (user?.id) {
      // Fetch plan info from user object (already includes planType, freeTrialUsed, planLimits)
      if ((user as any).planType !== undefined) {
        setUserPlanInfo({
          planType: (user as any).planType as string,
          freeTrialUsed: (user as any).freeTrialUsed as number,
          freeTrialCount: (user as any).planLimits?.freeTrialCount,
          planLimits: (user as any).planLimits,
        });
      }
      
      // Fetch check-in status
      fetch('/api/user/checkin-status')
        .then(res => res.json())
        .then(data => {
          if (data.code === 0) {
            setCanCheckIn(data.data.canCheckIn);
          }
        })
        .catch(err => console.error('Failed to fetch check-in status:', err));
    }
  }, [user]);

  // Fetch direct download URL when video is ready (with duplicate request prevention)
  const fetchingUrlRef = useRef<boolean>(false);
  useEffect(() => {
    let isMounted = true;
    
    const fetchDirectUrl = async () => {
      if (
        taskStatus?.id &&
        taskStatus?.outputType === 'video' &&
        taskStatus?.videoUrlInternal &&
        (taskStatus?.status === 'extracted' || taskStatus?.status === 'completed') &&
        !directDownloadUrl && // 避免重复请求
        !fetchingUrlRef.current // 防止并发请求
      ) {
        fetchingUrlRef.current = true;
        try {
          const url = await getVideoDownloadUrl(taskStatus.id);
          if (isMounted && url) {
            setDirectDownloadUrl(url);
          }
          // 如果 url 为 null（超时或失败），静默处理，不显示错误
          // 用户仍可通过下载按钮使用 proxy 下载
        } catch (error: any) {
          // 这个 catch 现在不应该被触发（因为 getVideoDownloadUrl 返回 null 而不是抛出）
          // 但保留作为安全网
          if (isMounted) {
            console.warn('Failed to fetch direct download URL (will use proxy on download):', error.message);
          }
        } finally {
          fetchingUrlRef.current = false;
        }
      } else if (!taskStatus?.videoUrlInternal || 
                 (taskStatus?.status !== 'extracted' && taskStatus?.status !== 'completed')) {
        // 清理状态
        if (isMounted) {
          setDirectDownloadUrl(null);
        }
      }
    };

    fetchDirectUrl();
    
    return () => {
      isMounted = false;
    };
  }, [taskStatus?.id, taskStatus?.outputType, taskStatus?.videoUrlInternal, taskStatus?.status, getVideoDownloadUrl, directDownloadUrl]);
  
  // Handle daily check-in
  const handleCheckIn = async () => {
    if (!user || isCheckingIn) return;
    
    setIsCheckingIn(true);
    try {
      const resp = await fetch('/api/user/checkin', {
        method: 'POST',
      });
      
      const data = await resp.json();
      if (data.code === 0) {
        toast.success(`Check-in successful! You earned ${data.data.addedCredits} credits.`);
        setCanCheckIn(false);
        await fetchUserCredits();
        await fetchUserInfo(); // Refresh user info
      } else {
        toast.error(data.message || 'Check-in failed');
      }
    } catch (error: any) {
      toast.error('Check-in failed: ' + error.message);
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Generate friendly filename from task metadata
  const getFriendlyFileName = (extension: string, suffix?: string): string => {
    if (!taskStatus) {
      return `video.${extension}`;
    }
    
    const author = taskStatus.author || 'User';
    const title = taskStatus.title || 'Video';
    const baseName = sanitizeFileName(author, title, extension);
    
    // Remove extension, add suffix if provided, then add extension back
    if (suffix) {
      const nameWithoutExt = baseName.replace(`.${extension}`, '');
      return `${nameWithoutExt}_${suffix}.${extension}`;
    }
    
    return baseName;
  };

  // CSV Export function
  const exportToCSV = () => {
    if (!taskStatus) return;

    const headers = [
      'Title',
      'Platform',
      'Author',
      'Views',
      'Likes',
      'Shares',
      'Source Language',
      'Target Language',
      'Original Subtitle',
      'Translated Subtitle',
      'Video URL',
      'Expires At',
    ];

    const escapeCSV = (text: string | null | undefined): string => {
      if (!text) return '';
      return `"${String(text).replace(/"/g, '""')}"`;
    };

    const row = [
      escapeCSV(taskStatus.title),
      taskStatus.platform || '',
      escapeCSV(taskStatus.author),
      taskStatus.views?.toString() || '0',
      taskStatus.likes?.toString() || '0',
      taskStatus.shares?.toString() || '0',
      taskStatus.sourceLang || 'auto',
      taskStatus.targetLang || '',
      escapeCSV(taskStatus.subtitleRaw),
      escapeCSV(taskStatus.subtitleTranslated),
      taskStatus.videoUrlInternal || '',
      taskStatus.expiresAt || '',
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      headers.join(',') +
      '\n' +
      row.join(',');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    // Use friendly filename for CSV export
    const csvFileName = getFriendlyFileName('csv', 'export').replace('.csv', '') || `media_export_${taskStatus.id}`;
    link.setAttribute('download', `${csvFileName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV exported successfully');
  };


  // Handle video download (try direct download first, fallback to proxy)
  const handleVideoDownload = async () => {
    if (!taskStatus?.id) return;

    try {
      // Show loading state
      toast.loading('Preparing video download...', { id: 'video-download' });

      const triggerDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        // Use friendly filename based on metadata
        link.download = getFriendlyFileName('mp4');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      // Try to get signed download URL (may timeout, that's OK)
      let downloadUrl: string | null = null;
      try {
        downloadUrl = await getVideoDownloadUrl(taskStatus.id);
      } catch (error: any) {
        // getVideoDownloadUrl should not throw, but if it does, continue to proxy
        console.warn('[Video Download] Failed to get signed URL, using proxy:', error.message);
      }

      // If we have a signed URL, try direct download first
      if (downloadUrl) {
        try {
          const headResp = await fetch(downloadUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000), // 3 second timeout for HEAD check
          });
          if (headResp.ok) {
            triggerDownload(downloadUrl);
            toast.success('Video download started', { id: 'video-download' });
            return;
          }
          console.warn('Direct download HEAD check failed, falling back to proxy');
        } catch (headError: any) {
          console.warn('Direct download HEAD check error, falling back to proxy:', headError.message);
          // Continue to proxy fallback
        }
      }

      // Fallback: Use proxy API for download (same-origin, always works)
      // This is the reliable path when signed URL fails or times out
      const proxyUrl = `/api/media/download-proxy?id=${taskStatus.id}`;
      triggerDownload(proxyUrl);
      
      if (!downloadUrl) {
        // Only show info if we never got a signed URL (silent fallback)
        toast.success('Video download started', { id: 'video-download' });
      } else {
        // Show info if direct download failed but we have proxy
        toast.info('Using backup download method', { id: 'video-download' });
        toast.success('Video download started', { id: 'video-download' });
      }
    } catch (error: any) {
      console.error('Video download error:', error);
      const errorMessage = error.message || 'Failed to download video';
      
      // Provide more helpful error messages
      if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        toast.error('Download timeout. The video file may be too large. Please try again.', { id: 'video-download' });
      } else if (errorMessage.includes('not available') || errorMessage.includes('not found') || errorMessage.includes('404')) {
        toast.error('Video file is not available. It may have expired or been deleted.', { id: 'video-download' });
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('Forbidden') || errorMessage.includes('401') || errorMessage.includes('403')) {
        toast.error('You do not have permission to download this video.', { id: 'video-download' });
      } else {
        toast.error(`Download failed: ${errorMessage}`, { id: 'video-download' });
      }
    }
  };

  // Copy direct download URL to clipboard
  const copyDirectUrl = async () => {
    if (!directDownloadUrl) return;
    
    try {
      await navigator.clipboard.writeText(directDownloadUrl);
      toast.success('Download link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy link');
    }
  };

  // Open direct download URL in new tab
  const openDirectUrl = () => {
    if (!directDownloadUrl) return;
    window.open(directDownloadUrl, '_blank');
  };

  // Start a new task (reset all states)
  const handleStartNewTask = () => {
    // Reset task state
    resetTask();
    
    // Clear form inputs
    setUrl('');
    setTargetLang('');
    setSelectedTranslationLang('');
    
    // Clear direct download URL
    setDirectDownloadUrl(null);
    
    // Reset output type to default
    setOutputType('subtitle');
    
    // Show success message
    toast.success('Ready for a new task! Enter a new URL to start.');
    
    // Scroll to top to show the input form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExtract = async () => {
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    if (!url.trim()) {
      toast.error('Please enter a video URL');
      return;
    }

    // Validate URL (supports YouTube Shorts)
    const isValidUrl =
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('tiktok.com') ||
      url.includes('vm.tiktok.com');

    if (!isValidUrl) {
      toast.error(t('extractor.invalid_url'));
      return;
    }

    // Validate output type - Both TikTok and YouTube support video download now
    // No need to restrict video download to TikTok only

    // Check credits (only for extraction, translation credits checked separately)
    if (user) {
      // For video output type, only charge for video download (15 credits)
      // For subtitle output type, charge for subtitle extraction (10 credits)
      let requiredCredits = outputType === 'video' ? 15 : 10;

      let userCredits = 0;
      if (user.credits) {
        if (
          typeof user.credits === 'object' &&
          'remainingCredits' in user.credits
        ) {
          userCredits = user.credits.remainingCredits || 0;
        } else if (typeof user.credits === 'number') {
          userCredits = user.credits;
        }
      }

      if (userCredits < requiredCredits) {
        toast.error(
          t('extractor.insufficient_credits') +
            ` (需要 ${requiredCredits} 积分，当前 ${userCredits} 积分)`
        );
        try {
          await fetchUserCredits();
        } catch (e) {
          console.error('Failed to refresh credits:', e);
        }
        return;
      }
    }

    // Submit task using hook (hook will handle loading state)
    const taskId = await submitTask(url.trim(), outputType);
    if (taskId) {
      fetchUserCredits();
    }
  };

  const handleTranslate = async () => {
    if (!taskStatus?.id) return;

    if (!selectedTranslationLang) {
      toast.error('Please select a target language');
      return;
    }

    // Check credits for translation
    if (user) {
      const requiredCredits = 5; // Translation costs 5 credits

      let userCredits = 0;
      if (user.credits) {
        if (
          typeof user.credits === 'object' &&
          'remainingCredits' in user.credits
        ) {
          userCredits = user.credits.remainingCredits || 0;
        } else if (typeof user.credits === 'number') {
          userCredits = user.credits;
        }
      }

      if (userCredits < requiredCredits) {
        toast.error(
          t('extractor.insufficient_credits') +
            ` (需要 ${requiredCredits} 积分，当前 ${userCredits} 积分)`
        );
        try {
          await fetchUserCredits();
        } catch (e) {
          console.error('Failed to refresh credits:', e);
        }
        return;
      }
    }

    const success = await startTranslation(taskStatus.id, selectedTranslationLang);
    if (success) {
      fetchUserCredits();
    }
  };

  const getStatusText = () => {
    if (!taskStatus) return '';
    
    // Use dynamic status during processing
    if (isPolling && (taskStatus.status === 'processing' || taskStatus.status === 'translating' || taskStatus.status === 'pending')) {
      return dynamicStatus.currentLabel;
    }
    
    switch (taskStatus.status) {
      case 'pending':
        return t('extractor.status.pending');
      case 'processing':
        return t('extractor.status.processing');
      case 'extracted':
        return t('extractor.status.extracted');
      case 'translating':
        return t('extractor.status.translating');
      case 'completed':
        return t('extractor.status.completed');
      case 'failed':
        return t('extractor.status.failed');
      default:
        return t('extractor.extracting');
    }
  };

  const getProgressText = () => {
    if (!taskStatus) return '';
    
    // Use dynamic status during processing
    if (isPolling && (taskStatus.status === 'processing' || taskStatus.status === 'translating' || taskStatus.status === 'pending')) {
      return dynamicStatus.currentLabel;
    }
    
    if (taskStatus.status === 'translating') {
      return 'Gemini is translating (approx. 1 min)...';
    }
    if (taskStatus.status === 'processing') {
      return 'Extracting media... This may take up to 2 minutes.';
    }
    if (taskStatus.status === 'extracted') {
      return 'Extraction successful! You can now translate.';
    }
    return '';
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          {srOnlyTitle ? (
            <span className="sr-only">{srOnlyTitle}</span>
          ) : (
            t('extractor.title')
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL Input */}
        <div className="space-y-2">
          <Label htmlFor="media-url">{t('extractor.url_label')}</Label>
          <div className="flex gap-2">
            <Input
              id="media-url"
              type="url"
              placeholder={t('extractor.url_placeholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isExtracting}
              className="flex-1"
            />
            {url && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setUrl('')}
                disabled={isExtracting}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 3 Button Layout: Source Language (Read-only), Target Language, Output Type */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Button 1: Source Language (Read-only) */}
          <div className="space-y-2">
            <Label>{t('extractor.source_lang_label') || 'Source Language'}</Label>
            <Input
              value={
                taskStatus?.sourceLang
                  ? TARGET_LANGUAGES.find((l) => l.value === taskStatus.sourceLang)
                      ?.label || taskStatus.sourceLang
                  : 'Auto'
              }
              disabled
              className="bg-muted"
              placeholder="Detecting..."
            />
          </div>

          {/* Button 2: Target Language Select */}
          <div className="space-y-2">
            <Label htmlFor="target-lang">
              {t('extractor.target_lang_label') || 'Target Language'}
            </Label>
            <Select
              value={
                taskStatus?.status === 'extracted' || taskStatus?.status === 'translating' || taskStatus?.status === 'completed'
                  ? selectedTranslationLang || taskStatus.targetLang || ''
                  : targetLang
              }
              onValueChange={(value) => {
                if (taskStatus?.status === 'extracted') {
                  setSelectedTranslationLang(value);
                } else {
                  setTargetLang(value);
                }
              }}
              disabled={isPolling && taskStatus?.status !== 'extracted'}
            >
              <SelectTrigger id="target-lang">
                <SelectValue
                  placeholder={t('extractor.target_lang_placeholder') || 'Select language'}
                />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Button 3: Output Type Select */}
          <div className="space-y-2">
            <Label htmlFor="output-type">
              {t('extractor.output_type_label') || 'Output Type'}
            </Label>
            <Select
              value={outputType}
              onValueChange={(value) =>
                setOutputType(value as 'subtitle' | 'video')
              }
              disabled={isPolling}
            >
              <SelectTrigger id="output-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subtitle">
                  {t('extractor.output_type_subtitle') || 'Subtitle'}
                </SelectItem>
                <SelectItem value="video">
                  {t('extractor.output_type_video') || 'Video'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Estimated Credits Cost Display */}
        {user && url.trim() && (
          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Estimated cost: </span>
              <span className="text-blue-700 dark:text-blue-300 font-semibold">
                {estimatedCredits} credits
              </span>
              {outputType === 'video' ? (
                <span className="text-muted-foreground">
                  {' '}(Video download: 15)
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {' '}(Subtitle extraction: 10)
                </span>
              )}
              {selectedTranslationLang && (
                <span className="text-muted-foreground">
                  {' '}+ Translation: 5 = {estimatedCreditsWithTranslation} total
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Plan Limits Warnings */}
        {user && userPlanInfo?.planLimits && (
          <div className="space-y-2">
            {userPlanInfo.planLimits.maxVideoDuration && (
              <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs">
                  Video duration limit: {Math.floor((userPlanInfo.planLimits.maxVideoDuration || 0) / 60)} minutes
                </AlertDescription>
              </Alert>
            )}
            {userPlanInfo.planLimits.concurrentLimit && (
              <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs">
                  Concurrent task limit: {userPlanInfo.planLimits.concurrentLimit} task(s)
                </AlertDescription>
              </Alert>
            )}
            {userPlanInfo.planLimits.translationCharLimit && (
              <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs">
                  Translation character limit: {userPlanInfo.planLimits.translationCharLimit.toLocaleString()} characters
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Free Trial Count Display */}
        {user && userPlanInfo?.planType === 'free' && userPlanInfo.freeTrialCount !== undefined && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-muted-foreground">
                Free trials: {userPlanInfo.freeTrialUsed || 0} / {userPlanInfo.freeTrialCount} used
              </span>
            </div>
            {(userPlanInfo.freeTrialUsed || 0) < (userPlanInfo.freeTrialCount || 0) && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                {userPlanInfo.freeTrialCount - (userPlanInfo.freeTrialUsed || 0)} remaining
              </Badge>
            )}
          </div>
        )}

        {/* Extract Button */}
        {!user ? (
          <Button
            onClick={() => setIsShowSignModal(true)}
            className="w-full"
            size="lg"
          >
            <User className="mr-2 h-4 w-4" />
            {t('extractor.sign_in_to_extract')}
          </Button>
        ) : taskStatus?.status === 'extracted' ? (
          // Show translate button when extraction is complete and subtitle exists
          // For video download, subtitle is optional - only show error if subtitle output type
          taskStatus.outputType === 'video' ? (
            // Video download mode: Check if video is available
            taskStatus.videoUrlInternal ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Video Ready for Download</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-300 mb-3">
                    Video extraction completed successfully. You can download the video below.
                  </p>
                  {taskStatus.subtitleRaw && taskStatus.subtitleRaw.trim().length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-600 dark:text-green-300 mb-2">
                        Subtitles are also available. You can translate them below.
                      </p>
                      <Button
                        onClick={handleTranslate}
                        disabled={!selectedTranslationLang || isPolling}
                        className="w-full"
                        size="sm"
                        variant="outline"
                      >
                        {isPolling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Translating...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Translate Subtitles
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-4">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Info className="h-5 w-5" />
                  <span className="font-medium">Video Download Failed</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Video extraction completed, but the video file is not available for download. {taskStatus.errorMessage || 'Please try again.'}
                </p>
              </div>
            )
          ) : taskStatus.subtitleRaw && taskStatus.subtitleRaw.trim().length > 0 ? (
            // Subtitle mode: Show translate button when subtitle exists
            <div className="space-y-2">
              <Button
                onClick={handleTranslate}
                disabled={!selectedTranslationLang || isPolling}
                className="w-full"
                size="lg"
              >
                {isPolling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Translating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Start Translation
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Select a target language above and click to translate
              </p>
            </div>
          ) : (
            // Subtitle mode: No subtitles available
            <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20 p-4">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <Info className="h-5 w-5" />
                <span className="font-medium">No Subtitles Available</span>
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-300">
                This video does not have subtitles available for translation. The extraction completed successfully, but no subtitle content was found.
              </p>
            </div>
          )
        ) : (
          <Button
            onClick={handleExtract}
            disabled={isPolling || !url.trim()}
            className="w-full"
            size="lg"
          >
            {isPolling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {getStatusText()}
              </>
            ) : (
              <>
                <Video className="mr-2 h-4 w-4" />
                {t('extractor.extract')}
              </>
            )}
          </Button>
        )}

        {/* Download Buttons Section - Enhanced UI with friendly filenames */}
        {(taskStatus?.status === 'extracted' || taskStatus?.status === 'completed') && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-slate-100/50 p-6 dark:from-slate-900/50 dark:to-slate-800/30 dark:border-slate-800 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Available Resources</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click to download in your preferred format
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {taskStatus.status}
              </Badge>
            </div>

            <div className="space-y-4">
              {/* Video Download - Primary Action (if video output) */}
              {taskStatus.outputType === 'video' && taskStatus.videoUrlInternal && (
                <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4 dark:from-primary/10 dark:to-primary/20">
                  <Button
                    onClick={handleVideoDownload}
                    className="w-full h-auto p-0 bg-transparent hover:bg-transparent"
                    variant="ghost"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className="rounded-xl bg-primary p-3 shadow-md">
                          <FileVideo className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-base mb-1">Download Video</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>MP4 • HD Quality</span>
                            {taskStatus.title && (
                              <span className="text-primary/70">
                                • {getFriendlyFileName('mp4').replace('.mp4', '')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Download className="h-5 w-5 text-primary/70" />
                    </div>
                  </Button>
                  
                  {/* Direct Download Link - Compact */}
                  {directDownloadUrl && (
                    <div className="mt-3 pt-3 border-t border-primary/20 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs hover:bg-primary/10"
                        onClick={copyDirectUrl}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs hover:bg-primary/10"
                        onClick={openDirectUrl}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Subtitle Downloads - Compact Icon Grid */}
              {taskStatus.subtitleRaw && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    Original Subtitles
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-blue-50 dark:bg-slate-900/50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                      onClick={() =>
                        downloadSRT(
                          taskStatus.subtitleRaw!,
                          getFriendlyFileName('srt', 'original').replace('.srt', '')
                        )
                      }
                    >
                      <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                        <Type className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold">SRT</div>
                        <div className="text-[10px] text-muted-foreground">Standard</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-emerald-50 dark:bg-slate-900/50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                      onClick={() =>
                        downloadTXT(
                          taskStatus.subtitleRaw!,
                          getFriendlyFileName('txt', 'text').replace('.txt', '')
                        )
                      }
                    >
                      <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2">
                        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold">TXT</div>
                        <div className="text-[10px] text-muted-foreground">Plain Text</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-purple-50 dark:bg-slate-900/50 dark:hover:bg-purple-950/30 border-purple-200 dark:border-purple-800"
                      onClick={() =>
                        downloadVTT(
                          taskStatus.subtitleRaw!,
                          getFriendlyFileName('vtt', 'webvtt').replace('.vtt', '')
                        )
                      }
                    >
                      <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                        <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold">VTT</div>
                        <div className="text-[10px] text-muted-foreground">Web Format</div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}

              {/* Translated Subtitle - Show when completed */}
              {taskStatus.status === 'completed' && taskStatus.subtitleTranslated && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Translated Subtitles ({taskStatus.targetLang?.toUpperCase()})
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-950/30 dark:hover:to-emerald-950/30"
                    onClick={() =>
                      downloadSRT(
                        taskStatus.subtitleTranslated!,
                        getFriendlyFileName('srt', `translated_${taskStatus.targetLang}`).replace('.srt', '')
                      )
                    }
                  >
                    <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2 mr-3">
                      <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex flex-col items-start flex-1">
                      <span className="text-sm font-semibold">Translated SRT</span>
                      <span className="text-[10px] text-muted-foreground">
                        AI Translated • {taskStatus.targetLang?.toUpperCase()}
                      </span>
                    </div>
                    <Download className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </Button>
                </div>
              )}

              {/* CSV Export */}
              {(taskStatus.subtitleRaw || taskStatus.subtitleTranslated) && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-white/50 hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-800/50"
                    onClick={exportToCSV}
                  >
                    <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2 mr-3">
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex flex-col items-start flex-1">
                      <span className="text-sm font-semibold">Export CSV</span>
                      <span className="text-[10px] text-muted-foreground">
                        Complete metadata & subtitles
                      </span>
                    </div>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Rewrite Center - Show when extracted or completed */}
        {(taskStatus?.status === 'extracted' || taskStatus?.status === 'completed') &&
          taskStatus?.subtitleRaw && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-purple-50/80 to-blue-50/50 p-6 dark:from-purple-900/30 dark:to-blue-900/20 dark:border-slate-800 shadow-lg">
            <AIRewriteCenter
              taskId={taskStatus.id}
              originalText={taskStatus.subtitleRaw || ''}
              rewrittenText={(taskStatus as any).subtitleRewritten || undefined}
              title={taskStatus.title}
              author={taskStatus.author}
            />
          </div>
        )}

        {/* Download Buttons Section - Enhanced UI with friendly filenames */}
        {(taskStatus?.status === 'extracted' || taskStatus?.status === 'completed') && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-slate-100/50 p-6 dark:from-slate-900/50 dark:to-slate-800/30 dark:border-slate-800 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 dark:bg-primary/20">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Available Resources</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click to download in your preferred format
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {taskStatus.status}
              </Badge>
            </div>

            <div className="space-y-4">
              {/* Video Download - Primary Action (if video output) */}
              {taskStatus.outputType === 'video' && taskStatus.videoUrlInternal && (
                <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4 dark:from-primary/10 dark:to-primary/20">
                  <Button
                    onClick={handleVideoDownload}
                    className="w-full h-auto p-0 bg-transparent hover:bg-transparent"
                    variant="ghost"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className="rounded-xl bg-primary p-3 shadow-md">
                          <FileVideo className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-base mb-1">Download Video</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>MP4 • HD Quality</span>
                            {taskStatus.title && (
                              <span className="text-primary/70">
                                • {getFriendlyFileName('mp4').replace('.mp4', '')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Download className="h-5 w-5 text-primary/70" />
                    </div>
                  </Button>
                  
                  {/* Direct Download Link - Compact */}
                  {directDownloadUrl && (
                    <div className="mt-3 pt-3 border-t border-primary/20 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs hover:bg-primary/10"
                        onClick={copyDirectUrl}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs hover:bg-primary/10"
                        onClick={openDirectUrl}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Subtitle Downloads - Compact Icon Grid */}
              {taskStatus.subtitleRaw && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    Original Subtitles
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-blue-50 dark:bg-slate-900/50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                      onClick={() =>
                        downloadSRT(
                          taskStatus.subtitleRaw!,
                          getFriendlyFileName('srt', 'original').replace('.srt', '')
                        )
                      }
                    >
                      <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                        <Type className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold">SRT</div>
                        <div className="text-[10px] text-muted-foreground">Standard</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-emerald-50 dark:bg-slate-900/50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                      onClick={() =>
                        downloadTXT(
                          taskStatus.subtitleRaw!,
                          getFriendlyFileName('txt', 'text').replace('.txt', '')
                        )
                      }
                    >
                      <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2">
                        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold">TXT</div>
                        <div className="text-[10px] text-muted-foreground">Plain Text</div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 flex flex-col items-center gap-2 bg-white/50 hover:bg-purple-50 dark:bg-slate-900/50 dark:hover:bg-purple-950/30 border-purple-200 dark:border-purple-800"
                      onClick={() =>
                        downloadVTT(
                          taskStatus.subtitleRaw!,
                          getFriendlyFileName('vtt', 'webvtt').replace('.vtt', '')
                        )
                      }
                    >
                      <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                        <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold">VTT</div>
                        <div className="text-[10px] text-muted-foreground">Web Format</div>
                      </div>
                    </Button>
                  </div>
                </div>
              )}

              {/* Translated Subtitle - Show when completed */}
              {taskStatus.status === 'completed' && taskStatus.subtitleTranslated && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Translated Subtitles ({taskStatus.targetLang?.toUpperCase()})
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-950/30 dark:hover:to-emerald-950/30"
                    onClick={() =>
                      downloadSRT(
                        taskStatus.subtitleTranslated!,
                        getFriendlyFileName('srt', `translated_${taskStatus.targetLang}`).replace('.srt', '')
                      )
                    }
                  >
                    <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2 mr-3">
                      <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex flex-col items-start flex-1">
                      <span className="text-sm font-semibold">Translated SRT</span>
                      <span className="text-[10px] text-muted-foreground">
                        AI Translated • {taskStatus.targetLang?.toUpperCase()}
                      </span>
                    </div>
                    <Download className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </Button>
                </div>
              )}

              {/* CSV Export */}
              {(taskStatus.subtitleRaw || taskStatus.subtitleTranslated) && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-white/50 hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-800/50"
                    onClick={exportToCSV}
                  >
                    <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2 mr-3">
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex flex-col items-start flex-1">
                      <span className="text-sm font-semibold">Export CSV</span>
                      <span className="text-[10px] text-muted-foreground">
                        Complete metadata & subtitles
                      </span>
                    </div>
                  </Button>
                </div>
              )}
            </div>
            
            {/* Start New Task Button */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                className="w-full bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20"
                onClick={handleStartNewTask}
              >
                <X className="mr-2 h-4 w-4" />
                Start New Task
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Clear current task and start processing a new video
              </p>
            </div>
          </div>
        )}

        {/* Progress Bar with Dynamic Status and Creator Tips */}
        {isPolling && taskStatus && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {taskStatus.status === 'translating'
                  ? t('extractor.progress.translation')
                  : t('extractor.progress.extraction')}
              </span>
              <span className="font-medium">{taskStatus.progress || 0}%</span>
            </div>
            <Progress value={taskStatus.progress || 0} />
            
            {/* Dynamic Status with Icon */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">{dynamicStatus.currentIcon}</span>
              <p className="text-xs text-muted-foreground flex-1">
                {getProgressText()}
              </p>
            </div>
            
            {/* Creator Tips Card - Rotating educational content */}
            {isPolling && (taskStatus.status === 'processing' || taskStatus.status === 'translating' || taskStatus.status === 'pending') && (
              <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4 dark:from-primary/10 dark:to-primary/5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 dark:bg-primary/20">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-primary/60 font-bold">
                      Creator Tip
                    </p>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      "{dynamicStatus.currentTip}"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completed Status Indicator */}
        {taskStatus?.status === 'completed' && (
          <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 p-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">{t('extractor.completed')}</span>
            </div>
            {taskStatus.title && (
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                {taskStatus.title}
              </p>
            )}
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              All files are ready for download above.
            </p>
          </div>
        )}

        {/* Error Display */}
        {(taskStatus?.status === 'failed' || taskError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                  Task Failed
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {taskStatus?.errorMessage || taskError || 'Unknown error'}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                💡 <strong>Tip:</strong> Credits have been refunded automatically. 
                {user && (typeof user.credits === 'object' && user.credits !== null && 'remainingCredits' in user.credits
                  ? user.credits.remainingCredits
                  : typeof user.credits === 'number'
                  ? user.credits
                  : 0) < 15 && (
                  <span> Need more credits? Check in daily for free credits or <Link href="/settings/credits" className="underline font-medium">purchase a plan</Link>.</span>
                )}
              </p>
              <Button
                variant="outline"
                className="w-full bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20 border-red-300 dark:border-red-700"
                onClick={handleStartNewTask}
              >
                <X className="mr-2 h-4 w-4" />
                Start New Task
              </Button>
            </div>
          </div>
        )}

        {/* Credits Info and Daily Check-in */}
        {user && (
          <div className="space-y-3">
            {/* Credits Display */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('extractor.credits_remaining', {
                    credits: typeof user.credits === 'object' && user.credits !== null && 'remainingCredits' in user.credits
                      ? user.credits.remainingCredits
                      : typeof user.credits === 'number'
                      ? user.credits
                      : 0
                  })}
                </span>
              </div>
              <Link href="/settings/credits">
                <Button variant="link" size="sm" className="h-auto p-0">
                  {t('extractor.buy_credits')}
                </Button>
              </Link>
            </div>
            
            {/* Daily Check-in Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant={canCheckIn ? "default" : "outline"}
                      size="sm"
                      onClick={handleCheckIn}
                      disabled={!canCheckIn || isCheckingIn}
                      className="w-full"
                    >
                      {isCheckingIn ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking in...
                        </>
                      ) : canCheckIn ? (
                        <>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          Daily Check-in (+2 credits)
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Already checked in today
                        </>
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canCheckIn && (
                  <TooltipContent>
                    <p className="text-sm">
                      Daily check-in is available once per day (UTC timezone). 
                      You've already checked in today. Come back tomorrow for more free credits!
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      Note: Check-in is independent of task success/failure. 
                      If you need more credits, consider purchasing a plan.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

