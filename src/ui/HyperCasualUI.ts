import Phaser from 'phaser';
import { UI_ASSETS, UIButtonVariant } from './HyperCasualUIAssets';

export const DEBUG_UI_LAYOUT = false;

export const MOBILE_UI_LAYOUT = {
  SAFE_TOP_MARGIN: 24,
  SAFE_BOTTOM_MARGIN: 34,
  SCREEN_SIDE_PADDING: 18,
  PANEL_INNER_PADDING: 34,
  BUTTON_VERTICAL_GAP: 18,
  SECTION_VERTICAL_GAP: 28,
  BUTTON_SCALE_MAIN: 0.88,
  BUTTON_SCALE_SECONDARY: 0.78,
  HUD_ROW_GAP: 17,
  HUD_INNER_PADDING: 14
};

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
  const hitWidth = Math.max(bg.displayWidth, 52);
  const hitHeight = Math.max(bg.displayHeight, 46);
  c.setInteractive(new Phaser.Geom.Rectangle(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight), Phaser.Geom.Rectangle.Contains);
  if (DEBUG_UI_LAYOUT) {
    const bounds = scene.add.rectangle(0, 0, hitWidth, hitHeight, 0x00ffcc, .08)
      .setStrokeStyle(1, 0x00ffcc, .7);
    c.addAt(bounds, 0);
  }
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
