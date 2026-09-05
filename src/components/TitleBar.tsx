import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';
import { Icon } from '@iconify/react';

export default function TitleBar() {
  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window || '__TAURI_IPC__' in window;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    const appWindow = getCurrentWindow();
    
    appWindow.isMaximized().then(setIsMaximized).catch(console.error);

    let unlisten: any;
    appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch(console.error);
    }).then(u => unlisten = u);

    return () => {
      if (unlisten) unlisten();
    };
  }, [isTauri]);

  const handleMinimize = () => {
    if (!isTauri) return;
    
    try {
      getCurrentWindow().minimize().catch((e: any) => console.error(e));
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleMaximize = async () => {
    if (!isTauri) return;
    try {
      const win = getCurrentWindow();
      const isMax = await win.isMaximized();
      if (isMax) {
        await win.unmaximize();
        setIsMaximized(false);
      } else {
        await win.maximize();
        setIsMaximized(true);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleClose = async () => {
    if (!isTauri) return;

    try {
      await exit(0);
    } catch (e: any) {
      try {
        await getCurrentWindow().close();
      } catch (err: any) {
        console.error(err);
      }
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-7 flex items-center justify-end z-[9999] px-2 gap-1 pointer-events-none">
      
      {/* Área de arrasto independente */}
      <div 
        className="absolute inset-0 right-[120px] pointer-events-auto"
        data-tauri-drag-region
      />

      {/* Minimizar */}
      <button
        onClick={handleMinimize}
        className="w-6 h-6 flex items-center justify-center text-[#8a9a8a] hover:text-white hover:bg-white/10 rounded transition-colors text-xs cursor-pointer z-50 pointer-events-auto"
        title="Minimizar"
      >
        <Icon icon="mdi:window-minimize" />
      </button>

      {/* Maximizar */}
      <button
        onClick={handleMaximize}
        className="w-6 h-6 flex items-center justify-center text-[#8a9a8a] hover:text-white hover:bg-white/10 rounded transition-colors text-xs cursor-pointer z-50 pointer-events-auto"
        title={isMaximized ? "Restaurar" : "Maximizar"}
      >
        <Icon icon={isMaximized ? "mdi:window-restore" : "mdi:window-maximize"} />
      </button>

      {/* Fechar */}
      <button
        onClick={handleClose}
        className="w-6 h-6 flex items-center justify-center text-[#8a9a8a] hover:text-red-400 hover:bg-red-500/20 rounded transition-colors text-xs cursor-pointer z-50 pointer-events-auto"
        title="Fechar"
      >
        <Icon icon="mdi:window-close" />
      </button>
    </div>
  )
}
