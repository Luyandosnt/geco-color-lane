import Phaser from 'phaser';
import { FlightSpawn, HazardMovementType, HazardType } from './FlightPatternDirector';
import { TerrainAssets } from './TerrainRestorationManager';

export type HazardObject = Phaser.GameObjects.Container & {
  lane?: number;
  hazardType?: HazardType;
  movementType?: HazardMovementType;
  occupiedLanes?: number[];
  damage?: number;
  baseX?: number;
  motionPhase?: number;
  motionSpeed?: number;
  direction?: -1 | 1;
  warning?: Phaser.GameObjects.GameObject;
};

export class HazardController {
  constructor(private scene: Phaser.Scene, private lanes: number[]) {}

  create(spawn: FlightSpawn) {
    const lane = spawn.lane;
    const type = spawn.hazardType || 'corruptedWasp';
    const x = this.lanes[lane];
    const warningColor = type === 'pesticideCloud' ? 0xa855f7 : type === 'birdCrossing' ? 0xfacc15 : 0xf97316;
    const warning = this.scene.add.triangle(0, -55, 0, 18, 18, -14, -18, -14, warningColor, .88)
      .setStrokeStyle(3, 0x07111f, .9);
    const cue = this.scene.add.text(0, -87, type === 'birdCrossing' ? '!' : '!!', {
      fontFamily: 'Arial',
      fontSize: type === 'birdCrossing' ? '18px' : '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#020617',
      strokeThickness: 4
    }).setOrigin(.5);

    const spriteKey = type === 'pesticideCloud' ? TerrainAssets.cloud : type === 'birdCrossing' ? TerrainAssets.bird : TerrainAssets.wasp;
    const sprite = this.scene.add.image(0, 0, spriteKey);
    if (type === 'pesticideCloud') {
      sprite.setDisplaySize(86, 58).setAlpha(.88);
      const haze = this.scene.add.ellipse(0, 0, 96, 64, 0x39ff88, .12).setStrokeStyle(3, 0xa855f7, .45).setBlendMode(Phaser.BlendModes.ADD);
      const hazard = this.scene.add.container(x, spawn.offsetY, [haze, sprite, warning, cue]) as HazardObject;
      this.finishHazard(hazard, spawn, warning, cue, x);
      return hazard;
    }

    if (type === 'birdCrossing') {
      sprite.setDisplaySize(72, 50);
      const shadow = this.scene.add.ellipse(0, 28, 70, 14, 0x020617, .28);
      const hazard = this.scene.add.container(x + (spawn.direction === -1 ? 150 : -150), spawn.offsetY, [shadow, sprite, warning, cue]) as HazardObject;
      this.finishHazard(hazard, spawn, warning, cue, x);
      return hazard;
    }

    sprite.setDisplaySize(62, 62);
    const aura = this.scene.add.circle(0, 0, 38, 0xf97316, .1).setStrokeStyle(3, 0xa855f7, .45).setBlendMode(Phaser.BlendModes.ADD);
    const hazard = this.scene.add.container(x, spawn.offsetY, [aura, sprite, warning, cue]) as HazardObject;
    this.scene.tweens.add({ targets: sprite, angle: 8, yoyo: true, repeat: -1, duration: 220, ease: 'Sine.easeInOut' });
    this.finishHazard(hazard, spawn, warning, cue, x);
    return hazard;
  }

  update(hazard: HazardObject, elapsedMs: number) {
    if (hazard.baseX === undefined) return;
    const phase = (hazard.motionPhase || 0) + elapsedMs / (520 / (hazard.motionSpeed || 1));
    if (hazard.movementType === 'laneSweep') {
      const lanes = hazard.occupiedLanes?.length ? hazard.occupiedLanes : [hazard.lane || 1];
      const minX = this.lanes[Math.min(...lanes)];
      const maxX = this.lanes[Math.max(...lanes)];
      hazard.x = Phaser.Math.Linear(minX, maxX, (Math.sin(phase) + 1) / 2);
    } else if (hazard.movementType === 'slowDrift') {
      hazard.x = Phaser.Math.Clamp(hazard.baseX + Math.sin(phase * .65) * 22, 34, 356);
    } else if (hazard.movementType === 'horizontalCross') {
      const direction = hazard.direction || 1;
      hazard.x += direction * (1.8 + (hazard.motionSpeed || 1)) * 2.2;
      hazard.setAngle(direction * -5);
    } else if (hazard.movementType === 'diagonalCross') {
      const direction = hazard.direction || 1;
      hazard.x += direction * (1.4 + (hazard.motionSpeed || 1)) * 1.8;
      hazard.y += 1.1;
      hazard.setAngle(direction * -12);
    }

    if (hazard.warning && hazard.y > 108) hazard.warning.setVisible(false);
  }

  private finishHazard(
    hazard: HazardObject,
    spawn: FlightSpawn,
    warning: Phaser.GameObjects.GameObject,
    cue: Phaser.GameObjects.GameObject,
    baseX: number
  ) {
    hazard.lane = spawn.lane;
    hazard.hazardType = spawn.hazardType || 'corruptedWasp';
    hazard.movementType = spawn.movementType;
    hazard.occupiedLanes = spawn.occupiedLanes || [spawn.lane];
    hazard.damage = spawn.damage || 1;
    hazard.baseX = baseX;
    hazard.motionPhase = Math.random() * Math.PI * 2;
    hazard.motionSpeed = spawn.speed || 1;
    hazard.direction = spawn.direction || 1;
    hazard.warning = warning;
    hazard.setSize(84, 74);
    hazard.setDepth(13);
    this.scene.tweens.add({ targets: [warning, cue], alpha: .35, yoyo: true, repeat: -1, duration: Math.max(220, (spawn.warningTimeMs || 600) / 2) });
  }
}
