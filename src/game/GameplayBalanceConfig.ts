export const DEBUG_RESOURCES = false;

export const GameplayBalanceConfig = {
  fuel: {
    max: 100,
    start: 100,
    gain: 10,
    missLoss: 22,
    refillAfterLifeLoss: 50
  },
  restoration: {
    passivePerSecond: .0022,
    distancePerPixel: .000004,
    fuelCollect: .015,
    waterCollect: .045,
    goldInstantMin: 3,
    goldInstantMax: 5,
    milestones: [10, 25, 50, 75, 100]
  },
  water: {
    multiplier: 1.6,
    durationMs: 4000
  },
  surge: {
    multiplier: 3,
    durationMs: 3000
  },
  pickups: {
    waterChance: .18,
    goldChance: .018,
    minGoldGapMs: 45000,
    maxNonFuelStreak: 2
  }
};
