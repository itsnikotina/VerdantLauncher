const fs = require('fs');
let content = fs.readFileSync('src/components/Modals/ProfileModal.tsx', 'utf8');

content = content.replace(
  /const \[variant, setVariant\] = useState<'classic' \| 'slim'>\('classic'\);/,
  "const [variant, setVariant] = useState<'classic' | 'slim'>('classic');\n  const [variantChanged, setVariantChanged] = useState(false);"
);

content = content.replace(
  /onClick=\{\(\) => setVariant\('classic'\)\}/g,
  "onClick={() => { setVariant('classic'); setVariantChanged(true); }}"
);

content = content.replace(
  /onClick=\{\(\) => setVariant\('slim'\)\}/g,
  "onClick={() => { setVariant('slim'); setVariantChanged(true); }}"
);

content = content.replace(
  /pendingSkinUrl \? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'/g,
  "(pendingSkinUrl || variantChanged) ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'"
);

content = content.replace(
  /disabled=\{uploading \|\| !pendingSkinUrl\}/g,
  "disabled={uploading || (!pendingSkinUrl && !variantChanged)}"
);

content = content.replace(
  /const handleCancelPick = \(\) => \{/,
  "const handleCancelPick = () => {\n    setVariantChanged(false);"
);

// update handleSaveSkin logic
content = content.replace(
  /if \(!pendingSkinFile \|\| !pendingSkinUrl\) return;/,
  "if (!pendingSkinFile && !variantChanged) return;"
);

content = content.replace(
  /if \(isMicrosoft\) \{/,
  "if (isMicrosoft) {\n        if (!pendingSkinFile) throw new Error('Para contas Microsoft, é necessário ESCOLHER SKIN novamente para mudar o modelo.');"
);

content = content.replace(
  /\} else \{\n        const \{ readFile \} = await import\('@tauri-apps\/plugin-fs'\);\n        const fileData = await readFile\(pendingSkinFile\);\n        const blob = new Blob\(\[fileData\], \{ type: 'image\/png' \}\);\n\n        const \{ error \} = await supabase\.storage\n          \.from\('skins'\)\n          \.upload\(\$\{user!\.id\}\.png, blob, \{\n            cacheControl: '3600',\n            upsert: true\n          \}\);\n\n        if \(error\) throw new Error\(error\.message\);\n        \n        await supabase\.auth\.updateUser\(\{ data: \{ skin_variant: variant \} \}\);\n        setCachedSkinUrl\(pendingSkinUrl\);\n        showToast\('Skin Verdant atualizada com sucesso!'\);/g,
  } else {
        if (pendingSkinFile) {
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
          setCachedSkinUrl(pendingSkinUrl);
        }
        await supabase.auth.updateUser({ data: { skin_variant: variant } });
        showToast('Skin Verdant atualizada com sucesso!');

);

fs.writeFileSync('src/components/Modals/ProfileModal.tsx', content, 'utf8');
