import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { ArrowUp, ArrowDown } from 'lucide-react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../utils/cropImage'
import { ManageInstanceModal } from './ManageInstanceModal'
import InstanceSettingsModal from './InstanceSettingsModal'
import gearIconUrl from '../../assets/images/gearicon.png'
import trashIconUrl from '../../assets/images/trashicon.png'
import folderIconUrl from '../../assets/images/foldericon.png'

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

interface InstancesModalProps {
  onClose: () => void
  onPlay: (instanceId: string) => void
  onCreateNew: () => void
  onDelete: (instanceId: string) => void
  onUpdate?: () => void
}

export default function InstancesModal({ onClose, onPlay, onCreateNew, onDelete, onUpdate }: InstancesModalProps) {
  const [instances, setInstances] = useState<InstanceConfig[]>([])
  const [instanceToDelete, setInstanceToDelete] = useState<InstanceConfig | null>(null)
  const [managingInstance, setManagingInstance] = useState<InstanceConfig | null>(null)
  const [settingsInstance, setSettingsInstance] = useState<InstanceConfig | null>(null)
  
  // Crop States
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropTargetInstance, setCropTargetInstance] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

  const fetchInstances = () => {
    invoke<string>('get_instances')
      .then(json => {
        setInstances(JSON.parse(json))
        if (onUpdate) onUpdate()
      })
      .catch(console.error)
  }

  useEffect(() => {
    fetchInstances()
  }, [])

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const currentId = instances[index].id;
    const prevId = instances[index - 1].id;
    await invoke('swap_instances_order', { id1: currentId, id2: prevId });
    fetchInstances();
  };

  const handleMoveDown = async (index: number) => {
    if (index === instances.length - 1) return;
    const currentId = instances[index].id;
    const nextId = instances[index + 1].id;
    await invoke('swap_instances_order', { id1: currentId, id2: nextId });
    fetchInstances();
  };

  const handleChangeIcon = async (id: string) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg'] }]
      })
      if (selected && typeof selected === 'string') {
        const base64Data = await invoke<string>('read_image_file', { path: selected })
        setCropImageSrc(base64Data)
        setCropTargetInstance(id)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
      }
    } catch (e) {
      console.error('Failed to set icon:', e)
    }
  }

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleApplyCrop = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !cropTargetInstance) return
    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels)
      if (croppedBlob) {
        const arrayBuffer = await croppedBlob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        await invoke('set_instance_icon_data', { 
          id: cropTargetInstance, 
          imageData: Array.from(uint8Array) 
        })
        setCropImageSrc(null)
        setCropTargetInstance(null)
        fetchInstances()
      }
    } catch (e) {
      console.error('Failed to crop image:', e)
    }
  }

  const handleDelete = async () => {
    if (!instanceToDelete) return
    try {
      await invoke('delete_instance', { id: instanceToDelete.id })
      onDelete(instanceToDelete.id)
      setInstanceToDelete(null)
      fetchInstances()
    } catch (e) {
      alert(e)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      
      {/* Container Principal */}
      <div 
        className="w-full max-w-[760px] bg-[#0a0c0a] shadow-2xl rounded-sm overflow-hidden flex flex-col border border-[#1db868]/20 relative"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Scrollbar pseudo-element bar behind the scroll */}
        <div className="absolute right-0 top-14 bottom-0 w-3 bg-[#111411] border-l border-[#1db868]/10 pointer-events-none z-0"></div>

        {/* Header */}
        <div className="h-[60px] bg-[#1db868] flex items-center justify-center relative z-10">
          <h2 className="font-mc-big text-[28px] text-white tracking-widest pb-1 drop-shadow-[0_2px_0_rgba(13,89,42,1)]">
            INSTANCES
          </h2>
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0a0c0a] hover:text-white font-mc-big text-xl transition-colors pb-1"
          >
            X
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto relative z-10 custom-scrollbar pr-5">
          
          <button
            onClick={onCreateNew}
            className="bg-[#0a0c0a] border-2 border-dashed border-[#2dba7e]/30 p-4 rounded flex items-center justify-center gap-3 hover:border-[#2dba7e] hover:bg-[#2dba7e]/10 transition-colors min-h-[116px] group"
          >
            <span className="text-[#1db868] text-[32px] font-bold leading-none group-hover:scale-110 transition-transform pb-1">+</span>
            <span className="font-mc-big text-[#1db868] text-[20px] tracking-widest pb-1 drop-shadow-[0_2px_0_rgba(13,89,42,0.4)]">CRIAR NOVA INSTANCIA</span>
          </button>

          {instances.length === 0 && (
            <div className="text-center py-10">
              <p className="font-mc-small text-[#8a9a8a] text-sm">NENHUMA INSTANCIA ENCONTRADA</p>
            </div>
          )}

          {instances.map((inst, index) => (
            <div 
              key={inst.id} 
              className="bg-[#111411] border border-[#2dba7e]/20 p-4 rounded flex gap-5 hover:border-[#2dba7e]/50 transition-colors group/inst"
            >
              {/* Icon / Image */}
              <div 
                onClick={() => handleChangeIcon(inst.id)}
                className="w-[84px] h-[84px] bg-[#1a1c1a] rounded flex-shrink-0 relative group cursor-pointer overflow-hidden border border-[#2dba7e]/30"
              >
                {inst.icon_path ? (
                  <img 
                    src={inst.icon_path} 
                    alt={inst.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#242424]">
                    <span className="text-[#4a4a4a] text-xs font-sans">No Image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white font-mc-small text-[10px] tracking-wider text-center px-1 drop-shadow-md">MUDAR FOTO</span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col pt-1">
                
                {/* Top Row: Title & Actions */}
                <div className="flex justify-between items-start">
                  <h3 className="font-mc-big text-white text-[20px] uppercase leading-none drop-shadow-md">
                    {inst.name}
                  </h3>
                  <div className="flex gap-3 mt-1 items-center">
                    
                    {/* Order arrows */}
                    <div className="flex gap-1 opacity-0 group-hover/inst:opacity-100 transition-opacity mr-2">
                      <button 
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="text-[#8a9a8a] hover:text-[#2dba7e] disabled:opacity-30 disabled:hover:text-[#8a9a8a] transition-colors"
                        title="Mover para Cima"
                      >
                        <ArrowUp size={18} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => handleMoveDown(index)}
                        disabled={index === instances.length - 1}
                        className="text-[#8a9a8a] hover:text-[#2dba7e] disabled:opacity-30 disabled:hover:text-[#8a9a8a] transition-colors"
                        title="Mover para Baixo"
                      >
                        <ArrowDown size={18} strokeWidth={3} />
                      </button>
                    </div>

                    <button 
                      title="Configuracoes"
                      onClick={() => setSettingsInstance(inst)}
                      className="w-[18px] h-[18px] bg-[#8a9a8a] hover:bg-white transition-colors cursor-pointer"
                      style={{
                        maskImage: `url(${gearIconUrl})`,
                        WebkitMaskImage: `url(${gearIconUrl})`,
                        maskSize: 'contain', WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center', WebkitMaskPosition: 'center'
                      }}
                    />
                    <button 
                      title="Deletar"
                      onClick={() => setInstanceToDelete(inst)}
                      className="w-[18px] h-[18px] bg-[#8a9a8a] hover:bg-[#ff3333] transition-colors"
                      style={{
                        maskImage: `url(${trashIconUrl})`,
                        WebkitMaskImage: `url(${trashIconUrl})`,
                        maskSize: 'contain', WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center', WebkitMaskPosition: 'center'
                      }}
                    />
                  </div>
                </div>

                {/* Middle: Description */}
                <p className="font-sans text-[11px] text-[#8a9a8a] mt-0.5 line-clamp-2 pr-10">
                  {inst.description || "Nenhuma descricao fornecida para esta instancia."}
                </p>

                {/* Bottom Row: Buttons & Version */}
                <div className="flex items-end gap-3 mt-auto">
                  <button 
                    onClick={() => onPlay(inst.id)}
                    className="bg-[#1db868] hover:bg-[#32d583] text-white font-mc-big text-[16px] px-5 pt-1.5 pb-2 rounded-sm shadow-[0_3px_0_#14844a] active:translate-y-[3px] active:shadow-none transition-all"
                  >
                    <span className="drop-shadow-[0_2px_0_rgba(13,89,42,1)]">PLAY</span>
                  </button>
                  
                  {inst.loader.toLowerCase() !== 'vanilla' && (
                    <button 
                      onClick={() => setManagingInstance(inst)}
                      className="bg-[#2a2d2a] hover:bg-[#3a3d3a] text-white font-mc-big text-[16px] px-5 pt-1.5 pb-2 rounded-sm shadow-[0_3px_0_#151715] active:translate-y-[3px] active:shadow-none transition-all"
                    >
                      MODS
                    </button>
                  )}

                  <button 
                    title="Abrir Pasta"
                    onClick={() => invoke('open_instance_folder', { id: inst.id }).catch(e => console.error(e))}
                    className="w-[22px] h-[22px] bg-[#1db868] hover:bg-[#32d583] transition-colors ml-1 mb-1 cursor-pointer"
                    style={{
                      maskImage: `url(${folderIconUrl})`,
                      WebkitMaskImage: `url(${folderIconUrl})`,
                      maskSize: 'contain', WebkitMaskSize: 'contain',
                      maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                      maskPosition: 'center', WebkitMaskPosition: 'center'
                    }}
                  />

                  {/* Version Text */}
                  <div className="ml-auto font-mc-small text-[#1db868] text-[10px] tracking-wider mb-1">
                    {inst.loader.toLowerCase() !== 'vanilla' ? `${inst.loader} ` : ''}{inst.mc_version}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
        </div>
      </div>

      {/* Modal de Confirmacao de Delecao */}
      {instanceToDelete && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#111411] border border-[#ff3333]/30 rounded p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-mc-big text-white text-[24px] mb-2 text-center text-[#ff3333]">ATENCAO</h3>
            <p className="font-sans text-sm text-[#8a9a8a] text-center mb-6">
              Tem certeza que deseja apagar a instancia <strong className="text-white">{instanceToDelete.name}</strong>? Esta acao nao pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setInstanceToDelete(null)}
                className="flex-1 bg-[#2a2d2a] hover:bg-[#3a3d3a] text-white font-mc-big text-[16px] py-2 rounded-sm transition-colors"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 bg-[#ff3333] hover:bg-[#ff4f4f] text-white font-mc-big text-[16px] py-2 rounded-sm shadow-[0_3px_0_#8e0000] active:translate-y-[3px] active:shadow-none transition-all"
              >
                APAGAR
              </button>
            </div>
          </div>
        </div>
      )}

      {managingInstance && (
        <ManageInstanceModal 
          isOpen={true} 
          onClose={() => setManagingInstance(null)} 
          instance={managingInstance} 
        />
      )}

      {settingsInstance && (
        <InstanceSettingsModal 
          isOpen={true} 
          onClose={() => setSettingsInstance(null)} 
          instance={settingsInstance as any} 
          onInstanceUpdated={() => { fetchInstances(); if (onUpdate) onUpdate(); }}
        />
      )}

      {/* Cropper Modal */}
      {cropImageSrc && (
        <div 
          className="absolute inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setCropImageSrc(null);
          }}
        >
          <div 
            className="w-full max-w-[500px] h-[500px] bg-[#111411] border border-[#2dba7e]/30 rounded relative flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 flex justify-between items-center border-b border-[#2dba7e]/20">
              <h3 className="text-white font-sans font-semibold">Editar imagem</h3>
              <button onClick={() => setCropImageSrc(null)} className="text-[#8a9a8a] hover:text-white transition-colors">X</button>
            </div>
            
            <div className="relative flex-1 bg-black">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-4 flex items-center justify-between border-t border-[#2dba7e]/20">
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-1/2 accent-[#1db868]"
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setCropImageSrc(null)}
                  className="px-4 py-2 font-sans text-sm font-semibold text-white bg-[#2a2d2a] hover:bg-[#3a3d3a] rounded transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleApplyCrop}
                  className="px-4 py-2 font-sans text-sm font-semibold text-white bg-[#1db868] hover:bg-[#32d583] rounded transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
