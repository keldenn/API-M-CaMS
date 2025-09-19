const { spawn } = require('child_process');
spawn('pm2', ['start', 'ecosystem.config.js'], { stdio: 'inherit' });