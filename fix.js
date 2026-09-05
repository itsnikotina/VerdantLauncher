const fs = require('fs');
let content = fs.readFileSync('src/components/Modals/ProfileModal.tsx', 'utf8');

const startStr = '  const skinUrl = pendingSkinUrl ?';
const endStr = '  return (';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find bounds');
  process.exit(1);
}

const newBlock = 
  const skinUrl = pendingSkinUrl 
    ? pendingSkinUrl 
    : cachedSkinUrl 
      ? cachedSkinUrl
      : isMicrosoft 
        ? \https://mc-heads.net/skin/\?t=\\
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
        throw new Error('Apenas imagens no formato PNG são suportadas.');
      }
      
      const base64String = \data:image/png;base64,\\;
      setPendingSkinFile(selectedPath as string);
      setPendingSkinUrl(base64String);
    } catch (e: any) {
      setErrorMsg(e.message || 'Falha ao escolher arquivo');
    }
  };

  const handleSaveSkin = async () => {
    if (!pendingSkinFile || !pendingSkinUrl) return;
    
    try {
      setErrorMsg('');
      setUploading(true);

      if (isMicrosoft) {
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
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const fileData = await readFile(pendingSkinFile);
        const blob = new Blob([fileData], { type: 'image/png' });

        const { error } = await supabase.storage
          .from('skins')
          .upload(\\.png\, blob, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) throw new Error(error.message);
        
        await supabase.auth.updateUser({ data: { skin_variant: variant } });
        setCachedSkinUrl(pendingSkinUrl);
        showToast('Skin Verdant atualizada com sucesso!');
      }
      
      setSkinTimestamp(Date.now());
      setPendingSkinFile(null);
      setPendingSkinUrl(null);
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
    setErrorMsg('');
  };
;

content = content.substring(0, startIndex) + newBlock + '\n' + content.substring(endIndex);
fs.writeFileSync('src/components/Modals/ProfileModal.tsx', content, 'utf8');
console.log('Replaced block successfully');
