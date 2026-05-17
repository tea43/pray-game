const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const audioRoot = path.join(root, 'public', 'assets', 'audio');
const catalogPath = path.join(audioRoot, 'catalog.json');
const manifestPath = path.join(audioRoot, 'manifest.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listAudioFiles(dir, supportedExtensions, safePattern, warnings) {
  if (!dir) return [];
  const absDir = path.join(audioRoot, dir);
  if (!fs.existsSync(absDir)) return [];

  return fs.readdirSync(absDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => supportedExtensions.includes(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map(name => {
      if (safePattern && !safePattern.test(name)) {
        warnings.push(`Non-standard audio filename: ${path.posix.join(dir, name)}`);
      }
      return `./assets/audio/${path.posix.join(dir, name)}`;
    });
}

function buildSection(section, catalog, supportedExtensions, safePattern, warnings) {
  const output = {};
  for (const [id, entry] of Object.entries(section || {})) {
    const { dir, ...settings } = entry;
    output[id] = {
      variants: listAudioFiles(dir, supportedExtensions, safePattern, warnings),
      ...settings,
    };
  }
  return output;
}

function main() {
  const catalog = readJson(catalogPath);
  const supportedExtensions = catalog.supportedExtensions || ['.mp3', '.ogg', '.wav', '.m4a'];
  const safePattern = catalog.naming?.safePattern ? new RegExp(catalog.naming.safePattern) : null;
  const warnings = [];

  const manifest = {
    version: catalog.version || 1,
    generatedFrom: './assets/audio/catalog.json',
    music: buildSection(catalog.music, catalog, supportedExtensions, safePattern, warnings),
    sfx: buildSection(catalog.sfx, catalog, supportedExtensions, safePattern, warnings),
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const variantCount = Object.values(manifest.music).concat(Object.values(manifest.sfx))
    .reduce((sum, entry) => sum + entry.variants.length, 0);
  console.log(`Generated ${path.relative(root, manifestPath)} with ${variantCount} audio file(s).`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  if (warnings.length > 0 && catalog.naming?.warnOnly === false) {
    process.exitCode = 1;
  }
}

main();
