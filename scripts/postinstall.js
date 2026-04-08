#!/usr/bin/env node
'use strict';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`claude-schedule-session-resume requires Node.js >= 18. Found: ${process.versions.node}`);
  process.exit(1);
}

const { execSync } = require('child_process');
const path = require('path');

try {
  execSync('tsc -p tsconfig.json', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  console.log('claude-schedule-session-resume: build complete');
} catch {
  console.error('claude-schedule-session-resume: build failed — run `npm run build` manually');
  // Don't exit non-zero: postinstall failures block npm install
}
