import { ReactNode } from 'react'
import { Icon } from '@iconify/react'
import { openUrl } from '@tauri-apps/plugin-opener'

interface NewsCardProps {
  title?: string
  description?: string
  imageUrl?: string
  date?: string
  authorName?: string
  authorAvatar?: string
  isAd?: boolean
  adProgress?: number
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

const extractTag = (text: string, tag: string): string | null => {
  const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
};

const parseFormattedText = (text: string): ReactNode[] | string => {
  if (!text) return '';
  
  let processedText = text.replace(/\[\/?br\]/gi, '\n');

  const regex = /\{([a-z-]+)\}(.*?)\{\/[a-z-]+\}/gi;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  const rainbowColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];

  while ((match = regex.exec(processedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(processedText.substring(lastIndex, match.index));
    }

    const styleType = match[1].toLowerCase();
    const content = match[2];

    const isGlow = styleType.includes('glow');
    const isRainbow = styleType.includes('rainbow');
    const isFloating = styleType.includes('floating');
    
    let colorClass = '';

    let baseColor = 'white';
    if (styleType.includes('red')) baseColor = 'red';
    if (styleType.includes('green')) baseColor = 'green';
    if (styleType.includes('blue')) baseColor = 'blue';
    if (styleType.includes('yellow')) baseColor = 'yellow';
    if (styleType.includes('pink')) baseColor = 'pink';

    switch (baseColor) {
      case 'red': colorClass = 'text-red-500'; break;
      case 'green': colorClass = 'text-[#2dba7e]'; break;
      case 'blue': colorClass = 'text-blue-400'; break;
      case 'yellow': colorClass = 'text-yellow-400'; break;
      case 'pink': colorClass = 'text-pink-400'; break;
      default: 
        if (!isRainbow) colorClass = 'text-white';
        break;
    }

    if (isRainbow || isFloating) {
      const letters = content.split('').map((char, idx) => {
        const charColor = isRainbow ? rainbowColors[idx % rainbowColors.length] : undefined;
        const animDelay = isFloating ? `${idx * 0.1}s` : '0s';
        
        let innerStyle: any = {};
        if (charColor) innerStyle.color = charColor;
        if (isGlow) {
          innerStyle.textShadow = '0 0 6px currentColor, 0 0 12px currentColor';
        }
        
        const innerSpan = (
          <span 
            className={`inline-block ${isRainbow ? 'animate-rainbow' : ''} font-bold ${!isRainbow ? colorClass : ''} `}
            style={innerStyle}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        );

        if (isFloating) {
          return (
            <span key={idx} className="inline-block animate-floating" style={{ animationDelay: animDelay }}>
              {innerSpan}
            </span>
          );
        }

        return <span key={idx}>{innerSpan}</span>;
      });
      parts.push(<span key={match.index}>{letters}</span>);
    } else {
      let customStyle: any = {};
      if (isGlow) customStyle.textShadow = '0 0 8px currentColor';

      parts.push(
        <span key={match.index} className={`font-bold ${colorClass}`} style={customStyle}>
          {content}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < processedText.length) {
    parts.push(processedText.substring(lastIndex));
  }

  return parts.length > 0 ? parts : processedText;
};

export default function NewsCard({ title: rawContent, imageUrl, date, authorName, authorAvatar, isAd, adProgress, onMouseEnter, onMouseLeave }: NewsCardProps) {
  const contentStr = rawContent || '';
  
  let finalTitle = extractTag(contentStr, 'title');
  let finalDesc = extractTag(contentStr, 'desc');
  let finalImgLink = extractTag(contentStr, 'imglink');
  let finalHyperlink = extractTag(contentStr, 'hyperlink');

  let posMatch = contentStr.match(/%pos=(\d+)%/i);
  let forcedPos = posMatch ? parseInt(posMatch[1], 10) : 99;

  if (isAd || contentStr.toLowerCase().includes('%ad%')) {
    forcedPos = 3;
  }

  const cleanStr = (s: string) => {
    if (!s) return s;
    return s
      .replace(new RegExp(`\\[imglink\\]([\\s\\S]*?)\\[\\/imglink\\]`, 'i'), '')
      .replace(new RegExp(`\\[hyperlink\\]([\\s\\S]*?)\\[\\/hyperlink\\]`, 'i'), '')
      .replace(/%pos=\d+%/gi, '')
      .replace(/%ad%/gi, '')
      .replace(/%time=\d+%/gi, '')
      .trim();
  }

  if (!finalTitle && !finalDesc) {
    finalDesc = cleanStr(contentStr);
  } else if (finalDesc) {
    finalDesc = cleanStr(finalDesc);
  }

  const finalImage = imageUrl || finalImgLink;

  const handleCardClick = () => {
    if (finalHyperlink) {
      openUrl(finalHyperlink).catch(console.error);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ gridColumn: forcedPos !== 99 ? forcedPos : undefined, gridRow: 1 }}
      className={`flex flex-col rounded bg-[#151815] border shadow-xl min-w-0 transition-all duration-150 overflow-hidden group relative
        ${finalHyperlink ? 'cursor-pointer hover:border-[#2dba7e] border-[#2dba7e]/20 hover:-translate-y-1' : 'border-[#2dba7e]/20 hover:-translate-y-0.5'}
      `}
    >
      {isAd && (
        <div className="absolute top-0 left-0 w-full h-1 bg-black/50 z-10">
          <div 
            className="h-full bg-[#2dba7e] transition-all duration-75 ease-linear"
            style={{ width: `${adProgress || 0}%` }}
          />
        </div>
      )}

      <div className="w-full aspect-video bg-[#0d0f0d] relative overflow-hidden border-b border-[#2dba7e]/10 shrink-0">
        {finalImage ? (
          <img src={finalImage} alt={finalTitle || 'News'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#2dba7e]/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
          </div>
        )}
        
        {finalHyperlink && (
          <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-sm p-1.5 xl:p-2 2xl:p-2.5 rounded flex items-center justify-center shadow-lg group-hover:bg-black/60 transition-all duration-300 pointer-events-none">
            <Icon icon="mdi:arrow-top-right" className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 text-white/90 transition-all duration-300" />
          </div>
        )}








        </div>
        
      <div className="p-4 xl:p-5 2xl:p-6 flex flex-col flex-1 min-h-0">
        {finalTitle && (
          <h3 className="font-sans text-[13px] xl:text-[15px] 2xl:text-[18px] text-white font-bold mb-1.5 xl:mb-2 2xl:mb-3 uppercase tracking-wide transition-all duration-300">
            {parseFormattedText(finalTitle)}
          </h3>
        )}
        
        <p className="font-sans text-xs xl:text-sm 2xl:text-base text-white/80 leading-relaxed font-medium whitespace-pre-wrap flex-1 transition-all duration-300">
          {parseFormattedText(finalDesc || "")}
        </p>
        
        <div className="mt-4 xl:mt-5 2xl:mt-6 pt-3 xl:pt-4 2xl:pt-5 border-t border-[#2dba7e]/10 flex items-center justify-between shrink-0 transition-all duration-300">
          <div className="flex items-center gap-1.5 2xl:gap-2">
            <span className="font-sans text-[9px] xl:text-[10px] 2xl:text-[12px] text-[#8a9a8a] uppercase tracking-wider transition-all duration-300">Postado por</span>
            {authorAvatar && <img src={authorAvatar} className="w-4 h-4 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 rounded-full transition-all duration-300" />}
            <span className="font-sans text-[11px] xl:text-[12px] 2xl:text-[14px] text-[#2dba7e] font-semibold transition-all duration-300">{authorName || "Verdant"}</span>
          </div>
          {date && (
            <span className="font-sans text-[9px] xl:text-[10px] 2xl:text-[12px] text-[#8a9a8a] uppercase tracking-wider transition-all duration-300">{date}</span>
          )}
        </div>
      </div>
    </div>
  )
}
