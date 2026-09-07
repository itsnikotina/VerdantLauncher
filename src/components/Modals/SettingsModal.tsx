import { useState, useEffect } from 'react'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [rpcEnabled, setRpcEnabled] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('rpcEnabled')
    if (saved !== null) {
      setRpcEnabled(saved === 'true')
    }
  }, [])

  const handleToggleRpc = () => {
    const newVal = !rpcEnabled
    setRpcEnabled(newVal)
    localStorage.setItem('rpcEnabled', newVal.toString())
    window.dispatchEvent(new Event('rpc-settings-changed'))
  }

  return (
    <div 
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      
      {/* Container Principal */}
      <div 
        className="w-full max-w-[600px] bg-[#0a0c0a] shadow-2xl rounded-sm overflow-hidden flex flex-col border border-[#1db868]/20 relative"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="h-[60px] bg-[#1db868] flex items-center justify-center relative z-10">
          <h2 className="font-mc-big text-[28px] text-white tracking-widest pb-1 drop-shadow-[0_2px_0_rgba(13,89,42,1)]">
            SETTINGS
          </h2>
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0a0c0a] hover:text-white font-mc-big text-xl transition-colors pb-1"
          >
            X
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col gap-6 max-h-[60vh] overflow-y-auto relative z-10 custom-scrollbar">
          
          <div className="bg-[#111411] border border-[#2dba7e]/20 p-5 rounded flex items-center justify-between hover:border-[#2dba7e]/50 transition-colors">
            
            <div className="flex flex-col gap-1 pr-4">
              <h3 className="font-mc-big text-white text-[18px] uppercase drop-shadow-md">
                Discord Rich Presence
              </h3>
              <p className="font-sans text-[12px] text-[#8a9a8a] leading-tight">
                Mostra no seu perfil do Discord que você está usando o Verdant Launcher e qual modpack está jogando.
              </p>
            </div>

            {/* Toggle Button */}
            <button 
              onClick={handleToggleRpc}
              className={`relative w-14 h-7 flex-shrink-0 rounded-full transition-colors duration-300 border-2 ${
                rpcEnabled ? 'bg-[#1db868] border-[#14844a]' : 'bg-[#242424] border-[#111411]'
              }`}
            >
              <div 
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                  rpcEnabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>

          </div>

        </div>

      </div>
    </div>
  )
}
