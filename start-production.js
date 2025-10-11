#!/usr/bin/env node

// Production startup script for Replit deployment
const { spawn } = require('child_process');

console.log('Starting production server...');

// Run tsx directly with the TypeScript server file
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000'
  }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});