const { spawn } = require('child_process');
const child = spawn('npx.cmd', ['tauri', 'signer', 'generate', '-w', 'updater.key']);
child.stdout.on('data', (data) => {
  const str = data.toString();
  console.log(str);
  if (str.includes('password')) {
    child.stdin.write('\n');
  }
});
child.stderr.on('data', (data) => console.error(data.toString()));
child.on('close', (code) => console.log('Exited with', code));
