import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface InstallProgress {
  state: string;
  current: number;
  total: number;
  message: string;
}

interface ModpackInfo {
  project_id: string;
  title: string;
  icon_url: string;
}

interface DownloadContextType {
  activeDownload: ModpackInfo | null;
  progress: InstallProgress | null;
  isFinished: boolean;
  finishedInstanceId: string | null;
  startDownload: (pack: ModpackInfo, mrpackUrl: string, packVersion: string, packDescription?: string) => Promise<void>;
  cancelDownload: () => void;
  hideFinished: () => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [activeDownload, setActiveDownload] = useState<ModpackInfo | null>(null);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [finishedInstanceId, setFinishedInstanceId] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen('pack-install-progress', (event: any) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const startDownload = async (pack: ModpackInfo, mrpackUrl: string, packVersion: string, packDescription?: string) => {
    setActiveDownload(pack);
    setIsFinished(false);
    setProgress({ state: 'init', current: 0, total: 1, message: 'Buscando modpack...' });

    try {
      const instanceId = await invoke<string>('install_mrpack', {
        url: mrpackUrl,
        packName: pack.title,
        packVersion: packVersion,
        iconUrl: pack.icon_url || null,
        projectId: pack.project_id,
        packDescription: packDescription || null
      });
      
      // Concluiu com sucesso!
      setFinishedInstanceId(instanceId);
      setIsFinished(true);
      
    } catch (e) {
      if (String(e) === "CANCELLED") {
        console.log("Download cancelado.");
      } else {
        console.error(e);
        alert("Erro ao instalar: " + String(e));
      }
      setActiveDownload(null);
      setProgress(null);
      setIsFinished(false);
    }
  };

  const cancelDownload = () => {
    if (activeDownload) {
      invoke('cancel_install_mrpack', { id: activeDownload.project_id });
      setProgress(prev => prev ? { ...prev, message: 'Cancelando...' } : null);
    }
  };

  const hideFinished = () => {
    setIsFinished(false);
    setActiveDownload(null);
    setProgress(null);
  };

  return (
    <DownloadContext.Provider value={{ activeDownload, progress, isFinished, finishedInstanceId, startDownload, cancelDownload, hideFinished }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (context === undefined) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
}



