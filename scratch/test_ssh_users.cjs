const { execSync } = require('child_process');

const users = ['root', 'ubuntu', 'debian', 'admin', 'jb', 'deploy'];

for (const user of users) {
  try {
    console.log(`Testing SSH as ${user}@187.77.127.167...`);
    const out = execSync(`ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=4 -i C:\\Users\\HP\\.ssh\\id_ed25519 ${user}@187.77.127.167 "whoami && hostname"`, { encoding: 'utf8' });
    console.log(`SUCCESS with ${user}! Output:`, out.trim());
    break;
  } catch (err) {
    console.log(`Failed for ${user}: ${err.message.split('\n')[0]}`);
  }
}

