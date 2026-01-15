import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

export interface UseDynamicStatusOptions {
  isProcessing: boolean;
  mode?: 'extraction' | 'translation';
  onStageChange?: (stage: number) => void;
}

export interface DynamicStatus {
  currentLabel: string;
  currentIcon: string;
  currentTip: string;
  stageIndex: number;
  tipIndex: number;
}

/**
 * Hook for managing dynamic status messages during media processing
 * Provides stage-based status updates and rotating creator tips
 */
export function useDynamicStatus({
  isProcessing,
  mode = 'extraction',
  onStageChange,
}: UseDynamicStatusOptions): DynamicStatus {
  const t = useTranslations('ai.media.extractor.dynamic_status');
  const [stageIndex, setStageIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Build stages dynamically using translations
  const extractionStages = [
    { time: 0, labelKey: 'extraction.stage_0', icon: '🔒' },
    { time: 3, labelKey: 'extraction.stage_1', icon: '📊' },
    { time: 8, labelKey: 'extraction.stage_2', icon: '🌐' },
    { time: 13, labelKey: 'extraction.stage_3', icon: '🧠' },
    { time: 18, labelKey: 'extraction.stage_4', icon: '✨' },
    { time: 23, labelKey: 'extraction.stage_5', icon: '✅' },
  ];

  const translationStages = [
    { time: 0, labelKey: 'translation.stage_0', icon: '🤖' },
    { time: 5, labelKey: 'translation.stage_1', icon: '🔍' },
    { time: 12, labelKey: 'translation.stage_2', icon: '💎' },
    { time: 18, labelKey: 'translation.stage_3', icon: '🔥' },
    { time: 25, labelKey: 'translation.stage_4', icon: '📢' },
    { time: 30, labelKey: 'translation.stage_5', icon: '📦' },
  ];

  // Creator tips keys
  const tipKeys = [
    'tips.tip_1',
    'tips.tip_2',
    'tips.tip_3',
    'tips.tip_4',
    'tips.tip_5',
    'tips.tip_6',
    'tips.tip_7',
    'tips.tip_8',
  ];

  const stages = mode === 'translation' ? translationStages : extractionStages;

  useEffect(() => {
    if (isProcessing) {
      // Reset state when processing starts
      setStageIndex(0);
      setTipIndex(Math.floor(Math.random() * tipKeys.length)); // Random initial tip
      setElapsedSeconds(0);
      startTimeRef.current = Date.now();

      // Update stage based on elapsed time
      const updateStage = () => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
        setElapsedSeconds(elapsed);

        // Find the appropriate stage based on elapsed time
        const newStageIndex = stages.findIndex(
          (stage, index) => {
            const nextStage = stages[index + 1];
            return elapsed >= stage.time && (!nextStage || elapsed < nextStage.time);
          }
        );

        if (newStageIndex >= 0 && newStageIndex !== stageIndex) {
          setStageIndex(newStageIndex);
          if (onStageChange) {
            onStageChange(newStageIndex);
          }
        }

        // Rotate tip every 4.5 seconds
        if (elapsed > 0 && elapsed % 4.5 < 1) {
          setTipIndex((prev) => (prev + 1) % tipKeys.length);
        }
      };

      // Update every second
      intervalRef.current = setInterval(updateStage, 1000);
      updateStage(); // Initial update
    } else {
      // Reset when processing stops
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      startTimeRef.current = null;
      setElapsedSeconds(0);
      setStageIndex(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isProcessing, mode, stageIndex, stages, onStageChange]);

  const currentStage = stages[Math.min(stageIndex, stages.length - 1)] || stages[0];
  const currentTipKey = tipKeys[tipIndex] || tipKeys[0];

  return {
    currentLabel: t(currentStage.labelKey),
    currentIcon: currentStage.icon,
    currentTip: t(currentTipKey),
    stageIndex,
    tipIndex,
  };
}
