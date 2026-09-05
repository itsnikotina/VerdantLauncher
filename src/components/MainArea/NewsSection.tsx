import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import NewsCard from './NewsCard'

interface NewsItem {
  id: string
  content: string
  date: string
  image_url: string | null
  author_name?: string
  author_avatar?: string
}

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

export default function NewsSection() {
  const [normalNews, setNormalNews] = useState<NewsItem[]>([])
  const [ads, setAds] = useState<NewsItem[]>([])
  
  const [currentAdIndex, setCurrentAdIndex] = useState(0)
  const [adProgress, setAdProgress] = useState(0)
  const [isAdPaused, setIsAdPaused] = useState(false)
  const [adDuration, setAdDuration] = useState(15)

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('date', { ascending: false })
        .limit(30)
      
      if (error) throw error
      if (data) {
        const normal: NewsItem[] = []
        const adList: NewsItem[] = []
        
        data.forEach(item => {
          const content = item.content || ''
          if (content.toLowerCase().includes('%ad%')) {
            adList.push(item)
          } else {
            normal.push(item)
          }
        })

        setNormalNews(normal)
        setAds(adList)
      }
    } catch (err: any) {
      console.error('Erro ao buscar news do Supabase:', err)
    }
  }

  useEffect(() => {
    fetchNews()

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news' },
        () => {
          fetchNews()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Timer para Ads reconstruído de forma pura para o React Strict Mode
  useEffect(() => {
    if (ads.length <= 1) return;
    if (isAdPaused) return;

    const intervalMs = 50;
    const timer = setInterval(() => {
      setAdProgress(prev => {
        const safeDuration = Math.max(1, adDuration);
        const step = (intervalMs / (safeDuration * 1000)) * 100;
        return prev + step; // Retorna apenas o novo progresso sem efeitos colaterais
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [ads, isAdPaused, adDuration, currentAdIndex]);

  // Listener do Progresso: Quando atingir 100%, fazemos a troca!
  // Isso evita o bug do React invocar a troca 2x no modo Strict (0 -> 1 -> 0)
  useEffect(() => {
    if (adProgress >= 100) {
      setAdProgress(0); // Reseta a barra
      setCurrentAdIndex(idx => (idx + 1) % ads.length);
    }
  }, [adProgress, ads.length, currentAdIndex]);

  // Atualiza duração quando muda de Ad
  useEffect(() => {
    if (ads.length > 0) {
      const currentAd = ads[currentAdIndex];
      if (currentAd) {
        const match = currentAd.content?.match(/%time=(\d+)%/i);
        setAdDuration(match ? parseInt(match[1], 10) : 15);
      }
    }
  }, [currentAdIndex, ads]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString)
      const day = String(d.getDate()).padStart(2, '0')
      const month = MONTHS[d.getMonth()]
      const year = d.getFullYear()
      return `${day} ${month} ${year}`
    } catch {
      return isoString
    }
  }

  // Prepara os 3 slots cravados do grid
  const slots: { item: NewsItem | null, isAd: boolean }[] = [
    { item: null, isAd: false },
    { item: null, isAd: false },
    { item: null, isAd: false }
  ];
  
  // 1. O terceiro slot (índice 2) sempre pega o AD se existir
  if (ads.length > 0 && ads[currentAdIndex]) {
    slots[2] = { item: ads[currentAdIndex], isAd: true };
  }

  // 2. Tenta alocar as notícias normais de acordo com o %pos=%
  let unplacedNormalNews: NewsItem[] = [];
  
  normalNews.forEach(news => {
    let posMatch = news.content?.match(/%pos=(\d+)%/i);
    let forcedPos = posMatch ? parseInt(posMatch[1], 10) : -1;
    
    // Grid é 1-indexed, array é 0-indexed
    let targetIndex = forcedPos - 1;
    
    if (targetIndex >= 0 && targetIndex < 3 && slots[targetIndex].item === null) {
      slots[targetIndex] = { item: news, isAd: false };
    } else {
      unplacedNormalNews.push(news);
    }
  });

  // 3. Preenche os slots vazios com as notícias que sobraram
  for (let i = 0; i < 3; i++) {
    if (slots[i].item === null && unplacedNormalNews.length > 0) {
      slots[i] = { item: unplacedNormalNews.shift()!, isAd: false };
    }
  }

  return (
    <div className="flex flex-col flex-1 px-4 pb-4">
      {/* Título NEWS puxado pra cima com margin negativa */}
      <div className="flex justify-center -mt-7 2xl:-mt-10 z-20 pointer-events-none transition-all duration-300">
        <h2 className="font-mc-big text-[#f5c542] text-[32px] xl:text-[40px] 2xl:text-[56px] tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)] transition-all duration-300">
          NEWS
        </h2>
      </div>

      {/* Grid de cards ou estado vazio */}
      {normalNews.length === 0 && ads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center mt-3">
          <p className="font-mc-small text-[12px] text-[#8a9a8a]">vazio...</p>
        </div>
      ) : (
        <div className="w-full max-w-[1600px] mx-auto">
          <div className="grid grid-cols-3 gap-4 flex-1 min-h-0 mt-4">
            {slots.map((slot, idx) => {
              if (!slot.item) {
                // Renderiza um slot vazio transparente para manter o grid alinhado
                return <div key={`empty-${idx}`} className="flex flex-col min-w-0" />;
              }
              
              const { item, isAd } = slot;
              return (
                <NewsCard
                  key={item.id}
                  title={item.content || undefined}
                  imageUrl={item.image_url || undefined}
                  date={item.date ? formatDate(item.date) : undefined}
                  authorName={item.author_name}
                  authorAvatar={item.author_avatar}
                  isAd={isAd}
                  adProgress={isAd && ads.length > 1 ? adProgress : undefined}
                  onMouseEnter={() => isAd && setIsAdPaused(true)}
                  onMouseLeave={() => isAd && setIsAdPaused(false)}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

