'use client';

import { Card, CardContent } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';

interface SEOContentProps {
  locale?: string;
  className?: string;
}

export function SEOContent({ locale = 'en', className }: SEOContentProps) {
  // English content
  const enContent = (
    <div className="prose prose-lg max-w-none dark:prose-invert">
      <h2 className="text-2xl font-bold mb-4">
        The Ultimate YouTube Subtitle Extractor & TikTok Video Downloader for Creators
      </h2>
      
      <p className="mb-4">
        In today's fast-paced digital landscape, content repurposing is the secret weapon of successful creators. Whether you are a blogger, a social media manager, or a researcher, SubtitleTK provides a seamless, AI-powered solution to bridge the gap between video and text. Our platform is designed to help you extract value from every frame, offering a robust YouTube Subtitle Extractor and a high-speed TikTok Video Downloader in one unified dashboard.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        How SubtitleTK Empowers Your Workflow
      </h3>
      
      <p className="mb-4">
        Why spend hours manually transcribing videos when AI can do it in seconds? SubtitleTK uses advanced processing to fetch official and auto-generated transcripts directly from YouTube. But we don't stop there. For TikTok enthusiasts, our tool acts as a high-fidelity TikTok video downloader, ensuring your creative assets are clean and ready for professional editing.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        Step-by-Step Guide: How to Use SubtitleTK
      </h3>
      
      <ol className="list-decimal list-inside space-y-2 mb-4">
        <li>
          <strong>Copy the URL:</strong> Find the YouTube or TikTok video you want to process and copy its link from the address bar.
        </li>
        <li>
          <strong>Paste and Analyze:</strong> Navigate to the SubtitleTK input field and paste the link. Our system automatically detects the platform.
        </li>
        <li>
          <strong>Choose Output:</strong> Select whether you want to download the transcript (as SRT or TXT) or the video.
        </li>
        <li>
          <strong>Extract & Save:</strong> Click the "Extract" button. Once processed, your file is ready for instant download.
        </li>
      </ol>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        Core Advantages of SubtitleTK
      </h3>
      
      <ul className="list-disc list-inside space-y-2 mb-4">
        <li>
          <strong>Precision AI Recognition:</strong> We prioritize high-accuracy data fetching, ensuring that the subtitles you receive match the spoken word perfectly.
        </li>
        <li>
          <strong>Multi-Format Export:</strong> Save your transcripts in SRT format for video subtitles or TXT format for blog drafting and AI rewriting.
        </li>
        <li>
          <strong>Clean TikTok Assets:</strong> Unlike generic downloaders, we provide TikTok videos in their original quality.
        </li>
      </ul>
    </div>
  );

  // Chinese content (中文内容)
  const zhContent = (
    <div className="prose prose-lg max-w-none dark:prose-invert">
      <h2 className="text-2xl font-bold mb-4">
        创作者必备的终极 YouTube 字幕提取器与 TikTok 视频下载工具
      </h2>
      
      <p className="mb-4">
        在当今快节奏的数字环境中，内容再利用是成功创作者的秘密武器。无论您是博客作者、社交媒体经理还是研究人员，SubtitleTK 提供无缝的 AI 驱动解决方案，架起视频与文本之间的桥梁。我们的平台旨在帮助您从每一帧中提取价值，在一个统一的仪表板中提供强大的 YouTube 字幕提取器和高速 TikTok 视频下载器。
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        SubtitleTK 如何赋能您的工作流程
      </h3>
      
      <p className="mb-4">
        当 AI 可以在几秒钟内完成时，为什么要花费数小时手动转录视频？SubtitleTK 使用先进的处理技术直接从 YouTube 获取官方和自动生成的字幕。但我们并不止步于此。对于 TikTok 爱好者，我们的工具可作为高保真 TikTok 视频下载器，确保您的创意资产干净整洁，随时可用于专业编辑。
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        分步指南：如何使用 SubtitleTK
      </h3>
      
      <ol className="list-decimal list-inside space-y-2 mb-4">
        <li>
          <strong>复制 URL：</strong>找到您要处理的 YouTube 或 TikTok 视频，从地址栏复制其链接。
        </li>
        <li>
          <strong>粘贴并分析：</strong>导航到 SubtitleTK 输入字段并粘贴链接。我们的系统会自动检测平台。
        </li>
        <li>
          <strong>选择输出：</strong>选择是要下载字幕（SRT 或 TXT 格式）还是视频。
        </li>
        <li>
          <strong>提取并保存：</strong>点击"提取"按钮。处理完成后，您的文件即可立即下载。
        </li>
      </ol>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        SubtitleTK 的核心优势
      </h3>
      
      <ul className="list-disc list-inside space-y-2 mb-4">
        <li>
          <strong>精准 AI 识别：</strong>我们优先考虑高精度数据获取，确保您收到的字幕与口语完美匹配。
        </li>
        <li>
          <strong>多格式导出：</strong>以 SRT 格式保存字幕用于视频字幕，或以 TXT 格式保存用于博客起草和 AI 重写。
        </li>
        <li>
          <strong>干净的 TikTok 资源：</strong>与通用下载器不同，我们提供原始质量的 TikTok 视频。
        </li>
      </ul>
    </div>
  );

  // French content
  const frContent = (
    <div className="prose prose-lg max-w-none dark:prose-invert">
      <h2 className="text-2xl font-bold mb-4">
        L'extracteur de Transcription YouTube et Téléchargeur TikTok de Référence
      </h2>
      
      <p className="mb-4">
        Dans l'univers numérique actuel, la réutilisation du contenu est la clé du succès. Que vous soyez blogueur ou gestionnaire de réseaux sociaux, SubtitleTK offre une solution dopée à l'IA pour transformer vos vidéos en texte. Notre plateforme regroupe un extracteur de transcription YouTube ultra-précis et un téléchargeur TikTok rapide, le tout dans une interface unique.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        Pourquoi choisir SubtitleTK pour votre création de contenu ?
      </h3>
      
      <p className="mb-4">
        Ne perdez plus de temps à transcrire manuellement. SubtitleTK utilise des algorithmes avancés pour récupérer les sous-titres officiels et générés automatiquement. Pour les fans de TikTok, notre outil permet de télécharger des vidéos TikTok, garantissant des fichiers propres pour vos montages professionnels.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        Guide étape par étape : Comment utiliser SubtitleTK
      </h3>
      
      <ol className="list-decimal list-inside space-y-2 mb-4">
        <li>
          <strong>Copiez l'URL :</strong> Trouvez la vidéo YouTube ou TikTok et copiez le lien.
        </li>
        <li>
          <strong>Collez le lien :</strong> Insérez le lien dans le champ de saisie de SubtitleTK.
        </li>
        <li>
          <strong>Choisissez le format :</strong> Sélectionnez "Transcription" (SRT/TXT) ou "Vidéo".
        </li>
        <li>
          <strong>Extrayez et Téléchargez :</strong> Cliquez sur "Extraire". Votre fichier est prêt en quelques secondes.
        </li>
      </ol>

      <h3 className="text-xl font-semibold mt-6 mb-3">
        Les Avantages de SubtitleTK
      </h3>
      
      <ul className="list-disc list-inside space-y-2 mb-4">
        <li>
          <strong>Reconnaissance IA de Haute Précision :</strong> Nous garantissons des transcriptions fidèles aux paroles prononcées.
        </li>
        <li>
          <strong>Exportation Multi-formats :</strong> Sauvegardez en format SRT pour le sous-titrage ou en format TXT pour vos articles de blog.
        </li>
        <li>
          <strong>Vidéos TikTok Propres :</strong> Téléchargez vos vidéos préférées.
        </li>
      </ul>
    </div>
  );

  // Only show content for English, Chinese and French locales
  if (locale !== 'en' && locale !== 'zh' && locale !== 'fr') {
    return null;
  }

  // Render content based on locale
  let content;
  if (locale === 'zh') {
    content = zhContent;
  } else if (locale === 'fr') {
    content = frContent;
  } else {
    content = enContent;
  }

  return (
    <section className={cn('py-8 md:py-12', className)}>
      <div className="container">
        <Card>
          <CardContent className="pt-6">
            {content}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

