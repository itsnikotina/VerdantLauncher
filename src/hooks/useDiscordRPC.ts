import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';

export function useDiscordRPC(
  details: string,
  stateStr: string,
  largeImageKey: string = 'verdantlogo',
  largeImageText: string = 'Verdant Launcher',
  smallImageKey?: string,
  smallImageText?: string,
  startTimestamp?: number
) {
  useEffect(() => {
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
  }, [details, stateStr, largeImageKey, largeImageText, smallImageKey, smallImageText, startTimestamp]);
}


