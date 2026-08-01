import Phaser from 'phaser';
import { GameplayBalanceConfig } from './GameplayBalanceConfig';

export type PickupType = 'fuel' | 'water' | 'goldCore';

export type PickupSpawn = {
  type: PickupType;
  lane: number;
};

export class PickupSpawnDirector {
  private scene: Phaser.Scene;
  private nonFuelStreak = 0;
  private lastGoldAt = -999999;
  private pattern: number[] = [];
  private patternIndex = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  reset() {
    this.nonFuelStreak = 0;
    this.lastGoldAt = -999999;
    this.pattern = [];
    this.patternIndex = 0;
  }

  next(level: number, score: number): PickupSpawn {
    const lane = this.nextLane(level);
    const now = this.scene.time.now;
    let type: PickupType = 'fuel';

    if (this.nonFuelStreak < GameplayBalanceConfig.pickups.maxNonFuelStreak) {
      const roll = Math.random();
      const goldReady = score >= 8 && now - this.lastGoldAt >= GameplayBalanceConfig.pickups.minGoldGapMs;
      if (goldReady && roll < GameplayBalanceConfig.pickups.goldChance) {
        type = 'goldCore';
        this.lastGoldAt = now;
      } else if (roll < GameplayBalanceConfig.pickups.goldChance + GameplayBalanceConfig.pickups.waterChance) {
        type = 'water';
      }
    }

    this.nonFuelStreak = type === 'fuel' ? 0 : this.nonFuelStreak + 1;
    return { type, lane };
  }

  private nextLane(level: number) {
    if (this.patternIndex >= this.pattern.length) {
      if (level < 3) this.pattern = [Phaser.Math.Between(0, 2)];
      else {
        const a = Phaser.Math.Between(0, 2);
        const b = (a + Phaser.Math.Between(1, 2)) % 3;
        this.pattern = level < 7 ? [a, b, a] : [a, (a + 1) % 3, (a + 2) % 3];
      }
      this.patternIndex = 0;
    }
    return this.pattern[this.patternIndex++];
  }
}
