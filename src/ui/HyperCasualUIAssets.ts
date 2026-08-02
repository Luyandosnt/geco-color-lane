import Phaser from 'phaser';

type UIAsset = { key: string; path: string };

export const UI_ASSETS = {
  buttons: {
    primary: { key: 'ui-button-primary', path: '/assets/Sprites/Buttons/empty_buttons/blue.png' },
    gold: { key: 'ui-button-gold', path: '/assets/Sprites/Buttons/empty_buttons/GOLDEN.png' },
    play: { key: 'ui-button-play', path: '/assets/Sprites/Buttons/Play.png' },
    leaderboard: { key: 'ui-button-leaderboard', path: '/assets/Sprites/Buttons/Leaderboard.png' },
    settings: { key: 'ui-button-settings', path: '/assets/Sprites/Buttons/Setting.png' },
    shop: { key: 'ui-button-shop', path: '/assets/Sprites/Buttons/Shop.png' },
    back: { key: 'ui-button-back', path: '/assets/Sprites/Buttons/Back.png' },
    confirm: { key: 'ui-button-confirm', path: '/assets/Sprites/Buttons/Confirm.png' },
    continue: { key: 'ui-button-continue', path: '/assets/Sprites/Buttons/Continue.png' },
    customize: { key: 'ui-button-customize', path: '/assets/Sprites/Buttons/Customize.png' },
    resume: { key: 'ui-button-resume', path: '/assets/Sprites/Buttons/Resume.png' },
    retry: { key: 'ui-button-retry', path: '/assets/Sprites/Buttons/Retry.png' },
    disabled: { key: 'ui-button-disabled', path: '/assets/Sprites/Buttons/Disabled.png' }
  },
  icons: {
    back: { key: 'ui-icon-back', path: '/assets/Sprites/Icons/Back (1).png' },
    close: { key: 'ui-icon-close', path: '/assets/Sprites/Icons/Close.png' },
    play: { key: 'ui-icon-play', path: '/assets/Sprites/Icons/Play (1).png' },
    pause: { key: 'ui-icon-pause', path: '/assets/Sprites/Icons/Pause (2).png' },
    resume: { key: 'ui-icon-resume', path: '/assets/Sprites/Icons/Resume (1).png' },
    home: { key: 'ui-icon-home', path: '/assets/Sprites/Icons/home_icon.png' },
    settings: { key: 'ui-icon-settings', path: '/assets/Sprites/Icons/setting.png' },
    shop: { key: 'ui-icon-shop', path: '/assets/Sprites/Icons/shop.png' },
    profile: { key: 'ui-icon-profile', path: '/assets/Sprites/Icons/character.png' },
    leaderboard: { key: 'ui-icon-leaderboard', path: '/assets/Sprites/Icons/leaderboard.png' },
    coin: { key: 'ui-icon-coin', path: '/assets/Sprites/Icons/coin.png' },
    badge: { key: 'ui-icon-badge', path: '/assets/Sprites/Icons/badge.png' },
    life: { key: 'ui-icon-life', path: '/assets/Sprites/Icons/heartt.png' },
    restore: { key: 'ui-icon-restore', path: '/assets/Sprites/Icons/Gold Treasure box.png' },
    lock: { key: 'ui-icon-lock', path: '/assets/Sprites/Icons/lock.png' },
    soundOn: { key: 'ui-icon-sound-on', path: '/assets/Sprites/Icons/soundon.png' },
    soundOff: { key: 'ui-icon-sound-off', path: '/assets/Sprites/Icons/soundoff.png' },
    help: { key: 'ui-icon-help', path: '/assets/Sprites/Icons/Help (2).png' },
    info: { key: 'ui-icon-info', path: '/assets/Sprites/Icons/Info (1).png' },
    star: { key: 'ui-icon-star', path: '/assets/Sprites/Icons/star golden.png' }
  },
  panels: {
    hud: { key: 'ui-panel-hud', path: '/assets/Sprites/GameUI/HUD Pannel.png' },
    menu: { key: 'ui-panel-menu', path: '/assets/Sprites/Panel_Sprites/Main Menu pannel.png' },
    pause: { key: 'ui-panel-pause', path: '/assets/Sprites/GameUI/Pause (1).png' },
    popup: { key: 'ui-panel-popup', path: '/assets/Sprites/Panel_Sprites/Resume Game popup.png' },
    card: { key: 'ui-panel-card', path: '/assets/Sprites/Panel_Sprites/Rectangle 357.png' },
    tallCard: { key: 'ui-panel-tall-card', path: '/assets/Sprites/Panel_Sprites/Rectangle 356.png' },
    gameOver: { key: 'ui-panel-game-over', path: '/assets/Sprites/Panel_Sprites/Game Over (1).png' }
  },
  titles: {
    inshimuOrigins: { key: 'ui-title-inshimu-origins', path: '/assets/ui/Inshimu-Origins-title.png' },
    restorationWorld: { key: 'ui-title-restoration-world', path: '/assets/ui/restoration-world-title.png' }
  },
  toggle: {
    on: { key: 'ui-toggle-on', path: '/assets/Sprites/Toggle/Toggle_ON.png' },
    off: { key: 'ui-toggle-off', path: '/assets/Sprites/Toggle/Toggle_Off.png' }
  }
} as const;

function flattenAssets(value: unknown, out: UIAsset[] = []) {
  if (!value || typeof value !== 'object') return out;
  if ('key' in value && 'path' in value) out.push(value as UIAsset);
  else Object.values(value).forEach(child => flattenAssets(child, out));
  return out;
}

export function preloadHyperCasualUI(scene: Phaser.Scene) {
  for (const asset of flattenAssets(UI_ASSETS)) {
    if (!scene.textures.exists(asset.key)) scene.load.image(asset.key, asset.path);
  }
}

export type UIButtonVariant = keyof typeof UI_ASSETS.buttons;
