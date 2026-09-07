import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

export function useDiscordRPC(
  details: string,
  stateStr: string,
  largeImageKey: string = 'verdantlogo',
  largeImageText: string = 'Verdant Launcher',
  smallImageKey?: string,
  smallImageText?: string,
  startTimestamp?: number
) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Escuta mudanças feitas no SettingsModal
    const handleSettingsChanged = () => {
      const saved = localStorage.getItem('rpcEnabled');
      if (saved !== null) {
        setEnabled(saved === 'true');
      }
    };
    
    handleSettingsChanged(); // init
    window.addEventListener('rpc-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('rpc-settings-changed', handleSettingsChanged);
  }, []);

  useEffect(() => {
    if (!enabled) {
      invoke('clear_discord_rpc').catch(console.error);
      return;
    }

    // Fire and forget
    invoke('set_discord_rpc', {
      details,
      stateStr,
      largeImageKey,
      largeImageText,
      smallImageKey,
      smallImageText,
      startTimestamp,
    }).catch((e) => console.warn('Discord RPC não está rodando no momento:', e));
  }, [details, stateStr, largeImageKey, largeImageText, smallImageKey, smallImageText, startTimestamp, enabled]);
}


