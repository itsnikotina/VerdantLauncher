import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Icon } from '@iconify/react'

interface InstanceConfig {
  id: string
  name: string
  description: string | null
  mc_version: string
  loader: string
  loader_version: string | null
  ram_mb: number
}

interface ManageInstanceModalProps {
  isOpen: boolean
  onClose: () => void
  instance: InstanceConfig
}

interface LocalMod {
  filename: string
  name: string
  path: string
  enabled: boolean
  file_type: string
  modified_at?: number
  project_id?: string
}

interface ModProject {
  project_id: string
  title: string
  description: string
  icon_url?: string
  author: string
  slug: string
}

interface ModDependency {
  version_id?: string
  project_id?: string
  dependency_type: string
}

interface ModVersion {
  id: string
  name: string
  version_number: string
  version_type: string
  files: { url: string; filename: string; primary: boolean }[]
  dependencies: ModDependency[]
}

interface ModProjectResult {
  id: string
  slug: string
  title: string
  description: string
  icon_url?: string
}

const CATEGORIES = [
  { id: '', name: 'All Categories' },
  { id: 'api', name: 'API and Library' },
  { id: 'adventure', name: 'Adventure and RPG' },
  { id: 'automation', name: 'Automation' },
  { id: 'cursed', name: 'Cursed' },
  { id: 'decoration', name: 'Decoration' },
  { id: 'economy', name: 'Economy' },
  { id: 'equipment', name: 'Equipment' },
  { id: 'food', name: 'Food' },
  { id: 'game-mechanics', name: 'Game Mechanics' },
  { id: 'magic', name: 'Magic' },
  { id: 'management', name: 'Management' },
  { id: 'minigame', name: 'Minigame' },
  { id: 'mobs', name: 'Mobs' },
  { id: 'optimization', name: 'Optimization' },
  { id: 'social', name: 'Social' },
  { id: 'storage', name: 'Storage' },
  { id: 'technology', name: 'Technology' },
  { id: 'utility', name: 'Utility' },
  { id: 'worldgen', name: 'World Generation' }
]

export function ManageInstanceModal({ isOpen, onClose, instance }: ManageInstanceModalProps) {
  const [activeTab, setActiveTab] = useState<'installed' | 'search'>('installed')
  
  // Installed state
  const [localMods, setLocalMods] = useState<LocalMod[]>([])
  const [isLoadingLocal, setIsLoadingLocal] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ModProject[]>([])
  const [, setTotalSearchHits] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [downloadingMod, setDownloadingMod] = useState<string | null>(null)
  
  // Install Modal State
  const [selectedProject, setSelectedProject] = useState<ModProject | null>(null)
  const [projectVersions, setProjectVersions] = useState<ModVersion[]>([])
  const [isFetchingVersions, setIsFetchingVersions] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  
  const [requiredDependencies, setRequiredDependencies] = useState<ModProjectResult[]>([])
  const [isFetchingDependencies, setIsFetchingDependencies] = useState(false)
  
  // Delete Modal State
  const [modToDelete, setModToDelete] = useState<string | null>(null)
  
  // Error Modal State
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // ATLauncher-like Filters
  const [projectType, setProjectType] = useState<'mod' | 'resourcepack' | 'shader'>('mod')
  const [localFilter, setLocalFilter] = useState<'mod' | 'resourcepack' | 'shader'>('mod')
  const [localSort, setLocalSort] = useState<'newest' | 'oldest'>('newest')
  const [sortParam, setSortParam] = useState<'relevance' | 'downloads' | 'updated'>('downloads')
  const [category, setCategory] = useState<string>('')
  const [offset, setOffset] = useState<number>(0)

  useEffect(() => {
    if (isOpen && activeTab === 'installed') {
      fetchLocalMods()
    } else if (isOpen && activeTab === 'search' && searchResults.length === 0) {
      // Auto-search on open if empty
      performSearch(0)
    }
  }, [isOpen, activeTab])

  // Trigger search when filters change (resetting offset)
  useEffect(() => {
    if (isOpen && activeTab === 'search') {
      performSearch(0)
    }
  }, [projectType, sortParam, category])

  // Fetch dependencies when selected version changes
  useEffect(() => {
    if (!selectedVersionId || projectVersions.length === 0) {
      setRequiredDependencies([])
      return
    }

    const version = projectVersions.find(v => v.id === selectedVersionId)
    if (!version || !version.dependencies) return

    const requiredIds = version.dependencies
      .filter(d => d.dependency_type === 'required' && d.project_id)
      .map(d => d.project_id as string)

    if (requiredIds.length === 0) {
      setRequiredDependencies([])
      return
    }

    const fetchDeps = async () => {
      setIsFetchingDependencies(true)
      try {
        const projects = await invoke<ModProjectResult[]>('get_modrinth_projects', { ids: requiredIds })
        setRequiredDependencies(projects)
      } catch (e) {
        console.error('Failed to fetch dependencies', e)
        setRequiredDependencies([])
      } finally {
        setIsFetchingDependencies(false)
      }
    }

    fetchDeps()
  }, [selectedVersionId, projectVersions])

    const formatModName = (filename: string) => {
    let clean = filename.replace(/\.(jar|zip)(\.disabled)?$/i, '');
    clean = clean.replace(/[-_](fabric|forge|quilt|neoforge|optifine|mc[\d\.]+)/ig, '');
    clean = clean.replace(/[-_+]+v?\d.*$/i, '');
    clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    clean = clean.replace(/[-_]/g, ' ');
    return clean
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const fetchLocalMods = async () => {
    setIsLoadingLocal(true)
    try {
      const mods: LocalMod[] = await invoke('get_instance_mods', { instanceId: instance.id })
      setLocalMods(mods)
    } catch (e) {
      console.error('Failed to load mods:', e)
    } finally {
      setIsLoadingLocal(false)
    }
  }

  const handleToggleMod = async (filename: string, enable: boolean) => {
    try {
      await invoke('toggle_instance_mod', { instanceId: instance.id, filename, enable })
      fetchLocalMods()
    } catch (e) {
      console.error('Failed to toggle mod:', e)
    }
  }

  const handleDeleteMod = (filename: string) => {
    setModToDelete(filename)
  }

  const confirmDeleteMod = async () => {
    if (!modToDelete) return
    try {
      await invoke('delete_instance_mod', { instanceId: instance.id, filename: modToDelete })
      fetchLocalMods()
    } catch (e) {
      console.error('Failed to delete mod:', e)
    } finally {
      setModToDelete(null)
    }
  }

  const performSearch = async (newOffset: number, overrideQuery?: string) => {
    setIsSearching(true)
    setOffset(newOffset)
    try {
      const queryToUse = overrideQuery !== undefined ? overrideQuery : searchQuery;
      const loaderParam = projectType === 'mod' ? (instance.loader === 'vanilla' ? 'fabric' : instance.loader) : ''
      const res: { hits: ModProject[], total_hits: number } = await invoke('search_modrinth_mods', {
        query: queryToUse,
        loader: loaderParam,
        version: instance.mc_version,
        projectType: projectType,
        sort: sortParam,
        category: category !== 'all' ? category : '',
        offset: newOffset,
        limit: 20
      })
      setSearchResults(res.hits)
      setTotalSearchHits(res.total_hits || 0)
    } catch (e) {
      console.error('Failed to search mods:', e)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch(0)
  }

  const handleOpenInstallModal = async (project: ModProject) => {
    setSelectedProject(project)
    setIsFetchingVersions(true)
    try {
      const loaderParam = projectType === 'mod' ? (instance.loader === 'vanilla' ? 'fabric' : instance.loader) : ''
      
      let versions: ModVersion[] = await invoke('get_modrinth_versions', {
        projectId: project.project_id,
        version: instance.mc_version,
        loader: loaderParam
      })

      // Fallback: se nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o achar versÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fica, puxar TODAS pra deixar o usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio escolher
      if (versions.length === 0) {
        versions = await invoke('get_modrinth_versions', {
          projectId: project.project_id,
          version: '',
          loader: ''
        })
      }

      setProjectVersions(versions)
      if (versions.length > 0) {
        const bestVersion = versions.find(v => v.version_type === 'release') || versions[0]
        setSelectedVersionId(bestVersion.id)
      } else {
        setErrorMessage('Nenhuma versÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi encontrada para este projeto.')
        setSelectedProject(null)
      }
    } catch (e) {
      console.error('Failed to fetch versions:', e)
      setErrorMessage('Falha ao conectar com o Modrinth.')
      setSelectedProject(null)
    } finally {
      setIsFetchingVersions(false)
    }
  }

  const confirmInstall = async () => {
    if (!selectedProject || !selectedVersionId) return
    
    const version = projectVersions.find(v => v.id === selectedVersionId)
    if (!version) return
    
    const file = version.files.find(f => f.primary) || version.files[0]
    if (!file) return

    setDownloadingMod(selectedProject.project_id)
    try {
      const loaderParam = projectType === 'mod' ? (instance.loader === 'vanilla' ? 'fabric' : instance.loader) : ''

      // Auto-install dependencies
      for (const dep of requiredDependencies) {
        const isDepInstalled = checkIsInstalled(dep.slug, dep.title) !== undefined

        if (!isDepInstalled) {
          try {
            const depVersions = await invoke<ModVersion[]>('get_modrinth_versions', {
              projectId: dep.id,
              version: instance.mc_version,
              loader: loaderParam
            })
            if (depVersions.length > 0) {
              const bestVersion = depVersions.find(v => v.version_type === 'release') || depVersions[0]
              const depFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0]
              if (depFile) {
                  await invoke('install_modrinth_mod', {
                    fileUrl: depFile.url,
                    filename: depFile.filename,
                    instanceId: instance.id,
                    projectType: 'mod',
                    projectId: dep.id
                  })
                }
            }
          } catch (err) {
            console.error(`Failed to auto-install dependency ${dep.title}:`, err)
          }
        }
      }

      // Hardcode Fabric API requirement for any Fabric Mod
      if (projectType === 'mod' && loaderParam === 'fabric' && selectedProject.slug !== 'fabric-api') {
        const isFabricApiInstalled = checkIsInstalled('fabric-api', 'Fabric API') !== undefined
        if (!isFabricApiInstalled) {
          try {
            const depVersions = await invoke<ModVersion[]>('get_modrinth_versions', {
              projectId: 'P7dR8mSH', // Modrinth ID para Fabric API
              version: instance.mc_version,
              loader: 'fabric'
            })
            if (depVersions.length > 0) {
              const bestVersion = depVersions.find(v => v.version_type === 'release') || depVersions[0]
              const depFile = bestVersion.files.find(f => f.primary) || bestVersion.files[0]
                              if (depFile) {
                  await invoke('install_modrinth_mod', {
                    fileUrl: depFile.url,
                    filename: depFile.filename,
                    instanceId: instance.id,
                    projectType: 'mod',
                    projectId: 'P7dR8mSH'
                  })
                }
            }
          } catch (err) {
            console.error('Failed to auto-install Fabric API:', err)
          }
        }
      }

              // Install main mod
        await invoke('install_modrinth_mod', {
          fileUrl: file.url,
          filename: file.filename,
          instanceId: instance.id,
          projectType: projectType,
          projectId: selectedProject.project_id || selectedProject.slug
        })
      
      if (activeTab === 'installed') fetchLocalMods()
      
      // Re-fetch local mods to update the state in search tab
      const newLocal: LocalMod[] = await invoke('get_instance_mods', { instanceId: instance.id })
      setLocalMods(newLocal)
      
      setSelectedProject(null)
    } catch (e) {
      console.error('Failed to install:', e)
      setErrorMessage(`Erro ao instalar: ${e}`)
    } finally {
      setDownloadingMod(null)
    }
  }

    const checkIsInstalled = (slug: string, title: string, projectId?: string): LocalMod | undefined => {
    // 1. Verificacao precisa por ID do json index (Se existir)
    if (projectId) {
      const exactMatch = localMods.find(m => m.project_id === projectId || m.project_id === slug);
      if (exactMatch) return exactMatch;
    }

    // 2. Fallback de heuristica para arquivos manuais (nao baixados pelo launcher)
    const normSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const words = title.split(/[\s-]+/);
    const firstWord = words.length > 0 ? words[0].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const secondWord = words.length > 1 ? words[1].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    
    const combinedFirstTwo = firstWord + secondWord;

    return localMods.find(m => {
      // Se tivermos project_id setado e n bateu la em cima, n?o e ele.
      if (m.project_id) return false; 
      
      const normName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normSlug && normName.includes(normSlug)) return true;
      if (normTitle && normName.includes(normTitle)) return true;
      if (combinedFirstTwo.length > 3 && normName.includes(combinedFirstTwo)) return true;
      if (firstWord.length >= 4 && normName.includes(firstWord)) return true;
      
      return false;
    });
  }
  const getInstalledMod = (mod: ModProject): LocalMod | undefined => {
    return checkIsInstalled(mod.slug, mod.title, mod.project_id)
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="bg-[#242424] border border-[#3a3a3a] w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header Style ATLauncher */}
        <div className="bg-[#1e1e1e] p-3 flex items-center justify-between border-b border-[#3a3a3a]">
          <h2 className="text-[#1db868] font-mc-small text-sm drop-shadow-[0_2px_0_rgba(13,89,42,0.4)]">
            ADDING MODS FOR {instance.name.toUpperCase()}
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
            onClick={() => setActiveTab('installed')}
            className={`px-6 py-3 font-mc-small text-[10px] tracking-widest ${activeTab === 'installed' ? 'bg-[#2a2a2a] text-[#1db868] border-b-2 border-[#1db868]' : 'text-[#8a9a8a] hover:bg-[#202020]'}`}
          >
            INSTALADOS
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-6 py-3 font-mc-small text-[10px] tracking-widest ${activeTab === 'search' ? 'bg-[#2a2a2a] text-[#1db868] border-b-2 border-[#1db868]' : 'text-[#8a9a8a] hover:bg-[#202020]'}`}
          >
            OBTER MODS
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#242424]">
          {activeTab === 'installed' && (
            <div className="flex flex-col h-full">
              <div className="bg-[#1e1e1e] p-2 border-b border-[#3a3a3a] flex gap-2">
                <select 
                  value={localFilter}
                  onChange={(e) => setLocalFilter(e.target.value as any)}
                  className="bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] px-3 py-1.5 rounded-sm outline-none focus:border-[#4a4a4a]"
                >
                  <option value="mod">Mods</option>
                  <option value="resourcepack">Resource Packs</option>
                  <option value="shader">Shaders</option>
                </select>
                  <select 
                    value={localSort}
                    onChange={(e) => setLocalSort(e.target.value as any)}
                    className="bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] px-3 py-1.5 rounded-sm outline-none focus:border-[#4a4a4a]"
                  >
                    <option value="newest">Mais Recentes</option>
                    <option value="oldest">Mais Antigos</option>
                  </select>
              </div>
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                {isLoadingLocal ? (
                  <p className="text-[#8a9a8a] text-sm text-center py-10">Carregando...</p>
                ) : localMods.filter(m => m.file_type === localFilter).length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[#8a9a8a] text-sm font-sans">Nenhum {localFilter} instalado.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {localMods.filter(m => m.file_type === localFilter).sort((a, b) => localSort === 'newest' ? (b.modified_at || 0) - (a.modified_at || 0) : (a.modified_at || 0) - (b.modified_at || 0)).map(mod => (
                      <div key={mod.filename} className="bg-[#2a2a2a] border border-[#3a3a3a] p-3 flex items-center justify-between">
                        <div>
                          <p className={`font-sans font-medium text-sm ${mod.enabled ? 'text-white' : 'text-[#8a9a8a] line-through'}`}>{formatModName(mod.filename)}</p>
                          <p className="font-sans text-xs text-[#6a6a6a]">{mod.filename}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleToggleMod(mod.filename, !mod.enabled)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-sm ${mod.enabled ? 'bg-[#3a3a3a] text-white hover:bg-[#4a4a4a]' : 'bg-[#1db868]/20 text-[#1db868] hover:bg-[#1db868]/40'}`}
                          >
                            {mod.enabled ? 'Desativar' : 'Ativar'}
                          </button>
                          <button 
                            onClick={() => handleDeleteMod(mod.filename)}
                            className="px-4 py-1.5 bg-red-900/30 text-red-500 text-xs font-bold rounded-sm hover:bg-red-900 hover:text-white"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="flex flex-col h-full">
              {/* Filter Bar */}
              <div className="bg-[#1e1e1e] p-2 border-b border-[#3a3a3a] flex gap-2">
                <select className="bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] px-2 py-1.5 rounded-sm outline-none w-32 focus:border-[#4a4a4a]">
                  <option>Modrinth</option>
                </select>
                
                <select 
                  value={projectType} 
                  onChange={e => setProjectType(e.target.value as any)}
                  className="bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] px-2 py-1.5 rounded-sm outline-none w-36 focus:border-[#4a4a4a]"
                >
                  <option value="mod">Mods</option>
                  <option value="resourcepack">Resource Packs</option>
                  <option value="shader">Shaders</option>
                </select>

                <select 
                  value={sortParam} 
                  onChange={e => setSortParam(e.target.value as any)}
                  className="bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] px-2 py-1.5 rounded-sm outline-none w-36 focus:border-[#4a4a4a]"
                >
                  <option value="downloads">Popularity</option>
                  <option value="updated">Last Updated</option>
                  <option value="relevance">Relevance</option>
                </select>

                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] px-2 py-1.5 rounded-sm outline-none flex-1 focus:border-[#4a4a4a]"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <form onSubmit={handleSearchSubmit} className="flex relative w-48">
                  <Icon icon="line-md:search" className="absolute left-2 top-2 text-[#6a6a6a] w-4 h-4" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      if (e.target.value === '') {
                        performSearch(0, '')
                      }
                    }}
                    placeholder="Search"
                    className="w-full bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] pl-7 pr-2 py-1.5 rounded-sm outline-none focus:border-[#4a4a4a]"
                  />
                </form>
              </div>

              {/* Grid Content */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {searchResults.length === 0 && !isSearching && (
                  <p className="text-[#8a9a8a] text-sm text-center py-10 font-sans">Nenhum mod encontrado.</p>
                )}
                {searchResults.length === 0 && isSearching && (
                  <p className="text-[#8a9a8a] text-sm text-center py-10 font-sans">Buscando...</p>
                )}
                
                {searchResults.length > 0 && (
                  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-200 ${isSearching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    {searchResults.map(mod => {
                      const installedMod = getInstalledMod(mod);
                      
                      return (
                        <div key={mod.project_id} className={`bg-[#2a2a2a] border p-3 flex flex-col relative h-[140px] shadow-sm transition-colors ${installedMod ? 'border-[#1db868]/40' : 'border-[#3a3a3a]'}`}>
                          {/* Mod Title */}
                          <div className={`absolute -top-2.5 left-2 bg-[#242424] px-1 border-x flex items-center gap-1 ${installedMod ? 'border-[#1db868]/40' : 'border-[#3a3a3a]'}`}>
                            <span className="text-[#e0e0e0] font-sans font-bold text-xs">{mod.title}</span>
                            {installedMod && <Icon icon="mdi:check-circle" className="text-[#1db868] w-3 h-3" />}
                          </div>

                          <div className="flex gap-3 mt-1.5 flex-1">
                            {/* Icon */}
                            {mod.icon_url ? (
                              <img src={mod.icon_url} alt={mod.title} className="w-12 h-12 object-cover flex-shrink-0 bg-[#1e1e1e]" />
                            ) : (
                              <div className="w-12 h-12 bg-[#1e1e1e] flex-shrink-0 flex items-center justify-center border border-[#3a3a3a]">
                                <span className="text-[#4a4a4a] text-[10px]">No Icon</span>
                              </div>
                            )}

                            {/* Description */}
                            <p className="text-[#aaaaaa] font-sans text-[11px] leading-snug line-clamp-3 overflow-hidden">
                              {mod.description}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-center gap-2 mt-auto pt-2 border-t border-[#3a3a3a]/30">
                            {installedMod ? (
                              <>
                                <button
                                  onClick={() => handleOpenInstallModal(mod)}
                                  title="Change Version"
                                  className="px-2 py-1 text-[11px] font-sans font-medium rounded-sm border bg-[#3a3a3a] text-white border-[#4a4a4a] hover:bg-[#4a4a4a]"
                                >
                                  <Icon icon="mdi:refresh" className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMod(installedMod.filename)}
                                  className="px-5 py-1 text-[11px] font-sans font-medium rounded-sm border bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                                >
                                  Remover
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleOpenInstallModal(mod)}
                                disabled={downloadingMod === mod.project_id || isFetchingVersions}
                                className="px-5 py-1 text-[11px] font-sans font-medium rounded-sm border bg-[#3a3a3a] text-white border-[#4a4a4a] hover:bg-[#4a4a4a] disabled:opacity-50"
                              >
                                {downloadingMod === mod.project_id || (isFetchingVersions && selectedProject?.project_id === mod.project_id) ? 'Baixando...' : 'Add'}
                              </button>
                            )}
                            <button
                              onClick={() => openUrl(`https://modrinth.com/${projectType === 'mod' ? 'mod' : (projectType === 'resourcepack' ? 'resourcepack' : 'shader')}/${mod.slug}`)}
                              className="bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white border border-[#4a4a4a] px-5 py-1 text-[11px] font-sans font-medium rounded-sm"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pagination Bar */}
              {searchResults.length > 0 && (
                <div className="bg-[#1e1e1e] border-t border-[#3a3a3a] p-2 flex justify-center gap-2">
                  <button 
                    onClick={() => performSearch(Math.max(0, offset - 20))}
                    disabled={offset === 0 || isSearching}
                    className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#4a4a4a] text-[#cccccc] px-3 py-1 flex items-center justify-center rounded-sm disabled:opacity-50 transition-colors"
                  >
                    <Icon icon="material-symbols:chevron-left-rounded" className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => performSearch(offset + 20)}
                    disabled={searchResults.length < 20 || isSearching}
                    className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#4a4a4a] text-[#cccccc] px-3 py-1 flex items-center justify-center rounded-sm disabled:opacity-50 transition-colors"
                  >
                    <Icon icon="material-symbols:chevron-right-rounded" className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Install Version Modal */}
      {selectedProject && !isFetchingVersions && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProject(null);
          }}
        >
          <div 
            className="bg-[#242424] border border-[#3a3a3a] w-[450px] shadow-2xl flex flex-col rounded-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#1e1e1e] p-3 flex items-center justify-between border-b border-[#3a3a3a]">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:download" className="text-[#1db868]" />
                <h3 className="text-[#1db868] font-mc-small text-sm drop-shadow-[0_2px_0_rgba(13,89,42,0.4)] mt-1">
                  INSTALLING {selectedProject.title.toUpperCase()}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedProject(null)}
                className="text-[#8a9a8a] hover:text-white transition-colors"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 w-full px-4">
                <span className="text-[#8a9a8a] font-sans text-xs">Version To Install:</span>
                <select 
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="flex-1 bg-[#2a2a2a] text-[#cccccc] text-xs font-sans border border-[#3a3a3a] px-2 py-1.5 rounded-sm outline-none focus:border-[#4a4a4a]"
                >
                  {projectVersions.map(v => {
                    const typeLabel = v.version_type === 'release' ? '' : v.version_type === 'beta' ? ' (Beta)' : ' (Alpha)';
                    return (
                      <option key={v.id} value={v.id}>
                        [{instance.loader === 'vanilla' ? 'Fabric' : instance.loader.charAt(0).toUpperCase() + instance.loader.slice(1)} {instance.mc_version}] {v.version_number}{typeLabel}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Dependencies Section */}
              {isFetchingDependencies ? (
                <div className="w-full px-4 mt-2">
                  <p className="text-[#8a9a8a] text-xs text-center font-sans">Checking dependencies...</p>
                </div>
              ) : requiredDependencies.length > 0 && (
                <div className="w-full px-4 mt-2">
                  <div className="border border-[#3a3a3a] rounded-sm pt-4 pb-1 relative">
                    <span className="absolute -top-2.5 left-2 bg-[#242424] px-1 text-[#8a9a8a] text-xs font-sans">
                      Required Dependencies (Auto-installed if missing)
                    </span>
                    
                    <div className="flex flex-col gap-4 max-h-[180px] overflow-y-auto custom-scrollbar px-3 pt-3 pb-2">
                      {requiredDependencies.map(dep => {
                        // isInstalled needs to work with ModProjectResult too
                        const depSlug = dep.slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
                        const depFirstWord = dep.title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
                        const isDepInstalled = localMods.some(m => {
                          const name = m.name.toLowerCase()
                          if (depSlug && name.includes(depSlug)) return true
                          if (depFirstWord.length > 2 && name.includes(depFirstWord)) return true
                          return false
                        })

                        return (
                          <div key={dep.id} className="border border-[#3a3a3a] p-2 relative bg-[#1e1e1e]">
                            <span className="absolute -top-2.5 left-2 bg-[#1e1e1e] px-1 text-white font-bold text-xs font-sans flex items-center gap-2">
                              {dep.title}
                              {isDepInstalled && (
                                <span className="text-[#1db868] text-[9px] font-sans font-bold flex items-center gap-0.5 mt-0.5">
                                  <Icon icon="mdi:check-circle" className="w-3 h-3" /> Installed
                                </span>
                              )}
                            </span>
                            
                            <div className="flex gap-2 mt-2">
                              {dep.icon_url ? (
                                <img src={dep.icon_url} alt={dep.title} className="w-10 h-10 object-cover bg-[#242424]" />
                              ) : (
                                <div className="w-10 h-10 bg-[#242424] flex items-center justify-center border border-[#3a3a3a]">
                                  <span className="text-[#4a4a4a] text-[9px]">No Icon</span>
                                </div>
                              )}
                              <p className="text-[#aaaaaa] font-sans text-[10px] leading-snug line-clamp-3 overflow-hidden flex-1">
                                {dep.description}
                              </p>
                            </div>
                            
                            <div className="flex justify-center items-center gap-2 mt-2 border-t border-[#3a3a3a]/30 pt-1.5 h-6">
                              <button 
                                onClick={() => openUrl(`https://modrinth.com/mod/${dep.slug}`)}
                                className="bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white border border-[#4a4a4a] px-4 py-1 text-[10px] font-sans font-medium rounded-sm"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#1e1e1e] p-3 border-t border-[#3a3a3a] flex justify-center gap-2">
              <button
                onClick={confirmInstall}
                disabled={downloadingMod !== null}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white border border-[#4a4a4a] px-6 py-1.5 text-xs font-sans rounded-sm transition-colors"
              >
                {downloadingMod ? 'Downloading...' : 'Add'}
              </button>
              <button
                onClick={() => openUrl(`https://modrinth.com/${projectType === 'mod' ? 'mod' : (projectType === 'resourcepack' ? 'resourcepack' : 'shader')}/${selectedProject.slug}`)}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white border border-[#4a4a4a] px-4 py-1.5 text-xs font-sans rounded-sm transition-colors"
              >
                View Mod
              </button>
              <button
                onClick={() => setSelectedProject(null)}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white border border-[#4a4a4a] px-6 py-1.5 text-xs font-sans rounded-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modToDelete && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            e.stopPropagation();
            setModToDelete(null);
          }}
        >
          <div 
            className="bg-[#242424] border border-[#3a3a3a] w-[350px] shadow-2xl flex flex-col rounded-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#1e1e1e] p-3 flex items-center justify-between border-b border-[#3a3a3a]">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:trash-can-outline" className="text-red-500 w-4 h-4" />
                <h3 className="text-white font-sans text-sm font-medium">Excluir Mod</h3>
              </div>
              <button 
                onClick={() => setModToDelete(null)}
                className="text-[#8a9a8a] hover:text-white transition-colors"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center gap-2 text-center">
              <p className="text-white font-sans text-sm">Deseja realmente excluir este mod?</p>
              <p className="text-[#8a9a8a] font-sans text-xs break-all">{modToDelete}</p>
            </div>

            <div className="bg-[#1e1e1e] p-3 border-t border-[#3a3a3a] flex justify-center gap-2">
              <button
                onClick={confirmDeleteMod}
                className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 hover:border-red-500 px-6 py-1.5 text-xs font-sans rounded-sm transition-colors"
              >
                Excluir
              </button>
              <button
                onClick={() => setModToDelete(null)}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white border border-[#4a4a4a] px-6 py-1.5 text-xs font-sans rounded-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorMessage && (
        <div 
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            e.stopPropagation();
            setErrorMessage(null);
          }}
        >
          <div 
            className="bg-[#242424] border border-[#3a3a3a] w-[350px] shadow-2xl flex flex-col rounded-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#1e1e1e] p-3 flex items-center gap-2 border-b border-[#3a3a3a]">
              <Icon icon="mdi:alert-circle-outline" className="text-red-500 w-4 h-4" />
              <h3 className="text-white font-sans text-sm font-medium">Aviso</h3>
            </div>
            
            <div className="p-6 text-center">
              <p className="text-white font-sans text-sm">{errorMessage}</p>
            </div>

            <div className="bg-[#1e1e1e] p-3 border-t border-[#3a3a3a] flex justify-center">
              <button
                onClick={() => setErrorMessage(null)}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white border border-[#4a4a4a] px-6 py-1.5 text-xs font-sans rounded-sm transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}











