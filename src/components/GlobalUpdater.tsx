import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export default function GlobalUpdater() {
  const [updateInfo, setUpdateInfo] = useState<{ version: string, notes: string | null } | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Verificando atualizações...');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Ignora se estiver no navegador
    if (!('__TAURI_INTERNALS__' in window)) {
      console.log('Ignorado: não está no Tauri');
      return;
    }

    const runUpdate = async () => {
      try {
        console.log("Chamando check() do tauri plugin-updater...");
        const update = await check();
        
        if (update) {
          console.log(`Atualização encontrada: ${update.version}`);
          setUpdateInfo({ version: update.version, notes: update.body || null });
          setIsUpdating(true);
          setStatus(`Baixando Verdant Launcher v${update.version}...`);
          
          let downloaded = 0;
          let contentLength = 1; // previne divisao por 0

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 1;
                console.log(`Download iniciado. Tamanho: ${contentLength}`);
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                setProgress((downloaded / contentLength) * 100);
                break;
              case 'Finished':
                setProgress(100);
                setStatus('Instalação concluída! Reiniciando...');
                console.log('Download e instalação concluídos!');
                break;
            }
          });

          setIsFinished(true);
          
          // Aguarda 2 segundinhos pro usuario ler que acabou e reinicia
          setTimeout(async () => {
            console.log('Chamando relaunch()...');
            await relaunch();
          }, 2000);
        } else {
          console.log('check() retornou null. Nenhuma atualização disponível ou a versão é a mesma.');
        }
      } catch (error: any) {
        console.error(`ERRO NO UPDATER: ${error?.message || error}`);
      }
    };

    // Atrasa levemente a checagem para nao travar o boot principal da interface
    setTimeout(runUpdate, 1500);

  }, []);

  if (!isUpdating) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 transition-all duration-500">
      <div className="bg-[#111411] border border-[#2dba7e]/30 rounded-xl max-w-lg w-full p-8 shadow-2xl flex flex-col items-center relative overflow-hidden">
        
        {/* Glow de fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-[#2dba7e]/20 blur-[80px] pointer-events-none" />

        <div className="w-16 h-16 bg-[#2dba7e]/10 border border-[#2dba7e]/30 rounded-full flex items-center justify-center mb-6 z-10 relative">
          <Icon 
            icon={isFinished ? "mdi:check-bold" : "mdi:download"} 
            className={`w-8 h-8 text-[#2dba7e] ${!isFinished && 'animate-bounce'}`} 
          />
        </div>

        <h2 className="text-white font-mc-big text-xl tracking-widest text-center mb-2 z-10">
          ATUALIZAÇÃO DO LAUNCHER
        </h2>
        
        <p className="text-[#8a9a8a] font-mc-small text-sm text-center mb-8 z-10">
          {status}
        </p>

        <div className="w-full max-w-md h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 relative z-10">
          <div 
            className="h-full bg-[#2dba7e] transition-all duration-300 relative" 
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1s_infinite]" />
          </div>
        </div>

        <div className="flex justify-between w-full max-w-md mt-3 z-10">
          <span className="text-white/40 font-mc-small text-[10px] tracking-widest">
            {updateInfo?.version ? `NOVA VERSÃO: ${updateInfo.version}` : ''}
          </span>
          <span className="text-[#2dba7e] font-mc-small text-[10px] tracking-widest">
            {progress.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

