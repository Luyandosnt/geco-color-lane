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
  corruptedTexture: Phaser.Textures.CanvasTexture;
  restoredTexture: Phaser.Textures.CanvasTexture;
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
  private chunkOverlap = 24;
  private chunkStep = this.chunkHeight - this.chunkOverlap;
  private sourceInset = 12;
  private planeY = AIRCRAFT_Y;
  private frontierOffset = 46;
  private time = 0;
  private coverageTotal = 0;
  private restorationPower = 1;
  private surgeBoost = 0;
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

  setRestorationPower(multiplier: number, surgeBoost = 0) {
    this.restorationPower = Phaser.Math.Clamp(multiplier, 1, 3);
    this.surgeBoost = Phaser.Math.Clamp(surgeBoost, 0, 1);
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
      this.positionChunk(chunk);
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
        'restore ' + Math.round(this.coverageTotal) + '%\n' +
        'height ' + this.chunkHeight + ' overlap ' + this.chunkOverlap + '\n' +
        this.chunks.map(c => Math.round(c.y)).join(', ')
      );
    }
  }

  private createChunk(index: number, y: number): TerrainChunk {
    const restoredKey = 'terrain-restored-canvas-' + index;
    const corruptedKey = 'terrain-corrupted-canvas-' + index;
    const restoredTexture = this.createOrResetCanvas(restoredKey);
    const corruptedTexture = this.createOrResetCanvas(corruptedKey);
    this.paintTile(restoredTexture, TerrainAssets.restored);
    this.paintTile(corruptedTexture, TerrainAssets.corrupted);
    const restored = this.scene.add.image(195, y, restoredKey).setOrigin(.5, 0).setDepth(-30);
    const corrupted = this.scene.add.image(195, y, corruptedKey).setOrigin(.5, 0).setDepth(-29);
    const chunk = { y, restoredCoverage: 0, stamps: 0, corruptedTexture, restoredTexture, corrupted, restored };
    this.positionChunk(chunk);
    return chunk;
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
    const boost = this.restorationPower;
    const surge = this.surgeBoost;

    const ctx = chunk.corruptedTexture.getContext();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    this.eraseSoftEllipse(ctx, x, localY, 92 * boost, 48 * boost, .9);
    this.eraseSoftEllipse(ctx, x - 44 + Math.sin(this.time / 230) * 10, localY + 14, 68 * boost, 34 * boost, .62);
    this.eraseSoftEllipse(ctx, x + 43 + Math.cos(this.time / 260) * 10, localY + 18, 64 * boost, 32 * boost, .58);
    this.eraseSoftEllipse(ctx, x + Math.sin(this.time / 190) * 24, localY + 42, 114 * boost, 42 * boost, .44);
    if (surge > 0) this.eraseSoftEllipse(ctx, x, localY + 12, 165 + surge * 90, 118 + surge * 58, .68);
    ctx.restore();
    chunk.corruptedTexture.refresh();

    chunk.stamps++;
    chunk.restoredCoverage = Math.min(100, chunk.stamps * 2.1 * boost);
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
      this.waveGlow.lineStyle(pass === 0 ? 5 : 2, color, pass === 0 ? .1 * this.restorationPower : .18 * this.restorationPower);
      this.waveGlow.beginPath();
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const width = 212 * (1 + (this.restorationPower - 1) * .45);
        const px = x - width / 2 + t * width;
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
    this.paintTile(chunk.restoredTexture, TerrainAssets.restored);
    this.paintTile(chunk.corruptedTexture, TerrainAssets.corrupted);
    this.positionChunk(chunk);
  }

  private positionChunk(chunk: TerrainChunk) {
    const y = Math.round(chunk.y);
    chunk.restored.setPosition(195, y);
    chunk.corrupted.setPosition(195, y);
  }

  private createOrResetCanvas(key: string) {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    return this.scene.textures.createCanvas(key, this.chunkWidth, this.chunkHeight) as Phaser.Textures.CanvasTexture;
  }

  private paintTile(texture: Phaser.Textures.CanvasTexture, assetKey: string) {
    const ctx = texture.getContext();
    const source = this.scene.textures.get(assetKey).getSourceImage() as HTMLImageElement;
    const inset = this.sourceInset;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.chunkWidth, this.chunkHeight);
    ctx.drawImage(source, inset, inset, source.width - inset * 2, source.height - inset * 2, 0, 0, this.chunkWidth, this.chunkHeight);
    texture.refresh();
  }
}
