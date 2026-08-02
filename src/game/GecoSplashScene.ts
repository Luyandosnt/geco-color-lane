import Phaser from 'phaser';

const GECO_LOGO_KEY = 'geco-splash-logo';
const GECO_LOGO_PATH = '/assets/branding/geco-logo.png';

export class GecoSplashScene extends Phaser.Scene {
  constructor() {
    super('GecoSplash');
  }

  preload() {
    this.load.image(GECO_LOGO_KEY, GECO_LOGO_PATH);
  }

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const logo = this.add.image(centerX, centerY, GECO_LOGO_KEY).setAlpha(0);
    const maxWidth = this.scale.width * 0.74;
    const maxHeight = this.scale.height * 0.34;
    const source = this.textures.get(GECO_LOGO_KEY).getSourceImage() as HTMLImageElement;
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
    logo.setDisplaySize(source.width * scale, source.height * scale);

    this.tweens.add({
      targets: logo,
      alpha: 1,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(3000, () => {
          this.tweens.add({
            targets: logo,
            alpha: 0,
            duration: 700,
            ease: 'Sine.easeIn',
            onComplete: () => this.scene.start('ColorLane')
          });
        });
      }
    });
  }
}
