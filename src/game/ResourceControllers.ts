import { Core } from '../core/Core';
import { GameplayBalanceConfig } from './GameplayBalanceConfig';

export class FlightFuelController {
  fuel = GameplayBalanceConfig.fuel.start;

  reset() {
    this.fuel = GameplayBalanceConfig.fuel.start;
  }

  addFuel() {
    const before = this.fuel;
    this.fuel = Math.min(GameplayBalanceConfig.fuel.max, this.fuel + GameplayBalanceConfig.fuel.gain);
    return this.fuel - before;
  }

  missFuel() {
    this.fuel = Math.max(0, this.fuel - GameplayBalanceConfig.fuel.missLoss);
    if (this.fuel > 0) return false;
    this.fuel = GameplayBalanceConfig.fuel.refillAfterLifeLoss;
    return true;
  }

  percent() {
    return Math.round(this.fuel);
  }
}

export class RestorationPowerController {
  waterMs = 0;
  surgeMs = 0;

  reset() {
    this.waterMs = 0;
    this.surgeMs = 0;
  }

  update(delta: number) {
    this.waterMs = Math.max(0, this.waterMs - delta);
    this.surgeMs = Math.max(0, this.surgeMs - delta);
  }

  activateWater() {
    this.waterMs = GameplayBalanceConfig.water.durationMs;
  }

  activateSurge() {
    this.surgeMs = GameplayBalanceConfig.surge.durationMs;
  }

  multiplier() {
    if (this.surgeMs > 0) return GameplayBalanceConfig.surge.multiplier;
    if (this.waterMs > 0) return GameplayBalanceConfig.water.multiplier;
    return 1;
  }

  boostRatio() {
    if (this.surgeMs > 0) return this.surgeMs / GameplayBalanceConfig.surge.durationMs;
    if (this.waterMs > 0) return this.waterMs / GameplayBalanceConfig.water.durationMs;
    return 0;
  }
}

export class RestorationProgressController {
  runGain = 0;
  displayTotal = 0;

  resetRun() {
    this.runGain = 0;
    this.displayTotal = Core.data.worldRestorationPercent;
  }

  add(amount: number) {
    const before = Core.data.worldRestorationPercent;
    Core.data.worldRestorationPercent = Math.min(100, Math.max(0, before + amount));
    const gained = Core.data.worldRestorationPercent - before;
    if (gained > 0) {
      this.runGain += gained;
      Core.save();
    }
    return gained;
  }

  updateDisplay() {
    this.displayTotal += (Core.data.worldRestorationPercent - this.displayTotal) * .08;
  }

  checkMilestones() {
    const hit: number[] = [];
    for (const milestone of GameplayBalanceConfig.restoration.milestones) {
      if (Core.data.worldRestorationPercent >= milestone && !Core.data.claimedRestorationMilestones.includes(milestone)) {
        Core.data.claimedRestorationMilestones.push(milestone);
        hit.push(milestone);
      }
    }
    if (hit.length) Core.save();
    return hit;
  }
}
