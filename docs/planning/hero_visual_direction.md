# Hero Visual Direction

Working visual brief for translating the three movie-reference protagonists into readable in-game sprites.

Status: planning reference for hero art. This does **not** mean the final sprites are approved yet.

Selected body style: **chibi miniature humans**, not circular/snowman bodies.
Current approval note: the first generated chibi concept is accepted as the working direction, while the exact head-to-body ratio remains open for iteration.

Current seed preview:

- `docs/current/hero_visuals/seed_preview.png` — first static in-game read pass for Eliott, Habib, and Richard
- `docs/current/hero_visuals/chibi_concept_reference.png` — approved working concept reference for the current chibi direction
- See also `docs/planning/hero_miniature_spec.md` for the exact size and stance model the next seed pass should follow

## Goal

Preserve the identity of the original movie characters while simplifying them for a top-down Phaser game.

Priority order:

1. Silhouette readability at small size
2. Strong costume color blocking
3. Signature accessories
4. Surface pattern detail

At gameplay scale, the player should identify each hero from a glance, even before reading the weapon or ability UI.

## Runtime Constraints

- Hero sheets use **64 x 64 px frames**
- Sprites are rotated in-game to face movement/attack direction
- The body should sit comfortably inside the existing `r * 3` draw area in `Unit.draw()`
- We should prefer bold shapes and clustered color regions over realistic clothing detail
- Fine shirt prints must be reduced to 2-4 readable color masses, not reproduced literally

## Shared Style Rules

- Keep the heroes grounded in the movie references rather than the current placeholder circles
- Preserve relative body builds between the three heroes
- Favor slightly exaggerated chibi proportions if they improve readability
- Faces should stay minimal; eyewear, hats, and shirt blocks do more identification work than facial detail
- Top-down readability matters more than front-portrait likeness

## Character Locks

### Eliott

Role read: weird alchemical support, small chaotic vacation energy.

Must keep:

- Beige bucket hat
- Yellow-tinted aviator glasses
- Loud rainbow / tie-dye shirt
- Green patterned shorts
- Slimmer, smaller silhouette than Richard

Top-down translation:

- Hat brim should be the first thing visible from above
- Yellow glasses can read as a bright amber band across the face
- The shirt should resolve into 4-5 bold rainbow zones, not a full spiral print
- Shorts should read as green with lighter broken patches

Palette direction:

- Hat: pale beige / sand
- Glasses: amber yellow
- Shirt: red, yellow, blue, green with one darker purple accent
- Shorts: olive and lime

Sprite exaggeration:

- Slightly larger hat and eyewear than realistic proportions
- Slightly narrower shoulders and torso

### Habib

Role read: practical engineer, neat and composed, cleaner than the others.

Must keep:

- Light oversized T-shirt
- Red shorts
- Clean short hair
- Slim upright silhouette
- Technical accessory feel from the movie reference

Top-down translation:

- Shirt should read as a pale block with a warm/dark central graphic simplified into one emblem-like shape
- Red shorts should be the second major read after the pale shirt
- Hair should be visible as a compact dark shape above the forehead
- Optional small dark eyewear / goggle cue can be used if it helps distinguish him from Eliott

Palette direction:

- Shirt: warm off-white
- Graphic accent: brown / ochre / muted red
- Shorts: dusty red
- Hair / accessories: charcoal or black

Sprite exaggeration:

- Longest leg read of the three
- Straightest posture
- Cleanest silhouette, least noisy costume

### Richard (Dick)

Role read: heavy melee bruiser, loud presence, broad and dangerous.

Must keep:

- Dark cap with bold white lettering
- Blue mirrored aviator sunglasses
- Pastel striped shirt
- Dark shorts
- Broad, heavy build

Top-down translation:

- Cap crown and glasses should dominate the head read
- Shirt should resolve into chunky vertical pastel bands, not fine textile detail
- Torso should be visibly wider than both Eliott and Habib
- Arms should feel heavier and more powerful

Palette direction:

- Cap: navy / black with white lettering
- Glasses: cool blue
- Shirt: pale pink, pale blue, cream, soft yellow
- Shorts: near-black

Sprite exaggeration:

- Widest shoulders and torso of the trio
- Shorter neck and heavier arms
- Most stable planted stance

## Relative Read Hierarchy

The heroes should separate visually in this order:

- Eliott: hat + yellow glasses + rainbow shirt
- Habib: pale tee + red shorts + slim clean build
- Richard: cap + blue glasses + broad torso + pastel shirt

If a frame becomes too noisy, remove interior shirt detail before removing silhouette cues.

## Approval Criteria For Seed Frames

Before generating animation strips, one idle seed frame per hero should satisfy all of the following:

- The hero is identifiable without UI help
- The three silhouettes remain distinct in grayscale
- Costume colors still separate the trio when scaled down
- Richard reads as the heaviest body
- Eliott reads as the most eccentric dresser
- Habib reads as the cleanest and most practical character

## Next Step

Refine the current seed frames toward the approved chibi concept reference until all three hero reads are stable at game scale. Keep the head-to-body ratio flexible during iteration. Once the stills are approved, use them as the anchor inputs for full spritesheet generation and normalization.
