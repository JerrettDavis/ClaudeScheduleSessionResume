#!/usr/bin/env node
// Syncs the release version into plugin.json and marketplace.json.
// Called by semantic-release via @semantic-release/exec:
//   prepareCmd: "node scripts/sync-versions.js ${nextRelease.version}"

const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..');
const version = process.argv[2];

if (!version) {
  process.stderr.write('Usage: sync-versions.js <version>\n');
  process.exit(1);
}

function updateJson(filePath, updater) {
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  updater(data);
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// .claude-plugin/plugin.json — top-level .version
updateJson(resolve(root, '.claude-plugin/plugin.json'), (data) => {
  data.version = version;
});

// .claude-plugin/marketplace.json — .metadata.version and .plugins[0].version
updateJson(resolve(root, '.claude-plugin/marketplace.json'), (data) => {
  data.metadata.version = version;
  data.plugins[0].version = version;
});

// package.json — .version (semantic-release also does this, but keep in sync explicitly)
updateJson(resolve(root, 'package.json'), (data) => {
  data.version = version;
});

console.log(`Synced version ${version} to plugin.json, marketplace.json, and package.json`);
