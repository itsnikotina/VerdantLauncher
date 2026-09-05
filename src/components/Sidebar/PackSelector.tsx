import { useState, useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

interface InstanceConfig {
  id: string
  name: string
  description: string | null
  mc_version: string
  loader: string
  loader_version: string | null
  ram_mb: number
  icon_path: string | null
}

interface PackSelectorProps {
  activeInstance: InstanceConfig | null
  onSelect: (instance: InstanceConfig) => void
  onCreateNew?: () => void
}

export default function PackSelector({ activeInstance, onSelect, onCreateNew }: PackSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [instances, setInstances] = useState<InstanceConfig[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  const fetchInstances = async () => {
    try {
      const json = await invoke<string>('get_instances')
      setInstances(JSON.parse(json))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchInstances()
    }
  }, [isOpen])

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const displayVersion = activeInstance 
    ? `${activeInstance.loader !== 'vanilla' ? activeInstance.loader + ' ' : ''}${activeInstance.mc_version}` 
    : 'Nenhuma'

  const displayName = activeInstance ? activeInstance.name : 'Selecione...'

  return (
    <div className="relative w-full" ref={menuRef}>
      {isOpen && (
        <div className="absolute bottom-0 left-full w-[220px] xl:w-[280px] 2xl:w-[350px] bg-[#111411] border border-[#2dba7e]/30 rounded shadow-xl overflow-hidden z-50 flex flex-col max-h-[250px] xl:max-h-[350px] 2xl:max-h-[450px] animate-in fade-in slide-in-from-left-2 duration-150 transition-all">
          <div className="overflow-y-auto custom-scrollbar flex-1 py-1 xl:py-2">
            
            <button
              onClick={() => {
                setIsOpen(false)
                if (onCreateNew) onCreateNew()
              }}
              className="w-full text-left px-3 py-2 xl:px-4 xl:py-3 2xl:px-5 2xl:py-4 flex items-center gap-2 xl:gap-3 hover:bg-[#1db868]/20 transition-colors border-b border-[#2dba7e]/20 mb-1"
            >
              <span className="text-[#1db868] text-[16px] xl:text-[20px] 2xl:text-[24px] font-bold leading-none">+</span>
              <span className="font-mc-small text-[#1db868] text-[10px] xl:text-[12px] 2xl:text-[14px] mt-0.5 tracking-wide transition-all">NOVA INSTANCIA</span>
            </button>

            {instances.length === 0 ? (
              <p className="text-center font-mc-small text-[10px] xl:text-[12px] 2xl:text-[14px] text-[#8a9a8a] py-3 xl:py-4 transition-all">NENHUMA INSTANCIA</p>
            ) : (
              instances.map(inst => (
                <button
                  key={inst.id}
                  onClick={() => {
                    onSelect(inst)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 xl:px-4 xl:py-3 2xl:px-5 2xl:py-4 flex items-center gap-2.5 xl:gap-3.5 2xl:gap-4 hover:bg-[#2dba7e]/20 transition-colors ${
                    activeInstance?.id === inst.id ? 'bg-[#2dba7e]/10 border-l-2 border-[#1db868]' : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="w-[30px] h-[30px] xl:w-[40px] xl:h-[40px] 2xl:w-[50px] 2xl:h-[50px] bg-[#1a1c1a] rounded flex-shrink-0 overflow-hidden border border-[#2dba7e]/30 transition-all">
                    {inst.icon_path ? (
                      <img src={inst.icon_path} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#242424]">
                        <span className="text-[#4a4a4a] text-[8px] xl:text-[10px] 2xl:text-[12px] font-sans transition-all">No</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="font-mc-small text-white text-[11px] xl:text-[13px] 2xl:text-[15px] truncate w-full transition-all">{inst.name}</span>
                    <span className="font-mc-small text-[#8a9a8a] text-[9px] xl:text-[10px] 2xl:text-[12px] mt-0.5 truncate w-full transition-all">
                      {inst.loader !== 'vanilla' ? inst.loader + ' ' : ''}{inst.mc_version}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#1a9e6a] hover:bg-[#20b87a] transition-colors rounded-t-lg px-3 py-2 xl:px-4 xl:py-3 2xl:px-5 2xl:py-4 flex items-center justify-between group"
      >
        <div className="flex items-center gap-2.5 xl:gap-3 2xl:gap-4 overflow-hidden flex-1">
          <div className="w-[28px] h-[28px] xl:w-[36px] xl:h-[36px] 2xl:w-[48px] 2xl:h-[48px] bg-black/20 rounded flex-shrink-0 overflow-hidden transition-all duration-300">
            {activeInstance?.icon_path ? (
              <img src={activeInstance.icon_path} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-black/10"></div>
            )}
          </div>
          <div className="text-left flex-1 overflow-hidden">
            <p className="font-mc-small text-white/60 text-[9px] xl:text-[11px] 2xl:text-xs tracking-widest truncate transition-all duration-300">{displayVersion}</p>
            <p className="font-mc-small text-white text-xs xl:text-sm 2xl:text-base tracking-wide truncate mt-0.5 transition-all duration-300">{displayName}</p>
          </div>
        </div>
        <ChevronRight 
          size={14} 
          className={`text-white/60 group-hover:text-white transition-all flex-shrink-0 ml-2 xl:w-5 xl:h-5 2xl:w-6 2xl:h-6 ${isOpen ? 'translate-x-0.5 text-white' : ''}`} 
        />
      </button>
    </div>
  )
}
