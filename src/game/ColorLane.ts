import Phaser from 'phaser';
import { Core, SkinId } from '../core/Core';
import { RunSystem } from '../core/RunSystem';
import { Audio } from '../core/Audio';
import { Online } from '../core/Online';
import { AIRCRAFT_Y, PICKUP_EFFECT_Y, PICKUP_Y, TerrainAssets, TerrainRestorationManager } from './TerrainRestorationManager';
import { RunOnboardingController } from './RunOnboardingController';
import { DEBUG_RESOURCES, GameplayBalanceConfig } from './GameplayBalanceConfig';
import { FlightPatternDirector, FlightPickupType, FlightSpawn, HazardType } from './FlightPatternDirector';
import { HazardController, HazardObject } from './HazardController';
import { PollenChainController } from './PollenChainController';
import { RestorationPowerController, RestorationProgressController } from './ResourceControllers';
import { MOBILE_UI_LAYOUT as UI, hyperButton, hyperIcon, hyperPanel } from '../ui/HyperCasualUI';
import { preloadHyperCasualUI, UI_ASSETS, UIButtonVariant } from '../ui/HyperCasualUIAssets';

type Gate = Phaser.GameObjects.Container & {
  lane?: number;
  kind?: 'pickup' | 'hazard';
  pickupType?: FlightPickupType;
  hazardType?: HazardType;
  gold?: boolean;
};
const C = [0x22c55e, 0x3b82f6, 0xf43f5e];
const G = 0xfacc15;
const MENU_PANEL = { x: 195, y: 424, width: 330, height: 430 };
const MENU_BUTTON = 156;
const MAIN_BUTTON = 184;
const LEADERBOARD_LAYOUT = {
  titleY: 166,
  panelY: 418,
  panelWidth: 330,
  panelHeight: 430,
  panelPadding: 34,
  textY: 306,
  homeButtonY: 590,
  buttonWidth: 170
};
const RUN_COMPLETE_LAYOUT = {
  titleY: 158,
  panelY: 386,
  panelWidth: 334,
  panelHeight: 360,
  panelPadding: 24,
  statRowGap: 22,
  messageGap: 30,
  buttonStartY: 625,
  buttonGap: 60,
  playAgainWidth: 190,
  buttonWidth: 178
};

export class ColorLane extends Phaser.Scene {
  lane = 1; speed = 220; playing = false; paused = false; spawnDelay = 1180;
  visualTime = 0; nextOrbitSpark = 0; distance = 0; nextPatternAt = 0; pollenDustMuteMs = 0;
  run = new RunSystem(); pattern: number[] = []; pi = 0;
  restorePower = new RestorationPowerController(); restoreProgress = new RestorationProgressController();
  patternDirector = new FlightPatternDirector();
  pollenChain = new PollenChainController();
  hazardController!: HazardController;
  pickups = { fuel: 0, water: 0, gold: 0, hazardsAvoided: 0 };
  menu: Phaser.GameObjects.GameObject[] = []; inputs: HTMLInputElement[] = [];
  player!: Phaser.GameObjects.Rectangle; gates!: Phaser.GameObjects.Group;
  score!: Phaser.GameObjects.Text; distanceLabel!: Phaser.GameObjects.Text; streak!: Phaser.GameObjects.Text; lives!: Phaser.GameObjects.Text; level!: Phaser.GameObjects.Text;
  restoreHud!: Phaser.GameObjects.Text; restoreBoost!: Phaser.GameObjects.Rectangle; worldHud!: Phaser.GameObjects.Text; debugResources!: Phaser.GameObjects.Text; chainHud!: Phaser.GameObjects.Text;
  lifePips: Phaser.GameObjects.Image[] = [];
  title!: Phaser.GameObjects.Text; hint!: Phaser.GameObjects.Text; status!: Phaser.GameObjects.Text; pause!: Phaser.GameObjects.Text; pauseBg!: Phaser.GameObjects.Image; shellPanel!: Phaser.GameObjects.Image;
  version!: Phaser.GameObjects.Text;
  terrain!: TerrainRestorationManager; plane!: Phaser.GameObjects.Image;
  onboarding!: RunOnboardingController;
  aura!: Phaser.GameObjects.Arc; rays: Phaser.GameObjects.Rectangle[] = []; dangerEdges: Phaser.GameObjects.Rectangle[] = [];
  overlay!: Phaser.GameObjects.Rectangle; danger!: Phaser.GameObjects.Rectangle; lanes = [65, 195, 325];

  constructor() { super('ColorLane'); }

  preload() {
    TerrainRestorationManager.preload(this);
    preloadHyperCasualUI(this);
  }

  create() {
    this.terrain = new TerrainRestorationManager(this);
    this.terrain.create();
    this.lanes.forEach((x, i) => {
      this.add.rectangle(x, 450, 108, 720, C[i], .035).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
      this.add.rectangle(x, 450, 2, 720, C[i], .18).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
      this.add.circle(x, 104, 5, C[i], .8).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    });
    this.danger = this.add.rectangle(195, 422, 390, 844, 0xf43f5e, 0).setDepth(4);
    this.dangerEdges = [
      this.add.rectangle(195, 4, 390, 8, 0xf43f5e, 0),
      this.add.rectangle(195, 840, 390, 8, 0xf43f5e, 0),
      this.add.rectangle(4, 422, 8, 844, 0xf43f5e, 0),
      this.add.rectangle(386, 422, 8, 844, 0xf43f5e, 0)
    ].map(x => x.setDepth(29).setBlendMode(Phaser.BlendModes.ADD));
    this.add.image(195, 50, UI_ASSETS.panels.hud.key).setDisplaySize(378, 68).setDepth(30).setAlpha(.96);
    this.distanceLabel = this.add.text(366, 22, 'DISTANCE', { fontFamily: 'Arial', fontSize: '10px', color: '#dbeafe', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(32);
    this.score = this.add.text(366, 34, '', { fontFamily: 'Arial', fontSize: '28px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(32);
    this.lives = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: '1px', color: '#e5e7eb', fontStyle: 'bold' }).setVisible(false).setDepth(32);
    this.lifePips = [0, 1, 2].map(i => hyperIcon(this, 35 + i * 30, 48, TerrainAssets.fuel, 25, 32));
    this.level = this.add.text(195, 18, '', { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setVisible(false).setDepth(32);
    this.streak = this.add.text(366, 65, '', { fontFamily: 'Arial', fontSize: '10px', color: '#fde047', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(32);
    this.restoreHud = this.add.text(195, 34, '', { fontFamily: 'Arial', fontSize: '10px', color: '#dbeafe', fontStyle: 'bold', align: 'center' }).setOrigin(.5).setDepth(32);
    this.restoreBoost = this.add.rectangle(166, 43, 58, 2, 0x38bdf8, .7).setOrigin(0, .5).setDepth(33);
    this.worldHud = this.add.text(195, 52, '', { fontFamily: 'Arial', fontSize: '15px', color: '#ffffff', fontStyle: 'bold', align: 'center' }).setOrigin(.5).setDepth(32);
    this.chainHud = this.add.text(195, 91, '', { fontFamily: 'Arial', fontSize: '13px', color: '#fef9c3', fontStyle: 'bold', align: 'center', stroke: '#020617', strokeThickness: 4 }).setOrigin(.5).setDepth(32);
    this.debugResources = this.add.text(12, 132, '', { fontFamily: 'Arial', fontSize: '10px', color: '#e5e7eb', backgroundColor: 'rgba(2,6,23,.5)', padding: { x: 6, y: 4 } }).setDepth(91).setVisible(false);
    this.pauseBg = this.add.image(195, 805, UI_ASSETS.buttons.primary.key).setDisplaySize(130, 50).setDepth(59).setVisible(false);
    this.pause = this.add.text(195, 805, '', { fontFamily: 'Arial', fontSize: '14px', color: '#e5e7eb', padding: { x: 20, y: 8 }, fontStyle: 'bold', stroke: '#0f172a', strokeThickness: 3 }).setOrigin(.5).setDepth(60).setInteractive();
    this.pause.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); this.tweens.add({ targets: [this.pause, this.pauseBg], scale: .95, yoyo: true, duration: 70 }); if (this.playing) this.togglePause(); });
    this.status = this.add.text(195, 150, '', { fontFamily: 'Arial', fontSize: '20px', color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: { width: 340 } }).setOrigin(.5).setDepth(70);
    this.player = this.add.rectangle(this.lanes[1], AIRCRAFT_Y, 64, 64, C[1]).setStrokeStyle(4, 0xffffff, .95).setDepth(10);
    this.plane = this.add.image(this.player.x, this.player.y, TerrainAssets.plane).setDisplaySize(92, 92).setDepth(11).setVisible(false);
    this.aura = this.add.circle(this.player.x, this.player.y, 46, C[1], 0).setStrokeStyle(3, C[1], 0).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.rays = [-18, 0, 18].map((off, i) => this.add.rectangle(this.player.x + off, this.player.y + 24, 5, 70 + i * 10, C[1], 0).setAngle(off * .35).setDepth(8).setBlendMode(Phaser.BlendModes.ADD));
    this.gates = this.add.group();
    this.hazardController = new HazardController(this, this.lanes);
    this.onboarding = new RunOnboardingController(this, {
      lanes: this.lanes,
      gates: this.gates,
      getCurrentLane: () => this.lane,
      moveToLane: lane => this.move(lane),
      collectFuel: gate => this.onboardingFuel(gate),
      hitHazard: gate => this.hitHazard(gate, true),
      onComplete: () => this.beginNormalGameplay()
    });
    this.onboarding.create();
    this.overlay = this.add.rectangle(195, 422, 390, 844, 0x020617, .86).setDepth(45).setVisible(false);
    this.shellPanel = hyperPanel(this, 195, 418, UI_ASSETS.panels.menu.key, 344, 49).setVisible(false);
    this.title = this.add.text(195, 205, 'COLOR\nLANE', { align: 'center', fontFamily: 'Arial', fontSize: '48px', color: '#fff', fontStyle: 'bold', wordWrap: { width: 360 } }).setOrigin(.5).setDepth(50);
    this.hint = this.add.text(195, 335, '', { align: 'center', fontFamily: 'Arial', fontSize: '16px', color: '#cbd5e1', lineSpacing: 7, wordWrap: { width: 340 } }).setOrigin(.5).setDepth(50);
    this.version = this.add.text(UI.SCREEN_SIDE_PADDING, 820, 'v0.1.21 RC', { fontFamily: 'Arial', fontSize: '11px', color: '#64748b' }).setDepth(52).setVisible(false);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.playing || this.paused) return;
      if (this.onboarding.isActive()) {
        const lane = Math.max(0, Math.min(2, Math.floor(p.worldX / 130)));
        this.onboarding.handleLaneTap(lane);
        return;
      }
      const direction = p.worldX >= this.scale.width / 2 ? 1 : -1;
      this.move(Phaser.Math.Clamp(this.lane + direction, 0, 2));
    });
    window.addEventListener('blur', () => { if (this.playing) Audio.pauseMusic(); });
    window.addEventListener('focus', () => { if (this.playing && !this.paused) Audio.resumeMusic(); });
    this.home();
  }

  clear() { this.menu.forEach(x => x.destroy()); this.menu = []; this.inputs.forEach(x => x.remove()); this.inputs = []; this.version.setVisible(false); }
  blur() { this.inputs.forEach(x => x.blur()); (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); }
  btn(y: number, t: string, cb: () => void, w = 250) {
    const clean = t.replace(/[^\w\s]/g, '').trim().toUpperCase();
    const variant = this.buttonVariant(clean);
    const iconKey = this.buttonIcon(clean);
    const noLabel = ['PLAY', 'RESUME', 'BACK'].some(x => clean === x);
    const maxWidth = clean === 'PLAY' ? MAIN_BUTTON : MENU_BUTTON;
    const minWidth = clean === 'PLAY' ? 172 : 132;
    const scaled = Math.round(w * (clean === 'PLAY' ? UI.BUTTON_SCALE_MAIN : UI.BUTTON_SCALE_SECONDARY));
    const b = hyperButton(this, 195, y, { variant, iconKey, width: Math.min(Math.max(scaled, minWidth), maxWidth), label: noLabel ? undefined : clean, noLabel, onClick: cb });
    this.menu.push(b);
  }
  buttonVariant(clean: string): UIButtonVariant {
    if (clean === 'PLAY') return 'play';
    if (clean === 'LEADERBOARD') return 'primary';
    if (clean === 'SHOP') return 'primary';
    if (clean === 'SETTINGS' || clean === 'SETTING') return 'primary';
    if (clean === 'RESUME') return 'resume';
    if (clean.includes('BACK') || clean.includes('HOME')) return clean.includes('HOME') ? 'primary' : 'back';
    if (clean === 'CONFIRM') return 'confirm';
    if (clean === 'RETRY') return 'retry';
    if (clean.includes('CREATE') || clean.includes('SIGN') || clean.includes('EQUIP') || clean.includes('UNLOCK')) return 'primary';
    return clean.includes('PLAY') ? 'gold' : 'primary';
  }
  buttonIcon(clean: string) {
    if (clean.includes('HOME')) return UI_ASSETS.icons.home.key;
    if (clean.includes('ACCOUNT') || clean.includes('SIGN') || clean.includes('CREATE')) return UI_ASSETS.icons.profile.key;
    if (clean.includes('SHOP')) return UI_ASSETS.icons.shop.key;
    if (clean.includes('SETTING')) return UI_ASSETS.icons.settings.key;
    if (clean.includes('SOUND')) return clean.includes('OFF') ? UI_ASSETS.icons.soundOff.key : UI_ASSETS.icons.soundOn.key;
    if (clean.includes('VIBRATION')) return UI_ASSETS.icons.badge.key;
    if (clean.includes('HOW') || clean.includes('HELP')) return UI_ASSETS.icons.help.key;
    if (clean.includes('RANK') || clean.includes('LEADERBOARD')) return UI_ASSETS.icons.leaderboard.key;
    return undefined;
  }
  shell(on = true) { this.overlay.setVisible(on); this.shellPanel.setVisible(on); this.title.setVisible(on); this.hint.setVisible(on); }
  menuPanel() { this.shellPanel.setTexture(UI_ASSETS.panels.menu.key).setDisplaySize(MENU_PANEL.width, MENU_PANEL.height).setPosition(MENU_PANEL.x, MENU_PANEL.y); }
  field(y: number, placeholder: string, type = 'text') {
    const el = document.createElement('input'); el.type = type; el.placeholder = placeholder; el.autocomplete = type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'nickname';
    Object.assign(el.style, { position: 'fixed', left: '50%', top: `calc(50% + ${y - 422}px)`, transform: 'translate(-50%,-50%)', width: '260px', height: '44px', boxSizing: 'border-box', padding: '0 14px', border: '2px solid #475569', borderRadius: '5px', background: '#0f172a', color: '#fff', fontSize: '16px', zIndex: '9999', outline: 'none' });
    document.body.appendChild(el); this.inputs.push(el); return el;
  }

  home() {
    Audio.stopMusic();
    this.onboarding?.cancel();
    this.shellPanel.setVisible(false);
    this.playing = false; this.paused = false; this.danger.setAlpha(0); this.clear(); this.gates.clear(true, true); this.player.setVisible(false); this.plane.setVisible(false); this.pause.setText(''); this.pauseBg.setVisible(false);
    this.lives.setText(''); this.level.setText(''); this.streak.setText(''); this.score.setText(''); this.distanceLabel.setVisible(false); this.restoreHud.setText(''); this.restoreBoost.setVisible(false); this.worldHud.setText(''); this.chainHud.setText('').setVisible(false); this.lifePips.forEach(p => p.setVisible(false)); this.debugResources.setVisible(false); this.shell(true);
    this.overlay.setVisible(false);
    this.shellPanel.setVisible(false);
    const logo = this.add.image(195, 116, UI_ASSETS.titles.inshimuOrigins.key).setDisplaySize(330, 98).setDepth(52);
    const coin = hyperIcon(this, 288, 198, UI_ASSETS.icons.coin.key, 20, 52);
    this.menu.push(logo, coin);
    this.title.setVisible(false);
    this.hint.setPosition(195, 205).setFontSize(13).setText('BEST ' + Core.data.highScore + '   COINS ' + Core.data.coins + '\nWORLD ' + Core.data.worldRestorationPercent.toFixed(1) + '%\n' + (Online.user ? Online.name() : 'GUEST'));
    this.version.setVisible(true);
    const playY = 310;
    this.btn(playY, 'PLAY', () => this.start(), 210);
    this.btn(playY + 70, 'LEADERBOARD', () => this.board(), 178);
    this.btn(playY + 132, Online.user ? 'ACCOUNT' : 'SIGN IN', () => this.account(), 178);
    this.btn(playY + 194, 'SHOP', () => this.shop(), 178);
    this.btn(playY + 256, 'SETTINGS', () => this.settings(), 178);
  }

  tutorial(step = 0) {
    this.onboarding?.cancel();
    this.menuPanel();
    this.playing = false; this.paused = false; this.clear(); this.gates.clear(true, true); this.player.setVisible(false); this.plane.setVisible(false); this.pause.setText(''); this.pauseBg.setVisible(false); this.shell(true);
    const pages = [
      ['HOW TO PLAY', 'FOLLOW POLLEN\n\nPollen appears in chains across the three lanes.\nMove through each orb to keep the chain alive.'],
      ['MOVE FAST', 'TAP A LANE\n\nTap one of the three lane zones to move instantly.\n\nFollow the pollen path while keeping clear of hazards.'],
      ['BUILD MOMENTUM', 'KEEP THE CHAIN\n\nConsecutive pollen builds FLOW and ON FIRE energy.\nMissing pollen breaks the chain but does not remove vitality.'],
      ['GOLD = REWARD', 'CATCH GOLDEN POLLEN\n\nRare golden pollen appears after harder routes.\nCatch it for bonus coins and a restoration surge.'],
      ['SURVIVE', 'YOU HAVE 3 VITALITY CHARGES\n\nMissing pollen breaks your chain.\nHazards remove a charge.\nWhen all three are gone, the run ends.'],
      ['READY?', 'FOLLOW POLLEN. DODGE HAZARDS.\n\nCollect pollen chains, avoid airborne hazards, and restore the world as distance climbs.']
    ];
    const page = pages[Math.max(0, Math.min(step, pages.length - 1))];
    this.title.setPosition(195, 190).setFontSize(step === 0 ? 38 : 34).setText(page[0]); this.hint.setPosition(195, 340).setFontSize(15).setText(page[1]);
    if (step > 0) this.btn(600, 'BACK', () => this.tutorial(step - 1), 155);
    if (step < pages.length - 1) this.btn(600, 'NEXT', () => this.tutorial(step + 1), 155);
    else this.btn(600, 'PLAY', () => { Core.markTutorial(); this.start(); }, 180);
    this.btn(548, 'HOME', () => this.home(), 170);
  }

  account() {
    this.clear(); this.menuPanel(); this.shell(true); this.title.setPosition(195, 178).setFontSize(38).setText('ACCOUNT');
    if (Online.user) { this.hint.setPosition(195, 310).setFontSize(15).setText(Online.name() + '\n' + Online.user.email + '\n\nYour best runs are submitted globally.'); this.btn(460, 'VIEW RANK', () => this.board(), 190); this.btn(525, 'SIGN OUT', async () => { await Online.signOut(); this.home(); }, 190); this.btn(590, 'HOME', () => this.home(), 170); return; }
    this.hint.setPosition(195, 300).setFontSize(15).setText('Sign in to join global rankings.\nGuest play remains available.'); this.btn(445, 'SIGN IN', () => this.authForm(false), 190); this.btn(510, 'CREATE ACCOUNT', () => this.authForm(true), 210); this.btn(575, 'HOME', () => this.home(), 170);
  }

  authForm(create: boolean, message = '') {
    this.clear(); this.menuPanel(); this.shell(true); this.title.setPosition(195, 178).setFontSize(create ? 32 : 38).setText(create ? 'CREATE ACCOUNT' : 'SIGN IN'); this.hint.setPosition(195, 282).setFontSize(14).setText(message || (create ? 'Choose a player name, email and password.' : 'Enter your account details.'));
    const name = create ? this.field(375, 'Player name (1-18 characters)') : null, email = this.field(create ? 435 : 405, 'Email address', 'email'), password = this.field(create ? 495 : 470, 'Password (minimum 6 characters)', 'password');
    this.btn(create ? 575 : 545, create ? 'CREATE ACCOUNT' : 'SIGN IN', async () => {
      const n = name?.value.trim() || '', e = email.value.trim(), p = password.value; this.blur();
      if (!e || p.length < 6 || (create && !n)) { this.hint.setText('CHECK YOUR DETAILS\nUse a valid email and password of at least 6 characters.'); return; }
      this.hint.setText(create ? 'CREATING ACCOUNT...' : 'SIGNING IN...');
      try {
        if (create) { const r = await Online.signUp(e, p, n); this.clear(); this.menuPanel(); this.shell(true); this.title.setPosition(195, 190).setFontSize(36).setText(r.needsConfirmation ? 'CHECK YOUR EMAIL' : 'WELCOME!'); this.hint.setPosition(195, 330).setFontSize(15).setText(r.needsConfirmation ? 'We sent a confirmation link to\n' + e + '\n\nConfirm it, then return and sign in.' : 'Signed in as ' + Online.name()); this.btn(570, r.needsConfirmation ? 'BACK TO SIGN IN' : 'HOME', () => r.needsConfirmation ? this.authForm(false) : this.home()); }
        else { await Online.signIn(e, p); this.clear(); this.menuPanel(); this.shell(true); this.title.setPosition(195, 190).setFontSize(38).setText('SIGNED IN'); this.hint.setPosition(195, 325).setFontSize(16).setText('WELCOME, ' + Online.name()); this.btn(570, 'CONTINUE', () => this.home()); }
      } catch (err: any) { const msg = String(err?.message || 'AUTHENTICATION FAILED').replace(/^AuthApiError:\s*/, '').slice(0, 100); this.hint.setText('ACCOUNT ERROR\n\n' + msg + '\n\nCorrect the details above and try again.'); }
    });
    this.btn(create ? 655 : 625, '← BACK', () => { this.blur(); this.account(); });
  }

  async board() {
    const centerX = this.scale.width / 2;
    const layout = LEADERBOARD_LAYOUT;
    this.clear();
    this.shellPanel.setTexture(UI_ASSETS.panels.menu.key).setDisplaySize(layout.panelWidth, layout.panelHeight).setPosition(centerX, layout.panelY);
    this.shell(true);
    this.title.setPosition(centerX, layout.titleY).setFontSize(34).setText('GLOBAL TOP 10');
    this.hint.setPosition(centerX, layout.textY).setFontSize(13).setLineSpacing(8).setText('LOADING...');
    try { const rows = await Online.top(10), rank = await Online.rank(); let text = rows.length ? rows.map((r, i) => (i + 1) + '. ' + r.display_name + '   ' + r.best_score).join('\n') : 'NO SCORES YET'; text += rank ? '\n\nYOUR RANK  #' + rank.rank + '   •   BEST ' + rank.score : Online.user ? '\n\nFINISH A RUN TO GET RANKED' : '\n\nSIGN IN TO JOIN THE RANKINGS'; this.hint.setText(text); }
    catch (e: any) { this.hint.setText('LEADERBOARD UNAVAILABLE\n' + String(e?.message || '').slice(0, 50)); }
    this.btn(layout.homeButtonY, 'HOME', () => this.home(), layout.buttonWidth);
  }

  shop() {
    this.clear(); this.menuPanel(); this.shell(true); this.title.setPosition(195, 178).setFontSize(38).setText('STYLE SHOP'); this.hint.setPosition(195, 285).setFontSize(15).setText('BALANCE ' + Core.data.coins + ' COINS');
    (['classic', 'sunset', 'neon'] as SkinId[]).forEach((s, i) => { const o = Core.data.unlocked.includes(s), sel = Core.data.skin === s; this.btn(395 + i * 68, (sel ? 'SELECTED ' : o ? 'EQUIP ' : 'UNLOCK ') + s.toUpperCase() + (o ? '' : ' ' + Core.price(s)), () => { Core.buy(s) ? this.shop() : this.flash('NEED MORE COINS', 500); }, 220); });
    this.btn(625, 'HOME', () => this.home(), 170);
  }

  settings() {
    this.clear(); this.menuPanel(); this.shell(true); this.title.setPosition(195, 178).setFontSize(38).setText('SETTINGS'); this.hint.setPosition(195, 285).setFontSize(15).setText('Preferences save automatically');
    this.btn(395, 'SOUND ' + (Core.data.sound ? 'ON' : 'OFF'), () => { Core.toggleSound(); Audio.syncMusicVolume(); this.settings(); }, 215);
    this.btn(463, 'VIBRATION ' + (Core.data.vibration ? 'ON' : 'OFF'), () => { Core.toggleVibration(); this.settings(); }, 215);
    this.btn(531, 'HOW TO PLAY', () => this.tutorial(0), 215);
    this.btn(599, 'HOME', () => this.home(), 170);
  }

  skin() { const s = Core.data.skin; this.player.setScale(1).setAngle(0); if (s === 'sunset') { this.player.setStrokeStyle(8, 0xf97316, 1); this.player.setAngle(45).setScale(.86); } else if (s === 'neon') { this.player.setStrokeStyle(8, 0x22d3ee, 1); this.tweens.add({ targets: this.player, alpha: .62, yoyo: true, repeat: -1, duration: 420 }); } else this.player.setStrokeStyle(4, 0xffffff, .95); }
  trail(from: number, to: number, col: number) {
    const g = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    const draw = (width: number, alpha: number, lift: number) => {
      g.lineStyle(width, col, alpha);
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, x = Phaser.Math.Linear(from, to, t), y = AIRCRAFT_Y - Math.sin(t * Math.PI) * lift;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokePath();
    };
    draw(13, .16, 38);
    draw(5, .55, 30);
    this.tweens.add({ targets: g, alpha: 0, scaleY: 1.24, duration: 250, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
  }
  move(i: number) { if (i === this.lane) return; const from = this.player.x; this.trail(from, this.lanes[i], C[i]); this.lane = i; this.player.setFillStyle(C[i]); Audio.move(); this.tweens.killTweensOf(this.player); this.tweens.add({ targets: this.player, x: this.lanes[i], duration: 100, ease: 'Back.out' }); }

  start() {
    this.clear();
    this.time.removeAllEvents();
    this.onboarding?.cancel(false);
    this.tweens.killTweensOf(this.player);
    this.gates.clear(true, true);
    this.run.reset();
    this.restorePower.reset();
    this.restoreProgress.resetRun();
    this.patternDirector.reset();
    this.pollenChain.reset();
    this.pickups = { fuel: 0, water: 0, gold: 0, hazardsAvoided: 0 };
    this.distance = 0;
    this.nextPatternAt = 0;
    this.pollenDustMuteMs = 0;
    this.playing = true;
    this.paused = false;
    Audio.startMusic();
    this.pattern = [];
    this.pi = 0;
    this.lane = 1;
    this.danger.setAlpha(0);
    this.shell(false);
    this.player.setVisible(true).setPosition(this.lanes[1], AIRCRAFT_Y).setFillStyle(C[1]);
    this.plane.setVisible(true).setPosition(this.player.x, this.player.y);
    this.skin();
    this.player.setAlpha(0);
    this.hud();
    this.pause.setText('Ⅱ PAUSE');
    this.pauseBg.setVisible(true);
    this.cameras.main.fadeIn(220, 0, 0, 0);
    this.beginNormalGameplay();
  }
  beginNormalGameplay() {
    if (!this.playing || this.paused) return;
    this.player.setPosition(this.lanes[1], AIRCRAFT_Y);
    this.lane = 1;
    this.flash('GO!', 420);
    this.cameras.main.flash(110, 120, 255, 170, false);
    this.spawnPattern();
  }
  hud() {
    const s = this.run.snapshot();
    this.lives.setText('').setVisible(false);
    this.lifePips.forEach((pip, i) => pip.setVisible(true).clearTint().setAlpha(i < s.lives ? 1 : .22));
    this.level.setText('').setVisible(false);
    this.streak.setText(this.pollenChain.current >= 25 ? 'ON FIRE' : this.pollenChain.current >= 10 ? 'FLOW' : '');
    this.distanceLabel.setVisible(true);
    this.score.setText(String(Math.round(this.distance)));
    this.restoreHud.setText('WORLD\nRESTORATION').setVisible(true);
    this.restoreBoost.setVisible(false).width = 58 * this.restorePower.boostRatio();
    this.worldHud.setText(this.restoreProgress.displayTotal.toFixed(1) + '%').setVisible(true);
    this.chainHud.setVisible(this.playing && this.pollenChain.current > 0).setText(this.pollenChain.current > 0 ? 'POLLEN CHAIN x' + this.pollenChain.current : '');
  }
  schedule() {}
  choose() { return this.patternDirector.next(this.distance).pollen[0]?.lane ?? 1; }
  spawnPattern() {
    const pattern = this.patternDirector.next(this.distance);
    [...pattern.pollen, ...pattern.hazards].forEach(spawn => {
      const gate = spawn.kind === 'hazard' ? this.createHazard(spawn) : this.createPickup(spawn);
      gate.setData('patternId', pattern.id);
      this.gates.add(gate);
    });
    this.nextPatternAt = this.distance + pattern.length;
  }
  createPickup(spawn: FlightSpawn) {
    const l = spawn.lane;
    const children: Phaser.GameObjects.GameObject[] = [];
    if (spawn.pickupType === 'goldenPollen') {
      const halo = this.add.circle(0, 0, 35, G, .14).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.circle(0, 0, 22, G, .95).setStrokeStyle(4, 0xffffff, .78).setBlendMode(Phaser.BlendModes.ADD);
      children.push(halo, core);
      this.tweens.add({ targets: [halo, core], scale: 1.12, angle: 180, yoyo: true, repeat: -1, duration: 380 });
    } else if (spawn.pickupType === 'nectar') {
      const drop = this.add.circle(0, 0, 25, 0x38bdf8, .92).setScale(.82, 1.18).setStrokeStyle(4, 0xbff4ff, .75);
      const shine = this.add.circle(-8, -12, 5, 0xffffff, .72);
      children.push(drop, shine);
    } else {
      const glow = this.add.circle(0, 0, 28, 0xfef9c3, .08).setBlendMode(Phaser.BlendModes.ADD);
      children.push(glow, this.add.image(0, 0, TerrainAssets.fuel).setDisplaySize(44, 44));
    }
    const g = this.add.container(this.lanes[l], spawn.offsetY, children) as Gate;
    g.kind = 'pickup'; g.lane = l; g.pickupType = spawn.pickupType || 'pollen'; g.gold = g.pickupType === 'goldenPollen'; g.setDepth(12).setScale(.7).setAlpha(0);
    this.tweens.add({ targets: g, scale: 1, alpha: 1, duration: 180, ease: 'Back.out' });
    return g;
  }
  createHazard(spawn: FlightSpawn) {
    const g = this.hazardController.create(spawn) as Gate & HazardObject;
    g.kind = 'hazard';
    g.hazardType = spawn.hazardType || 'corruptedWasp';
    return g;
  }
  visualUpdate(d: number) {
    this.visualTime += d;
    this.restoreProgress.updateDisplay();
    const onboardingActive = this.onboarding?.isActive();
    const terrainSpeed = onboardingActive ? 0 : this.speed;
    this.terrain.update(terrainSpeed, this.player.x, this.playing, this.paused || onboardingActive || (this.onboarding?.shouldFreezeWorld() ?? false), d);
    this.plane.setPosition(this.player.x, this.player.y).setVisible(this.playing);
    const s = this.pollenChain.current, col = C[this.lane], dustScale = this.pollenDustMuteMs > 0 ? .35 : 1, aura = this.playing ? Math.min(.28, Math.max(0, (s - 2) * .018)) * dustScale : 0;
    this.aura.setPosition(this.player.x, this.player.y).setFillStyle(col, aura * .22).setStrokeStyle(3 + Math.min(5, s), col, aura);
    this.aura.setScale(1 + Math.sin(this.visualTime / 180) * .04 + Math.min(.28, s * .015));
    this.rays.forEach((r, i) => r.setPosition(this.player.x + (i - 1) * 18, this.player.y + 35).setFillStyle(col, s >= 4 && this.playing ? Math.min(.18, .055 + s * .012) : 0).setScale(1, 1 + Math.sin(this.visualTime / 240 + i) * .16));
    if (this.playing && s >= 2 && this.visualTime > this.nextOrbitSpark) {
      this.nextOrbitSpark = this.visualTime + (s >= 25 ? 110 : s >= 10 ? 155 : 240);
      const a = this.visualTime * .006;
      const q = this.add.circle(this.player.x + Math.cos(a) * 39, this.player.y + Math.sin(a) * 27, s >= 4 ? 3 : 2, s >= 4 ? 0xffffff : col, .65).setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: q, x: this.player.x + Math.cos(a + .8) * 48, y: this.player.y + Math.sin(a + .8) * 33, alpha: 0, scale: .25, duration: 260, onComplete: () => q.destroy() });
    }
    const dangerAlpha = this.playing && this.run.lives === 1 ? .09 + Math.sin(this.visualTime / 1000 * Math.PI * 2) * .035 : 0;
    this.dangerEdges.forEach(e => e.setAlpha(Math.max(0, dangerAlpha)));
    this.player.setAlpha(0);
  }
  update(_: number, d: number) {
    this.visualUpdate(d);
    if (!this.playing || this.paused) return;
    if (this.onboarding.isActive()) {
      this.onboarding.update(d);
      return;
    }
    const l = Math.floor(this.distance / 500) + 1;
    this.run.level = l;
    Audio.setMusicPace(l);
    this.restorePower.update(d);
    this.pollenDustMuteMs = Math.max(0, this.pollenDustMuteMs - d);
    this.speed = Math.min(560, 215 + Math.floor(this.distance / 500) * 24 + this.pollenChain.best * .55);
    this.distance += this.speed * d / 1000;
    if (this.distance >= this.nextPatternAt && this.gates.getLength() < 30) this.spawnPattern();
    const multiplier = this.restorePower.multiplier() * this.pollenChain.restorationMultiplier();
    this.restoreProgress.add((GameplayBalanceConfig.restoration.passivePerSecond * d / 1000 + this.speed * d / 1000 * GameplayBalanceConfig.restoration.distancePerPixel) * multiplier);
    this.restoreProgress.checkMilestones().forEach(m => this.milestoneFx(m));
    this.terrain.setRestorationPower(multiplier, this.restorePower.surgeMs > 0 ? this.restorePower.boostRatio() : 0);
    for (const o of [...this.gates.getChildren()] as Gate[]) {
      o.y += this.speed * d / 1000;
      if (o.kind === 'hazard') this.hazardController.update(o as Gate & HazardObject, this.visualTime);
      if (o.gold && Phaser.Math.Between(1, 12) === 1) this.spark(o.x, o.y);
      if (o.y > PICKUP_Y && !o.getData('checked')) {
        o.setData('checked', true);
        this.resolveGate(o);
      }
      if (o.y > 880) {
        if (o.kind === 'hazard' && !o.getData('hit')) this.pickups.hazardsAvoided++;
        o.destroy();
      }
    }
    if (DEBUG_RESOURCES) this.debugResources.setVisible(true).setText('Charges ' + this.run.lives + '\nNectar ' + Math.ceil(this.restorePower.waterMs / 1000) + 's\nSurge ' + Math.ceil(this.restorePower.surgeMs / 1000) + 's\nChain ' + this.pollenChain.current + '\nRun +' + this.restoreProgress.runGain.toFixed(2) + '%\nTotal ' + Core.data.worldRestorationPercent.toFixed(2) + '%');
    else this.debugResources.setVisible(false);
    this.hud();
  }

  resolveGate(o: Gate) {
    const matched = o.lane === this.lane;
    if (o.kind === 'hazard') {
      if (this.hazardTouchesPlayer(o as Gate & HazardObject)) this.hitHazard(o);
      return;
    }
    const type = o.pickupType || 'pollen';
    if (!matched) {
      this.missPollen(o);
      return;
    }
    if (type === 'nectar') this.water(o);
    else if (type === 'goldenPollen') this.gold(o);
    else this.ok(o);
  }

  spark(x: number, y: number) { const q = this.add.circle(x + Phaser.Math.Between(-22, 22), y + Phaser.Math.Between(-12, 12), Phaser.Math.Between(1, 3), G, .8).setDepth(8); this.tweens.add({ targets: q, y: y + 30, alpha: 0, scale: 0, duration: 240, onComplete: () => q.destroy() }); }
  streakFx(s: number) {
    if (s < 2) return;
    const col = C[this.lane], sparks = s >= 4 ? 6 : 3;
    for (let i = 0; i < sparks; i++) {
      const a = (Math.PI * 2 / sparks) * i + this.visualTime * .004;
      const q = this.add.circle(this.player.x + Math.cos(a) * 36, this.player.y + Math.sin(a) * 25, s >= 4 ? 3 : 2, s >= 4 ? 0xffffff : col, .72).setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: q, x: this.player.x + Math.cos(a + .9) * 50, y: this.player.y + Math.sin(a + .9) * 34, alpha: 0, scale: .3, duration: 270, ease: 'Sine.easeOut', onComplete: () => q.destroy() });
    }
  }
  jackpotFx(x: number) {
    this.burst(x, G, 25);
    const edge = this.add.rectangle(195, 422, 390, 844, G, .07).setDepth(28).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: edge, alpha: 0, duration: 420, ease: 'Sine.easeOut', onComplete: () => edge.destroy() });
    const shock = this.add.circle(x, PICKUP_EFFECT_Y, 22, G, .05).setStrokeStyle(7, G, .9).setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: shock, scale: 5.4, alpha: 0, duration: 330, ease: 'Cubic.easeOut', onComplete: () => shock.destroy() });
    for (let i = 0; i < 22; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2), r = Phaser.Math.Between(55, 155);
      const q = this.add.circle(x, PICKUP_EFFECT_Y, Phaser.Math.Between(2, 4), i % 4 === 0 ? 0xffffff : G, .95).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: q, x: x + Math.cos(a) * r, y: PICKUP_EFFECT_Y + Math.sin(a) * r, alpha: 0, scale: .25, duration: Phaser.Math.Between(260, 480), ease: 'Sine.easeOut', onComplete: () => q.destroy() });
    }
    this.cameras.main.flash(120, 255, 220, 80, false);
    this.cameras.main.zoomTo(1.028, 90);
    this.cameras.main.rotateTo(Phaser.Math.FloatBetween(-.025, .025), 90, false, 'Sine.easeOut');
    this.time.delayedCall(110, () => { this.cameras.main.zoomTo(1, 180); this.cameras.main.rotateTo(0, 180, false, 'Sine.easeInOut'); });
  }
  surgeFx(x: number) {
    this.jackpotFx(x);
    const ring = this.add.circle(this.player.x, this.player.y + 12, 36, 0x38bdf8, .04).setStrokeStyle(8, 0xfacc15, .85).setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 6.8, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 30; i++) {
      const col = [0xfacc15, 0x22c55e, 0x38bdf8][i % 3];
      const q = this.add.circle(this.player.x, this.player.y, Phaser.Math.Between(2, 4), col, .85).setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: q, x: this.player.x + Phaser.Math.Between(-180, 180), y: this.player.y + Phaser.Math.Between(-150, 65), alpha: 0, scale: .25, duration: Phaser.Math.Between(340, 620), ease: 'Sine.easeOut', onComplete: () => q.destroy() });
    }
  }
  floatText(t: string, x: number, col: number) {
    const txt = this.add.text(x, PICKUP_EFFECT_Y - 28, t, { fontFamily: 'Arial', fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setDepth(28).setTint(col);
    this.tweens.add({ targets: txt, y: txt.y - 35, alpha: 0, duration: 460, ease: 'Sine.easeOut', onComplete: () => txt.destroy() });
  }
  milestoneFx(milestone: number) {
    Audio.milestone();
    this.flash('WORLD RESTORATION: ' + milestone + '%', 720);
    this.tweens.add({ targets: this.worldHud, scale: 1.25, yoyo: true, duration: 180 });
  }
  burst(x: number, col: number, n = 18) {
    const flash = this.add.circle(x, PICKUP_EFFECT_Y, 24, 0xffffff, .32).setDepth(22).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.9, duration: 120, ease: 'Sine.easeOut', onComplete: () => flash.destroy() });
    const core = this.add.circle(x, PICKUP_EFFECT_Y, 18, col, .24).setDepth(21).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: core, alpha: 0, scale: 2.3, duration: 180, onComplete: () => core.destroy() });
    const ring = this.add.circle(x, PICKUP_EFFECT_Y, 18, col, .08).setStrokeStyle(4, col, .95).setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 250, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < n; i++) {
      const a = Phaser.Math.FloatBetween(-Math.PI, 0), r = Phaser.Math.Between(34, 92);
      const q = this.add.rectangle(x, PICKUP_EFFECT_Y, Phaser.Math.Between(2, 4), Phaser.Math.Between(5, 10), i % 5 === 0 ? 0xffffff : col, .95).setDepth(21).setAngle(Phaser.Math.Between(0, 180)).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: q, x: x + Math.cos(a) * r, y: PICKUP_EFFECT_Y + Math.sin(a) * r, alpha: 0, scale: .25, duration: Phaser.Math.Between(170, 290), ease: 'Sine.easeOut', onComplete: () => q.destroy() });
    }
  }
  ok(o: Gate) {
    const x = this.lanes[o.lane!];
    o.destroy();
    this.run.score++;
    this.run.coins++;
    this.pickups.fuel++;
    const milestone = this.pollenChain.collect();
    this.restoreProgress.add(GameplayBalanceConfig.restoration.pollenCollect * this.restorePower.multiplier() * this.pollenChain.restorationMultiplier());
    Audio.catch();
    const s = this.pollenChain.current, big = milestone > 0 || s >= 25;
    this.burst(x, 0xfef9c3, big ? 18 : 9);
    this.streakFx(s);
    this.tweens.add({ targets: this.player, scaleX: big ? 1.22 : 1.1, scaleY: big ? .86 : .94, yoyo: true, duration: big ? 90 : 55 });
    if (milestone) this.flash('POLLEN CHAIN x' + milestone, 560);
    if (big) this.cameras.main.zoomTo(1.012, 70);
    if (big) this.time.delayedCall(85, () => this.cameras.main.zoomTo(1, 120));
    this.hud();
  }
  onboardingFuel(o: Gate) { this.ok(o); }
  water(o: Gate) {
    const x = this.lanes[o.lane!];
    o.destroy();
    this.pickups.water++;
    if (this.run.lives < 3) this.run.lives++;
    this.restorePower.activateWater();
    this.restoreProgress.add(GameplayBalanceConfig.restoration.nectarCollect);
    this.run.score += 3;
    Audio.water();
    this.floatText('NECTAR BOOST', x, 0x38bdf8);
    this.burst(x, 0x38bdf8, 18);
    this.cameras.main.flash(70, 80, 220, 255, false);
    this.hud();
  }
  gold(o: Gate) {
    const x = this.lanes[o.lane!];
    o.destroy();
    this.pickups.gold++;
    this.run.score += 10;
    this.run.coins += 5;
    this.restorePower.activateSurge();
    this.restoreProgress.add(Phaser.Math.FloatBetween(GameplayBalanceConfig.restoration.goldInstantMin, GameplayBalanceConfig.restoration.goldInstantMax));
    Audio.surge();
    this.surgeFx(x);
    this.flash('GOLDEN POLLEN!', 650);
    this.hud();
  }
  levelFx() { const t = this.add.text(195, 390, 'LEVEL ' + this.run.level + '!\nKEEP GOING!', { align: 'center', fontFamily: 'Arial', fontSize: '38px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setDepth(35).setAlpha(0).setScale(.5); const ring = this.add.circle(this.player.x, this.player.y, 28, 0xffffff, .05).setStrokeStyle(5, 0xffffff, .8).setDepth(24).setBlendMode(Phaser.BlendModes.ADD); const glow = this.add.rectangle(195, 422, 390, 844, C[this.lane], .06).setDepth(3).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() }); this.tweens.add({ targets: glow, alpha: 0, duration: 450, onComplete: () => glow.destroy() }); this.tweens.add({ targets: this.player, y: this.player.y - 12, yoyo: true, duration: 120, ease: 'Sine.easeOut' }); for (let i = 0; i < 18; i++) { const q = this.add.rectangle(this.player.x, this.player.y, 3, 8, C[i % 3], .86).setDepth(24).setAngle(Phaser.Math.Between(0, 180)).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: q, x: this.player.x + Phaser.Math.Between(-120, 120), y: this.player.y + Phaser.Math.Between(-95, 45), alpha: 0, scale: .3, duration: Phaser.Math.Between(320, 520), ease: 'Sine.easeOut', onComplete: () => q.destroy() }); } this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 180, yoyo: true, hold: 180, onComplete: () => t.destroy() }); this.cameras.main.zoomTo(1.025, 90); this.time.delayedCall(100, () => this.cameras.main.zoomTo(1, 140)); }
  missPollen(o: Gate) {
    o.destroy();
    if (o.pickupType === 'pollen') {
      this.pollenChain.miss();
      this.pollenDustMuteMs = 900;
      this.floatText('CHAIN BROKEN', this.player.x, 0xe5e7eb);
    }
    this.hud();
  }
  hazardTouchesPlayer(o: Gate & HazardObject) {
    if (o.hazardType === 'birdCrossing') return Math.abs(o.x - this.player.x) < 46;
    if (o.hazardType === 'corruptedWasp' && Math.abs(o.x - this.player.x) < 42) return true;
    return (o.occupiedLanes || [o.lane ?? 1]).includes(this.lane);
  }
  hitHazard(o: Gate, tutorial = false) {
    const x = o.x || this.lanes[o.lane!];
    o.setData('hit', true);
    o.destroy();
    this.pollenChain.miss();
    this.pollenDustMuteMs = 1200;
    const dead = tutorial ? false : this.run.miss();
    Audio.miss();
    const warning = dead ? 'FLIGHT OVER' : this.run.lives === 1 ? 'LAST CHARGE!' : this.run.lives === 2 ? 'VITALITY HIT!' : 'HAZARD HIT!';
    this.cameras.main.shake(dead ? 220 : 100, dead ? .015 : .008);
    this.cameras.main.flash(dead ? 130 : 80, 255, 35, 60, false);
    const slash = this.add.rectangle(x, PICKUP_EFFECT_Y, 85, 8, 0xffffff, .9).setAngle(-35).setDepth(25);
    this.tweens.add({ targets: slash, alpha: 0, scaleX: 1.8, duration: 180, onComplete: () => slash.destroy() });
    if (!dead && this.run.lives === 1) {
      this.danger.setAlpha(.055);
      this.tweens.add({ targets: this.danger, alpha: .13, yoyo: true, repeat: -1, duration: 700 });
    } else if (!dead && this.run.lives === 2) this.danger.setAlpha(.025);
    this.flash(warning, dead ? 700 : 560);
    this.hud();
    if (dead) {
      Audio.stopMusic();
      this.danger.setAlpha(.2);
      this.playing = false;
      this.time.delayedCall(650, () => this.over());
    }
  }
  togglePause() { this.paused = !this.paused; this.paused ? this.onboarding.pause() : this.onboarding.resume(); this.paused ? Audio.pauseMusic() : Audio.resumeMusic(); this.overlay.setVisible(this.paused).setAlpha(.78); this.status.setText(this.paused ? 'PAUSED' : '').setAlpha(this.paused ? 1 : 0); this.pause.setText(this.paused ? '▶ RESUME' : 'Ⅱ PAUSE'); if (!this.paused) this.overlay.setVisible(false); }
  flash(t: string, d: number) { this.status.setText(t).setAlpha(1).setScale(.82); this.tweens.add({ targets: this.status, alpha: 0, scale: 1.08, duration: d }); }

  async over() {
    Audio.stopMusic();
    this.onboarding.cancel();
    this.restoreProgress.checkMilestones().forEach(m => this.milestoneFx(m));
    this.playing = false;
    this.paused = false;
    this.time.removeAllEvents();
    this.tweens.killTweensOf(this.danger);
    this.danger.setAlpha(0);
    this.gates.clear(true, true);
    this.cameras.main.fade(260, 0, 0, 0);
    await new Promise(r => setTimeout(r, 270));
    this.player.setVisible(false);
    this.plane.setVisible(false);

    const s = this.run.snapshot();
    const distance = Math.round(this.distance);
    const previousBest = Core.data.highScore;
    Core.finish(distance, s.coins);
    let submitted = false, error = '';
    if (Online.user) try { submitted = await Online.submit(distance); } catch (e: any) { error = String(e?.message || 'UPLOAD FAILED'); }

    const centerX = this.scale.width / 2;
    const layout = RUN_COMPLETE_LAYOUT;
    this.clear();
    this.shellPanel.setTexture(UI_ASSETS.panels.gameOver.key).setDisplaySize(layout.panelWidth, layout.panelHeight).setPosition(centerX, layout.panelY);
    this.shell(true);
    this.cameras.main.fadeIn(220, 0, 0, 0);
    const panelTop = this.shellPanel.y - this.shellPanel.displayHeight / 2;
    const panelBottom = this.shellPanel.y + this.shellPanel.displayHeight / 2;
    this.title.setPosition(centerX, layout.titleY).setFontSize(36).setText(distance >= previousBest ? 'NEW BEST!' : 'RUN COMPLETE');
    this.hint.setText('').setVisible(false);
    const rows = [
      'DISTANCE: ' + distance + 'm',
      'BEST: ' + Core.data.highScore + 'm',
      'POLLEN COLLECTED: ' + this.pollenChain.total,
      'BEST POLLEN CHAIN: ' + this.pollenChain.best,
      'NECTAR COLLECTED: ' + this.pickups.water,
      'GOLDEN POLLEN: ' + this.pickups.gold,
      'HAZARDS AVOIDED: ' + this.pickups.hazardsAvoided,
      'RESTORED THIS RUN: +' + this.restoreProgress.runGain.toFixed(1) + '%',
      'WORLD RESTORATION: ' + Core.data.worldRestorationPercent.toFixed(1) + '%'
    ];
    const message = Online.user ? (error ? 'SCORE SAVE FAILED' : submitted ? 'NEW GLOBAL BEST SUBMITTED' : 'GLOBAL BEST ALREADY HIGHER') : 'SIGN IN TO JOIN GLOBAL RANKINGS';
    const blockHeight = (rows.length - 1) * layout.statRowGap + layout.messageGap;
    const minStartY = panelTop + 28;
    const maxStartY = panelBottom - 28 - blockHeight;
    const contentStartY = Phaser.Math.Clamp(this.shellPanel.y - blockHeight / 2, minStartY, maxStartY);
    rows.forEach((row, index) => {
      this.menu.push(this.add.text(centerX, contentStartY + index * layout.statRowGap, row, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: layout.panelWidth - layout.panelPadding * 2 }
      }).setOrigin(.5).setDepth(52));
    });
    this.menu.push(this.add.text(centerX, contentStartY + (rows.length - 1) * layout.statRowGap + layout.messageGap, message, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#e5e7eb',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: layout.panelWidth - layout.panelPadding * 2 }
    }).setOrigin(.5).setDepth(52));
    this.pause.setText('');
    this.pauseBg.setVisible(false);
    this.btn(layout.buttonStartY, 'PLAY AGAIN', () => this.start(), layout.playAgainWidth);
    this.btn(layout.buttonStartY + layout.buttonGap, 'LEADERBOARD', () => this.board(), layout.buttonWidth);
    this.btn(layout.buttonStartY + layout.buttonGap * 2, 'HOME', () => this.home(), layout.buttonWidth);
  }
}

