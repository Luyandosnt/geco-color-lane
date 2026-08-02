import Phaser from 'phaser';
import { Audio } from '../core/Audio';
import { AIRCRAFT_Y, PICKUP_Y, TerrainAssets } from './TerrainRestorationManager';

type Gate = Phaser.GameObjects.Container & { lane?: number; gold?: boolean };
type OnboardingState = 'idle' | 'moveFirst' | 'moveOpposite' | 'spawnFuel' | 'waitForCenter' | 'collectFuel' | 'countdown' | 'complete';

type RunOnboardingConfig = {
  lanes: number[];
  gates: Phaser.GameObjects.Group;
  moveToLane: (lane: number) => void;
  collectFuel: (gate: Gate) => void;
  onComplete: () => void;
};

export class RunOnboardingController {
  private scene: Phaser.Scene;
  private config: RunOnboardingConfig;
  private state: OnboardingState = 'idle';
  private firstTarget = 0;
  private secondTarget = 2;
  private currentTarget = 0;
  private label!: Phaser.GameObjects.Text;
  private hand!: Phaser.GameObjects.Text;
  private ring!: Phaser.GameObjects.Arc;
  private lanePulse!: Phaser.GameObjects.Rectangle;
  private countdownText: Phaser.GameObjects.Text | null = null;
  private fuel: Gate | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  private paused = false;
  private fuelSpeed = 260;
  private stopY = PICKUP_Y - 36;

  constructor(scene: Phaser.Scene, config: RunOnboardingConfig) {
    this.scene = scene;
    this.config = config;
  }

  create() {
    this.lanePulse = this.scene.add.rectangle(0, AIRCRAFT_Y - 8, 112, 104, 0xffffff, 0)
      .setStrokeStyle(3, 0xffffff, 0)
      .setDepth(39)
      .setVisible(false);
    this.ring = this.scene.add.circle(0, 742, 24, 0x38bdf8, .04)
      .setStrokeStyle(4, 0x38bdf8, .7)
      .setDepth(40)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.hand = this.scene.add.text(0, 728, 'TAP', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 5
    }).setOrigin(.5).setDepth(41).setVisible(false);
    this.label = this.scene.add.text(195, 666, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#020617',
      strokeThickness: 5,
      wordWrap: { width: 320 }
    }).setOrigin(.5).setDepth(41).setVisible(false);
  }

  start() {
    this.cancel(false);
    this.state = 'moveFirst';
    this.paused = false;
    this.firstTarget = Phaser.Math.Between(0, 1) === 0 ? 0 : 2;
    this.secondTarget = this.firstTarget === 0 ? 2 : 0;
    this.setTarget(this.firstTarget, 'TAP THIS LANE');
  }

  handleLaneTap(lane: number) {
    if (!this.isActive() || this.paused) return true;
    if (this.state === 'spawnFuel') {
      this.rejectTap();
      return true;
    }

    if ((this.state === 'moveFirst' || this.state === 'moveOpposite' || this.state === 'waitForCenter') && lane !== this.currentTarget) {
      this.rejectTap();
      return true;
    }

    if (this.state === 'moveFirst') {
      this.config.moveToLane(lane);
      this.state = 'moveOpposite';
      this.queue(170, () => this.setTarget(this.secondTarget, 'NOW TAP HERE'));
    } else if (this.state === 'moveOpposite') {
      this.config.moveToLane(lane);
      this.state = 'spawnFuel';
      this.hidePrompt();
      this.queue(260, () => this.spawnFuel());
    } else if (this.state === 'waitForCenter') {
      this.config.moveToLane(1);
      this.state = 'collectFuel';
      this.hidePrompt();
      this.queue(150, () => this.finishFuel());
    }

    return true;
  }

  update(delta: number) {
    if (!this.isActive() || this.paused) return;
    if (this.state === 'spawnFuel' && this.fuel) {
      this.fuel.y = Math.min(this.stopY, this.fuel.y + this.fuelSpeed * delta / 1000);
      if (this.fuel.y >= this.stopY) {
        this.state = 'waitForCenter';
        this.setTarget(1, 'MOVE TO THE CENTER', true);
      }
    }
  }

  pause() {
    if (!this.isActive()) return;
    this.paused = true;
    this.timers.forEach(timer => timer.paused = true);
    this.scene.tweens.pauseTweensOf(this.targets());
  }

  resume() {
    if (!this.isActive()) return;
    this.paused = false;
    this.timers.forEach(timer => timer.paused = false);
    this.scene.tweens.resumeTweensOf(this.targets());
  }

  cancel(hide = true) {
    this.timers.forEach(timer => timer.remove(false));
    this.timers = [];
    if (this.fuel) {
      this.fuel.destroy();
      this.fuel = null;
    }
    if (this.countdownText) {
      this.countdownText.destroy();
      this.countdownText = null;
    }
    this.scene.tweens.killTweensOf(this.targets());
    this.paused = false;
    this.state = 'idle';
    if (hide) this.hidePrompt();
  }

  isActive() {
    return this.state !== 'idle' && this.state !== 'complete';
  }

  isComplete() {
    return this.state === 'complete';
  }

  shouldFreezeWorld() {
    return this.state === 'waitForCenter' || this.state === 'countdown';
  }

  private setTarget(lane: number, text: string, centerHighlight = false) {
    this.currentTarget = lane;
    const x = this.config.lanes[lane];
    this.label.setText(text).setPosition(x, centerHighlight ? AIRCRAFT_Y - 126 : 690).setAlpha(1).setVisible(true);
    this.hand.setPosition(x, 738).setAlpha(1).setScale(1).setVisible(true);
    this.ring.setPosition(x, 748).setAlpha(.72).setScale(.65).setVisible(true);
    this.lanePulse.setPosition(x, centerHighlight ? AIRCRAFT_Y - 44 : 742)
      .setFillStyle(centerHighlight ? 0x38bdf8 : 0xffffff, centerHighlight ? .045 : 0)
      .setStrokeStyle(3, centerHighlight ? 0x38bdf8 : 0xffffff, centerHighlight ? .42 : 0)
      .setVisible(true);
    this.scene.tweens.killTweensOf([this.hand, this.ring, this.lanePulse]);
    this.scene.tweens.add({ targets: [this.hand, this.ring], y: '-=12', yoyo: true, repeat: -1, duration: 430, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: this.hand, scale: .94, yoyo: true, repeat: -1, duration: 430, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: this.ring, scale: 1.85, alpha: 0, repeat: -1, duration: 860, ease: 'Sine.easeOut' });
    if (centerHighlight) this.scene.tweens.add({ targets: this.lanePulse, alpha: .9, yoyo: true, repeat: -1, duration: 540, ease: 'Sine.easeInOut' });
  }

  private hidePrompt() {
    this.label?.setVisible(false);
    this.hand?.setVisible(false);
    this.ring?.setVisible(false);
    this.lanePulse?.setVisible(false);
  }

  private rejectTap() {
    Audio.miss();
    this.scene.tweens.add({ targets: this.hand, x: this.hand.x - 8, yoyo: true, repeat: 2, duration: 45 });
    this.scene.tweens.add({ targets: this.ring, alpha: .95, scale: 1.2, yoyo: true, duration: 95 });
  }

  private spawnFuel() {
    if (this.state !== 'spawnFuel') return;
    const startY = 305;
    const sprite = this.scene.add.image(this.config.lanes[1], startY, TerrainAssets.fuel)
      .setDisplaySize(58, 58)
      .setTint(0x3b82f6);
    const glow = this.scene.add.circle(this.config.lanes[1], startY, 35, 0x38bdf8, .1)
      .setStrokeStyle(3, 0x8bf0d1, .55)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.fuel = this.scene.add.container(0, 0, [glow, sprite]) as Gate;
    this.fuel.lane = 1;
    this.fuel.gold = false;
    this.fuel.setDepth(12);
    this.fuel.setData('onboarding', true);
    this.config.gates.add(this.fuel);
    this.scene.tweens.add({ targets: glow, scale: 1.16, alpha: .2, yoyo: true, repeat: -1, duration: 380 });
    this.setTarget(1, 'PICK UP THE FUEL CELL');
  }

  private finishFuel() {
    if (!this.fuel) return;
    const fuel = this.fuel;
    this.fuel = null;
    this.scene.tweens.add({
      targets: fuel,
      y: PICKUP_Y,
      duration: 130,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.config.collectFuel(fuel);
        this.label.setText('FUEL COLLECTED!').setPosition(195, AIRCRAFT_Y - 130).setVisible(true).setAlpha(1).setScale(.9);
        this.scene.tweens.add({ targets: this.label, scale: 1.04, alpha: 0, duration: 260, ease: 'Sine.easeOut' });
        this.queue(160, () => this.countdown());
      }
    });
  }

  private countdown() {
    this.state = 'countdown';
    this.hidePrompt();
    const values = ['3', '2', '1', 'GO!'];
    const text = this.scene.add.text(195, 410, '', {
      fontFamily: 'Arial',
      fontSize: '58px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(.5).setDepth(42);
    this.countdownText = text;
    values.forEach((value, index) => {
      this.queue(index * 560, () => {
        text.setText(value).setAlpha(1).setScale(.72);
        Audio.catch();
        this.scene.tweens.add({ targets: text, scale: 1.16, alpha: 0, duration: 520, ease: 'Cubic.easeOut' });
      });
    });
    this.queue(values.length * 560, () => {
      text.destroy();
      this.countdownText = null;
      this.state = 'complete';
      this.config.onComplete();
    });
  }

  private queue(delay: number, callback: () => void) {
    const timer = this.scene.time.delayedCall(delay, callback);
    timer.paused = this.paused;
    this.timers.push(timer);
  }

  private targets() {
    return [this.label, this.hand, this.ring, this.lanePulse, this.fuel, this.countdownText].filter(Boolean) as Phaser.GameObjects.GameObject[];
  }
}
