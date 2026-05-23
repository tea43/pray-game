# Hero Miniature Spec

Exact in-game miniature model for Eliott, Habib, and Richard before final animated sprite production.

This document turns the broader visual brief into a concrete sprite construction target.

Chosen style direction: **chibi miniature humans**
Working reference image: `docs/current/hero_visuals/chibi_concept_reference.png`

## Purpose

We are **not** shrinking the movie stills directly and we are **not** decorating the old circle heroes.

We are building a chibi-miniature adaptation of each hero:

- based on the original movie appearance
- simplified for top-down readability
- consistent across all animation rows
- sized to the existing gameplay footprint

This means:

- recognizably human
- oversized headwear and accessory cues
- compressed torso and limb detail
- cleaner, toy-like readability at small scale

The exact head-to-body ratio is intentionally not locked yet. We should experiment around this reference rather than forcing a rigid 2:1 rule too early.

## Runtime Size Target

Current runtime draw box in `Unit.draw()`:

- draw area: about **33 x 33 px** in world space
- sprite frame: **64 x 64 px**

Recommended miniature target inside that frame:

- visible full hero height: **28-32 px**
- visible head + hat / cap emphasis: slightly larger than natural proportion
- visible shoulder width:
  - Eliott: **20-22 px**
  - Habib: **21-23 px**
  - Richard: **24-27 px**
- transparent padding around hero: **16+ px** on each side of frame for safe rotation

## Default Stance

The heroes should use a **weapon-ready chibi miniature stance**, not a photo-neutral standing pose.

Rules:

- arms stay close to torso
- elbows angle slightly outward only when needed for silhouette
- hands sit around lower-rib / waist level
- chest faces mostly forward
- feet stay planted and simplified
- the pose should feel ready to hold or recover into a weapon action

This is better than arms hanging down because the game almost always presents the heroes as combatants.

## Miniature Construction Grid

Use these proportions as the base idle seed.

Shared structure:

- head zone: top **9-11 px**
- upper torso zone: next **8-9 px**
- lower torso / shorts overlap: next **7-8 px**
- leg zone: bottom **8-10 px**

Shared simplification rules:

- heads and accessories can be slightly oversized if readability improves
- facial features are minimal
- headwear and glasses do more work than detailed eyes or mouth
- shirt detail must be expressed as large clusters, bands, or emblem blocks
- shorts should be one clear lower-body mass, not naturalistic folds
- hands and feet should be simplified into compact readable shapes

## Chibi Ratio Target

This project should use a mild chibi treatment, not an extreme super-deformed cartoon.

Target feel:

- head reads slightly larger than realistic miniature proportion
- torso is compact
- legs are short but still functional and readable
- the figure remains grounded and combat-ready, not cute-bouncy

We want:

- more readable than natural miniature humans
- less caricatured than mascot or toy-figure proportions

## Per-Hero Miniature

### Eliott

Target read:

- smallest and most eccentric silhouette
- compact torso
- bucket hat dominant from above
- strong rainbow shirt read

Construction target:

- full visible height: **29-30 px**
- shoulder width: **20-21 px**
- head + hat width: **22-24 px**
- torso width: **18-19 px**
- shorts width: **17-18 px**

Must-read cues:

- beige bucket hat with visible brim
- yellow glasses band
- rainbow shirt simplified into bold curved or diagonal color zones
- green shorts with light pattern flecks

### Habib

Target read:

- slim, practical, clean silhouette
- straight posture
- pale shirt and red shorts do most of the work

Construction target:

- full visible height: **30-31 px**
- shoulder width: **21-22 px**
- head width: **17-18 px**
- torso width: **18-19 px**
- shorts width: **16-17 px**
- longest leg read of the trio

Must-read cues:

- warm off-white oversized T-shirt block
- red shorts
- neat dark hair shape
- one central simplified shirt graphic
- optional tiny dark technical cue near head if needed

### Richard

Target read:

- widest and heaviest silhouette
- strongest planted stance
- cap and blue glasses lead the head read

Construction target:

- full visible height: **31-32 px**
- shoulder width: **24-27 px**
- head + cap width: **20-22 px**
- torso width: **21-23 px**
- shorts width: **18-20 px**
- thickest arm and chest read

Must-read cues:

- dark cap with light lettering block
- blue mirrored glasses
- pastel vertical shirt bands
- dark shorts

## Pattern Reduction Rules

Movie clothing detail must be reduced aggressively:

- Eliott shirt: convert spiral tie-dye into **4-5 bold color regions**
- Eliott shorts: convert leaf detail into **small light patches**
- Habib shirt print: convert to **1 centered warm/dark emblem**
- Richard shirt: convert thin fabric texture into **4-6 chunky pastel vertical bands**

If a shirt becomes noisy, remove internal detail before changing the silhouette.

## Seed Frame Approval Checklist

A miniature seed frame is ready only when:

- it reads as a real tiny person, not a decorated blob
- it reads as a chibi human, not a snowman stack
- each hero is identifiable in under one second
- the trio is still distinct when viewed at 1x game scale
- Eliott is the most eccentric
- Habib is the cleanest
- Richard is the heaviest
- the pose already supports weapon-holding animation

## Production Sequence

1. Approve chibi miniature proportions
2. Approve one idle seed per hero
3. Generate / draw full animation rows from those seed frames
4. Normalize all frames to the same anchor and size
5. Test in-engine and refine
