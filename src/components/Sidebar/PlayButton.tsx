interface PlayButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  isPlaying?: boolean;
  isLaunching?: boolean;
  status?: string;
}

export default function PlayButton({ onClick, disabled, isPlaying, isLaunching, status }: PlayButtonProps) {
  // Cores dinÃ¢micas
  const bgClass = isPlaying 
    ? "bg-[#e53935] hover:bg-[#ef5350] active:bg-[#c62828]" // Vermelho (Kill)
    : isLaunching 
      ? "bg-[#6b7280] opacity-80" // Cinza (Carregando)
      : "bg-[#1db868] hover:bg-[#22d476] active:bg-[#19a55e]"; // Verde (Jogar)
      
  const shadowClass = isPlaying
    ? "shadow-[0_4px_0_#8e0000]"
    : isLaunching
      ? "shadow-[0_4px_0_#374151]"
      : "shadow-[0_4px_0_#14844a]";

  const label = isPlaying ? "FORÇAR PARADA" : isLaunching ? "CARREGANDO" : "JOGAR";
  
  // Tamanho dinâmico para nao vazar a caixa
  const textSize = isPlaying ? "text-[18px] xl:text-[22px] 2xl:text-[28px]" : isLaunching ? "text-[20px] xl:text-[24px] 2xl:text-[32px]" : "text-[40px] xl:text-[48px] 2xl:text-[64px]";

  return (
    <div className="flex flex-col w-full">
      <button
        onClick={onClick}
        disabled={disabled || isLaunching}
        className={`
          w-full h-[60px] xl:h-[75px] 2xl:h-[100px] pb-2 font-mc-big ${textSize} tracking-normal text-white
          ${bgClass}
          disabled:cursor-wait
          transition-all duration-300
          ${shadowClass} active:shadow-none active:translate-y-[2px]
          rounded-b-lg flex items-center justify-center
        `}
      >
        <span className={`leading-none ${isPlaying ? '' : 'drop-shadow-[0_4px_0_rgba(13,89,42,1)]'}`}>
          {label}
        </span>
      </button>

      {/* Progress Bar Label (sÃ³ mostra enquanto carrega) */}
      {isLaunching && (
        <div className="mt-4 flex flex-col items-center justify-center space-y-1">
          <div className="text-[10px] text-[#2dba7e] font-mc-small animate-pulse text-center px-2">
            {status || "Iniciando..."}
          </div>
          <div className="w-full h-1 bg-[#111411] rounded-full overflow-hidden">
            <div className="h-full bg-[#2dba7e] animate-pulse w-full rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  )
}

