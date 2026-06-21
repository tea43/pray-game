import { G } from '../globals.js';
import { rand, dist2 } from '../utils/math.js';
import { state } from '../state.js';
import { pushDamageNumber } from '../render/effects.js';
import { playSfx } from '../systems/audio.js';
import { drawWeaponSprite, WEAPON_SPRITES, WEAPON_RENDER_SCALE, getWeaponRender } from '../render/weaponSprites.js';

export class BouncingProjectile {
  constructor(x, y, vx, vy, dmg, owner, wDef) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.z = 12;
    this.dmg = dmg;
    this.owner = owner;
    this.dead = false;
    this.hasHit = false;
    this.key = wDef.key;
    this.wDef = wDef;
    
    const bParams = wDef.bounce || {};
    this.bouncesLeft = bParams.maxBounces ?? 0;
    this.pierce = bParams.pierce ?? false;
    this.maxLife = bParams.lifetime ?? 5.0;
    this.offBounds = bParams.offBounds ?? false;
    this.gravity = bParams.gravity ?? 0;
    this.groundY = Math.min(G.WORLD_H - 10, y + (bParams.bounceHeight ?? 80));
    
    this.life = 0;
    this.r = 6;
    this.spin = 15;
    this.rot = 0;
    this._hitSet = new Set();
    this.flightSound = playSfx('weapon.thrownClub.throw', { loop: false });
    this.isProjectile = true;
  }

  update(dt) {
    if (this.dead) return;
    this.life += dt;
    this.rot += this.spin * dt;
    
    if (this.life > this.maxLife) {
      this.cleanup();
      return;
    }

    if (this.gravity > 0) {
      this.vy += this.gravity * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.offBounds) {
      if (this.x < 0 || this.x > G.WORLD_W) {
        this.vx *= -1;
        this.x = Math.max(0, Math.min(G.WORLD_W, this.x));
        this.doBounce();
      }
      if (this.y < 0 || this.y > G.WORLD_H) {
        this.vy *= -1;
        this.y = Math.max(0, Math.min(G.WORLD_H, this.y));
        this.doBounce();
      }
    } else if (this.gravity > 0) {
      if (this.y > this.groundY) {
        this.y = this.groundY;
        this.vy *= -0.7;
        this.doBounce();
      }
    }

    for (const e of state.enemies) {
      if (e.dead) continue;
      const touchDist = e.r + this.r;
      // Note: dist2 returns Math.hypot (not squared distance), so we just compare directly
      if (dist2(this.x, this.y, e.x, e.y) < touchDist) {
        this.hitEnemy(e);
      }
    }
  }

  doBounce() {
    if (this.bouncesLeft <= 0) {
      this.cleanup();
      return;
    }
    this.bouncesLeft--;
    this._hitSet.clear();
  }

  hitEnemy(e) {
    if (!this.pierce && this.hasHit) return;
    if (this._hitSet.has(e)) return;
    
    this._hitSet.add(e);
    if (!this.pierce) this.hasHit = true;

    playSfx('weapon.impact.default');
    e.hp -= this.dmg;
    if (this.owner && !this.owner.dead) {
      this.owner._gainWeaponXp(this.dmg);
      this.owner._applyWeaponEffect(e);
    }
    e.hurtFlash = 1;
    e.knockX += this.vx * 0.1;
    e.knockY += this.vy * 0.1;
    pushDamageNumber(e.x, e.y - e.r - 4, this.dmg);
    
    if (!this.pierce) {
      if (this.gravity > 0) {
        this.vy *= -0.8;
        this.vx *= -0.5; 
        this.doBounce();
      } else {
        this.cleanup();
      }
    }
  }

  cleanup() {
    if (this.flightSound) this.flightSound.stop();
    this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    
    ctx.save();
    ctx.translate(this.x, this.y - this.z);
    ctx.rotate(this.rot);
    
    const spriteKey = this.wDef?.projectileSprite || this.key;
    if (spriteKey && WEAPON_SPRITES[spriteKey]) {
      const renderConfig = getWeaponRender(spriteKey);
      const scale = renderConfig.scale * WEAPON_RENDER_SCALE;
      drawWeaponSprite(ctx, spriteKey, 0, 0, scale, 0);
    } else {
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
