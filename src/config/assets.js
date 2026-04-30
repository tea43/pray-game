export const DISPLAY_NAME_DEFS = {
  gameTitle: 'P-RAY: The Game',
  waveSubtext: 'the brood stirs',
  minibossLabel: 'A BROOD WARDEN SURFACES',
  bigbossLabel: 'ELDER WORM SURFACES',
};

// Asset registry shape — populated by manifest.json in a later phase.
// The renderer checks: loaded asset → configured primitive → legacy primitive → debug placeholder.
export const ASSET_REGISTRY = {
  heroes: {},
  enemies: {},
  weapons: {},
  loot: {},
  comicPanels: {},
};

/**
 * Resolve an asset by category and key.
 * Returns null if no asset is loaded, which triggers the fallback renderer.
 */
export function resolveAsset(category, key) {
  return ASSET_REGISTRY[category]?.[key] ?? null;
}

/**
 * Load assets from a manifest object (e.g. parsed from manifest.json).
 * Structure: { category: { key: url } }
 */
export function loadAssets(manifest) {
  for (const [category, items] of Object.entries(manifest)) {
    if (!ASSET_REGISTRY[category]) ASSET_REGISTRY[category] = {};
    for (const [key, url] of Object.entries(items)) {
      const img = new Image();
      img.src = url;
      img.onload = () => { ASSET_REGISTRY[category][key] = img; };
      img.onerror = () => { console.warn(`Failed to load asset: ${url}`); };
    }
  }
}
