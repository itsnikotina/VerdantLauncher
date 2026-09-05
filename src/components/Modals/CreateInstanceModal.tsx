import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface CreateInstanceModalProps {
  onClose: () => void
  onUpdate?: () => void
}

interface MojangVersion {
  id: string
  type: string
  releaseTime: string
}

export default function CreateInstanceModal({ onClose, onUpdate }: CreateInstanceModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  
  // Versions fetch
  const [versions, setVersions] = useState<MojangVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState('')
  
  // Filters
  const [showReleases, setShowReleases] = useState(true)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [showBetas, setShowBetas] = useState(false)
  
  const [loader, setLoader] = useState('vanilla')
  const [loaderVersions, setLoaderVersions] = useState<string[]>([])
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string | null>(null)
  const [loadingLoaders, setLoadingLoaders] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    invoke<string>('fetch_vanilla_versions')
      .then(json => {
        const data: MojangVersion[] = JSON.parse(json)
        setVersions(data)
        // Select latest release by default
        const latest = data.find(v => v.type === 'release')
        if (latest) setSelectedVersion(latest.id)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (loader === 'vanilla' || !selectedVersion) {
      setLoaderVersions([])
      setSelectedLoaderVersion(null)
      return
    }

    setLoadingLoaders(true)
    invoke<string>('fetch_loader_versions', { mcVersion: selectedVersion, loader })
      .then(json => {
        const versions = JSON.parse(json)
        setLoaderVersions(versions)
        if (versions.length > 0) setSelectedLoaderVersion(versions[0])
        else setSelectedLoaderVersion(null)
      })
      .catch(e => {
        console.error(e)
        setLoaderVersions([])
        setSelectedLoaderVersion(null)
      })
      .finally(() => setLoadingLoaders(false))
  }, [loader, selectedVersion])

  const filteredVersions = versions.filter(v => {
    if (v.type === 'release' && showReleases) return true;
    if (v.type === 'snapshot' && showSnapshots) return true;
    if (v.type === 'old_beta' && showBetas) return true;
    if (v.type === 'old_alpha' && showBetas) return true;
    return false;
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Nome e obrigatorio')
    if (!selectedVersion) return setError('Selecione uma versao')
    if (loader !== 'vanilla' && !selectedLoaderVersion) return setError('Selecione a versao do loader')
    
    setError(null)
    setLoading(true)
    
    try {
      await invoke('create_instance', {
        name,
        description: description.trim() === '' ? null : description,
        mcVersion: selectedVersion,
        loader,
        loaderVersion: loader === 'vanilla' ? null : selectedLoaderVersion
      })
      if (onUpdate) onUpdate()
      onClose()
    } catch (err: any) {
      setError(err)
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[800px] max-h-[85vh] bg-[#0a0c0a] shadow-2xl rounded-sm flex flex-col border border-[#1db868]/20 relative"
        onClick={e => e.stopPropagation()}
      >
        
        <div className="h-[60px] flex-shrink-0 bg-[#1db868] flex items-center justify-center relative z-10">
          <h2 className="font-mc-big text-[28px] text-white tracking-widest pb-1 drop-shadow-[0_2px_0_rgba(13,89,42,1)]">
            CREATE PACK
          </h2>
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0a0c0a] hover:text-white font-mc-big text-xl transition-colors pb-1"
          >
            X
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 flex flex-col gap-6 relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
            {/* Esquerda: Informações básicas */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">NOME DA INSTANCIA</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Meu Modpack" 
                  className="w-full bg-[#111411] border border-[#2dba7e]/30 rounded-sm px-3 py-2 text-white font-sans text-sm focus:outline-none focus:border-[#32d583]"
                />
              </div>
              <div>
                <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">DESCRICAO (Opcional)</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Um modpack super legal..." 
                  className="w-full bg-[#111411] border border-[#2dba7e]/30 rounded-sm px-3 py-2 text-white font-sans text-sm h-24 resize-none focus:outline-none focus:border-[#32d583]"
                />
              </div>

              <div>
                <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">MOD LOADER</label>
                <div className="flex flex-wrap gap-2">
                  {['vanilla', 'fabric', 'forge'].map(l => (
                    <label key={l} className="flex items-center gap-2 cursor-pointer font-sans text-sm text-white">
                      <input 
                        type="radio" 
                        name="loader" 
                        value={l} 
                        checked={loader === l}
                        onChange={() => setLoader(l)}
                        className="accent-[#32d583]"
                      />
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </label>
                  ))}
                </div>
                {loader !== 'vanilla' && (
                  <div className="mt-4">
                    <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">VERSAO DO {loader.toUpperCase()}</label>
                    {loadingLoaders ? (
                      <p className="text-[#32d583] text-xs font-sans">Carregando versões...</p>
                    ) : loaderVersions.length === 0 ? (
                      <p className="text-red-400 text-xs font-sans">Nenhuma versão encontrada.</p>
                    ) : (
                      <select 
                        value={selectedLoaderVersion || ''} 
                        onChange={e => setSelectedLoaderVersion(e.target.value)}
                        className="w-full bg-[#111411] border border-[#2dba7e]/30 rounded-sm px-3 py-2 text-white font-sans text-sm focus:outline-none focus:border-[#32d583]"
                      >
                        {loaderVersions.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Direita: Seleção de versao */}
            <div className="flex flex-col gap-2 min-h-[300px]">
              <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">VERSAO DO JOGO</label>
              
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-1 cursor-pointer font-sans text-xs text-[#8a9a8a] hover:text-white">
                  <input type="checkbox" checked={showReleases} onChange={e => setShowReleases(e.target.checked)} className="accent-[#32d583]" />
                  Releases
                </label>
                <label className="flex items-center gap-1 cursor-pointer font-sans text-xs text-[#8a9a8a] hover:text-white">
                  <input type="checkbox" checked={showSnapshots} onChange={e => setShowSnapshots(e.target.checked)} className="accent-[#32d583]" />
                  Snapshots
                </label>
                <label className="flex items-center gap-1 cursor-pointer font-sans text-xs text-[#8a9a8a] hover:text-white">
                  <input type="checkbox" checked={showBetas} onChange={e => setShowBetas(e.target.checked)} className="accent-[#32d583]" />
                  Betas
                </label>
              </div>

              <div className="flex-1 min-h-0 bg-[#111411] border border-[#2dba7e]/20 rounded-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                  {filteredVersions.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVersion(v.id)}
                      className={`w-full text-left px-3 py-1.5 flex justify-between items-center border-b border-white/5 hover:bg-[#32d583]/10 font-sans text-xs transition-colors ${
                        selectedVersion === v.id ? 'bg-[#32d583]/20 text-[#32d583]' : 'text-[#8a9a8a]'
                      }`}
                    >
                      <span>{v.id}</span>
                      <span className="opacity-50">{v.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <div className="flex justify-end pt-4 border-t border-[#2dba7e]/20 flex-shrink-0 mt-auto">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#1db868] hover:bg-[#32d583] disabled:opacity-50 text-white font-mc-big text-[20px] px-8 pt-2 pb-3 rounded-sm shadow-[0_4px_0_#14844a] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <span className="drop-shadow-[0_4px_0_rgba(13,89,42,1)]">{loading ? 'CRIANDO...' : 'CRIAR'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
