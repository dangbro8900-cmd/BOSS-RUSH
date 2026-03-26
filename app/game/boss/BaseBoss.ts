import { Vector2, circleIntersect, circleLineIntersect } from '../math';
import { GameEngine } from '../engine';
import { Projectile, Laser, SafeZone } from '../entities';
import { BossConfig } from './BossData';

export abstract class BaseBoss {
  pos: Vector2;
  config: BossConfig;
  radius: number;
  hp: number;
  maxHp: number;
  displayHp: number;
  speed: number;
  phase = 1;
  
  state: string = 'IDLE';
  stateTimer = 2;
  subStateTimer = 0;
  
  dashTarget = new Vector2(0, 0);
  dashSpeed = 1000;

  dead = false;
  transitionTimer = 0;
  dialogueText = "";
  flashTime = 0;

  constructor(pos: Vector2, config: BossConfig) {
    this.pos = pos;
    this.config = config;
    this.radius = config.radius;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.displayHp = config.hp;
    this.speed = config.speed;
  }

  update(dt: number, game: GameEngine) {
    this.displayHp += (this.hp - this.displayHp) * 10 * dt;
    this.stateTimer -= dt;
    this.subStateTimer -= dt;

    if (this.flashTime > 0) {
      this.flashTime -= dt;
    }

    // Determine Phase
    if (this.phase === 1 && this.hp <= this.maxHp * 0.7) {
      this.phase = 1.5;
      this.startTransition(game, "FOOLISH MORTAL. YOU THINK YOU CAN DEFEAT ME?");
    } else if (this.phase === 2 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2.5;
      this.startTransition(game, "ENOUGH! I WILL ANNIHILATE YOU!");
    } else if (this.phase === 3 && (game as any).hardMode && this.hp <= this.maxHp * 0.25) {
      this.phase = 3.5;
      this.startTransition(game, "THIS ISN'T OVER! TRUE POWER AWAKENS!");
    } else if ((this.phase === 3 && !(game as any).hardMode && this.hp <= 0) || (this.phase === 4 && this.hp <= 0)) {
      this.phase = 5;
      this.startDeathSequence(game);
    }

    if (this.state === 'TRANSITION') {
      this.transitionTimer -= dt;
      const center = new Vector2(game.width / 2, game.height / 3);
      this.pos = this.pos.add(center.sub(this.pos).mult(2 * dt));
      
      game.spawnParticles(this.pos, '#a0f', 2, 100);

      if (this.transitionTimer <= 0) {
        if (this.phase === 1.5) {
          this.phase = 2;
          this.hp = this.maxHp * 0.7;
        } else if (this.phase === 2.5) {
          this.phase = 3;
          this.hp = this.maxHp * 0.5;
        } else if (this.phase === 3.5) {
          this.phase = 4;
          this.hp = this.maxHp * 0.25;
        }
        this.state = 'IDLE';
        this.stateTimer = 1.0;
        game.audio.startBGMPhase(Math.min(this.phase, 3)); // Keep BGM phase 3 for phase 4
        game.addShake(30);
        game.flashTime = 0.8;
        game.spawnParticles(this.pos, '#fff', 100, 300);
        this.radius = this.phase === 2 ? this.config.radius * 0.8 : (this.phase === 4 ? this.config.radius * 0.6 : this.config.radius * 1.2);
      }
      return;
    }

    if (this.state === 'DEATH') {
      this.transitionTimer -= dt;
      game.addShake(10);
      if (Math.random() < 0.2) {
        const offset = new Vector2((Math.random()-0.5)*300, (Math.random()-0.5)*300);
        game.spawnParticles(this.pos.add(offset), '#fa0', 30, 300);
        game.audio.playBossHit();
      }

      if (this.transitionTimer <= 0) {
        game.spawnParticles(this.pos, '#fff', 500, 1000);
        game.flashTime = 2.0;
        game.addShake(100);
        game.audio.playBossNuke();
        this.dead = true;
      }
      return;
    }

    const toPlayer = game.player.pos.sub(this.pos);
    const dir = toPlayer.normalize();

    if (this.stateTimer <= 0) {
      this.pickNextState(game);
    }

    switch (this.state) {
      case 'IDLE':
        break;
      case 'CHASE':
        this.pos = this.pos.add(dir.mult((this.phase >= 2 ? this.speed * 1.5 : this.speed) * dt));
        if (circleIntersect(this, game.player)) {
          game.player.takeDamage(10, game);
        }
        break;
      case 'HEAVY_SHOT':
        if (this.subStateTimer <= 0) {
          game.audio.playBossShoot();
          game.projectiles.push(new Projectile(
            this.pos.add(dir.mult(this.radius + 10)),
            dir.mult(300), 15, this.config.color, 20, true
          ));
          this.subStateTimer = 0.8;
        }
        break;
      case 'SPREAD':
        if (this.subStateTimer <= 0) {
          game.audio.playBossShoot();
          game.addShake(5);
          const count = this.phase >= 2 ? 24 : 16;
          const offsetAngle = this.stateTimer * Math.PI; // Spiral effect
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + offsetAngle;
            const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
            game.projectiles.push(new Projectile(
              this.pos.add(pDir.mult(this.radius + 5)),
              pDir.mult(300), 8, this.config.color, 10, true
            ));
          }
          this.subStateTimer = this.phase >= 2 ? 0.6 : 1.0;
        }
        break;
      case 'PREP_DASH':
        // Wait
        break;
      case 'DASH':
        const distToTarget = this.pos.dist(this.dashTarget);
        const moveDist = this.dashSpeed * dt;
        if (distToTarget <= moveDist) {
          this.pos = this.dashTarget.copy();
          this.stateTimer = 0;
          game.addShake(20);
          // Shockwave on impact
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
            game.projectiles.push(new Projectile(this.pos, pDir.mult(400), 6, this.config.color, 10, true));
          }
        } else {
          const dashDir = this.dashTarget.sub(this.pos).normalize();
          this.pos = this.pos.add(dashDir.mult(moveDist));
        }
        game.spawnParticles(this.pos, this.config.color, 3, 100);
        if (circleIntersect(this, game.player)) {
          game.player.takeDamage(25, game);
        }
        break;
      case 'LASER_CAGE':
        if (this.subStateTimer <= 0) {
          const time = performance.now() / 1000;
          const numLasers = this.phase >= 3 ? 6 : 4;
          for (let i = 0; i < numLasers; i++) {
            const angle = (i / numLasers) * Math.PI * 2 + time * 1.5; // Rotating cage
            const lDir = new Vector2(Math.cos(angle), Math.sin(angle));
            game.lasers.push(new Laser(this.pos.copy(), lDir, 30, 1.0, 0.8, 20));
          }
          this.subStateTimer = 1.2;
        }
        break;
      case 'SPIRAL':
        if (this.subStateTimer <= 0) {
          game.audio.playBossShoot();
          const angle = this.stateTimer * Math.PI * 5; // Fast rotation
          const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
          const pDir2 = new Vector2(Math.cos(angle + Math.PI), Math.sin(angle + Math.PI));
          game.projectiles.push(new Projectile(this.pos.add(pDir.mult(this.radius)), pDir.mult(200), 8, this.config.color, 10, true));
          game.projectiles.push(new Projectile(this.pos.add(pDir2.mult(this.radius)), pDir2.mult(200), 8, this.config.color, 10, true));
          this.subStateTimer = 0.08;
        }
        break;
      case 'MINEFIELD':
        if (this.subStateTimer <= 0) {
          const numMines = this.phase >= 3 ? 10 : 6;
          for (let i = 0; i < numMines; i++) {
            const offset = new Vector2((Math.random()-0.5)*1000, (Math.random()-0.5)*1000);
            const minePos = game.player.pos.add(offset);
            const mine = new Projectile(minePos, new Vector2(0,0), 15, '#f80', 20, true);
            mine.lifeTime = 4.0;
            mine.homingTarget = game.player; // Make mines slowly home in
            game.projectiles.push(mine);
          }
          this.subStateTimer = 1.2;
        }
        break;
      case 'HOMING':
        if (this.subStateTimer <= 0) {
          game.audio.playBossShoot();
          for (let i = -1; i <= 1; i++) {
            const angle = Math.atan2(dir.y, dir.x) + i * 0.4;
            const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
            const p = new Projectile(this.pos.add(pDir.mult(this.radius)), pDir.mult(150), 10, this.config.color, 15, true);
            p.homingTarget = game.player;
            game.projectiles.push(p);
          }
          this.subStateTimer = 1.5;
        }
        break;
      case 'BURST':
        if (this.subStateTimer <= 0) {
          game.audio.playBossShoot();
          game.projectiles.push(new Projectile(
            this.pos.add(dir.mult(this.radius)),
            dir.mult(600), 10, this.config.color, 15, true
          ));
          this.subStateTimer = 0.15;
        }
        break;
      case 'ULT_NOVA':
        if (this.subStateTimer <= 0) {
          game.audio.playBossNuke();
          game.addShake(20);
          for (let i = 0; i < 40; i++) {
            const angle = (i / 40) * Math.PI * 2;
            const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
            game.projectiles.push(new Projectile(
              this.pos.add(pDir.mult(this.radius)),
              pDir.mult(250), 12, this.config.color, 25, true
            ));
          }
          this.subStateTimer = 3.0;
        }
        break;
      case 'BLACK_HOLE':
        game.player.pos = game.player.pos.add(toPlayer.normalize().mult(-200 * dt));
        game.spawnParticles(this.pos, '#000', 2, 300);
        game.spawnParticles(this.pos, '#505', 1, 100);
        break;
      case 'CROSS_STRIKE':
        if (this.subStateTimer <= 0) {
          const pPos = game.player.pos.copy();
          game.lasers.push(new Laser(pPos, new Vector2(1, 0), 80, 1.2, 1.0, 40));
          game.lasers.push(new Laser(pPos, new Vector2(0, 1), 80, 1.2, 1.0, 40));
          this.subStateTimer = 2.5;
        }
        break;
      case 'PHANTOM_DASH':
        if (this.subStateTimer <= 0) {
          this.dashTarget = game.player.pos.copy();
          this.state = 'DASH';
          this.stateTimer = 0.4;
          game.audio.playBossDash();
        }
        break;
      case 'ULT_RAY':
        if (this.subStateTimer <= 0) {
          game.lasers.push(new Laser(this.pos.copy(), dir, 200, 1.5, 2.0, 60));
          this.subStateTimer = 4.0;
        }
        break;
      case 'ULT_NUKE':
        if (this.subStateTimer <= 0) {
          game.audio.playBossNuke();
          game.safeZones.push(new SafeZone(new Vector2(game.width*0.2, game.height*0.5), 180, 6.0));
          game.safeZones.push(new SafeZone(new Vector2(game.width*0.8, game.height*0.5), 180, 6.0));
          this.subStateTimer = 6.0;
        }
        if (this.stateTimer <= 1.0 && this.stateTimer + dt > 1.0) {
          game.addShake(50);
          game.flashTime = 1.5;
          let safe = false;
          for (const sz of game.safeZones) {
            if (game.player.pos.dist(sz.pos) <= sz.radius) safe = true;
          }
          if (!safe) game.player.takeDamage(150, game);
        }
        break;
      case 'COMBO_HELL':
        if (this.subStateTimer <= 0) {
          if (Math.random() < 0.1) game.audio.playBossShoot();
          // Spiral + Homing
          const angle = this.stateTimer * Math.PI * 7;
          const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
          game.projectiles.push(new Projectile(this.pos.add(pDir.mult(this.radius)), pDir.mult(250), 8, this.config.color, 10, true));
          
          if (Math.random() < 0.2) {
            const hDir = game.player.pos.sub(this.pos).normalize();
            const p = new Projectile(this.pos, hDir.mult(150), 10, '#f0f', 15, true);
            p.homingTarget = game.player;
            game.projectiles.push(p);
          }
          this.subStateTimer = 0.05;
        }
        break;
      case 'OMNI_LASER':
        if (this.subStateTimer <= 0) {
          const time = performance.now() / 1000;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + time * 2.0;
            const lDir = new Vector2(Math.cos(angle), Math.sin(angle));
            game.lasers.push(new Laser(this.pos.copy(), lDir, 40, 0.8, 0.5, 30));
          }
          this.subStateTimer = 0.8;
        }
        break;
      case 'FRENZY_DASH':
        if (this.subStateTimer <= 0) {
          this.dashTarget = game.player.pos.copy();
          this.state = 'DASH';
          this.stateTimer = 0.2; // Very fast dashes
          this.dashSpeed = 1500;
          game.audio.playBossDash();
        }
        break;
      case 'ULT_OBLITERATION':
        if (this.subStateTimer <= 0) {
          game.audio.playBossNuke();
          // Only one small safe zone that moves
          const safePos = new Vector2(game.width/2 + (Math.random()-0.5)*400, game.height/2 + (Math.random()-0.5)*300);
          game.safeZones.push(new SafeZone(safePos, 120, 5.0));
          this.subStateTimer = 5.0;
        }
        // Bullet hell while waiting for nuke
        if (this.stateTimer > 1.0 && Math.random() < 0.2) {
          const angle = Math.random() * Math.PI * 2;
          const pDir = new Vector2(Math.cos(angle), Math.sin(angle));
          game.projectiles.push(new Projectile(this.pos, pDir.mult(300), 8, this.config.color, 10, true));
        }
        if (this.stateTimer <= 1.0 && this.stateTimer + dt > 1.0) {
          game.addShake(80);
          game.flashTime = 2.0;
          let safe = false;
          for (const sz of game.safeZones) {
            if (game.player.pos.dist(sz.pos) <= sz.radius) safe = true;
          }
          if (!safe) game.player.takeDamage(200, game);
        }
        break;
    }

    this.pos.x = Math.max(this.radius, Math.min(game.width - this.radius, this.pos.x));
    this.pos.y = Math.max(this.radius, Math.min(game.height - this.radius, this.pos.y));
  }

  pickNextState(game: GameEngine) {
    let pool = [...this.config.phase1Pool];
    if (this.phase >= 2) pool = pool.concat(this.config.phase2Pool);
    if (this.phase >= 3) pool = pool.concat(this.config.phase3Pool);
    if (this.phase >= 4) pool = pool.concat(this.config.phase4Pool);
    
    this.state = pool[Math.floor(Math.random() * pool.length)];
    
    const timerMultiplier = this.phase >= 4 ? 0.4 : (this.phase >= 3 ? 0.6 : (this.phase >= 2 ? 0.8 : 1.0));
    
    if (this.state === 'PREP_DASH') {
      this.stateTimer = 0.6 * timerMultiplier;
      const toPlayer = game.player.pos.sub(this.pos).normalize();
      this.dashTarget = game.player.pos.add(toPlayer.mult(600)); 
    } else if (this.state === 'PHANTOM_DASH') {
      this.stateTimer = 1.0 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'ULT_NUKE') {
      this.stateTimer = 6.0;
      this.subStateTimer = 0;
    } else if (this.state === 'ULT_RAY') {
      this.stateTimer = 2.5 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'ULT_NOVA') {
      this.stateTimer = 2.0 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'BLACK_HOLE') {
      this.stateTimer = 3.0 * timerMultiplier;
    } else if (this.state === 'CROSS_STRIKE') {
      this.stateTimer = 2.0 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'LASER_CAGE') {
      this.stateTimer = 2.0 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'COMBO_HELL') {
      this.stateTimer = 4.0 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'OMNI_LASER') {
      this.stateTimer = 3.0 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'FRENZY_DASH') {
      this.stateTimer = 3.0 * timerMultiplier;
      this.subStateTimer = 0;
    } else if (this.state === 'ULT_OBLITERATION') {
      this.stateTimer = 5.0;
      this.subStateTimer = 0;
    } else {
      this.stateTimer = (1.0 + Math.random() * 0.5) * timerMultiplier;
      this.subStateTimer = 0;
    }
  }

  takeDamage(amount: number, game: GameEngine) {
    if (this.phase === 1.5 || this.phase === 2.5 || this.phase === 3.5 || this.phase === 5) return;
    this.hp -= amount;
    this.flashTime = 0.1;
    if (this.hp > 0) {
      game.audio.playBossHit();
      game.spawnParticles(this.pos, '#fff', 5, 150);
      game.spawnPopup(this.pos, `-${amount}`, '#fff');
    }
  }

  startTransition(game: GameEngine, text: string) {
    this.state = 'TRANSITION';
    this.transitionTimer = 4.0;
    this.dialogueText = text;
    game.projectiles = [];
    game.lasers = [];
    game.safeZones = [];
    game.audio.playBossNuke();
    game.addShake(20);
  }

  startDeathSequence(game: GameEngine) {
    this.state = 'DEATH';
    this.transitionTimer = 4.0;
    game.projectiles = [];
    game.lasers = [];
    game.safeZones = [];
    game.audio.stopBGM();
    game.audio.playBossNuke();
    game.addShake(50);
  }

  drawPolygon(ctx: CanvasRenderingContext2D, sides: number, radius: number) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;
}
