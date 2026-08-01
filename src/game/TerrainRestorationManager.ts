import Phaser from 'phaser';

export const DEBUG_WORLD = false;

export const TerrainAssets = {
  corrupted: 'terrain-corrupted',
  restored: 'terrain-restored',
  plane: 'plane',
  fuel: 'fuel-cell'
};

export const TerrainAssetPaths = {
  corrupted: '/assets/environment/savannah-corrupted.jpg',
  restored: '/assets/environment/savannah-restored.jpg',
  plane: '/assets/environment/plane.png',
  fuel: '/assets/environment/fuel-cell.png'
};

export const AIRCRAFT_Y = 612;
export const PICKUP_Y = AIRCRAFT_Y;
export const PICKUP_EFFECT_Y = AIRCRAFT_Y - 38;

type TerrainChunk = {
  y: number;
  restoredCoverage: number;
  stamps: number;
  texture: Phaser.Textures.CanvasTexture;
  corrupted: Phaser.GameObjects.Image;
  restored: Phaser.GameObjects.Image;
};

type RestorationParticle = Phaser.GameObjects.Arc & {
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
};

export class TerrainRestorationManager {
  private scene: Phaser.Scene;
  private chunks: TerrainChunk[] = [];
  private particles: RestorationParticle[] = [];
  private particleCursor = 0;
  private chunkHeight = 390;
  private chunkWidth = 390;
  private chunkStep = 388;
  private planeY = AIRCRAFT_Y;
  private frontierOffset = 46;
  private time = 0;
  private coverageTotal = 0;
  private debug!: Phaser.GameObjects.Text;
  private waveGlow!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene) {
    scene.load.image(TerrainAssets.corrupted, TerrainAssetPaths.corrupted);
    scene.load.image(TerrainAssets.restored, TerrainAssetPaths.restored);
    scene.load.image(TerrainAssets.plane, TerrainAssetPaths.plane);
    scene.load.image(TerrainAssets.fuel, TerrainAssetPaths.fuel);
  }

  create() {
    for (let i = 0; i < 4; i++) this.chunks.push(this.createChunk(i, (i - 1) * this.chunkStep));
    for (let i = 0; i < 18; i++) this.particles.push(this.createParticle());
    this.waveGlow = this.scene.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.debug = this.scene.add.text(12, 84, '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#d1d5db',
      backgroundColor: 'rgba(2,6,23,.42)',
      padding: { x: 6, y: 4 }
    }).setDepth(91).setVisible(false);
  }

  update(scrollSpeed: number, activeLaneX: number, playing: boolean, paused: boolean, delta: number) {
    this.time += delta;
    this.updateParticles(delta);

    if (!playing || paused) {
      this.debug.setVisible(false);
      this.waveGlow.clear();
      return;
    }

    const dy = scrollSpeed * delta / 1000;
    const revealY = this.planeY + this.frontierOffset;

    this.chunks.forEach(chunk => {
      chunk.y += dy;
      if (chunk.y >= 844) this.recycleChunk(chunk);
      chunk.corrupted.y = chunk.y;
      chunk.restored.y = chunk.y;
      this.reveal(chunk, activeLaneX, revealY);
    });

    if (Math.floor(this.time / 90) !== Math.floor((this.time - delta) / 90)) this.emitParticle(activeLaneX, revealY);
    this.drawWaveGlow(activeLaneX, revealY);

    const averageCoverage = this.chunks.reduce((sum, chunk) => sum + chunk.restoredCoverage, 0) / this.chunks.length;
    this.coverageTotal += (averageCoverage - this.coverageTotal) * .08;
    this.debug.setVisible(DEBUG_WORLD);
    if (DEBUG_WORLD) {
      this.debug.setText(
        'scroll ' + Math.round(scrollSpeed) + '\n' +
        'chunks ' + this.chunks.length + '\n' +
        'restore ' + Math.round(this.coverageTotal) + '%'
      );
    }
  }

  private createChunk(index: number, y: number): TerrainChunk {
    const restored = this.scene.add.image(195, y, TerrainAssets.restored).setOrigin(.5, 0).setDisplaySize(this.chunkWidth, this.chunkHeight).setDepth(-30);
    const key = 'terrain-corrupted-canvas-' + index;
    const texture = this.scene.textures.createCanvas(key, this.chunkWidth, this.chunkHeight) as Phaser.Textures.CanvasTexture;
    this.paintCorrupted(texture);
    const corrupted = this.scene.add.image(195, y, key).setOrigin(.5, 0).setDepth(-29);
    return { y, restoredCoverage: 0, stamps: 0, texture, corrupted, restored };
  }

  private createParticle() {
    const p = this.scene.add.circle(0, 0, 2, 0x8bf0d1, 0).setDepth(8).setBlendMode(Phaser.BlendModes.ADD) as RestorationParticle;
    p.life = 0;
    p.maxLife = 1;
    p.vx = 0;
    p.vy = 0;
    return p;
  }

  private reveal(chunk: TerrainChunk, x: number, revealY: number) {
    const localY = revealY - chunk.y;
    if (localY < -70 || localY > this.chunkHeight + 80) return;

    const ctx = chunk.texture.getContext();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    this.eraseSoftEllipse(ctx, x, localY, 92, 48, .9);
    this.eraseSoftEllipse(ctx, x - 44 + Math.sin(this.time / 230) * 10, localY + 14, 68, 34, .62);
    this.eraseSoftEllipse(ctx, x + 43 + Math.cos(this.time / 260) * 10, localY + 18, 64, 32, .58);
    this.eraseSoftEllipse(ctx, x + Math.sin(this.time / 190) * 24, localY + 42, 114, 42, .44);
    ctx.restore();
    chunk.texture.refresh();

    chunk.stamps++;
    chunk.restoredCoverage = Math.min(100, chunk.stamps * 2.1);
  }

  private eraseSoftEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, Math.max(rx, ry));
    gradient.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
    gradient.addColorStop(.62, 'rgba(255,255,255,' + alpha * .72 + ')');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, Math.sin(this.time / 900) * .08, 0, Math.PI * 2);
    ctx.fill();
  }

  private emitParticle(x: number, y: number) {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    p.life = 360;
    p.maxLife = p.life;
    p.vx = Phaser.Math.FloatBetween(-18, 18);
    p.vy = Phaser.Math.FloatBetween(18, 45);
    p.setPosition(x + Phaser.Math.Between(-46, 46), y + Phaser.Math.Between(-6, 24));
    p.setRadius(Phaser.Math.Between(2, 4));
    p.setFillStyle([0x22c55e, 0x38bdf8, 0xfacc15][Phaser.Math.Between(0, 2)], .58);
  }

  private drawWaveGlow(x: number, y: number) {
    this.waveGlow.clear();
    const colors = [0x38bdf8, 0xfacc15, 0x22c55e];
    colors.forEach((color, pass) => {
      this.waveGlow.lineStyle(pass === 0 ? 5 : 2, color, pass === 0 ? .1 : .18);
      this.waveGlow.beginPath();
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const px = x - 106 + t * 212;
        const py = y + Math.sin(t * Math.PI * 2 + this.time / 260 + pass) * 8 + Math.sin(t * Math.PI + this.time / 420) * 11;
        i ? this.waveGlow.lineTo(px, py) : this.waveGlow.moveTo(px, py);
      }
      this.waveGlow.strokePath();
    });
  }

  private updateParticles(delta: number) {
    this.particles.forEach(p => {
      if (p.life <= 0) {
        p.setAlpha(0);
        return;
      }
      p.life -= delta;
      p.x += p.vx * delta / 1000;
      p.y += p.vy * delta / 1000;
      p.setAlpha(Math.max(0, p.life / p.maxLife) * .65);
      p.setScale(.75 + (1 - p.life / p.maxLife) * .85);
    });
  }

  private recycleChunk(chunk: TerrainChunk) {
    const topY = Math.min(...this.chunks.map(c => c.y));
    chunk.y = topY - this.chunkStep;
    chunk.restoredCoverage = 0;
    chunk.stamps = 0;
    this.paintCorrupted(chunk.texture);
  }

  private paintCorrupted(texture: Phaser.Textures.CanvasTexture) {
    const ctx = texture.getContext();
    const source = this.scene.textures.get(TerrainAssets.corrupted).getSourceImage() as CanvasImageSource;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.chunkWidth, this.chunkHeight);
    ctx.drawImage(source, 0, 0, this.chunkWidth, this.chunkHeight);
    texture.refresh();
  }
}
