#!/usr/bin/env node
'use strict';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(
    `claude-schedule-session-resume requires Node.js >= 18. Found: ${process.versions.node}`
  );
  process.exit(1);
}

console.log('claude-schedule-session-resume: Node.js version check passed');
