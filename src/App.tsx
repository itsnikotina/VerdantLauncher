import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'
import { useDiscordRPC } from './hooks/useDiscordRPC';
import TitleBar from './components/TitleBar'
import HeroBackground from './components/MainArea/HeroBackground'
import NewsSection from './components/MainArea/NewsSection'
import UserHeader from './components/Sidebar/UserHeader'
import NavMenu from './components/Sidebar/NavMenu'
import PackSelector from './components/Sidebar/PackSelector'
import PlayButton from './components/Sidebar/PlayButton'
import { useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import InstancesModal from './components/Modals/InstancesModal'
import CreateInstanceModal from './components/Modals/CreateInstanceModal'
import ProfileModal from './components/Modals/ProfileModal'
import PacksModal from './components/Modals/PacksModal'
import { DownloadProvider } from './contexts/DownloadContext'
import GlobalDownloadIndicator from './components/GlobalDownloadIndicator'
import GlobalUpdater from './components/GlobalUpdater'

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

// Variáveis globais para rastrear o tempo sem reiniciar nos re-renders
const LAUNCHER_START_TIME = Math.floor(Date.now() / 1000);
let GAME_START_TIME: number | null = null;

function LauncherLayout() {
  const { user, mcUser } = useAuth()
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState('');
  const [currentModal, setCurrentModal] = useState<string | null>(null);
  
  const [activeInstance, setActiveInstance] = useState<InstanceConfig | null>(null);

  useEffect(() => {
    refreshActiveInstance();

    const unlistenOpened = listen('game-opened', () => {
      setIsLaunching(false);
      setIsPlaying(true);
      setLaunchStatus('');
      GAME_START_TIME = Math.floor(Date.now() / 1000);
    });
    
    const unlistenClosed = listen('game-closed', () => {
      setIsPlaying(false);
      setIsLaunching(false);
      setLaunchStatus('');
      GAME_START_TIME = null;
    });

    const unlistenStatus = listen<string>('launch-status', (event) => {
      setLaunchStatus(event.payload);
    });

    return () => {
      unlistenOpened.then(f => f());
      unlistenClosed.then(f => f());
      unlistenStatus.then(f => f());
    };
  }, []);

  const handleSelectInstance = (event: any) => {
    const inst = event.detail;
    if (inst) setActiveInstance(inst);
  };

  const handleCloseModals = () => setCurrentModal(null);

  useEffect(() => {
    window.addEventListener('select-instance', handleSelectInstance);
    window.addEventListener('close-modals', handleCloseModals);
    return () => {
      window.removeEventListener('select-instance', handleSelectInstance);
      window.removeEventListener('close-modals', handleCloseModals);
    }
  }, []);

  // LOGICA DO DISCORD RPC
  let rpcDetails = 'Navegando no Launcher';
  let rpcState = 'No Menu Inicial';
  let rpcImage = 'verdantlogo'; // Mantendo apenas a logo grande para evitar dor de cabeca com cdn
  let rpcStartTimestamp = isPlaying && GAME_START_TIME ? GAME_START_TIME : LAUNCHER_START_TIME;

  if (isPlaying && activeInstance) {
    rpcDetails = 'In-Game';
    rpcState = 'Jogando ' + activeInstance.name;
  } else if (currentModal === 'packs') {
    rpcDetails = 'Explorando Modpacks';
    rpcState = 'Procurando a próxima aventura';
  } else if (currentModal === 'instances') {
    rpcDetails = 'Gerenciando Instâncias';
    rpcState = 'Organizando tudo';
  } else if (currentModal === 'create') {
    rpcDetails = 'Criando Uma Nova Instância';
    rpcState = 'Configurando um novo pack';
  } else if (currentModal === 'profile') {
    rpcDetails = 'No Perfil';
    rpcState = 'Ajustando o Avatar';
  } else if (!user && !mcUser) {
    rpcDetails = 'Na Tela de Login';
    rpcState = 'Use Verdant Launcher :)';
  } else if (activeInstance) {
    rpcState = 'Selecionado: ' + activeInstance.name;
  }

  let rpcSmallImage = undefined;
  let rpcSmallText = undefined;
  if (mcUser) {
    rpcSmallImage = `https://api.mcheads.org/head/` + mcUser.name + `/256`;
    rpcSmallText = '[MC] ' + mcUser.name;
  } else if (user) {
    // Para contas Verdant, no enviamos imagem pequena do Minecraft Original
    const offName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Steve';
    rpcSmallText = '[VDT] ' + offName;
  }

  useDiscordRPC(rpcDetails, rpcState, rpcImage, 'Verdant Launcher', rpcSmallImage, rpcSmallText, rpcStartTimestamp);

  const refreshActiveInstance = () => {
    invoke<string>('get_instances')
      .then(json => {
        const instances: InstanceConfig[] = JSON.parse(json);
        setActiveInstance(prev => {
          if (prev) {
            const updated = instances.find(i => i.id === prev.id);
            if (updated) return updated;
            return instances.length > 0 ? instances[0] : null;
          }
          return instances.length > 0 ? instances[0] : null;
        });
      })
      .catch(console.error);
  };

  const handlePlay = async (overrideInstanceId?: string) => {
    const targetId = overrideInstanceId || activeInstance?.id;
    if (!targetId) {
      alert("Selecione uma instancia antes de jogar!");
      return;
    }

    if (!('__TAURI_INTERNALS__' in window)) {
      alert("Testando interface! Abra pelo .bat para rodar o jogo nativamente.");
      return;
    }

    try {
      const displayName = mcUser ? mcUser.name : (user?.user_metadata?.username || user?.email?.split('@')[0] || 'JOGADOR');
      
      setIsLaunching(true);
      setLaunchStatus('Iniciando...');
      
      // Atualiza a ultima jogada
      await invoke('update_last_played', { id: targetId });
      refreshActiveInstance();
      
      await invoke('play_game', { 
        instanceId: targetId,
        username: displayName,
        uuid: mcUser?.id || null,
        accessToken: mcUser?.token || null
      });
    } catch (e: any) {
      console.error(e);
      alert("Falha ao iniciar o jogo: " + e);
      setIsLaunching(false);
      setLaunchStatus('');
    }
  };

  const handleKill = async () => {
    try {
      await invoke('kill_game');
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0c0a] text-white overflow-hidden relative">
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="flex flex-col w-[220px] xl:w-[280px] 2xl:w-[350px] flex-shrink-0 bg-[#111411] border-r border-[#2dba7e]/10 pt-7 z-20 transition-all duration-300">
          <UserHeader setModal={setCurrentModal} />
          <NavMenu setModal={setCurrentModal} />
          <div className="flex-1" />
          <div className="px-3 pb-4">
            <PackSelector 
              activeInstance={activeInstance}
              onSelect={(inst) => setActiveInstance(inst)}
              onCreateNew={() => setCurrentModal('create')}
            />
            <PlayButton 
              onClick={() => isPlaying ? handleKill() : handlePlay()} 
              disabled={!activeInstance} 
              isPlaying={isPlaying}
              isLaunching={isLaunching}
              status={launchStatus}
            />
          </div>
        </aside>

        {/* Area Principal */}
        <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
          <HeroBackground />
          <div className="flex-1 flex relative z-20">
            <NewsSection />
          </div>
        </main>

        {/* Modais */}
        {currentModal === 'instances' && (
          <InstancesModal 
            onClose={() => setCurrentModal(null)} 
            onPlay={async (id) => {
              // Buscamos a instancia no backend e atualizamos o activeInstance
              invoke<string>('get_instances').then(json => {
                 const instances: InstanceConfig[] = JSON.parse(json);
                 const inst = instances.find(i => i.id === id);
                 if (inst) setActiveInstance(inst);
              });
              setCurrentModal(null);
              handlePlay(id); 
            }} 
            onCreateNew={() => setCurrentModal('create')}
            onDelete={(id) => {
              if (activeInstance?.id === id) {
                refreshActiveInstance();
              }
            }}
          />
        )}
        
        {currentModal === 'create' && (
          <CreateInstanceModal
            onClose={() => setCurrentModal(null)}
            onUpdate={refreshActiveInstance}
          />
        )}
        {currentModal === 'profile' && (
          <ProfileModal
            onClose={() => setCurrentModal(null)}
          />
        )}
        {currentModal === 'packs' && (
          <PacksModal
            onClose={() => setCurrentModal(null)}
            onInstallComplete={refreshActiveInstance}
          />
        )}

      </div>
    </div>
  )
}

function MainContent() {
  const { user, mcUser } = useAuth()
  
  if (!user && !mcUser) {
    return <AuthPage />
  }

  return (
    <DownloadProvider>
      <GlobalDownloadIndicator />
      <LauncherLayout />
    </DownloadProvider>
  )
}

export default function App() {
  return (
    <>
      <TitleBar />
      <GlobalUpdater />
      <MainContent />
    </>
  )
}



