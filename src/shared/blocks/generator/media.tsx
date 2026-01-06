'use client';

import { useState, useEffect } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Sparkles,
  User,
  Video,
  X,
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
import { cn } from '@/shared/lib/utils';
import { getEstimatedCreditsCost } from '@/shared/config/plans';

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

  // Fetch direct download URL when video is ready
  useEffect(() => {
    const fetchDirectUrl = async () => {
      if (
        taskStatus?.id &&
        taskStatus?.outputType === 'video' &&
        taskStatus?.videoUrlInternal &&
        (taskStatus?.status === 'extracted' || taskStatus?.status === 'completed')
      ) {
        try {
          const url = await getVideoDownloadUrl(taskStatus.id);
          if (url) {
            setDirectDownloadUrl(url);
          }
        } catch (error) {
          console.error('Failed to fetch direct download URL:', error);
        }
      } else {
        setDirectDownloadUrl(null);
      }
    };

    fetchDirectUrl();
  }, [taskStatus?.id, taskStatus?.outputType, taskStatus?.videoUrlInternal, taskStatus?.status, getVideoDownloadUrl]);
  
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
    link.setAttribute(
      'download',
      `media_export_${taskStatus.id}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV exported successfully');
  };

  // Download SRT file (create blob from text)
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

  // Handle video download (try direct download first, fallback to proxy)
  const handleVideoDownload = async () => {
    if (!taskStatus?.id) return;

    try {
      // Show loading state
      toast.loading('Preparing video download...', { id: 'video-download' });

      // Get download URL from API
      const downloadUrl = await getVideoDownloadUrl(taskStatus.id);
      if (!downloadUrl) {
        toast.error('Failed to get download URL', { id: 'video-download' });
        return;
      }

      // Try direct download first
      try {
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            'Accept': 'video/mp4, video/*, */*',
          },
        });

        if (response.ok && response.body) {
          // Convert response to blob
          const blob = await response.blob();

          // Create blob URL
          const blobUrl = URL.createObjectURL(blob);

          // Create download link
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `video-${taskStatus.id}.mp4`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up blob URL after a delay
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 100);

          toast.success('Video download started', { id: 'video-download' });
          return;
        }
      } catch (directError: any) {
        console.warn('Direct download failed, trying proxy:', directError);
        // Fall through to proxy download
      }

      // Fallback: Use proxy API for download
      const proxyUrl = `/api/media/download-proxy?id=${taskStatus.id}`;
      
      const proxyResponse = await fetch(proxyUrl);
      
      if (!proxyResponse.ok) {
        const errorData = await proxyResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Download failed: ${proxyResponse.status} ${proxyResponse.statusText}`);
      }

      if (!proxyResponse.body) {
        throw new Error('Video file has no content');
      }

      // Convert proxy response to blob
      const blob = await proxyResponse.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `video-${taskStatus.id}.mp4`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);

      toast.success('Video download started', { id: 'video-download' });
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
    switch (taskStatus.status) {
      case 'pending':
        return 'Submitting task...';
      case 'processing':
        return 'Extracting media...';
      case 'extracted':
        return 'Extraction completed!';
      case 'translating':
        return 'Translating subtitles...';
      case 'completed':
        return 'Translation completed!';
      case 'failed':
        return 'Failed';
      default:
        return 'Processing...';
    }
  };

  const getProgressText = () => {
    if (!taskStatus) return '';
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

        {/* Download Buttons Section - Show when extracted or completed */}
        {(taskStatus?.status === 'extracted' || taskStatus?.status === 'completed') && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Ready for Download
              </h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white dark:bg-slate-950 px-2 py-0.5 rounded border shadow-sm">
                {taskStatus.status}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Original SRT Download */}
              {taskStatus.subtitleRaw && (
                <Button
                  variant="outline"
                  className="w-full justify-start bg-white hover:bg-primary/5 dark:bg-slate-950"
                  onClick={() =>
                    downloadSRT(
                      taskStatus.subtitleRaw!,
                      `original-subtitle-${taskStatus.id}.srt`
                    )
                  }
                >
                  <FileText className="mr-2 h-4 w-4 text-blue-500" />
                  <div className="flex flex-col items-start">
                    <span className="text-xs">Original Subtitles</span>
                    <span className="text-[10px] text-muted-foreground">SRT Format</span>
                  </div>
                </Button>
              )}

              {/* Video Download - Only show for video output type */}
              {taskStatus.outputType === 'video' &&
                taskStatus.videoUrlInternal && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-white hover:bg-primary/5 dark:bg-slate-950"
                      onClick={handleVideoDownload}
                    >
                      <Video className="mr-2 h-4 w-4 text-red-500" />
                      <div className="flex flex-col items-start">
                        <span className="text-xs">Video MP4</span>
                        <span className="text-[10px] text-muted-foreground">
                          Original Quality
                        </span>
                      </div>
                    </Button>
                    
                    {/* Direct Download Link - Show if URL is available */}
                    {directDownloadUrl && (
                      <div className="col-span-full mt-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            Direct Download Link
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                              onClick={copyDirectUrl}
                              title="Copy link"
                            >
                              <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                              onClick={openDirectUrl}
                              title="Open in new tab"
                            >
                              <ExternalLink className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate rounded bg-white px-2 py-1 text-[10px] text-blue-900 dark:bg-slate-900 dark:text-blue-100">
                            {directDownloadUrl}
                          </code>
                        </div>
                        <p className="mt-1 text-[10px] text-blue-600 dark:text-blue-400">
                          Click the buttons above to copy or open the direct download link
                        </p>
                      </div>
                    )}
                  </>
                )}

              {/* Translated SRT - Only show when completed */}
              {taskStatus.status === 'completed' &&
                taskStatus.subtitleTranslated && (
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-white hover:bg-primary/5 dark:bg-slate-950"
                    onClick={() =>
                      downloadSRT(
                        taskStatus.subtitleTranslated!,
                        `translated-subtitle-${taskStatus.id}-${taskStatus.targetLang}.srt`
                      )
                    }
                  >
                    <FileText className="mr-2 h-4 w-4 text-green-500" />
                    <div className="flex flex-col items-start">
                      <span className="text-xs">Translated SRT</span>
                      <span className="text-[10px] text-muted-foreground">
                        AI Translated
                      </span>
                    </div>
                  </Button>
                )}

              {/* CSV Export */}
              {(taskStatus.subtitleRaw || taskStatus.subtitleTranslated) && (
                <Button
                  variant="outline"
                  className="w-full justify-start bg-white hover:bg-primary/5 dark:bg-slate-950"
                  onClick={exportToCSV}
                >
                  <FileText className="mr-2 h-4 w-4 text-purple-500" />
                  <div className="flex flex-col items-start">
                    <span className="text-xs">Export CSV</span>
                    <span className="text-[10px] text-muted-foreground">
                      All Data
                    </span>
                  </div>
                </Button>
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

        {/* Progress Bar */}
        {isPolling && taskStatus && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {taskStatus.status === 'translating'
                  ? 'Translation Progress'
                  : 'Extraction Progress'}
              </span>
              <span className="font-medium">{taskStatus.progress || 0}%</span>
            </div>
            <Progress value={taskStatus.progress || 0} />
            <p className="text-xs text-muted-foreground">
              {getProgressText()}
            </p>
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

