export const DISPLAY_NAME_DEFS = {
  gameTitle: 'P-RAY: The Game',
  waveSubtext: 'the brood stirs',
  minibossLabel: 'A BROOD WARDEN SURFACES',
  bigbossLabel: 'ELDER WORM SURFACES',
};

// ── SpriteSheet ────────────────────────────────────────────────────────────────
// Wraps a loaded HTMLImageElement with optional animation metadata.
// Static sprites: isAnimated = false, draw() renders the whole image.
// Animated sprites: isAnimated = true, draw() clips the correct frame.

export class SpriteSheet {
  constructor(image, def) {
    this.image = image;
    this.isAnimated = !!def.animations;
    this.frameW = def.frameW || image.naturalWidth;
    this.frameH = def.frameH || image.naturalHeight;
    this.animations = def.animations || null;
  }

  // Draw current animation frame.  animState = { name, frame } from the entity.
  draw(ctx, animState, x, y, w, h) {
    if (!this.isAnimated || !this.animations) {
      ctx.drawImage(this.image, x, y, w, h);
      return;
    }
    const anim = this.animations[animState?.name] || this.animations.idle || this.animations[Object.keys(this.animations)[0]];
    if (!anim) { ctx.drawImage(this.image, x, y, w, h); return; }
    const col = (animState?.frame ?? 0) % anim.frames;
    ctx.drawImage(
      this.image,
      col * this.frameW, anim.row * this.frameH, this.frameW, this.frameH,
      x, y, w, h,
    );
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

const ASSET_REGISTRY = {
  heroes:      {},
  enemies:     {},
  weapons:     {},
  loot:        {},
  world:       {},
  comicPanels: {},
};

export function resolveAsset(category, key) {
  return ASSET_REGISTRY[category]?.[key] ?? null;
}

// manifest entry shapes:
//   static:   "path/to/sprite.png"
//   animated: { src, frameW, frameH, animations: { name: { row, frames, fps } } }
export function loadAssets(manifest) {
  for (const [category, items] of Object.entries(manifest)) {
    if (!ASSET_REGISTRY[category]) ASSET_REGISTRY[category] = {};
    for (const [key, entry] of Object.entries(items)) {
      const def   = typeof entry === 'string' ? { src: entry } : entry;
      const image = new Image();
      image.onload  = () => { ASSET_REGISTRY[category][key] = new SpriteSheet(image, def); };
      image.onerror = () => { console.warn(`Sprite not found: ${def.src}`); };
      image.src = def.src;
    }
  }
}
