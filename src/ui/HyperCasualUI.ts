import Phaser from 'phaser';
import { UI_ASSETS, UIButtonVariant } from './HyperCasualUIAssets';

type ButtonOptions = {
  variant?: UIButtonVariant;
  iconKey?: string;
  width?: number;
  label?: string;
  noLabel?: boolean;
  depth?: number;
  disabled?: boolean;
  onClick: () => void;
};

export type UIButton = Phaser.GameObjects.Container & {
  bg: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
};

export function hyperButton(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
  const variant = options.disabled ? 'disabled' : options.variant ?? 'primary';
  const bg = scene.add.image(0, 0, UI_ASSETS.buttons[variant].key);
  const source = scene.textures.get(UI_ASSETS.buttons[variant].key).getSourceImage() as HTMLImageElement;
  const width = options.width ?? (variant === 'gold' ? 180 : 160);
  bg.setDisplaySize(width, width * source.height / source.width);

  const children: Phaser.GameObjects.GameObject[] = [bg];
  let icon: Phaser.GameObjects.Image | undefined;
  if (options.iconKey) {
    icon = scene.add.image(options.noLabel ? 0 : -width * .32, 0, options.iconKey).setDisplaySize(22, 22);
    children.push(icon);
  }

  let label: Phaser.GameObjects.Text | undefined;
  if (!options.noLabel && options.label) {
    label = scene.add.text(icon ? 12 : 0, 0, options.label, {
      fontFamily: 'Arial',
      fontSize: width > 190 ? '15px' : '13px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#0f172a',
      strokeThickness: 3,
      wordWrap: { width: icon ? width * .55 : width * .72 }
    }).setOrigin(.5);
    children.push(label);
  }

  const c = scene.add.container(x, y, children) as UIButton;
  c.bg = bg;
  c.label = label;
  c.icon = icon;
  c.setDepth(options.depth ?? 52).setSize(bg.displayWidth, bg.displayHeight);
  c.setInteractive(new Phaser.Geom.Rectangle(-bg.displayWidth / 2, -bg.displayHeight / 2, bg.displayWidth, bg.displayHeight), Phaser.Geom.Rectangle.Contains);
  if (!options.disabled) {
    c.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      scene.tweens.add({ targets: c, scale: .94, yoyo: true, duration: 70 });
      options.onClick();
    });
  } else c.setAlpha(.72);
  return c;
}

export function hyperPanel(scene: Phaser.Scene, x: number, y: number, key: string, width: number, depth = 49) {
  const img = scene.add.image(x, y, key).setDepth(depth);
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  img.setDisplaySize(width, width * source.height / source.width);
  img.setAlpha(.96);
  return img;
}

export function hyperIcon(scene: Phaser.Scene, x: number, y: number, key: string, size: number, depth = 52) {
  return scene.add.image(x, y, key).setDisplaySize(size, size).setDepth(depth);
}
