const { execSync } = require('child_process');
const fs = require('fs');
const key = fs.readFileSync('updater.key', 'utf-8');
const cmd = `npx @tauri-apps/cli signer sign -k "${key.trim()}" "C:\\Users\\pik4c\\Desktop\\VerdantLauncher Project\\VerdantLauncher\\src-tauri\\target\\release\\bundle\\nsis\\Verdant-Launcher-0.1.0-setup.nsis.zip"`;
const out = execSync(cmd, { encoding: 'utf-8', env: process.env });
console.log("SIG:", out);
