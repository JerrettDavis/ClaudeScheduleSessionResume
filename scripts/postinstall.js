#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

// Check Node.js version
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  console.error(
    `\n  ERROR: claude-schedule-session-resume requires Node.js >= 18.\n` +
    `  Current version: ${process.version}\n` +
    `  Please upgrade Node.js and try again.\n`
  );
  process.exit(1);
}

// Run TypeScript compilation if source exists and bin doesn't
const srcDir = join(__dirname, '..', 'src');
const binDir = join(__dirname, '..', 'bin');

if (existsSync(srcDir) && !existsSync(binDir)) {
  console.log('Compiling TypeScript...');
  try {
    execSync('npx tsc -p tsconfig.json', {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('Compilation complete.');
  } catch (err) {
    console.error('TypeScript compilation failed. Run "npm run build" manually.');
    process.exit(1);
  }
} else if (existsSync(binDir)) {
  console.log('Plugin already compiled.');
} else {
  console.log('No source directory found — assuming prebuilt distribution.');
}
