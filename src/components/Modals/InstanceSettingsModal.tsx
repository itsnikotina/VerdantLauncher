import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../utils/cropImage'
interface InstanceConfig {
  id: string
  name: string
  description: string | null
  mc_version: string
  loader: string
  loader_version: string | null
  ram_mb: number
  java_args: string | null
  icon_path: string | null
}

interface InstanceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  instance: InstanceConfig
  onInstanceUpdated: () => void
}

export default function InstanceSettingsModal({ isOpen, onClose, instance, onInstanceUpdated }: InstanceSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'java'>('general')
  
  // State for General
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconPath, setIconPath] = useState<string | null>(null) // Path temporario da nova imagem escolhida
  const [iconPreview, setIconPreview] = useState<string | null>(null) // Data URI da preview

  // Crop States
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [croppedImageData, setCroppedImageData] = useState<number[] | null>(null)

  // State for Java
  const [ramMb, setRamMb] = useState<number>(4096)
  const [javaArgs, setJavaArgs] = useState('')
  
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form state when modal opens
  useEffect(() => {
    if (isOpen && instance) {
      setName(instance.name)
      setDescription(instance.description || '')
      setRamMb(instance.ram_mb || 4096)
      setJavaArgs(instance.java_args || '')
      setIconPreview(instance.icon_path || null)
      setIconPath(null) // Reseta o path pq s setamos se o cara escolher uma nova imagem
      setActiveTab('general')
    }
  }, [isOpen, instance])

  if (!isOpen) return null

  const handleSelectIcon = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Imagens',
          extensions: ['png', 'jpg', 'jpeg']
        }]
      })
      
      if (selected && typeof selected === 'string') {
        // Read file to open cropper
        const dataUrl: string = await invoke('read_image_file', { path: selected })
        setCropImageSrc(dataUrl)
      }
    } catch (e) {
      console.error("Falha ao selecionar imagem:", e)
    }
  }

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return
    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels)
      if (croppedBlob) {
        const arrayBuffer = await croppedBlob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        setCroppedImageData(Array.from(uint8Array))
        setIconPreview(URL.createObjectURL(croppedBlob))
        setIconPath('CROPPED')
        setCropImageSrc(null)
      }
    } catch (e) {
      console.error("Erro ao cortar:", e)
    }
  }

  const handleRemoveIcon = () => {
    setIconPath('REMOVE') // Flag magica pra remover o icon no backend
    setIconPreview(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // 1. Atualizar configs textuais
      await invoke('update_instance', {
        id: instance.id,
        name,
        description: description.trim() === '' ? null : description,
        ramMb,
        javaArgs: javaArgs.trim() === '' ? null : javaArgs
      })

      // 2. Atualizar icone se foi modificado
      if (iconPath === 'REMOVE') {
        await invoke('set_instance_icon', { id: instance.id, imagePath: null })
      } else if (iconPath === 'CROPPED' && croppedImageData) {
        await invoke('set_instance_icon_data', { id: instance.id, imageData: croppedImageData })
      }

      onInstanceUpdated()
      onClose()
    } catch (e) {
      console.error("Erro ao salvar configuraes:", e)
      alert("Erro ao salvar: " + e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="bg-[#242424] border border-[#3a3a3a] w-full max-w-2xl h-[70vh] min-h-[500px] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-[#1e1e1e] p-3 flex items-center justify-between border-b border-[#3a3a3a]">
          <h2 className="text-[#1db868] font-mc-small text-sm drop-shadow-[0_2px_0_rgba(13,89,42,0.4)]">
            SETTINGS FOR {instance.name.toUpperCase()}
          </h2>
          <button 
            onClick={onClose}
            className="text-[#8a9a8a] hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#1a1a1a] border-b border-[#3a3a3a]">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-6 py-2.5 font-sans font-bold text-[13px] tracking-wide transition-colors ${
              activeTab === 'general' 
                ? 'bg-[#242424] text-white border-b-2 border-[#1db868]' 
                : 'text-[#8a9a8a] hover:text-white hover:bg-[#242424]'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('java')}
            className={`px-6 py-2.5 font-sans font-bold text-[13px] tracking-wide transition-colors ${
              activeTab === 'java' 
                ? 'bg-[#242424] text-white border-b-2 border-[#1db868]' 
                : 'text-[#8a9a8a] hover:text-white hover:bg-[#242424]'
            }`}
          >
            Java / Minecraft
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
                            {/* Image Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-[#aaaaaa] font-sans text-[13px] font-bold flex items-center gap-1.5">
                  Instance Icon:
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#1e1e1e] border border-[#3a3a3a] flex items-center justify-center overflow-hidden shrink-0">
                    {iconPreview ? (
                      <img src={iconPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Icon icon="mdi:image-outline" className="w-8 h-8 text-[#4a4a4a]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={handleSelectIcon}
                      className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#4a4a4a] text-white px-4 py-1.5 text-xs font-sans rounded-sm transition-colors"
                    >
                      Change Icon
                    </button>
                    {iconPreview && (
                      <button 
                        onClick={handleRemoveIcon}
                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-1.5 text-xs font-sans rounded-sm transition-colors"
                      >
                        Remove Icon
                      </button>
                    )}
                  </div>
                </div>
              </div>

                            {/* Name */}
              <div className="flex flex-col gap-2">
                <label className="text-[#aaaaaa] font-sans text-[13px] font-bold flex items-center gap-1.5">
                  Instance Name:
                </label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-[#1e1e1e] border border-[#3a3a3a] outline-none focus:border-[#1db868]/50 text-white px-3 py-2 text-sm font-sans rounded-sm"
                  placeholder="My Modpack..."
                />
              </div>

                            {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-[#aaaaaa] font-sans text-[13px] font-bold flex items-center gap-1.5">
                  Description:
                </label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="bg-[#1e1e1e] border border-[#3a3a3a] outline-none focus:border-[#1db868]/50 text-white px-3 py-2 text-sm font-sans rounded-sm min-h-[100px] resize-y"
                  placeholder="Best RPG Modpack..."
                />
              </div>
            </div>
          )}

          {activeTab === 'java' && (
            <div className="space-y-6">
                            {/* RAM */}
              <div className="flex flex-col gap-2">
                <label className="text-[#aaaaaa] font-sans text-[13px] font-bold flex items-center gap-1.5">
                  <div className="relative flex items-center group cursor-help">
                    <Icon icon="mdi:help-circle" className="text-[#3b82f6] w-4 h-4" />
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-max max-w-[250px] p-2 bg-[#111111] border border-[#3a3a3a] rounded shadow-lg text-[11px] text-white/80 font-sans font-normal opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                      Maximum amount of RAM (Memory) the game can use.
                    </div>
                  </div>
                  Maximum Memory/Ram (MB):
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    value={ramMb}
                    min="1024"
                    step="1024"
                    onChange={e => setRamMb(parseInt(e.target.value) || 2048)}
                    className="bg-[#1e1e1e] border border-[#3a3a3a] outline-none focus:border-[#1db868]/50 text-white px-3 py-2 text-sm font-sans rounded-sm w-[150px]"
                  />
                  <span className="text-[#8a9a8a] text-xs font-sans">
                    {(ramMb / 1024).toFixed(1)} GB
                  </span>
                </div>
              </div>

                            {/* Java Parameters */}
              <div className="flex flex-col gap-2">
                <label className="text-[#aaaaaa] font-sans text-[13px] font-bold flex items-center gap-1.5">
                  <div className="relative flex items-center group cursor-help">
                    <Icon icon="mdi:help-circle" className="text-[#3b82f6] w-4 h-4" />
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-max max-w-[280px] p-2 bg-[#111111] border border-[#3a3a3a] rounded shadow-lg text-[11px] text-white/80 font-sans font-normal opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                      Advanced Java Arguments to override default garbage collection and optimization.
                    </div>
                  </div>
                  Java Parameters:
                </label>
                <div className="flex items-start gap-3">
                  <textarea 
                    value={javaArgs}
                    onChange={e => setJavaArgs(e.target.value)}
                    className="bg-[#1e1e1e] border border-[#3a3a3a] outline-none focus:border-[#1db868]/50 text-white px-3 py-2 text-sm font-sans rounded-sm h-[120px] resize-none flex-1 font-mono leading-relaxed"
                    placeholder="-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC ..."
                  />
                  <button 
                    onClick={() => setJavaArgs('-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M')}
                    className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#4a4a4a] text-white px-4 py-2 text-xs font-sans rounded-sm transition-colors shrink-0"
                  >
                    Reset (Aikar)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#1e1e1e] border-t border-[#3a3a3a] p-4 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="text-white hover:bg-[#2a2a2a] px-6 py-2 text-sm font-sans rounded-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="bg-[#1db868]/20 text-[#1db868] hover:bg-[#1db868]/30 border border-[#1db868]/40 px-8 py-2 text-sm font-sans font-bold rounded-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>

      {/* Cropper Modal */}
      {cropImageSrc && (
        <div className="absolute inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center animate-in fade-in rounded-sm">
          <div className="w-full max-w-[500px] h-[500px] bg-[#111411] border border-[#2dba7e]/30 rounded relative flex flex-col shadow-2xl">
            <div className="p-4 flex justify-between items-center border-b border-[#2dba7e]/20">
              <h3 className="text-white font-sans font-semibold">Editar imagem</h3>
              <button onClick={() => setCropImageSrc(null)} className="text-[#8a9a8a] hover:text-white transition-colors">
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
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
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-4 border-t border-[#2dba7e]/20 flex flex-col gap-4">
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[#1db868]"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setCropImageSrc(null)}
                  className="flex-1 bg-[#2a2d2a] hover:bg-[#3a3d3a] text-white font-mc-big text-[16px] py-2 rounded-sm transition-colors"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleCropConfirm}
                  className="flex-1 bg-[#1db868] hover:bg-[#32d583] text-white font-mc-big text-[16px] py-2 rounded-sm shadow-[0_3px_0_#14844a] active:translate-y-[3px] active:shadow-none transition-all"
                >
                  CONFIRMAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}




