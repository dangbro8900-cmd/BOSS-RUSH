import { InputManager } from './input';
import { Player, Projectile, Particle, TextPopup, Laser, SafeZone } from './entities';
import { BaseBoss } from './boss/BaseBoss';
import { OverseerBoss } from './boss/overseer/OverseerBoss';
import { SoundEngine } from './audio/SoundEngine';
import { Vector2 } from './math';

import { BossConfig, BOSS_DATA } from './boss/BossData';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 1200;
  height = 800;

  input: InputManager;
  audio: SoundEngine;

  player!: Player;
  boss!: BaseBoss;
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  popups: TextPopup[] = [];
  lasers: Laser[] = [];
  safeZones: SafeZone[] = [];

  lastTime = 0;
  running = false;
  state: 'MENU' | 'PLAYING' | 'GAMEOVER' | 'VICTORY' = 'MENU';
  stateTimer: number = 0;

  screenShake = 0;
  screenShakeEnabled = true; // QoL: Screen shake toggle
  hardMode = false;
  flashTime = 0;
  timeScale = 1.0;
  scanlinePattern: CanvasPattern | null = null;
  volume: number = 0.6;
  paused = false;
  
  selectedBossId: string = 'overseer';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.input = new InputManager(canvas);
    this.audio = new SoundEngine();

    this.input.onFirstInteraction = () => {
      this.audio.init();
    };

    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = 1;
    scanCanvas.height = 4;
    const sctx = scanCanvas.getContext('2d')!;
    sctx.fillStyle = 'rgba(0,0,0,0.15)';
    sctx.fillRect(0, 0, 1, 2);
    this.scanlinePattern = this.ctx.createPattern(scanCanvas, 'repeat');
  }

  setVolume(vol: number) {
    this.volume = vol;
    this.audio.setVolume(vol);
  }

  setResolution(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    
    // Recreate scanline pattern for new resolution if needed
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = 1;
    scanCanvas.height = 4;
    const sctx = scanCanvas.getContext('2d')!;
    sctx.fillStyle = 'rgba(0,0,0,0.15)';
    sctx.fillRect(0, 0, 1, 2);
    this.scanlinePattern = this.ctx.createPattern(scanCanvas, 'repeat');
  }

  addShake(amount: number) {
    if (!this.screenShakeEnabled) return;
    this.screenShake = Math.min(this.screenShake + amount, 50);
  }

  start() {
    this.audio.init();
    this.audio.setVolume(this.volume);
    this.state = 'PLAYING';
    this.reset();
    this.audio.startBGMPhase(1);
    this.input.keys['Space'] = false;
    this.lastTime = performance.now();
  }

  reset() {
    this.player = new Player(new Vector2(this.width / 2, this.height - 100));
    const config = BOSS_DATA[this.selectedBossId];
    const pos = new Vector2(this.width / 2, 150);
    this.boss = new OverseerBoss(pos, config);
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.lasers = [];
    this.safeZones = [];
    this.screenShake = 0;
    this.flashTime = 0;
    this.timeScale = 1.0;
  }

  stop() {
    this.running = false;
    this.input.destroy();
    this.audio.stopBGM();
  }

  loop = (time: number) => {
    if (!this.running) return;
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (!this.paused) {
      this.update(Math.min(dt, 0.1));
    }
    this.draw();

    requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    if (this.screenShake > 0) {
      this.screenShake -= dt * 60;
      if (this.screenShake < 0) this.screenShake = 0;
    }
    if (this.flashTime > 0) {
      this.flashTime -= dt;
    }

    // Always update particles and popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].update(dt);
      if (this.popups[i].life <= 0) this.popups.splice(i, 1);
    }

    if (this.state === 'MENU') {
      if (this.input.isKeyDown('KeyH')) {
        this.hardMode = !this.hardMode;
        this.input.keys['KeyH'] = false;
      }
      if (this.input.isKeyDown('Space')) {
        this.selectedBossId = 'overseer';
        this.start();
        this.input.keys['Space'] = false;
      }
      return;
    } else if (this.state !== 'PLAYING') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0 && this.input.isKeyDown('Space')) {
        this.state = 'MENU';
        this.input.keys['Space'] = false;
      }
      return;
    }

    const activeDt = dt * this.timeScale;

    this.player.update(dt, this); // Player uses unscaled dt
    this.boss.update(activeDt, this);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(activeDt);
      
      if (p.isEnemy) {
        if (p.collidesWith(this.player)) {
          this.player.takeDamage(p.damage, this);
          p.dead = true;
        } else if (!p.grazed && Math.hypot(p.pos.x - this.player.pos.x, p.pos.y - this.player.pos.y) < this.player.grazeRadius + p.radius) {
          p.grazed = true;
          this.player.ultimateCharge = Math.min(this.player.ultimateMax, this.player.ultimateCharge + 2);
          this.spawnPopup(this.player.pos.add(new Vector2(0, -20)), 'GRAZE', '#0ff');
        }
      } else {
        if (p.collidesWith(this.boss)) {
          this.boss.takeDamage(p.damage, this);
          p.dead = true;
        }
      }

      if (p.dead || p.isOutOfBounds(this.width, this.height)) {
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].update(activeDt, this);
      if (this.lasers[i].lifeTime <= 0) this.lasers.splice(i, 1);
    }

    for (let i = this.safeZones.length - 1; i >= 0; i--) {
      this.safeZones[i].update(activeDt);
      if (this.safeZones[i].lifeTime <= 0) this.safeZones.splice(i, 1);
    }

    if (this.player.hp <= 0) {
      this.state = 'GAMEOVER';
      this.stateTimer = 1.0;
      this.audio.stopBGM();
    } else if (this.boss.dead) {
      this.state = 'VICTORY';
      this.stateTimer = 1.5;
      this.audio.stopBGM();
    }
  }

  draw() {
    this.ctx.fillStyle = '#050510';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();
    if (this.screenShake > 0) {
      const dx = (Math.random() - 0.5) * this.screenShake;
      const dy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(dx, dy);
    }

    // Draw scrolling grid
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    this.ctx.lineWidth = 1;
    const time = performance.now() / 1000;
    const gridSize = 40;
    const offsetY = (time * 50) % gridSize;
    
    for (let x = 0; x < this.width; x += gridSize) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
    }
    for (let y = offsetY; y < this.height; y += gridSize) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); this.ctx.stroke();
    }

    if (this.state === 'MENU') {
      this.drawText('BOSS RUSH', this.width/2, this.height/2 - 40, 'bold 80px "Space Grotesk", sans-serif', '#fff', 'center');
      this.drawText('Press SPACE to Start', this.width/2, this.height/2 + 30, '24px "Space Grotesk", sans-serif', '#aaa', 'center');
      this.drawText(`HARD MODE: ${this.hardMode ? 'ON' : 'OFF'} (Press H to toggle)`, this.width/2, this.height/2 + 70, '20px "Space Grotesk", sans-serif', this.hardMode ? '#f00' : '#aaa', 'center');
      this.drawText('WASD to Move | SPACE to Dash | Left Click to Melee | Right Click to Shoot', this.width/2, this.height/2 + 110, '16px "Space Grotesk", sans-serif', '#888', 'center');
    } else {
      this.safeZones.forEach(sz => sz.draw(this.ctx));
      this.particles.forEach(p => p.draw(this.ctx));
      this.lasers.forEach(l => l.draw(this.ctx, this.width, this.height));
      this.projectiles.forEach(p => p.draw(this.ctx));
      
      if (this.state !== 'VICTORY') this.boss.draw(this.ctx);
      if (this.state !== 'GAMEOVER') this.player.draw(this.ctx);

      this.popups.forEach(p => p.draw(this.ctx));

      // Draw Boss Dialogue
      if (this.boss.state === 'TRANSITION') {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, this.height / 2 - 40, this.width, 80);
        this.drawText(this.boss.dialogueText, this.width / 2, this.height / 2 + 10, 'bold 30px "Space Grotesk", sans-serif', '#f0f', 'center');
      }

      // Draw Boss Death Explosion
      if (this.boss.state === 'DEATH') {
        const progress = 1 - (this.boss.transitionTimer / 4.0);
        if (progress > 0) {
          this.ctx.save();
          this.ctx.globalCompositeOperation = 'screen';
          
          this.ctx.beginPath();
          this.ctx.arc(this.boss.pos.x, this.boss.pos.y, progress * this.width * 1.5, 0, Math.PI * 2);
          this.ctx.fillStyle = `rgba(255, 100, 0, ${1 - progress})`;
          this.ctx.fill();

          this.ctx.beginPath();
          this.ctx.arc(this.boss.pos.x, this.boss.pos.y, progress * this.width, 0, Math.PI * 2);
          this.ctx.fillStyle = `rgba(255, 255, 255, ${1 - progress})`;
          this.ctx.fill();

          const coreRadius = Math.sin(progress * Math.PI) * 200;
          if (coreRadius > 0) {
            this.ctx.beginPath();
            this.ctx.arc(this.boss.pos.x, this.boss.pos.y, coreRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#fff';
            this.ctx.shadowBlur = 50;
            this.ctx.shadowColor = '#f0f';
            this.ctx.fill();
          }

          this.ctx.restore();
        }
      }
    }

    this.ctx.restore();

    if (this.flashTime > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashTime * 2})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.state !== 'MENU') {
      this.drawUI();
    }

    // QoL: Pause Overlay
    if (this.paused) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.drawText('PAUSED', this.width/2, this.height/2, 'bold 60px "Space Grotesk", sans-serif', '#fff', 'center');
    }

    // Draw custom crosshair
    if (!this.paused) {
      const mx = this.input.mouse.x;
      const my = this.input.mouse.y;
      
      // QoL: Crosshair Target Lock
      let isTargetingBoss = false;
      if (this.state === 'PLAYING' && this.boss && !this.boss.dead) {
        const dist = Math.hypot(this.boss.pos.x - mx, this.boss.pos.y - my);
        if (dist <= this.boss.radius) isTargetingBoss = true;
      }
      
      this.ctx.strokeStyle = isTargetingBoss ? '#f00' : '#0ff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(mx - 10, my);
      this.ctx.lineTo(mx - 2, my);
      this.ctx.moveTo(mx + 2, my);
      this.ctx.lineTo(mx + 10, my);
      this.ctx.moveTo(mx, my - 10);
      this.ctx.lineTo(mx, my - 2);
      this.ctx.moveTo(mx, my + 2);
      this.ctx.lineTo(mx, my + 10);
      this.ctx.stroke();
      
      this.ctx.fillStyle = isTargetingBoss ? '#f00' : '#f0f';
      this.ctx.beginPath();
      this.ctx.arc(mx, my, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // CRT Scanlines overlay
    if (this.scanlinePattern) {
      this.ctx.fillStyle = this.scanlinePattern;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    // Vignette
    const gradient = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.height * 0.4,
      this.width / 2, this.height / 2, this.height * 0.8
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    
    // QoL: Low HP Warning
    if (this.state === 'PLAYING' && this.player && this.player.hp <= this.player.maxHp * 0.3) {
      const pulse = Math.sin(performance.now() / 150) * 0.3 + 0.3;
      gradient.addColorStop(1, `rgba(255,0,0,${pulse + 0.4})`);
    } else {
      gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
    }
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (this.state === 'GAMEOVER') {
      this.ctx.fillStyle = 'rgba(20, 0, 0, 0.8)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.drawText('YOU DIED', this.width/2, this.height/2 - 20, 'bold 80px "Space Grotesk", sans-serif', '#f55', 'center');
      if (this.stateTimer <= 0) {
        this.drawText('Press SPACE to Restart', this.width/2, this.height/2 + 50, '24px "Space Grotesk", sans-serif', '#fff', 'center');
      }
    } else if (this.state === 'VICTORY') {
      this.ctx.fillStyle = 'rgba(0, 20, 0, 0.8)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.drawText('VICTORY', this.width/2, this.height/2 - 20, 'bold 80px "Space Grotesk", sans-serif', '#5f5', 'center');
      if (this.stateTimer <= 0) {
        this.drawText('Press SPACE to Play Again', this.width/2, this.height/2 + 50, '24px "Space Grotesk", sans-serif', '#fff', 'center');
      }
    }
  }

  drawUI() {
    // Player HP
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(20, 20, 200, 24);
    this.ctx.fillStyle = '#5f5';
    this.ctx.fillRect(20, 20, 200 * (this.player.displayHp / this.player.maxHp), 24);
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(20, 20, 200, 24);
    this.drawText(`HP: ${Math.ceil(this.player.hp)}`, 28, 38, 'bold 14px "Space Grotesk", sans-serif', '#000', 'left');

    // Player Dash Cooldown
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(20, 54, 150, 8);
    const dashRatio = Math.max(0, 1 - this.player.dashCooldown / this.player.dashCooldownMax);
    this.ctx.fillStyle = dashRatio >= 1 ? '#0ff' : '#55f';
    this.ctx.fillRect(20, 54, 150 * dashRatio, 8);
    this.drawText('SPACE', 24, 63, 'bold 10px "Space Grotesk", sans-serif', '#fff', 'left');

    // Abilities UI
    const startX = this.width - 200;
    
    // Z Ability
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(startX, 20, 160, 16);
    this.ctx.fillStyle = '#ff5';
    const zRatio = Math.max(0, 1 - this.player.zCooldown / this.player.zCooldownMax);
    this.ctx.fillRect(startX, 20, 160 * zRatio, 16);
    this.drawText('Z - SHOTGUN', startX + 4, 32, 'bold 12px "Space Grotesk", sans-serif', zRatio === 1 ? '#000' : '#fff', 'left');

    // X Ability
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(startX, 44, 160, 16);
    this.ctx.fillStyle = '#55f';
    const xRatio = Math.max(0, 1 - this.player.xCooldown / this.player.xCooldownMax);
    this.ctx.fillRect(startX, 44, 160 * xRatio, 16);
    this.drawText('X - TIME SLOW', startX + 4, 56, 'bold 12px "Space Grotesk", sans-serif', xRatio === 1 ? '#fff' : '#aaa', 'left');

    // C Ability (Ultimate)
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(startX, 68, 160, 24);
    const isUltReady = this.player.ultimateCharge >= this.player.ultimateMax;
    
    if (isUltReady) {
      const pulse = Math.sin(performance.now() / 100) * 0.5 + 0.5;
      this.ctx.fillStyle = `rgba(255, 0, 255, ${0.5 + pulse * 0.5})`;
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#f0f';
    } else {
      this.ctx.fillStyle = '#808';
    }
    
    const cRatio = this.player.ultimateCharge / this.player.ultimateMax;
    this.ctx.fillRect(startX, 68, 160 * cRatio, 24);
    
    this.ctx.strokeStyle = isUltReady ? '#fff' : '#aaa';
    this.ctx.strokeRect(startX, 68, 160, 24);
    this.ctx.shadowBlur = 0;
    this.drawText(isUltReady ? 'C - ULTIMATE READY!' : 'C - ULTIMATE', startX + 80, 85, 'bold 14px "Space Grotesk", sans-serif', isUltReady ? '#fff' : '#ccc', 'center');

    // Boss HP
    if (this.state !== 'VICTORY' && this.state !== 'MENU') {
      const bossHpWidth = 600;
      const bx = this.width / 2 - bossHpWidth / 2;
      this.ctx.fillStyle = '#222';
      this.ctx.fillRect(bx, 20, bossHpWidth, 24);
      this.ctx.fillStyle = this.boss.config.color;
      this.ctx.fillRect(bx, 20, bossHpWidth * (this.boss.displayHp / this.boss.maxHp), 24);
      
      // QoL: Segmented Boss Health Bar
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(bx + bossHpWidth * 0.5, 20);
      this.ctx.lineTo(bx + bossHpWidth * 0.5, 44);
      this.ctx.moveTo(bx + bossHpWidth * 0.7, 20);
      this.ctx.lineTo(bx + bossHpWidth * 0.7, 44);
      if (this.hardMode) {
        this.ctx.moveTo(bx + bossHpWidth * 0.25, 20);
        this.ctx.lineTo(bx + bossHpWidth * 0.25, 44);
      }
      this.ctx.stroke();

      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(bx, 20, bossHpWidth, 24);
      this.drawText(`${this.boss.config.name} - PHASE ${Math.floor(this.boss.phase)}${this.hardMode ? ' (HARD)' : ''}`, this.width / 2, 38, 'bold 14px "Space Grotesk", sans-serif', '#fff', 'center');
    }
  }

  drawText(text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign) {
    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, x, y);
  }

  spawnParticles(pos: Vector2, color: string, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = new Vector2(Math.cos(angle), Math.sin(angle)).mult(Math.random() * speed);
      this.particles.push(new Particle(pos, vel, color, 0.2 + Math.random() * 0.3));
    }
  }

  spawnPopup(pos: Vector2, text: string, color: string) {
    this.popups.push(new TextPopup(pos.copy(), text, color));
  }
}
