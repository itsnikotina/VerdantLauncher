import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useDownload } from '../../contexts/DownloadContext';

interface PacksModalProps {
  onClose: () => void;
  onInstallComplete: () => void;
}

interface Modpack {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  downloads: number;
  author?: string;
}

interface SearchResult {
  hits: Modpack[];
  offset: number;
  limit: number;
  total_hits: number;
}

interface ModVersion {
  id: string;
  name: string;
  version_number: string;
  files: { url: string; primary: boolean; filename: string }[];
}

export default function PacksModal({ onClose, onInstallComplete }: PacksModalProps) {
  const [query, setQuery] = useState('');
  const [packs, setPacks] = useState<Modpack[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [page, setPage] = useState(0);
  const [totalHits, setTotalHits] = useState(0);

  const { activeDownload, startDownload } = useDownload();

  useEffect(() => {
    fetchPacks('', 0);
  }, []);

  const fetchPacks = async (q: string, p: number) => {
    setLoading(true);
    try {
      const res: SearchResult = await invoke('search_modrinth_mods', {
        query: q,
        version: "",
        loader: "",
        projectType: "modpack",
        sort: "relevance",
        category: "",
        offset: p * 20
      });
      setPacks(res.hits);
      setTotalHits(res.total_hits);
      setPage(p);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleInstall = async (pack: Modpack) => {
    try {
      const versions: ModVersion[] = await invoke('get_modrinth_versions', {
        projectId: pack.project_id,
        version: "",
        loader: ""
      });
      
      if (versions.length === 0) {
        throw new Error("Nenhuma versão compatível encontrada.");
      }
      
      const latest = versions[0];
      const mrpackFile = latest.files.find(f => f.filename.endsWith('.mrpack')) || latest.files[0];
      
      if (!mrpackFile) {
        throw new Error("Arquivo .mrpack não encontrado na versão selecionada.");
      }
      
      startDownload(
        { project_id: pack.project_id, title: pack.title, icon_url: pack.icon_url },
        mrpackFile.url,
        latest.version_number,
        pack.description
      ).then(() => {
        onInstallComplete();
      });
      
    } catch (e) {
      console.error(e);
      alert("Erro ao buscar pacote: " + String(e));
    }
  };

  const totalPages = Math.ceil(totalHits / 20);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
      onClick={onClose}
    >
      <div 
        className="bg-[#111411] border-2 border-[#2dba7e]/20 rounded-xl w-full max-w-5xl h-full max-h-[800px] flex flex-col overflow-hidden shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[#2dba7e]/20 bg-[#161a16]">
          <div className="flex items-center gap-3">
            <Icon icon="mdi:package-variant" className="w-8 h-8 text-[#2dba7e]" />
            <div>
              <h2 className="text-2xl font-mc-big text-white tracking-widest">NAVEGADOR DE MODPACKS</h2>
              <p className="text-[#8a9a8a] font-mc-small text-xs tracking-wide">Explore pacotes da comunidade (Powered by Modrinth)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
            <Icon icon="mdi:close" className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 pb-2">
          <div className="relative">
            <Icon icon="mdi:magnify" className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-white/30" />
            <input 
              type="text" 
              value={query}
              onChange={(e) => { const val = e.target.value; setQuery(val); if (val.trim() === '') { fetchPacks('', 0); } }}
              onKeyDown={(e) => e.key === 'Enter' && fetchPacks(query, 0)}
              placeholder="Pesquisar modpacks no Modrinth..."
              className="w-full bg-[#0a0c0a] border border-[#2dba7e]/30 rounded-lg py-4 pl-12 pr-4 text-white font-mc-small text-sm placeholder:text-white/30 focus:outline-none focus:border-[#2dba7e] transition-colors"
            />
            <button 
              onClick={() => fetchPacks(query, 0)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#2dba7e]/10 hover:bg-[#2dba7e]/30 text-[#2dba7e] px-4 py-2 rounded text-xs font-mc-small transition-colors"
            >
              BUSCAR
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 pt-2 overflow-y-auto custom-scrollbar">
          {packs.length === 0 && loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
              <Icon icon="mdi:loading" className="w-12 h-12 text-[#2dba7e] animate-spin" />
              <span className="text-white font-mc-small tracking-widest">BUSCANDO PACOTES...</span>
            </div>
          ) : packs.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full opacity-30">
              <Icon icon="mdi:ghost" className="w-16 h-16 text-white mb-4" />
              <span className="text-white font-mc-small tracking-widest text-lg">NENHUM PACOTE ENCONTRADO</span>
            </div>
          ) : (
            <div className={`flex flex-col gap-3 pb-4 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {packs.map(pack => (
                <fieldset 
                  key={pack.project_id} 
                  className="border border-[#2dba7e]/20 hover:border-[#2dba7e]/50 transition-colors rounded-lg px-4 pb-3 pt-1 bg-[#0a0c0a]/50 relative group"
                >
                  <legend className="text-white font-mc-small text-sm px-3 ml-2 tracking-widest text-[#2dba7e]">
                    {pack.title}
                  </legend>
                  
                                    

                  <div className="flex gap-4 mt-1">
                    <div className="w-20 h-20 flex-shrink-0 bg-black/40 rounded-lg border border-white/5 p-1 overflow-hidden">
                      <img src={pack.icon_url || 'https://via.placeholder.com/128'} alt={pack.title} className="w-full h-full object-cover rounded shadow-inner" />
                    </div>
                    
                    <div className="flex flex-col flex-1">
                      <p className="text-white/70 font-sans text-xs leading-relaxed mb-2 flex-1 pr-2 line-clamp-2">
                        {pack.description}
                      </p>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-4 text-[#8a9a8a] font-mc-small text-[10px] tracking-widest">
                          <span className="flex items-center gap-1"><Icon icon="mdi:download" className="w-4 h-4 text-white/20" /> {(pack.downloads || 0).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Icon icon="mdi:tag" className="w-4 h-4 text-white/20" /> MODRINTH</span>
                        </div>
                        
                        <div className="flex gap-3">
                          <button 
                            onClick={() => openUrl(`https://modrinth.com/modpack/${pack.slug}`)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded font-mc-small text-[10px] tracking-widest transition-colors flex items-center gap-2 border border-white/5"
                          >
                            <Icon icon="mdi:open-in-new" className="w-4 h-4" /> MODRINTH
                          </button>
                          
                          <button 
                            disabled={activeDownload !== null}
                            onClick={() => handleInstall(pack)}
                            className="px-5 py-1.5 bg-[#2dba7e] hover:bg-[#32d583] text-black rounded font-mc-small text-[10px] tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_15px_rgba(45,186,126,0.3)] hover:shadow-[0_0_20px_rgba(45,186,126,0.5)]"
                          >
                            {activeDownload?.project_id === pack.project_id ? "BAIXANDO..." : <><Icon icon="mdi:download" className="w-4 h-4" /> INSTALAR</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </div>
        
        {/* Paginação Fixa no Rodapé */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#2dba7e]/20 bg-[#161a16] flex justify-center items-center gap-6">
            <button
              disabled={page === 0 || loading}
              onClick={() => {
                fetchPacks(query, page - 1);
                const scrollContainer = document.querySelector('.custom-scrollbar');
                if (scrollContainer) scrollContainer.scrollTop = 0;
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-[#2dba7e]/20 disabled:opacity-30 rounded text-white font-mc-small text-xs transition-colors"
            >
              <Icon icon="mdi:chevron-left" className="w-5 h-5" /> ANTERIOR
            </button>
            <span className="text-[#8a9a8a] font-mc-small text-[10px] tracking-widest">
              PÁGINA <strong className="text-white">{page + 1}</strong> DE <strong className="text-white">{totalPages}</strong>
            </span>
            <button
              disabled={page >= totalPages - 1 || loading}
              onClick={() => {
                fetchPacks(query, page + 1);
                const scrollContainer = document.querySelector('.custom-scrollbar');
                if (scrollContainer) scrollContainer.scrollTop = 0;
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-[#2dba7e]/20 disabled:opacity-30 rounded text-white font-mc-small text-xs transition-colors"
            >
              PRÓXIMA <Icon icon="mdi:chevron-right" className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}












