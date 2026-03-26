import { Vector2, circleIntersect, circleLineIntersect } from './math';
import { GameEngine } from './engine';

export class Player {
  pos: Vector2;
  radius = 4; // QoL: Smaller hitbox for grazing
  grazeRadius = 25; // QoL: Graze mechanic
  speed = 300;
  hp = 200;
  maxHp = 200;
  displayHp = 200;
  
  isDashing = false;
  dashTime = 0;
  dashDuration = 0.15;
  dashSpeed = 1000;
  dashCooldown = 0;
  dashCooldownMax = 1.0;
  dashDir = new Vector2(0, 0);

  meleeCooldown = 0;
  rangedCooldown = 0;
  isMeleeAttacking = false;
  meleeAttackTime = 0;
  meleeDir = new Vector2(0, 0);

  zCooldown = 0;
  zCooldownMax = 3.0;

  xCooldown = 0;
  xCooldownMax = 10.0;
  timeSlowTimer = 0;

  ultimateCharge = 0;
  ultimateMax = 100;
  isUltimateActive = false;
  ultimateTimer = 0;

  invulnTime = 0;
  aimDir = new Vector2(1, 0);

  constructor(pos: Vector2) {
    this.pos = pos;
  }

  update(dt: number, game: GameEngine) {
    this.displayHp += (this.hp - this.displayHp) * 10 * dt;
    
    // Passive ultimate charge
    if (!this.isUltimateActive) {
      this.ultimateCharge = Math.min(this.ultimateMax, this.ultimateCharge + 5 * dt);
    }

    if (this.isUltimateActive) {
      this.ultimateTimer -= dt;
      game.spawnParticles(this.pos, '#ff0', 2, 200);
      
      if (this.ultimateTimer <= 1.0 && this.ultimateTimer + dt > 1.0) {
        // Ultimate Climax!
        game.projectiles = [];
        game.lasers = [];
        game.boss.takeDamage(500, game);
        game.flashTime = 1.0;
        game.addShake(30);
        game.audio.playPlayerUltimateBoom();
      }

      if (this.ultimateTimer <= 0) {
        this.isUltimateActive = false;
        game.timeScale = 1.0;
      }
      return; // Skip normal updates during ultimate
    }

    if (this.timeSlowTimer > 0) {
      this.timeSlowTimer -= dt;
      game.timeScale = 0.3;
      if (this.timeSlowTimer <= 0) game.timeScale = 1.0;
    }

    if (this.invulnTime > 0) this.invulnTime -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.meleeCooldown > 0) this.meleeCooldown -= dt;
    if (this.rangedCooldown > 0) this.rangedCooldown -= dt;
    if (this.zCooldown > 0) this.zCooldown -= dt;
    if (this.xCooldown > 0) this.xCooldown -= dt;

    let moveDir = new Vector2(0, 0);
    if (game.input.isKeyDown('KeyW')) moveDir.y -= 1;
    if (game.input.isKeyDown('KeyS')) moveDir.y += 1;
    if (game.input.isKeyDown('KeyA')) moveDir.x -= 1;
    if (game.input.isKeyDown('KeyD')) moveDir.x += 1;
    if (moveDir.mag() > 0) moveDir = moveDir.normalize();

    if (this.isDashing) {
      this.dashTime -= dt;
      this.pos = this.pos.add(this.dashDir.mult(this.dashSpeed * dt));
      game.spawnParticles(this.pos, '#55f', 1, 50);
      if (this.dashTime <= 0) {
        this.isDashing = false;
      }
    } else {
      if (game.input.isKeyDown('Space') && this.dashCooldown <= 0) {
        this.isDashing = true;
        this.dashTime = this.dashDuration;
        this.dashCooldown = this.dashCooldownMax;
        this.dashDir = moveDir.mag() > 0 ? moveDir : new Vector2(1, 0);
        this.invulnTime = this.dashDuration;
        game.audio.playPlayerDash();
      } else {
        this.pos = this.pos.add(moveDir.mult(this.speed * dt));
      }
    }

    this.pos.x = Math.max(this.radius, Math.min(game.width - this.radius, this.pos.x));
    this.pos.y = Math.max(this.radius, Math.min(game.height - this.radius, this.pos.y));

    const mousePos = new Vector2(game.input.mouse.x, game.input.mouse.y);
    this.aimDir = mousePos.sub(this.pos).normalize();

    // Melee Attack
    if (game.input.mouse.left && this.meleeCooldown <= 0 && !this.isDashing) {
      this.meleeCooldown = 0.4;
      this.isMeleeAttacking = true;
      this.meleeAttackTime = 0.15;
      this.meleeDir = this.aimDir;
      game.audio.playPlayerMelee();
      
      const reach = 60;
      const hitPos = this.pos.add(this.aimDir.mult(reach/2));
      if (circleIntersect({ pos: hitPos, radius: reach }, game.boss)) {
        game.boss.takeDamage(15, game);
        this.ultimateCharge = Math.min(this.ultimateMax, this.ultimateCharge + 2);
      }
    }

    if (this.isMeleeAttacking) {
      this.meleeAttackTime -= dt;
      if (this.meleeAttackTime <= 0) this.isMeleeAttacking = false;
    }

    // Ranged Attack (Auto-fire if holding right click)
    if (game.input.mouse.right && this.rangedCooldown <= 0 && !this.isDashing) {
      this.rangedCooldown = 0.15; // Faster fire rate for auto-fire feel
      game.audio.playPlayerShoot();
      game.projectiles.push(new Projectile(
        this.pos.add(this.aimDir.mult(this.radius + 5)),
        this.aimDir.mult(800), 4, '#0ff', 5, false // Faster, smaller, less damage per shot but higher DPS
      ));
    }

    // Z Ability: Shotgun
    if (game.input.isKeyDown('KeyZ') && this.zCooldown <= 0 && !this.isDashing) {
      this.zCooldown = this.zCooldownMax;
      game.audio.playPlayerZ();
      game.addShake(5);
      for (let i = -2; i <= 2; i++) {
        const angle = Math.atan2(this.aimDir.y, this.aimDir.x) + i * 0.2;
        const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
        game.projectiles.push(new Projectile(
          this.pos.add(pDir.mult(this.radius + 5)),
          pDir.mult(800), 8, '#ff5', 15, false
        ));
      }
    }

    // X Ability: Time Slow
    if (game.input.isKeyDown('KeyX') && this.xCooldown <= 0 && !this.isDashing) {
      this.xCooldown = this.xCooldownMax;
      this.timeSlowTimer = 3.0;
      game.audio.playPlayerX();
      game.flashTime = 0.2;
    }

    // C Ability: Ultimate
    if (game.input.isKeyDown('KeyC') && this.ultimateCharge >= this.ultimateMax && !this.isDashing) {
      this.ultimateCharge = 0;
      this.isUltimateActive = true;
      this.ultimateTimer = 2.0;
      game.timeScale = 0.1;
      game.audio.playPlayerUltimateCharge();
      game.addShake(10);
    }
  }

  takeDamage(amount: number, game: GameEngine) {
    if (this.invulnTime > 0) return;
    this.hp -= amount;
    this.invulnTime = 0.5; // QoL: I-frames
    game.audio.playPlayerHit();
    game.addShake(10);
    game.flashTime = 0.1;
    game.spawnParticles(this.pos, '#f55', 10, 150);
    game.spawnPopup(this.pos, `-${amount}`, '#f55');
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.invulnTime > 0 && Math.floor(this.invulnTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.5; // QoL: I-frame indicator
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(Math.atan2(this.aimDir.y, this.aimDir.x));

    // Texture Remaster: Sleek neon ship
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#0ff';
    ctx.fillStyle = '#111';
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-15, 15);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-15, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Engine glow
    ctx.shadowColor = '#f0f';
    ctx.fillStyle = '#f0f';
    ctx.beginPath();
    ctx.arc(-8, 0, 4 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();

    // QoL: Player Hitbox Dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;

    // QoL: Dash Ready Indicator Ring
    if (this.dashCooldown <= 0 && !this.isDashing) {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 20 + Math.sin(performance.now() / 200) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.isMeleeAttacking) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const startAngle = Math.atan2(this.meleeDir.y, this.meleeDir.x) - Math.PI / 4;
      const endAngle = Math.atan2(this.meleeDir.y, this.meleeDir.x) + Math.PI / 4;
      ctx.arc(this.pos.x, this.pos.y, 30, startAngle, endAngle);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
  }
}

export class Projectile {
  dead = false;
  lifeTime = 10.0;
  homingTarget?: { pos: Vector2 };
  trail: Vector2[] = [];
  grazed = false; // QoL: Graze mechanic

  constructor(
    public pos: Vector2,
    public vel: Vector2,
    public radius: number,
    public color: string,
    public damage: number,
    public isEnemy: boolean
  ) {}

  update(dt: number) {
    this.trail.push(this.pos.copy());
    if (this.trail.length > 5) this.trail.shift();

    this.lifeTime -= dt;
    if (this.lifeTime <= 0) this.dead = true;

    if (this.homingTarget) {
      const toTarget = this.homingTarget.pos.sub(this.pos).normalize();
      this.vel = this.vel.add(toTarget.mult(400 * dt));
      if (this.vel.mag() > 400) this.vel = this.vel.normalize().mult(400);
    }

    this.pos = this.pos.add(this.vel.mult(dt));
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw trail
    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.radius * 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Texture Remaster: Soft radial halo
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 2);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, this.color);
    grad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Bright core
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  collidesWith(entity: { pos: Vector2; radius: number }) {
    // Use a smaller hitbox for projectiles for fairer dodging (bullet hell style)
    const hitbox = { pos: this.pos, radius: this.radius * 0.6 };
    return circleIntersect(hitbox, entity);
  }

  isOutOfBounds(w: number, h: number) {
    return this.pos.x < -50 || this.pos.x > w + 50 || this.pos.y < -50 || this.pos.y > h + 50;
  }
}

export class Laser {
  active = false;
  constructor(
    public pos: Vector2,
    public dir: Vector2,
    public width: number,
    public delay: number,
    public lifeTime: number,
    public damage: number
  ) {}

  update(dt: number, game: GameEngine) {
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay <= 0) {
        this.active = true;
        game.addShake(10);
        game.audio.playBossLaser();
      }
    } else {
      this.lifeTime -= dt;
      // Use a slightly smaller width for the laser collision for fairer dodging
      if (this.active && circleLineIntersect(game.player, this.pos, this.dir, this.width * 0.6)) {
        game.player.takeDamage(this.damage, game);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const endPos = this.pos.add(this.dir.mult(2000));
    if (this.delay > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([15, 15]);
      ctx.lineDashOffset = -performance.now() / 20;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(endPos.x, endPos.y);
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.lineWidth = this.width;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    } else if (this.active) {
      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#f00';
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = this.width * (1 + Math.random() * 0.2);
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(endPos.x, endPos.y);
      ctx.stroke();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = this.width * 0.3;
      ctx.stroke();
      
      ctx.strokeStyle = '#f55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let currentPos = this.pos.copy();
      ctx.moveTo(currentPos.x, currentPos.y);
      for (let i = 0; i < 20; i++) {
        const segment = this.dir.mult(100);
        const perp = new Vector2(-this.dir.y, this.dir.x).mult((Math.random() - 0.5) * this.width * 1.5);
        currentPos = currentPos.add(segment);
        ctx.lineTo(currentPos.x + perp.x, currentPos.y + perp.y);
      }
      ctx.stroke();
      
      ctx.restore();
    }
  }
}

export class SafeZone {
  maxLifeTime: number;
  constructor(public pos: Vector2, public radius: number, public lifeTime: number) {
    this.maxLifeTime = lifeTime;
  }

  update(dt: number) {
    this.lifeTime -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pulse = Math.sin(performance.now() / 150) * 0.1 + 0.2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#0f0';
    ctx.fillStyle = `rgba(0, 255, 0, ${pulse})`;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // QoL: Draw inner safe text and timer
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAFE', this.pos.x, this.pos.y - 5);
    
    ctx.font = 'bold 24px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.max(0, this.lifeTime).toFixed(1) + 's', this.pos.x, this.pos.y + 20);
    
    ctx.shadowBlur = 0;
  }
}

export class Particle {
  constructor(
    public pos: Vector2,
    public vel: Vector2,
    public color: string,
    public life: number,
    public maxLife: number = life
  ) {}

  update(dt: number) {
    this.pos = this.pos.add(this.vel.mult(dt));
    this.life -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export class TextPopup {
  constructor(
    public pos: Vector2,
    public text: string,
    public color: string,
    public life: number = 1.0,
    public maxLife: number = 1.0
  ) {}

  update(dt: number) {
    this.pos.y -= 50 * dt;
    this.life -= dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.globalAlpha = 1;
  }
}
