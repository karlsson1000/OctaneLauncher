const fs = require('fs');

const version = process.env.GITHUB_REF_NAME;

if (!(process.env.CI && version)) {
  console.log('Not a CI release build; skipping version pinning.');
  process.exit(0);
}

const path = './backend/Cargo.toml';
const cargo = fs.readFileSync(path, 'utf-8');
fs.writeFileSync(path, cargo.replace(/^version = ".*"$/m, `version = "${version}"`));

console.log(`Build version (from tag): ${version}`);
