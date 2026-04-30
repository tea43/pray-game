export const rand    = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const dist2   = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const clamp   = (v, a, b) => Math.max(a, Math.min(b, v));
