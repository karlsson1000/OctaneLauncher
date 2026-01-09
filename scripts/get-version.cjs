const { execSync } = require('child_process');
const fs = require('fs');

const getCommitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
};

if (process.env.CI && process.env.GITHUB_REF_NAME) {
  const version = process.env.GITHUB_REF_NAME;
  const commitHash = getCommitHash();
  
  // Update Cargo.toml
  const cargoPath = './src-tauri/Cargo.toml';
  let cargo = fs.readFileSync(cargoPath, 'utf-8');
  cargo = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
  fs.writeFileSync(cargoPath, cargo);

  // Update tauri.conf.json
  const tauriConfPath = './src-tauri/tauri.conf.json';
  let tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));

  const commitHashPath = './src-tauri/commit_hash.txt';
  fs.writeFileSync(commitHashPath, commitHash);

  console.log(`Build version (from tag): ${version}`);
  console.log(`Commit hash: ${commitHash}`);
  process.exit(0);
}

// Local dev
const version = '0.1.0-dev';
const commitHash = getCommitHash();

// Update Cargo.toml
const cargoPath = './src-tauri/Cargo.toml';
let cargo = fs.readFileSync(cargoPath, 'utf-8');
cargo = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargo);

// Update tauri.conf.json
const tauriConfPath = './src-tauri/tauri.conf.json';
let tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));

const commitHashPath = './src-tauri/commit_hash.txt';
fs.writeFileSync(commitHashPath, commitHash);

console.log(`Build version (local dev): ${version}`);
console.log(`Commit hash: ${commitHash}`);