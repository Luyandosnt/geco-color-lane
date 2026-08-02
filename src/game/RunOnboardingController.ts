import Phaser from 'phaser';
import { Audio } from '../core/Audio';
import { AIRCRAFT_Y, PICKUP_Y, TerrainAssets } from './TerrainRestorationManager';

type Gate = Phaser.GameObjects.Container & { lane?: number; gold?: boolean; kind?: 'pickup' | 'hazard'; pickupType?: 'pollen'; hazardType?: 'corruptedWasp' };
type OnboardingState = 'idle' | 'moveFirst' | 'moveOpposite' | 'spawnPollen' | 'waitForCenter' | 'dodgeHazard' | 'countdown' | 'complete';

type RunOnboardingConfig = {
  lanes: number[];
  gates: Phaser.GameObjects.Group;
  getCurrentLane: () => number;
  moveToLane: (lane: number) => void;
  collectFuel: (gate: Gate) => void;
  hitHazard: (gate: Gate) => void;
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
  private tutorialGates: Gate[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private paused = false;
  private fuelSpeed = 260;
  private stopY = AIRCRAFT_Y - 104;

  constructor(scene: Phaser.Scene, config: RunOnboardingConfig) {
    this.scene = scene;
    this.config = config;
  }

  create() {
    this.lanePulse = this.scene.add.rectangle(0, AIRCRAFT_Y - 8, 118, 112, 0xffffff, 0)
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
    if (this.state === 'spawnPollen') {
      this.rejectTap();
      return true;
    }

    if ((this.state === 'moveFirst' || this.state === 'moveOpposite' || this.state === 'waitForCenter' || this.state === 'dodgeHazard') && lane !== this.currentTarget) {
      this.rejectTap();
      return true;
    }

    if (this.state === 'moveFirst') {
      this.config.moveToLane(lane);
      this.state = 'moveOpposite';
      this.queue(170, () => this.setTarget(this.secondTarget, 'NOW TAP HERE'));
    } else if (this.state === 'moveOpposite') {
      this.config.moveToLane(lane);
      this.state = 'spawnPollen';
      this.hidePrompt();
      this.queue(220, () => this.spawnFuel());
    } else if (this.state === 'waitForCenter') {
      this.config.moveToLane(1);
      this.hidePrompt();
    } else if (this.state === 'dodgeHazard') {
      this.config.moveToLane(lane);
      this.hidePrompt();
    }

    return true;
  }

  update(delta: number) {
    if (!this.isActive() || this.paused) return;
    if ((this.state === 'spawnPollen' || this.state === 'waitForCenter' || this.state === 'dodgeHazard') && this.tutorialGates.length) {
      for (const gate of [...this.tutorialGates]) {
        gate.y += this.fuelSpeed * delta / 1000;
        if (gate.kind === 'pickup' && gate.y >= PICKUP_Y && !gate.getData('checked')) {
          if (this.config.getCurrentLane() === gate.lane) {
            gate.setData('checked', true);
            this.tutorialGates = this.tutorialGates.filter(x => x !== gate);
            this.config.collectFuel(gate);
          } else {
            gate.y = PICKUP_Y - 22;
            this.state = 'waitForCenter';
            this.setTarget(1, 'MOVE TO THE CENTER', true);
          }
        } else if (gate.kind === 'hazard' && gate.y >= PICKUP_Y && !gate.getData('checked')) {
          gate.setData('checked', true);
          this.tutorialGates = this.tutorialGates.filter(x => x !== gate);
          if (gate.lane === this.config.getCurrentLane()) {
            this.config.hitHazard(gate);
            this.queue(280, () => this.countdown());
          } else {
            gate.destroy();
            this.queue(140, () => this.countdown());
          }
        }
        if (gate.y > 880) {
          this.tutorialGates = this.tutorialGates.filter(x => x !== gate);
          gate.destroy();
        }
      }
      if (this.state === 'spawnPollen' && this.tutorialGates.some(gate => gate.kind === 'pickup' && gate.y >= this.stopY)) {
        this.state = 'waitForCenter';
        this.setTarget(1, 'MOVE TO THE CENTER', true);
      }
      if (this.state === 'waitForCenter' && !this.tutorialGates.some(gate => gate.kind === 'pickup')) this.spawnObstacle();
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
    this.tutorialGates.forEach(gate => gate.destroy());
    this.tutorialGates = [];
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
    return this.state === 'waitForCenter' || this.state === 'dodgeHazard' || this.state === 'countdown';
  }

  private setTarget(lane: number, text: string, centerHighlight = false) {
    this.currentTarget = lane;
    const x = this.config.lanes[lane];
    this.label.setText(text).setPosition(x, centerHighlight ? this.stopY - 86 : 628).setAlpha(1).setVisible(true);
    this.hand.setPosition(x, centerHighlight ? AIRCRAFT_Y + 72 : 690).setAlpha(1).setScale(1).setVisible(true);
    this.ring.setPosition(x, centerHighlight ? AIRCRAFT_Y + 82 : 700).setAlpha(.72).setScale(.65).setVisible(true);
    this.lanePulse.setPosition(x, centerHighlight ? this.stopY : 692)
      .setAlpha(1)
      .setFillStyle(centerHighlight ? 0x38bdf8 : 0xffffff, centerHighlight ? .035 : 0)
      .setStrokeStyle(centerHighlight ? 4 : 3, centerHighlight ? 0x38bdf8 : 0xffffff, centerHighlight ? .78 : 0)
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
    if (this.state !== 'spawnPollen') return;
    const startY = 250;
    for (let i = 0; i < 5; i++) {
      const sprite = this.scene.add.image(0, 0, TerrainAssets.fuel).setDisplaySize(44, 44);
      const glow = this.scene.add.circle(0, 0, 28, 0xfef9c3, .12).setBlendMode(Phaser.BlendModes.ADD);
      const gate = this.scene.add.container(this.config.lanes[1], startY - i * 70, [glow, sprite]) as Gate;
      gate.lane = 1;
      gate.kind = 'pickup';
      gate.pickupType = 'pollen';
      gate.setDepth(12);
      gate.setData('onboarding', true);
      this.tutorialGates.push(gate);
      this.config.gates.add(gate);
      this.scene.tweens.add({ targets: glow, scale: 1.16, alpha: .22, yoyo: true, repeat: -1, duration: 380 });
    }
    this.setTarget(1, 'PICK UP THE POLLEN');
  }

  private spawnObstacle() {
    if (this.state !== 'waitForCenter') return;
    const hazardLane = 1;
    const safeLane = this.firstTarget;
    const warn = this.scene.add.triangle(0, -42, 0, 18, 18, -14, -18, -14, 0xfacc15, .86).setStrokeStyle(3, 0x111827, .8);
    const waspGlow = this.scene.add.circle(0, 0, 38, 0xf97316, .1).setStrokeStyle(3, 0xa855f7, .45).setBlendMode(Phaser.BlendModes.ADD);
    const wasp = this.scene.add.image(0, 0, TerrainAssets.wasp).setDisplaySize(62, 62);
    const gate = this.scene.add.container(this.config.lanes[hazardLane], 275, [waspGlow, wasp, warn]) as Gate;
    gate.lane = hazardLane;
    gate.kind = 'hazard';
    gate.hazardType = 'corruptedWasp';
    gate.setDepth(13);
    gate.setData('onboarding', true);
    this.tutorialGates.push(gate);
    this.config.gates.add(gate);
    this.scene.tweens.add({ targets: wasp, angle: 8, yoyo: true, repeat: -1, duration: 220, ease: 'Sine.easeInOut' });
    this.state = 'dodgeHazard';
    this.setTarget(safeLane, 'DODGE THE HAZARD');
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
    return [this.label, this.hand, this.ring, this.lanePulse, this.fuel, this.countdownText, ...this.tutorialGates].filter(Boolean) as Phaser.GameObjects.GameObject[];
  }
}
