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
