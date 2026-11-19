/**
 * LIFEGENIE - Animated Quantum AI Core Visualizer
 * High-performance HTML5 Canvas animation featuring rotating orbital rings,
 * energy quantum particles, and a glowing singularity core.
 */

class AICoreVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.rings = [];
    this.corePulse = 0;
    this.state = 'idle'; // 'idle', 'thinking', 'speaking'
    this.animationId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Create dynamic rings relative to radius
    this.rebuildGeometry();
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : { width: 130, height: 130 };
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width > 0 ? rect.width : 130;
    const h = rect.height > 0 ? rect.height : 130;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.width = w;
    this.height = h;
    this.centerX = w / 2;
    this.centerY = h / 2;
    this.baseRadius = Math.min(w, h) / 2;

    this.rebuildGeometry();
  }

  rebuildGeometry() {
    const r = this.baseRadius || 60;

    // Create orbital rings scaled to container
    this.rings = [
      { radius: r * 0.58, tilt: 0.65, speed: 0.015, angle: 0, color: 'rgba(0, 240, 255, 0.45)', width: 1.5 },
      { radius: r * 0.74, tilt: -0.55, speed: -0.012, angle: Math.PI / 3, color: 'rgba(139, 92, 246, 0.45)', width: 1.5 },
      { radius: r * 0.88, tilt: 0.35, speed: 0.008, angle: Math.PI / 1.5, color: 'rgba(236, 72, 153, 0.35)', width: 1 }
    ];

    // Create quantum particle field
    this.particles = [];
    const particleCount = 38;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        angle: Math.random() * Math.PI * 2,
        dist: r * 0.28 + Math.random() * (r * 0.58),
        speed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.7 + 0.3,
        hue: Math.random() > 0.5 ? 185 : 270 // cyan or purple
      });
    }
  }

  setState(newState) {
    this.state = newState;
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    const speedMultiplier = this.state === 'thinking' ? 2.5 : (this.state === 'speaking' ? 1.8 : 1);
    this.corePulse += 0.04 * speedMultiplier;
    const r = this.baseRadius || 60;

    // Draw background nebula aura
    const glowRadius = r * 0.55 + Math.sin(this.corePulse) * (this.state === 'thinking' ? 10 : 5);
    const grad = this.ctx.createRadialGradient(
      this.centerX, this.centerY, 4,
      this.centerX, this.centerY, glowRadius
    );
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.38)');
    grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, glowRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw orbital rings
    this.rings.forEach(ring => {
      ring.angle += ring.speed * speedMultiplier;
      this.ctx.save();
      this.ctx.translate(this.centerX, this.centerY);
      this.ctx.rotate(ring.angle * 0.3);
      this.ctx.scale(1, ring.tilt);

      this.ctx.beginPath();
      this.ctx.arc(0, 0, ring.radius + Math.sin(this.corePulse * 0.5) * 2.5, 0, Math.PI * 2);
      this.ctx.strokeStyle = ring.color;
      this.ctx.lineWidth = ring.width;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = ring.color;
      this.ctx.stroke();

      // Orbital satellite node
      const satX = Math.cos(ring.angle) * ring.radius;
      const satY = Math.sin(ring.angle) * ring.radius;
      this.ctx.beginPath();
      this.ctx.arc(satX, satY, 2.2, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.fill();

      this.ctx.restore();
    });

    // Draw orbiting quantum particles
    this.particles.forEach(p => {
      p.angle += p.speed * speedMultiplier;
      const x = this.centerX + Math.cos(p.angle) * p.dist;
      const y = this.centerY + Math.sin(p.angle) * (p.dist * 0.7);

      this.ctx.beginPath();
      this.ctx.arc(x, y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.hue === 185 
        ? `rgba(0, 240, 255, ${p.alpha})` 
        : `rgba(192, 132, 252, ${p.alpha})`;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = p.hue === 185 ? '#00f0ff' : '#c084fc';
      this.ctx.fill();
    });

    // Draw Singularity Center
    const centerRadius = r * 0.24 + Math.sin(this.corePulse * 1.5) * 2;
    const coreGrad = this.ctx.createRadialGradient(
      this.centerX, this.centerY, 0,
      this.centerX, this.centerY, centerRadius
    );
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.35, '#00f0ff');
    coreGrad.addColorStop(0.75, '#7c3aed');
    coreGrad.addColorStop(1, 'rgba(7, 9, 20, 0.85)');

    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, centerRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = coreGrad;
    this.ctx.shadowBlur = 22;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.fill();

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

window.AICoreVisualizer = AICoreVisualizer;
