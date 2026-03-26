import { Vector2 } from '../../math';
import { BossConfig } from '../BossData';
import { BaseBoss } from '../BaseBoss';

export class OverseerBoss extends BaseBoss {
  constructor(pos: Vector2, config: BossConfig) {
    super(pos, config);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;

    const time = performance.now() / 1000;
    const spinSpeed = (this.state === 'TRANSITION' || this.state === 'DEATH') ? 5 : 1;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    if (this.phase === 1 || this.phase === 1.5) {
      // Phase 1: The Fortress
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.config.color;
      
      // Outer rotating armor
      ctx.save();
      ctx.rotate(time * 0.5 * spinSpeed);
      ctx.fillStyle = this.flashTime > 0 ? '#fff' : '#111';
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 4;
      this.drawPolygon(ctx, 6, this.radius);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Inner glowing eye
      ctx.fillStyle = this.flashTime > 0 ? '#fff' : this.config.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.4 + Math.sin(time * 5 * spinSpeed) * 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Orbiting shields
      ctx.strokeStyle = this.config.color;
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 - (time * spinSpeed);
        const x = Math.cos(angle) * (this.radius + 20);
        const y = Math.sin(angle) * (this.radius + 20);
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }

    } else if (this.phase === 2 || this.phase === 2.5) {
      // Phase 2: The Awakened
      ctx.shadowBlur = 40;
      ctx.shadowColor = this.config.color;

      // Floating outer segments
      ctx.save();
      ctx.rotate(-time * spinSpeed);
      ctx.fillStyle = this.flashTime > 0 ? '#fff' : '#111';
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i / 4) * Math.PI * 2);
        ctx.translate(this.radius * 0.8 + Math.sin(time * 3 * spinSpeed) * 15, 0);
        this.drawPolygon(ctx, 3, 20);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Central diamond core
      ctx.save();
      ctx.rotate(time * 2 * spinSpeed);
      ctx.fillStyle = this.flashTime > 0 ? '#fff' : '#111';
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 3;
      this.drawPolygon(ctx, 4, this.radius * 0.8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      
      // Core pulse
      ctx.fillStyle = this.flashTime > 0 ? '#fff' : this.config.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.3 + Math.sin(time * 8 * spinSpeed) * 5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.phase === 3 || this.phase === 3.5) {
      // Phase 3: The Singularity
      ctx.shadowBlur = 50 + Math.random() * 20;
      ctx.shadowColor = this.config.color;

      // Outer chaotic ring
      ctx.save();
      ctx.rotate(time * 2 * spinSpeed);
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const r = this.radius * (1 + Math.random() * 0.3);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Inner counter-rotating star
      ctx.save();
      ctx.rotate(-time * 3 * spinSpeed);
      ctx.fillStyle = this.flashTime > 0 ? this.config.color : '#fff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? this.radius : this.radius * 0.4;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Glitch effect
      if (Math.random() > 0.8) {
        ctx.fillStyle = Math.random() > 0.5 ? '#0ff' : '#f0f';
        ctx.fillRect(-this.radius + Math.random() * this.radius, -this.radius + Math.random() * this.radius, Math.random() * 40, Math.random() * 10);
      }
    } else {
      // Phase 4: True Power (Hard Mode)
      ctx.shadowBlur = 80 + Math.random() * 40;
      ctx.shadowColor = '#f0f'; // Purple/Magenta aura

      // Intense chaotic outer ring
      ctx.save();
      ctx.rotate(time * 5 * spinSpeed);
      ctx.strokeStyle = '#f0f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const r = this.radius * (1 + Math.random() * 0.5);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Pulsing black hole core
      ctx.fillStyle = this.flashTime > 0 ? '#fff' : '#000';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.5 + Math.sin(time * 15 * spinSpeed) * 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Core outline
      ctx.strokeStyle = '#f0f';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Severe Glitch effect
      if (Math.random() > 0.5) {
        ctx.fillStyle = Math.random() > 0.5 ? '#0ff' : '#f00';
        ctx.fillRect(-this.radius + Math.random() * this.radius * 2, -this.radius + Math.random() * this.radius * 2, Math.random() * 60, Math.random() * 15);
      }
    }

    ctx.restore();

    // Draw telegraph line if prepping dash
    if (this.state === 'PREP_DASH') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
      ctx.lineWidth = this.radius * 1.5;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(this.dashTarget.x, this.dashTarget.y);
      ctx.stroke();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // QoL: ULT_NUKE timer indicator
    if ((this.state === 'ULT_NUKE' || this.state === 'ULT_OBLITERATION') && this.stateTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#f00';
      ctx.font = 'bold 40px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`ANNIHILATION IN: ${this.stateTimer.toFixed(1)}s`, this.pos.x, this.pos.y - this.radius - 40);
      ctx.restore();
    }
  }
}
