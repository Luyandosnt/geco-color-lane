import Phaser from 'phaser';

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
  corrupted: Phaser.GameObjects.Image;
  restored: Phaser.GameObjects.Image;
};

export class TerrainRestorationManager {
  private scene: Phaser.Scene;
  private chunks: TerrainChunk[] = [];
  private chunkHeight = 404;
  private chunkWidth = 390;
  private revealBandHeight = 155;
  private planeY = AIRCRAFT_Y;
  private coverageTotal = 0;
  private debug!: Phaser.GameObjects.Text;

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
    for (let i = 0; i < 4; i++) this.chunks.push(this.createChunk((i - 1) * (this.chunkHeight - 18)));
    this.debug = this.scene.add.text(12, 84, '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#d1d5db',
      backgroundColor: 'rgba(2,6,23,.42)',
      padding: { x: 6, y: 4 }
    }).setDepth(91).setVisible(false);
  }

  update(scrollSpeed: number, activeLaneX: number, playing: boolean, paused: boolean, delta: number) {
    if (!playing || paused) {
      this.debug.setVisible(false);
      return;
    }

    const dy = scrollSpeed * delta / 1000;
    const revealY = this.planeY + 35;

    this.debug.setVisible(true);
    this.chunks.forEach(chunk => {
      chunk.y += dy;
      if (chunk.y >= 844) this.recycleChunk(chunk);
      chunk.corrupted.y = chunk.y;
      chunk.restored.y = chunk.y;
      this.reveal(chunk, revealY);
    });

    const averageCoverage = this.chunks.reduce((sum, chunk) => sum + chunk.restoredCoverage, 0) / this.chunks.length;
    this.coverageTotal += (averageCoverage - this.coverageTotal) * .08;
    this.debug.setText(
      'scroll ' + Math.round(scrollSpeed) + '\n' +
      'chunks ' + this.chunks.length + '\n' +
      'restore ' + Math.round(this.coverageTotal) + '%'
    );
  }

  private createChunk(y: number): TerrainChunk {
    const restored = this.scene.add.image(195, y, TerrainAssets.restored).setOrigin(.5, 0).setDisplaySize(this.chunkWidth, this.chunkHeight).setDepth(-30);
    const corrupted = this.scene.add.image(195, y, TerrainAssets.corrupted).setOrigin(.5, 0).setDisplaySize(this.chunkWidth, this.chunkHeight).setDepth(-29);
    return { y, restoredCoverage: 0, corrupted, restored };
  }

  private reveal(chunk: TerrainChunk, revealY: number) {
    const localRevealTop = Phaser.Math.Clamp(revealY - chunk.y, 0, this.chunkHeight);
    const currentCoverage = (this.chunkHeight - localRevealTop) / this.chunkHeight * 100;
    chunk.restoredCoverage = Math.max(chunk.restoredCoverage, currentCoverage);
    const visibleCorrupted = this.chunkHeight * (1 - chunk.restoredCoverage / 100);
    const source = chunk.corrupted.texture.getSourceImage() as HTMLImageElement;
    const cropHeight = Math.max(0, source.height * visibleCorrupted / this.chunkHeight);
    chunk.corrupted.setCrop(0, 0, source.width, cropHeight);
  }

  private recycleChunk(chunk: TerrainChunk) {
    const topY = Math.min(...this.chunks.map(c => c.y));
    chunk.y = topY - (this.chunkHeight - 18);
    chunk.restoredCoverage = 0;
    chunk.corrupted.setCrop();
  }
}
