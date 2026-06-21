// Slow-motion factors for weapon presentation. Set both to 1.0 to restore the
// original full-speed behaviour. 0.1 = play at 10% speed.
//
// PROJECTILE_TIME_SCALE  multiplies the dt that travelling projectiles
//   (Projectile, ShotgunBullet, BouncingProjectile) are simulated with.
//   Slows travel + spin + gravity arcs + bounce timing uniformly; ranges and
//   trajectories are unchanged (they're distance-based), projectiles simply
//   take 1/scale longer to cover the same path and live 1/scale longer.
export const PROJECTILE_TIME_SCALE = 0.1;

// ATTACK_ANIM_SCALE  playback speed of attack animations (swing/throw decay,
//   orbit angular speed). ANIM_DURATION_MULT stretches fixed-lifetime visual
//   overlays (slashes, beams, explosions) so they last 1/scale longer.
export const ATTACK_ANIM_SCALE  = 0.1;
export const ANIM_DURATION_MULT = 1 / ATTACK_ANIM_SCALE; // = 10
