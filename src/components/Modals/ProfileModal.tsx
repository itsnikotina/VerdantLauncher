import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import SkinViewer3D from '../SkinViewer3D';
import { supabase } from '../../lib/supabase';
import { open } from '@tauri-apps/plugin-dialog';

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, mcUser, cachedSkinUrl, setCachedSkinUrl } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [variant, setVariant] = useState<'classic' | 'slim'>('classic');
  const [variantChanged, setVariantChanged] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingSkinFile, setPendingSkinFile] = useState<string | null>(null);
  const [pendingSkinUrl, setPendingSkinUrl] = useState<string | null>(null);
  const { showToast } = useToast();
  
  const isMicrosoft = !!mcUser;
  const displayName = isMicrosoft 
    ? mcUser.name.toUpperCase()
    : (user?.user_metadata?.username || user?.email?.split('@')[0] || 'JOGADOR').toUpperCase();

  useEffect(() => {
    if (isMicrosoft) {
      // Busca modelo da skin na Mojang (via Ashcon API)
      fetch(`https://api.ashcon.app/mojang/v2/user/${mcUser.name}`)
        .then(res => res.json())
        .then(data => {
          if (data.textures?.slim) setVariant('slim');
          else setVariant('classic');
        })
        .catch(console.error);
    } else if (user) {
      // Puxa o modelo salvo no metadata do Verdant
      setVariant(user.user_metadata?.skin_variant === 'slim' ? 'slim' : 'classic');
    }
  }, [isMicrosoft, mcUser, user]);

  const [skinTimestamp, setSkinTimestamp] = useState(Date.now());
  
  const getVerdantSkinUrl = () => {
    if (!user) return '';
    const username = user.user_metadata?.username;
    if (!username) return '';
    const { data } = supabase.storage.from('skins').getPublicUrl(`${username}.png`);
    return `${data.publicUrl}?t=${skinTimestamp}`;
  };

  // Usa o cache local (base64) se existir, senÃƒÂ£o usa as APIs externas que retornam texturas achatadas (para o visualizador 3D) ou imagens.
  // IMPORTANTE: O Skinview3D precisa da textura achatada 64x64, nÃƒÂ£o o render 3D do Minotar!
  // A API oficial da Mojang pra pegar textura da skin exige UUID, entÃ£o usaremos o minotar/skin que retorna a textura limpa
  const skinUrl = pendingSkinUrl
    ? pendingSkinUrl 
    : cachedSkinUrl 
      ? cachedSkinUrl
      : isMicrosoft 
        ? `https://api.mcheads.org/skin/${mcUser?.name}?t=${skinTimestamp}`
        : getVerdantSkinUrl();

  const handlePickSkin = async () => {
    try {
      setErrorMsg('');
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'Image',
          extensions: ['png']
        }]
      });

      if (!selectedPath) return;
      
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const fileData = await readFile(selectedPath as string);
      
      if (fileData.length < 4 || fileData[0] !== 0x89 || fileData[1] !== 0x50 || fileData[2] !== 0x4E || fileData[3] !== 0x47) {
        throw new Error('Apenas imagens no formato PNG sÃƒÂ£o suportadas.');
      }
      
      const base64String = `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(fileData)))}`;
      setPendingSkinFile(selectedPath as string);
      setPendingSkinUrl(base64String);
    } catch (e: any) {
      setErrorMsg(e.message || 'Falha ao escolher arquivo');
    }
  };

  const handleSaveSkin = async () => {
    if (!pendingSkinFile && !variantChanged) return;
    
    try {
      setErrorMsg('');
      setUploading(true);

      if (isMicrosoft) {
        if (!pendingSkinFile) {
           throw new Error('Para contas Microsoft, é necessário ESCOLHER SKIN novamente para mudar o modelo.');
        }
        const { invoke } = await import('@tauri-apps/api/core');
        if (!mcUser?.token) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        await invoke('upload_mc_skin', { 
          mcToken: mcUser.token, 
          filePath: pendingSkinFile, 
          variant
        });
        
        setCachedSkinUrl(pendingSkinUrl);
        showToast('Skin atualizada com sucesso na Mojang!');
      } else {
        const username = user?.user_metadata?.username;
        if (!username) throw new Error('Nome de usuário não encontrado.');

        if (pendingSkinFile) {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const fileData = await readFile(pendingSkinFile);
          const blob = new Blob([fileData], { type: 'image/png' });

          const { error } = await supabase.storage
            .from('skins')
            .upload(`${username}.png`, blob, {
              cacheControl: '3600',
              upsert: true
            });

          if (error) throw new Error(error.message);
          setCachedSkinUrl(pendingSkinUrl);
        }
        
        // Atualiza a variante no user_metadata
        await supabase.auth.updateUser({ data: { skin_variant: variant } });

        // Envia o JSON da variante
        const jsonBlob = new Blob([JSON.stringify({ model: variant })], { type: 'application/json' });
        await supabase.storage
          .from('skins')
          .upload(`${username}.json`, jsonBlob, {
            cacheControl: '3600',
            upsert: true
          });

        showToast('Skin Verdant atualizada com sucesso!');
      }
      
      setSkinTimestamp(Date.now());
      setPendingSkinFile(null);
      setPendingSkinUrl(null);
      setVariantChanged(false);
      
    } catch (e: any) {
      console.error(e);
      setErrorMsg(typeof e === 'string' ? e : (e.message || 'Falha ao enviar skin.'));
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPick = () => {
    setPendingSkinFile(null);
    setPendingSkinUrl(null);
    setVariantChanged(false);
    setErrorMsg('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
      onClick={onClose}
    >
      <div 
        className="bg-[#111411] border border-[#2dba7e]/30 w-full max-w-2xl shadow-2xl flex flex-col max-h-full"
        onClick={e => e.stopPropagation()}
      >
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2dba7e]/20 bg-[#0a0c0a]">
          <h2 className="font-mc-big text-white text-xl tracking-widest text-[#2dba7e]">MEU PERFIL</h2>
          <button 
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-row p-8 gap-8 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          <div className="w-1/3 flex flex-col items-center gap-4">
            <div className="w-full max-w-[160px] h-[240px] shrink-0 bg-[#0a0c0a] border-2 border-[#2dba7e]/20 rounded-lg p-2 flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 z-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <Icon icon="mdi:cursor-move" className="w-12 h-12 text-white/10" />
              </div>
              <div className="z-10 w-full flex justify-center drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                <SkinViewer3D skinUrl={skinUrl} model={variant} />
              </div>
            </div>
            
            <div className="w-full flex flex-col gap-2 mt-2">
              <button 
                onClick={handlePickSkin}
                disabled={uploading}
                className="w-full py-3 bg-[#1a1c1a] hover:bg-[#2a2d2a] text-white border border-white/10 font-mc-small text-xs tracking-widest transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                <Icon icon="mdi:folder-image" className="w-4 h-4" />
                {pendingSkinUrl ? 'TROCAR IMAGEM' : 'ESCOLHER SKIN'}
              </button>

              <div className={`flex gap-2 transition-all duration-300 overflow-hidden ${pendingSkinUrl ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}>
                <button 
                  onClick={handleSaveSkin}
                  disabled={uploading || !pendingSkinUrl}
                  className="flex-1 py-3 bg-[#2dba7e] hover:bg-[#32d583] text-white font-mc-small text-xs tracking-widest transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {uploading ? (
                    <Icon icon="mdi:loading" className="animate-spin w-4 h-4" />
                  ) : (
                    <>
                      <Icon icon="mdi:content-save" className="w-4 h-4" />
                      SALVAR
                    </>
                  )}
                </button>
                <button 
                  onClick={handleCancelPick}
                  disabled={uploading}
                  className="w-12 h-12 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Restaurar skin atual"
                >
                  <Icon icon="mdi:undo-variant" className="w-5 h-5" />
                </button>
              </div>
            </div>
            {errorMsg && (
              <span className="text-red-400 font-mc-small text-[10px] text-center mt-2 block">{errorMsg}</span>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-6 pt-2">
            <div>
              <p className="text-white/40 font-mc-small text-[10px] tracking-widest mb-1">NOME DO JOGADOR</p>
              <h1 className="text-white font-mc-big text-3xl tracking-widest">{displayName}</h1>
            </div>

            <div>
              <p className="text-white/40 font-mc-small text-[10px] tracking-widest mb-1">TIPO DE CONTA</p>
              <div className="inline-flex items-center gap-2 bg-[#0a0c0a] px-3 py-2 rounded">
                <Icon icon={isMicrosoft ? "mdi:microsoft" : "mdi:account"} className={`w-5 h-5 -translate-y-[1px] ${isMicrosoft ? 'text-[#00a4ef]' : 'text-[#2dba7e]'}`} />
                <span className="text-white font-mc-small text-sm tracking-wider translate-y-[2px]">
                  {isMicrosoft ? 'CONTA MICROSOFT' : 'CONTA VERDANT'}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-white/40 font-mc-small text-[10px] tracking-widest mb-2">MODELO DA SKIN</p>
              <div className="flex gap-2 max-w-[200px]">
                <button 
                  onClick={() => { setVariant('classic'); setVariantChanged(true); }}
                  className={`flex-1 py-1.5 text-xs font-sans rounded border transition-colors ${variant === 'classic' ? 'bg-[#1a1c1a] border-[#2dba7e] text-[#2dba7e]' : 'bg-[#0a0c0a] border-white/5 text-[#8a9a8a] hover:bg-[#151715]'}`}
                >
                  Clássico
                </button>
                <button 
                  onClick={() => { setVariant('slim'); setVariantChanged(true); }}
                  className={`flex-1 py-1.5 text-xs font-sans rounded border transition-colors ${variant === 'slim' ? 'bg-[#1a1c1a] border-[#2dba7e] text-[#2dba7e]' : 'bg-[#0a0c0a] border-white/5 text-[#8a9a8a] hover:bg-[#151715]'}`}
                >
                  Fino
                </button>
              </div>
            </div>

            <div className="mt-auto bg-[#0a0c0a] border border-white/5 p-4 rounded text-white/60 font-sans text-xs leading-relaxed">
              <p className="mb-2">
                <strong className="text-[#2dba7e]">DICA:</strong> As contas do Verdant possuem um sistema de skins próprio. Faça o upload aqui para os outros te verem no jogo.
              </p>
              {isMicrosoft && (
                <p>
                  Sua conta Microsoft utiliza a infraestrutura oficial. Ao fazer o upload aqui, nós enviamos a sua skin nova direto para os servidores da Mojang!
                </p>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}



















