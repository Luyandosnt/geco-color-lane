import Phaser from 'phaser';
import { Core, SkinId } from '../core/Core';
import { RunSystem } from '../core/RunSystem';
import { Audio } from '../core/Audio';
import { Online } from '../core/Online';
import { AIRCRAFT_Y, PICKUP_EFFECT_Y, PICKUP_Y, TerrainAssets, TerrainRestorationManager } from './TerrainRestorationManager';
import { RunOnboardingController } from './RunOnboardingController';
import { DEBUG_RESOURCES, GameplayBalanceConfig } from './GameplayBalanceConfig';
import { PickupSpawnDirector, PickupType } from './PickupSpawnDirector';
import { FlightFuelController, RestorationPowerController, RestorationProgressController } from './ResourceControllers';
import { hyperButton, hyperIcon, hyperPanel } from '../ui/HyperCasualUI';
import { preloadHyperCasualUI, UI_ASSETS, UIButtonVariant } from '../ui/HyperCasualUIAssets';

type Gate = Phaser.GameObjects.Container & { lane?: number; gold?: boolean; pickupType?: PickupType };
const C = [0x22c55e, 0x3b82f6, 0xf43f5e];
const G = 0xfacc15;

export class ColorLane extends Phaser.Scene {
  lane = 1; speed = 220; playing = false; paused = false; spawnDelay = 1180;
  visualTime = 0; nextOrbitSpark = 0; distance = 0; displayedFuel = 100;
  run = new RunSystem(); pattern: number[] = []; pi = 0;
  flightFuel = new FlightFuelController(); restorePower = new RestorationPowerController(); restoreProgress = new RestorationProgressController();
  spawnDirector!: PickupSpawnDirector; pickups = { fuel: 0, water: 0, gold: 0 };
  menu: Phaser.GameObjects.GameObject[] = []; inputs: HTMLInputElement[] = [];
  player!: Phaser.GameObjects.Rectangle; gates!: Phaser.GameObjects.Group;
  score!: Phaser.GameObjects.Text; streak!: Phaser.GameObjects.Text; lives!: Phaser.GameObjects.Text; level!: Phaser.GameObjects.Text;
  fuelLabel!: Phaser.GameObjects.Text; fuelFill!: Phaser.GameObjects.Rectangle; fuelBar!: Phaser.GameObjects.Image; restoreHud!: Phaser.GameObjects.Text; restoreBoost!: Phaser.GameObjects.Rectangle; worldHud!: Phaser.GameObjects.Text; debugResources!: Phaser.GameObjects.Text;
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
    this.add.image(195, 43, UI_ASSETS.panels.hud.key).setDisplaySize(378, 54).setDepth(30).setAlpha(.96);
    hyperIcon(this, 25, 28, UI_ASSETS.icons.star.key, 24, 32);
    this.score = this.add.text(366, 14, '', { fontFamily: 'Arial', fontSize: '29px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(32);
    this.lives = this.add.text(42, 50, '', { fontFamily: 'Arial', fontSize: '10px', color: '#94a3b8', fontStyle: 'bold' }).setDepth(32);
    this.lifePips = [0, 1, 2].map(i => hyperIcon(this, 25 + i * 18, 59, UI_ASSETS.icons.badge.key, 18, 32));
    this.level = this.add.text(195, 24, '', { fontFamily: 'Arial', fontSize: '13px', color: '#e5e7eb', fontStyle: 'bold' }).setOrigin(.5).setDepth(32);
    this.streak = this.add.text(366, 48, '', { fontFamily: 'Arial', fontSize: '11px', color: '#fde047', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(32);
    this.fuelLabel = this.add.text(43, 18, '', { fontFamily: 'Arial', fontSize: '10px', color: '#d1fae5', fontStyle: 'bold' }).setDepth(32);
    this.fuelBar = this.add.image(80, 35, UI_ASSETS.panels.card.key).setDisplaySize(82, 22).setDepth(32);
    this.fuelFill = this.add.rectangle(45, 35, 70, 6, 0x22c55e, .95).setOrigin(0, .5).setDepth(33);
    this.restoreHud = this.add.text(195, 47, '', { fontFamily: 'Arial', fontSize: '10px', color: '#93c5fd', fontStyle: 'bold' }).setOrigin(.5).setDepth(32);
    this.restoreBoost = this.add.rectangle(165, 62, 60, 4, 0x38bdf8, .7).setOrigin(0, .5).setDepth(33);
    this.worldHud = this.add.text(366, 62, '', { fontFamily: 'Arial', fontSize: '10px', color: '#d1d5db', fontStyle: 'bold', align: 'right' }).setOrigin(1, 0).setDepth(32);
    this.debugResources = this.add.text(12, 116, '', { fontFamily: 'Arial', fontSize: '10px', color: '#e5e7eb', backgroundColor: 'rgba(2,6,23,.5)', padding: { x: 6, y: 4 } }).setDepth(91).setVisible(false);
    this.pauseBg = this.add.image(195, 805, UI_ASSETS.buttons.primary.key).setDisplaySize(130, 50).setDepth(59).setVisible(false);
    this.pause = this.add.text(195, 805, '', { fontFamily: 'Arial', fontSize: '14px', color: '#e5e7eb', padding: { x: 20, y: 8 }, fontStyle: 'bold', stroke: '#0f172a', strokeThickness: 3 }).setOrigin(.5).setDepth(60).setInteractive();
    this.pause.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); this.tweens.add({ targets: [this.pause, this.pauseBg], scale: .95, yoyo: true, duration: 70 }); if (this.playing) this.togglePause(); });
    this.status = this.add.text(195, 150, '', { fontFamily: 'Arial', fontSize: '20px', color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: { width: 340 } }).setOrigin(.5).setDepth(70);
    this.player = this.add.rectangle(this.lanes[1], AIRCRAFT_Y, 64, 64, C[1]).setStrokeStyle(4, 0xffffff, .95).setDepth(10);
    this.plane = this.add.image(this.player.x, this.player.y, TerrainAssets.plane).setDisplaySize(92, 92).setDepth(11).setVisible(false);
    this.aura = this.add.circle(this.player.x, this.player.y, 46, C[1], 0).setStrokeStyle(3, C[1], 0).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.rays = [-18, 0, 18].map((off, i) => this.add.rectangle(this.player.x + off, this.player.y + 24, 5, 70 + i * 10, C[1], 0).setAngle(off * .35).setDepth(8).setBlendMode(Phaser.BlendModes.ADD));
    this.gates = this.add.group();
    this.spawnDirector = new PickupSpawnDirector(this);
    this.onboarding = new RunOnboardingController(this, {
      lanes: this.lanes,
      gates: this.gates,
      moveToLane: lane => this.move(lane),
      collectFuel: gate => this.onboardingFuel(gate),
      onComplete: () => this.beginNormalGameplay()
    });
    this.onboarding.create();
    this.overlay = this.add.rectangle(195, 422, 390, 844, 0x020617, .86).setDepth(45).setVisible(false);
    this.shellPanel = hyperPanel(this, 195, 418, UI_ASSETS.panels.menu.key, 344, 49).setVisible(false);
    this.title = this.add.text(195, 205, 'COLOR\nLANE', { align: 'center', fontFamily: 'Arial', fontSize: '48px', color: '#fff', fontStyle: 'bold', wordWrap: { width: 360 } }).setOrigin(.5).setDepth(50);
    this.hint = this.add.text(195, 335, '', { align: 'center', fontFamily: 'Arial', fontSize: '16px', color: '#cbd5e1', lineSpacing: 7, wordWrap: { width: 340 } }).setOrigin(.5).setDepth(50);
    this.version = this.add.text(14, 820, 'v0.1.17 RC', { fontFamily: 'Arial', fontSize: '11px', color: '#64748b' }).setDepth(52).setVisible(false);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.playing || this.paused) return;
      const lane = Math.max(0, Math.min(2, Math.floor(p.worldX / 130)));
      if (this.onboarding.isActive()) {
        this.onboarding.handleLaneTap(lane);
        return;
      }
      this.move(lane);
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
    const noLabel = ['PLAY', 'LEADERBOARD', 'SHOP', 'SETTING', 'SETTINGS', 'RESUME', 'BACK'].some(x => clean === x);
    const b = hyperButton(this, 195, y, { variant, iconKey, width: Math.min(Math.max(w, 150), 230), label: noLabel ? undefined : clean, noLabel, onClick: cb });
    this.menu.push(b);
  }
  buttonVariant(clean: string): UIButtonVariant {
    if (clean.includes('PLAY') && !clean.includes('AGAIN')) return 'play';
    if (clean.includes('LEADERBOARD')) return 'leaderboard';
    if (clean === 'SHOP') return 'shop';
    if (clean.includes('SETTING')) return 'settings';
    if (clean.includes('RESUME')) return 'resume';
    if (clean.includes('BACK') || clean.includes('HOME')) return clean.includes('HOME') ? 'primary' : 'back';
    if (clean.includes('CREATE') || clean.includes('SIGN') || clean.includes('CONFIRM') || clean.includes('EQUIP') || clean.includes('UNLOCK')) return 'confirm';
    if (clean.includes('AGAIN') || clean.includes('RETRY')) return 'retry';
    return clean.includes('PLAY') ? 'gold' : 'primary';
  }
  buttonIcon(clean: string) {
    if (clean.includes('HOME')) return UI_ASSETS.icons.home.key;
    if (clean.includes('ACCOUNT') || clean.includes('SIGN') || clean.includes('CREATE')) return UI_ASSETS.icons.profile.key;
    if (clean.includes('SHOP')) return UI_ASSETS.icons.shop.key;
    if (clean.includes('SETTING')) return UI_ASSETS.icons.settings.key;
    if (clean.includes('HOW') || clean.includes('HELP')) return UI_ASSETS.icons.help.key;
    if (clean.includes('RANK') || clean.includes('LEADERBOARD')) return UI_ASSETS.icons.leaderboard.key;
    return undefined;
  }
  shell(on = true) { this.overlay.setVisible(on); this.shellPanel.setVisible(on); this.title.setVisible(on); this.hint.setVisible(on); }
  field(y: number, placeholder: string, type = 'text') {
    const el = document.createElement('input'); el.type = type; el.placeholder = placeholder; el.autocomplete = type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'nickname';
    Object.assign(el.style, { position: 'fixed', left: '50%', top: `calc(50% + ${y - 422}px)`, transform: 'translate(-50%,-50%)', width: '260px', height: '44px', boxSizing: 'border-box', padding: '0 14px', border: '2px solid #475569', borderRadius: '5px', background: '#0f172a', color: '#fff', fontSize: '16px', zIndex: '9999', outline: 'none' });
    document.body.appendChild(el); this.inputs.push(el); return el;
  }

  home() {
    Audio.stopMusic();
    this.onboarding?.cancel();
    this.shellPanel.setTexture(UI_ASSETS.panels.menu.key).setDisplaySize(344, 277);
    this.playing = false; this.paused = false; this.danger.setAlpha(0); this.clear(); this.gates.clear(true, true); this.player.setVisible(false); this.plane.setVisible(false); this.pause.setText(''); this.pauseBg.setVisible(false);
    this.lives.setText(''); this.level.setText(''); this.streak.setText(''); this.score.setText(''); this.fuelLabel.setText(''); this.fuelFill.setVisible(false); this.fuelBar.setVisible(false); this.restoreHud.setText(''); this.restoreBoost.setVisible(false); this.worldHud.setText(''); this.lifePips.forEach(p => p.setVisible(false)); this.debugResources.setVisible(false); this.shell(true);
    this.title.setFontSize(48).setText('COLOR\nLANE');
    this.hint.setText('BEST ' + Core.data.highScore + '  •  ' + Core.data.coins + ' COINS\n' + (Online.user ? 'SIGNED IN: ' + Online.name() : 'PLAYING AS GUEST') + '\n\nWORLD RESTORATION\n' + Core.data.worldRestorationPercent.toFixed(1) + '%');
    this.version.setVisible(true);
    this.btn(435, '▶  PLAY', () => Core.data.tutorialSeen ? this.start() : this.tutorial(0));
    this.btn(490, '🏆  LEADERBOARD', () => this.board());
    this.btn(545, Online.user ? '👤  ACCOUNT' : '👤  SIGN IN', () => this.account());
    this.btn(600, '★  SHOP', () => this.shop());
    this.btn(655, '⚙  SETTINGS', () => this.settings());
  }

  tutorial(step = 0) {
    this.onboarding?.cancel();
    this.playing = false; this.paused = false; this.clear(); this.gates.clear(true, true); this.player.setVisible(false); this.plane.setVisible(false); this.pause.setText(''); this.pauseBg.setVisible(false); this.shell(true);
    const pages = [
      ['HOW TO PLAY', 'MATCH THE COLOR\n\nA colored box falls down one of three lanes.\nMove your block into the SAME COLOR lane before it reaches the bottom.'],
      ['MOVE FAST', 'TAP A LANE\n\nTap the GREEN, BLUE or RED side of the screen to move instantly.\n\nWatch the next falling box — then choose its lane.'],
      ['BUILD MOMENTUM', 'KEEP MATCHING\n\nConsecutive catches build FLOW and ON FIRE streaks.\nLong streaks earn stronger rewards and feedback.'],
      ['GOLD = REWARD', 'CATCH ★ GOLD\n\nGold boxes can appear in ANY lane.\nCatch them for bonus coins and JACKPOT rewards.'],
      ['SURVIVE', 'YOU HAVE 3 LIVES\n\nMiss a colored box and you lose a life.\nDANGER ZONE means two remain.\nLAST FIGHT means one remains.'],
      ['READY?', 'MATCH. STREAK. SURVIVE.\n\nRead the falling box, move to its lane, and keep the run alive as the game gets faster.']
    ];
    const page = pages[Math.max(0, Math.min(step, pages.length - 1))];
    this.title.setFontSize(step === 0 ? 40 : 36).setText(page[0]); this.hint.setText(page[1]);
    if (step > 0) this.btn(610, '← BACK', () => this.tutorial(step - 1), 120);
    if (step < pages.length - 1) this.btn(610, 'NEXT →', () => this.tutorial(step + 1), 120);
    else this.btn(610, '▶ PLAY', () => { Core.markTutorial(); this.start(); }, 180);
    this.btn(675, '⌂ HOME', () => this.home(), 180);
  }

  account() {
    this.clear(); this.shell(true); this.title.setFontSize(42).setText(Online.user ? 'ACCOUNT' : 'GECO ACCOUNT');
    if (Online.user) { this.hint.setText(Online.name() + '\n' + Online.user.email + '\n\nYour best runs are submitted globally.'); this.btn(490, '🏆 VIEW RANK', () => this.board()); this.btn(550, 'SIGN OUT', async () => { await Online.signOut(); this.home(); }); this.btn(610, '← HOME', () => this.home()); return; }
    this.hint.setText('Sign in to join global rankings.\nGuest play remains available.'); this.btn(475, 'SIGN IN', () => this.authForm(false)); this.btn(535, 'CREATE ACCOUNT', () => this.authForm(true)); this.btn(600, '← HOME', () => this.home());
  }

  authForm(create: boolean, message = '') {
    this.clear(); this.shell(true); this.title.setFontSize(create ? 36 : 42).setText(create ? 'CREATE ACCOUNT' : 'SIGN IN'); this.hint.setText(message || (create ? 'Choose a player name, email and password.' : 'Enter your GECO account details.'));
    const name = create ? this.field(405, 'Player name (1-18 characters)') : null, email = this.field(create ? 465 : 425, 'Email address', 'email'), password = this.field(create ? 525 : 490, 'Password (minimum 6 characters)', 'password');
    this.btn(create ? 595 : 560, create ? 'CREATE ACCOUNT' : 'SIGN IN', async () => {
      const n = name?.value.trim() || '', e = email.value.trim(), p = password.value; this.blur();
      if (!e || p.length < 6 || (create && !n)) { this.hint.setText('CHECK YOUR DETAILS\nUse a valid email and password of at least 6 characters.'); return; }
      this.hint.setText(create ? 'CREATING ACCOUNT...' : 'SIGNING IN...');
      try {
        if (create) { const r = await Online.signUp(e, p, n); this.clear(); this.shell(true); this.title.setFontSize(38).setText(r.needsConfirmation ? 'CHECK YOUR EMAIL' : 'WELCOME!'); this.hint.setText(r.needsConfirmation ? 'We sent a confirmation link to\n' + e + '\n\nConfirm it, then return and sign in.' : 'Signed in as ' + Online.name()); this.btn(590, r.needsConfirmation ? 'BACK TO SIGN IN' : 'HOME', () => r.needsConfirmation ? this.authForm(false) : this.home()); }
        else { await Online.signIn(e, p); this.clear(); this.shell(true); this.title.setFontSize(42).setText('SIGNED IN'); this.hint.setText('WELCOME, ' + Online.name()); this.btn(590, 'CONTINUE', () => this.home()); }
      } catch (err: any) { const msg = String(err?.message || 'AUTHENTICATION FAILED').replace(/^AuthApiError:\s*/, '').slice(0, 100); this.hint.setText('ACCOUNT ERROR\n\n' + msg + '\n\nCorrect the details above and try again.'); }
    });
    this.btn(create ? 655 : 625, '← BACK', () => { this.blur(); this.account(); });
  }

  async board() {
    this.clear(); this.shell(true); this.title.setFontSize(38).setText('GLOBAL TOP 10'); this.hint.setText('LOADING...');
    try { const rows = await Online.top(10), rank = await Online.rank(); let text = rows.length ? rows.map((r, i) => (i + 1) + '. ' + r.display_name + '   ' + r.best_score).join('\n') : 'NO SCORES YET'; text += rank ? '\n\nYOUR RANK  #' + rank.rank + '   •   BEST ' + rank.score : Online.user ? '\n\nFINISH A RUN TO GET RANKED' : '\n\nSIGN IN TO JOIN THE RANKINGS'; this.hint.setText(text); }
    catch (e: any) { this.hint.setText('LEADERBOARD UNAVAILABLE\n' + String(e?.message || '').slice(0, 50)); }
    this.btn(690, '← HOME', () => this.home());
  }

  shop() {
    this.clear(); this.shell(true); this.title.setFontSize(40).setText('STYLE SHOP'); this.hint.setText('BALANCE ' + Core.data.coins + ' COINS');
    (['classic', 'sunset', 'neon'] as SkinId[]).forEach((s, i) => { const o = Core.data.unlocked.includes(s), sel = Core.data.skin === s; this.btn(440 + i * 58, (sel ? '✓ ' : o ? 'EQUIP ' : 'UNLOCK ') + s.toUpperCase() + (o ? '' : ' • ' + Core.price(s)), () => { Core.buy(s) ? this.shop() : this.flash('NEED MORE COINS', 500); }); });
    this.btn(640, '← HOME', () => this.home());
  }

  settings() {
    this.clear(); this.shell(true); this.title.setFontSize(40).setText('SETTINGS'); this.hint.setText('Preferences save automatically');
    this.btn(455, 'SOUND ' + (Core.data.sound ? 'ON' : 'OFF'), () => { Core.toggleSound(); Audio.syncMusicVolume(); this.settings(); });
    this.btn(515, 'VIBRATION ' + (Core.data.vibration ? 'ON' : 'OFF'), () => { Core.toggleVibration(); this.settings(); });
    this.btn(575, 'HOW TO PLAY', () => this.tutorial(0));
    this.btn(640, '← HOME', () => this.home());
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
    this.flightFuel.reset();
    this.restorePower.reset();
    this.restoreProgress.resetRun();
    this.spawnDirector.reset();
    this.pickups = { fuel: 0, water: 0, gold: 0 };
    this.distance = 0;
    this.displayedFuel = this.flightFuel.fuel;
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
    this.onboarding.start();
  }
  beginNormalGameplay() {
    if (!this.playing || this.paused) return;
    this.player.setPosition(this.lanes[1], AIRCRAFT_Y);
    this.lane = 1;
    this.flash('GO!', 420);
    this.cameras.main.flash(110, 120, 255, 170, false);
    this.spawn();
    this.schedule();
  }
  hud() {
    const s = this.run.snapshot();
    const fuel = Math.round(this.displayedFuel);
    const fuelColor = fuel < 10 ? 0xf43f5e : fuel < 25 ? 0xf97316 : fuel < 50 ? 0xfacc15 : 0x22c55e;
    this.lives.setText('LIVES');
    this.lifePips.forEach((pip, i) => pip.setVisible(true).setTint(i < s.lives ? 0x38bdf8 : 0x334155).setAlpha(i < s.lives ? .95 : .45));
    this.level.setText('LEVEL ' + s.level);
    this.streak.setText(s.streak >= 4 ? 'ON FIRE' : s.streak >= 2 ? 'FLOW' : '');
    this.score.setText(String(s.score));
    this.fuelLabel.setText('FUEL ' + fuel + '%');
    this.fuelFill.setVisible(true).setFillStyle(fuelColor, .95).width = 70 * fuel / 100;
    this.fuelBar.setVisible(true);
    this.restoreHud.setText('RESTORE ×' + this.restorePower.multiplier().toFixed(1));
    this.restoreBoost.setVisible(true).width = 60 * this.restorePower.boostRatio();
    this.worldHud.setText('WORLD\n' + this.restoreProgress.displayTotal.toFixed(1) + '%');
  }
  schedule() { if (!this.playing) return; this.time.delayedCall(this.spawnDelay, () => { if (this.playing && !this.paused) this.spawn(); this.schedule(); }); }
  choose() { return this.spawnDirector.next(this.run.level, this.run.score).lane; }
  spawn() {
    if (this.gates.getLength() >= 3) return;
    const pickup = this.spawnDirector.next(this.run.level, this.run.score);
    const l = pickup.lane;
    const children: Phaser.GameObjects.GameObject[] = [];
    if (pickup.type === 'goldCore') {
      const halo = this.add.circle(this.lanes[l], -38, 35, G, .14).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.circle(this.lanes[l], -38, 22, G, .95).setStrokeStyle(4, 0xffffff, .78).setBlendMode(Phaser.BlendModes.ADD);
      children.push(halo, core);
      this.tweens.add({ targets: [halo, core], scale: 1.12, angle: 180, yoyo: true, repeat: -1, duration: 380 });
    } else if (pickup.type === 'water') {
      const drop = this.add.circle(this.lanes[l], -38, 25, 0x38bdf8, .92).setScale(.82, 1.18).setStrokeStyle(4, 0xbff4ff, .75);
      const shine = this.add.circle(this.lanes[l] - 8, -50, 5, 0xffffff, .72);
      children.push(drop, shine);
    } else {
      children.push(this.add.image(this.lanes[l], -38, TerrainAssets.fuel).setDisplaySize(58, 58).setTint(C[l]));
    }
    const g = this.add.container(0, 0, children) as Gate;
    g.lane = l; g.pickupType = pickup.type; g.gold = pickup.type === 'goldCore'; g.setDepth(12).setScale(.7).setAlpha(0);
    this.tweens.add({ targets: g, scale: 1, alpha: 1, duration: 180, ease: 'Back.out' });
    this.gates.add(g);
  }
  visualUpdate(d: number) {
    this.visualTime += d;
    this.restoreProgress.updateDisplay();
    const onboardingActive = this.onboarding?.isActive();
    const terrainSpeed = onboardingActive ? 0 : this.speed;
    this.terrain.update(terrainSpeed, this.player.x, this.playing, this.paused || onboardingActive || (this.onboarding?.shouldFreezeWorld() ?? false), d);
    this.plane.setPosition(this.player.x, this.player.y).setVisible(this.playing);
    const s = this.run.streak, col = C[this.lane], aura = this.playing ? Math.min(.28, Math.max(0, (s - 2) * .045)) : 0;
    this.aura.setPosition(this.player.x, this.player.y).setFillStyle(col, aura * .22).setStrokeStyle(3 + Math.min(5, s), col, aura);
    this.aura.setScale(1 + Math.sin(this.visualTime / 180) * .04 + Math.min(.28, s * .015));
    this.rays.forEach((r, i) => r.setPosition(this.player.x + (i - 1) * 18, this.player.y + 35).setFillStyle(col, s >= 4 && this.playing ? Math.min(.18, .055 + s * .012) : 0).setScale(1, 1 + Math.sin(this.visualTime / 240 + i) * .16));
    if (this.playing && s >= 2 && this.visualTime > this.nextOrbitSpark) {
      this.nextOrbitSpark = this.visualTime + (s >= 4 ? 140 : 240);
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
    const l = this.run.level;
    Audio.setMusicPace(l);
    this.restorePower.update(d);
    this.speed = Math.min(540, 215 + (l - 1) * 28 + this.run.score * 1.2);
    this.spawnDelay = Math.max(650, 1200 - (l - 1) * 55);
    this.distance += this.speed * d / 1000;
    const multiplier = this.restorePower.multiplier();
    this.restoreProgress.add((GameplayBalanceConfig.restoration.passivePerSecond * d / 1000 + this.speed * d / 1000 * GameplayBalanceConfig.restoration.distancePerPixel) * multiplier);
    this.restoreProgress.checkMilestones().forEach(m => this.milestoneFx(m));
    this.displayedFuel += (this.flightFuel.fuel - this.displayedFuel) * .12;
    this.terrain.setRestorationPower(multiplier, this.restorePower.surgeMs > 0 ? this.restorePower.boostRatio() : 0);
    for (const o of [...this.gates.getChildren()] as Gate[]) {
      o.y += this.speed * d / 1000;
      if (o.gold && Phaser.Math.Between(1, 12) === 1) this.spark(this.lanes[o.lane!], o.y);
      if (o.y > PICKUP_Y && !o.getData('checked')) {
        o.setData('checked', true);
        this.resolvePickup(o);
      }
      if (o.y > 880) o.destroy();
    }
    if (DEBUG_RESOURCES) this.debugResources.setVisible(true).setText('Fuel ' + Math.round(this.flightFuel.fuel) + '\nWater ' + Math.ceil(this.restorePower.waterMs / 1000) + 's\nSurge ' + Math.ceil(this.restorePower.surgeMs / 1000) + 's\nRun +' + this.restoreProgress.runGain.toFixed(2) + '%\nTotal ' + Core.data.worldRestorationPercent.toFixed(2) + '%');
    else this.debugResources.setVisible(false);
    this.hud();
  }

  resolvePickup(o: Gate) {
    const type = o.pickupType || 'fuel';
    const matched = o.lane === this.lane;
    if (!matched) {
      type === 'fuel' ? this.miss(o) : o.destroy();
      return;
    }
    if (type === 'water') this.water(o);
    else if (type === 'goldCore') this.gold(o);
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
  ok(o: Gate) { const x = this.lanes[o.lane!]; o.destroy(); this.flightFuel.addFuel(); this.pickups.fuel++; this.restoreProgress.add(GameplayBalanceConfig.restoration.fuelCollect * this.restorePower.multiplier()); const r = this.run.catch(); Audio.catch(); this.floatText('+FUEL', x, 0x22c55e); this.tweens.add({ targets: [this.fuelFill, this.fuelBar], scaleY: 1.55, yoyo: true, duration: 95 }); const s = this.run.streak, big = r.bonus || s >= 4; this.burst(x, C[this.lane], r.bonus ? 24 : s >= 3 ? 20 : 16); this.streakFx(s); this.tweens.add({ targets: this.player, scaleX: r.bonus ? 1.38 : 1.17, scaleY: r.bonus ? .75 : .89, yoyo: true, duration: r.bonus ? 100 : 60 }); if (r.bonus) { this.cameras.main.flash(75, 120, 255, 170, false); this.flash('GREAT STREAK!', 540); } else if (s === 4) this.flash('ON FIRE!', 380); else if (s === 3) this.flash('GREAT CATCH!', 300); else if (s === 2) this.flash('NICE!', 220); else if (Phaser.Math.Between(1, 4) === 1) this.flash('GOOD CATCH!', 170); if (big) this.cameras.main.zoomTo(1.016, 80); if (big) this.time.delayedCall(90, () => this.cameras.main.zoomTo(1, 130)); if (r.levelUp) { Audio.level(); this.levelFx(); } this.hud(); }
  onboardingFuel(o: Gate) { const x = this.lanes[o.lane!]; o.destroy(); this.pickups.fuel++; const r = this.run.catch(); Audio.catch(); this.floatText('+FUEL', x, 0x22c55e); this.burst(x, C[this.lane], 16); if (r.levelUp) { Audio.level(); this.levelFx(); } this.hud(); }
  water(o: Gate) { const x = this.lanes[o.lane!]; o.destroy(); this.pickups.water++; this.restorePower.activateWater(); this.restoreProgress.add(GameplayBalanceConfig.restoration.waterCollect); this.run.score++; this.run.streak++; this.run.level = Math.floor(this.run.score / 10) + 1; Audio.water(); this.floatText('RESTORE BOOST', x, 0x38bdf8); this.burst(x, 0x38bdf8, 18); this.cameras.main.flash(70, 80, 220, 255, false); this.hud(); }
  gold(o: Gate) { const x = this.lanes[o.lane!]; o.destroy(); this.pickups.gold++; this.run.score++; this.run.coins += 5; this.run.level = Math.floor(this.run.score / 10) + 1; this.restorePower.activateSurge(); this.restoreProgress.add(Phaser.Math.FloatBetween(GameplayBalanceConfig.restoration.goldInstantMin, GameplayBalanceConfig.restoration.goldInstantMax)); Audio.surge(); this.surgeFx(x); this.flash('RESTORATION SURGE!', 650); this.hud(); }
  levelFx() { const t = this.add.text(195, 390, 'LEVEL ' + this.run.level + '!\nKEEP GOING!', { align: 'center', fontFamily: 'Arial', fontSize: '38px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(.5).setDepth(35).setAlpha(0).setScale(.5); const ring = this.add.circle(this.player.x, this.player.y, 28, 0xffffff, .05).setStrokeStyle(5, 0xffffff, .8).setDepth(24).setBlendMode(Phaser.BlendModes.ADD); const glow = this.add.rectangle(195, 422, 390, 844, C[this.lane], .06).setDepth(3).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() }); this.tweens.add({ targets: glow, alpha: 0, duration: 450, onComplete: () => glow.destroy() }); this.tweens.add({ targets: this.player, y: this.player.y - 12, yoyo: true, duration: 120, ease: 'Sine.easeOut' }); for (let i = 0; i < 18; i++) { const q = this.add.rectangle(this.player.x, this.player.y, 3, 8, C[i % 3], .86).setDepth(24).setAngle(Phaser.Math.Between(0, 180)).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: q, x: this.player.x + Phaser.Math.Between(-120, 120), y: this.player.y + Phaser.Math.Between(-95, 45), alpha: 0, scale: .3, duration: Phaser.Math.Between(320, 520), ease: 'Sine.easeOut', onComplete: () => q.destroy() }); } this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 180, yoyo: true, hold: 180, onComplete: () => t.destroy() }); this.cameras.main.zoomTo(1.025, 90); this.time.delayedCall(100, () => this.cameras.main.zoomTo(1, 140)); }
  miss(o: Gate) { const x = this.lanes[o.lane!]; o.destroy(); this.run.streak = 0; const lifeLost = this.flightFuel.missFuel(); const dead = lifeLost ? this.run.miss() : false; Audio.miss(); const warning = dead ? 'FIGHT OVER' : lifeLost ? (this.run.lives === 1 ? 'LAST FIGHT!' : this.run.lives === 2 ? 'DANGER ZONE!' : 'LIFE LOST!') : 'FUEL LOW!'; this.cameras.main.shake(dead ? 260 : lifeLost ? 135 : 80, dead ? .02 : lifeLost ? .011 : .006); this.cameras.main.flash(dead ? 130 : lifeLost ? 90 : 45, 255, 35, 60, false); const slash = this.add.rectangle(x, PICKUP_EFFECT_Y, 85, 8, 0xffffff, .9).setAngle(-35).setDepth(25); this.tweens.add({ targets: slash, alpha: 0, scaleX: 1.8, duration: 180, onComplete: () => slash.destroy() }); this.tweens.add({ targets: [this.fuelFill, this.fuelBar], x: '+=5', yoyo: true, repeat: 2, duration: 38 }); if (!dead && this.run.lives === 1) { this.danger.setAlpha(.055); this.tweens.add({ targets: this.danger, alpha: .13, yoyo: true, repeat: -1, duration: 520 }); } else if (!dead && this.run.lives === 2) this.danger.setAlpha(.025); this.flash(warning, dead ? 700 : lifeLost ? 560 : 260); this.hud(); if (dead) { Audio.stopMusic(); this.danger.setAlpha(.2); this.time.delayedCall(120, () => this.cameras.main.shake(280, .022)); this.playing = false; this.time.delayedCall(650, () => this.over()); } }
  togglePause() { this.paused = !this.paused; this.paused ? this.onboarding.pause() : this.onboarding.resume(); this.paused ? Audio.pauseMusic() : Audio.resumeMusic(); this.overlay.setVisible(this.paused).setAlpha(.78); this.status.setText(this.paused ? 'PAUSED' : '').setAlpha(this.paused ? 1 : 0); this.pause.setText(this.paused ? '▶ RESUME' : 'Ⅱ PAUSE'); if (!this.paused) this.overlay.setVisible(false); }
  flash(t: string, d: number) { this.status.setText(t).setAlpha(1).setScale(.82); this.tweens.add({ targets: this.status, alpha: 0, scale: 1.08, duration: d }); }

  async over() { Audio.stopMusic(); this.onboarding.cancel(); this.restoreProgress.checkMilestones().forEach(m => this.milestoneFx(m)); this.playing = false; this.paused = false; this.time.removeAllEvents(); this.tweens.killTweensOf(this.danger); this.danger.setAlpha(0); this.gates.clear(true, true); this.cameras.main.fade(260, 0, 0, 0); await new Promise(r => setTimeout(r, 270)); this.player.setVisible(false); this.plane.setVisible(false); const s = this.run.snapshot(); Core.finish(s.score, s.coins); let submitted = false, error = ''; if (Online.user) try { submitted = await Online.submit(s.score); } catch (e: any) { error = String(e?.message || 'UPLOAD FAILED'); } this.clear(); this.shell(true); this.cameras.main.fadeIn(220, 0, 0, 0); this.title.setFontSize(40).setText(s.score >= Core.data.highScore ? 'NEW BEST!' : 'RUN COMPLETE'); this.hint.setText('DISTANCE ' + Math.round(this.distance) + 'm\nSCORE ' + s.score + ' • BEST ' + Core.data.highScore + '\nFUEL CELLS ' + this.pickups.fuel + ' • WATER ' + this.pickups.water + ' • GOLD ' + this.pickups.gold + '\nRESTORED THIS RUN: +' + this.restoreProgress.runGain.toFixed(1) + '%\nWORLD RESTORATION: ' + Core.data.worldRestorationPercent.toFixed(1) + '%\n\n' + (Online.user ? (error ? 'SCORE SAVE FAILED' : submitted ? 'NEW GLOBAL BEST SUBMITTED' : 'GLOBAL BEST ALREADY HIGHER') : 'SIGN IN TO JOIN GLOBAL RANKINGS')); this.pause.setText(''); this.pauseBg.setVisible(false); this.btn(545, '▶ PLAY AGAIN', () => this.start()); this.btn(600, '🏆 LEADERBOARD', () => this.board()); this.btn(655, '⌂ HOME', () => this.home()); }
}
