import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import AvatarHead from '../AvatarHead'


export default function UserHeader({ setModal }: { setModal: (modal: string | null) => void }) {
  const { user, mcUser, signOut, cachedSkinUrl } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isMicrosoft = !!mcUser;
  const displayName = isMicrosoft 
    ? mcUser.name.toUpperCase()
    : (user?.user_metadata?.username || user?.email?.split('@')[0] || 'JOGADOR').toUpperCase();

  const skinUrlForAvatar = cachedSkinUrl 
    ? cachedSkinUrl
    : isMicrosoft 
      ? `https://api.mcheads.org/skin/${mcUser.name}`
      : user?.user_metadata?.username ? `https://gqdhfxbrlnbdcsobhzro.supabase.co/storage/v1/object/public/skins/${user.user_metadata.username}.png?t=${user.updated_at || Date.now()}` : '';

  return (
    <div className="relative" ref={menuRef}>
      {/* Botǜo Principal */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 bg-[#2dba7e] hover:bg-[#32d583] transition-colors px-3 py-3 xl:px-4 xl:py-4 text-left z-20"
      >
        <div className="w-10 h-10 xl:w-12 xl:h-12 2xl:w-16 2xl:h-16 bg-white/20 border-2 border-white/40 rounded flex-shrink-0 flex items-center justify-center overflow-hidden bg-[#111411] transition-all duration-300">
          {skinUrlForAvatar ? (
            <AvatarHead skinUrl={skinUrlForAvatar} size={64} />
          ) : (
            <span className="text-white font-mc-big text-base xl:text-lg 2xl:text-xl">
              {displayName.charAt(0)}
            </span>
          )}
        </div>
        <div className="overflow-hidden flex-1">
          <p className="font-mc-big text-white text-xs xl:text-sm 2xl:text-base tracking-wider truncate transition-all duration-300">
            {displayName}
          </p>
          <p className="font-mc-small text-white/70 text-[9px] xl:text-[10px] 2xl:text-xs tracking-widest mt-0.5 transition-all duration-300">
            {isMicrosoft ? "CONTA MICROSOFT" : "CONTA VERDANT"}
          </p>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-[#0a0c0a] border-b border-x border-[#2dba7e]/30 shadow-2xl z-50">
          <button 
            onClick={() => {
              setIsOpen(false);
              setModal('profile');
            }}
            className="w-full text-left px-4 py-3 xl:px-5 xl:py-4 2xl:px-6 2xl:py-5 font-mc-small text-xs xl:text-sm 2xl:text-base text-white hover:bg-white/10 transition-colors"
          >
            MEU PERFIL
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="w-full text-left px-4 py-3 xl:px-5 xl:py-4 2xl:px-6 2xl:py-5 font-mc-small text-xs xl:text-sm 2xl:text-base text-red-400 hover:bg-red-500/20 transition-colors"
          >
            DESLOGAR
          </button>
        </div>
      )}
    </div>
  )
}






