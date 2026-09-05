import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useDownload } from '../contexts/DownloadContext';

export default function GlobalDownloadIndicator() {
  const { activeDownload, progress, isFinished, finishedInstanceId, cancelDownload, hideFinished } = useDownload();
  const [showConfirm, setShowConfirm] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [isHiding, setIsHiding] = useState(false);
  const [isAppearing, setIsAppearing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [forceHide, setForceHide] = useState(false); // Novo estado para disparar fade out ao clicar

  useEffect(() => {
    if (activeDownload) {
      const t = setTimeout(() => setIsAppearing(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsAppearing(false);
      setIsExpanded(false);
    }
  }, [activeDownload]);

  useEffect(() => {
    if (isFinished) {
      if (forceHide) return; // Se o usuário clicou para forçar, ignoramos o timer.
      setIsHiding(false);
      setIsExpanded(false);
      setProgressWidth(0);
      const startTime = Date.now();
      const duration = 5000;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const current = Math.min((elapsed / duration) * 100, 100);
        setProgressWidth(current);
        
        if (current >= 100) {
          clearInterval(interval);
          setIsHiding(true);
          setTimeout(() => {
            hideFinished();
            setIsHiding(false);
          }, 500);
        }
      }, 50);
      
      return () => clearInterval(interval);
    } else {
      setShowConfirm(false);
      setProgressWidth(0);
      setIsHiding(false);
      setForceHide(false);
    }
  }, [isFinished, forceHide]);

  if (!activeDownload) return null;

  return (
    <>
      <div 
        onClick={() => {
          if (isFinished && finishedInstanceId && !isHiding) {
            window.dispatchEvent(new CustomEvent('select-instance', { detail: finishedInstanceId }));
            window.dispatchEvent(new Event('close-modals'));
            
            setForceHide(true);
            setIsHiding(true);
            setTimeout(() => {
              hideFinished();
              setIsHiding(false);
              setForceHide(false);
            }, 500);
          }
        }}
        className={`fixed bottom-6 right-6 z-[60] flex flex-col transition-all duration-500 overflow-hidden ${
          isFinished 
            ? 'bg-[#1e1e1e] border border-[#3a3a3a] rounded-sm shadow-xl p-4 w-72 cursor-pointer hover:brightness-110 pointer-events-auto' 
            : 'bg-[#111411] border border-[#2dba7e]/30 rounded-lg shadow-2xl w-[340px]'
        } ${
          !isAppearing || isHiding
            ? 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            : 'opacity-100 translate-y-0 scale-100'
        }`}
        style={!isFinished ? { height: isExpanded ? '95px' : '70px' } : undefined}
      >
        {isFinished ? (
          <>
            <div className="flex items-center gap-3">
              <Icon icon="mdi:check-circle" className="text-[#1db868] w-6 h-6 shrink-0" />
              <div className="flex flex-col min-w-0">
                <p className="text-white font-sans text-sm truncate w-full">{activeDownload.title}</p>
                <p className="text-[#8a9a8a] font-sans text-xs">Instalação Concluída</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-[#1db868] transition-all ease-linear" style={{ width: `${100 - progressWidth}%`, transitionDuration: '50ms' }} />
          </>
        ) : (
          <>
            <div className="flex w-full h-[70px] flex-shrink-0 items-center px-3 relative">
              <div 
                className="relative w-12 h-12 flex-shrink-0 bg-black/40 rounded border border-white/5 overflow-hidden cursor-pointer group"
                onClick={() => !isFinished && setShowConfirm(true)}
              >
                <img 
                  src={activeDownload.icon_url || 'https://via.placeholder.com/128'} 
                  className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-50 group-hover:grayscale group-hover:opacity-50"
                />
                {!isFinished && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-600/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Icon icon="material-symbols:delete-rounded" className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>

              <div className="ml-3 flex flex-col flex-1 justify-center min-w-0 pr-1">
                <h4 className="text-white font-mc-small text-[10px] tracking-widest truncate mb-1">
                  {activeDownload.title}
                </h4>
                
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1 relative">
                  <div 
                    className="h-full bg-[#2dba7e] transition-all duration-300 relative" 
                    style={{ width: `${progress && progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1s_infinite]"></div>
                  </div>
                </div>
              </div>

              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="ml-1 w-6 h-6 flex flex-shrink-0 items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                <Icon icon="mdi:chevron-down" className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className={`w-full px-3 pb-3 transition-all duration-300 flex items-center ${isExpanded && !isFinished ? 'opacity-100 h-[25px]' : 'opacity-0 h-0 pointer-events-none'}`}>
              <Icon icon="mdi:cloud-download" className="w-3 h-3 text-[#2dba7e] mr-2 flex-shrink-0" />
              <span className="text-[#8a9a8a] font-mc-small text-[9px] truncate block w-full">
                {progress?.message || 'Aguardando...'}
              </span>
            </div>
          </>
        )}
      </div>

      {showConfirm && !isFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111411] border border-[#2dba7e]/20 p-6 rounded-lg flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
            <Icon icon="mdi:alert-circle-outline" className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-white font-mc-small text-sm text-center mb-6">
              VOCÊ TEM CERTEZA QUE DESEJA CANCELAR O DOWNLOAD?
            </h3>
            <div className="flex gap-4 w-full">
              <button 
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2 font-mc-small text-[10px] rounded transition-colors"
              >NÃO</button>
              <button 
                onClick={() => {
                  cancelDownload();
                  setShowConfirm(false);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 font-mc-small text-[10px] rounded transition-colors"
              >
                SIM
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
