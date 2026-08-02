export type PollenFormationId =
  | 'straight'
  | 'shortLine'
  | 'longLine'
  | 'zigzag'
  | 'leftToCenter'
  | 'rightToCenter'
  | 'centerToLeft'
  | 'centerToRight'
  | 'threeLaneWave'
  | 'splitRoute';

export type FlightPickupType = 'pollen' | 'nectar' | 'goldenPollen';
export type HazardType = 'corruptedWasp' | 'pesticideCloud' | 'birdCrossing';
export type HazardMovementType = 'laneSweep' | 'slowDrift' | 'horizontalCross' | 'diagonalCross';

export type HazardDefinition = {
  id: HazardType;
  movementType: HazardMovementType;
  occupiedLanes: number[];
  warningTimeMs: number;
  damage: number;
  speed: number;
  regionTags: string[];
};

export type FlightSpawn = {
  kind: 'pickup' | 'hazard';
  lane: number;
  offsetY: number;
  pickupType?: FlightPickupType;
  hazardType?: HazardType;
  movementType?: HazardMovementType;
  occupiedLanes?: number[];
  warningTimeMs?: number;
  damage?: number;
  speed?: number;
  direction?: -1 | 1;
};

export type FlightPatternDefinition = {
  id: string;
  difficulty: number;
  minimumDistance: number;
  length: number;
  regionTags: string[];
  weight: number;
  pollen: FlightSpawn[];
  hazards: FlightSpawn[];
};

const SPACING = 82;

export const HAZARD_DEFINITIONS: Record<HazardType, HazardDefinition> = {
  corruptedWasp: {
    id: 'corruptedWasp',
    movementType: 'laneSweep',
    occupiedLanes: [1],
    warningTimeMs: 700,
    damage: 1,
    speed: 1,
    regionTags: ['enemy', 'airborne']
  },
  pesticideCloud: {
    id: 'pesticideCloud',
    movementType: 'slowDrift',
    occupiedLanes: [1],
    warningTimeMs: 850,
    damage: 1,
    speed: .45,
    regionTags: ['toxic', 'airborne']
  },
  birdCrossing: {
    id: 'birdCrossing',
    movementType: 'horizontalCross',
    occupiedLanes: [1],
    warningTimeMs: 500,
    damage: 1,
    speed: 1.65,
    regionTags: ['enemy', 'fast', 'airborne']
  }
};

function pollen(lane: number, index: number, type: FlightPickupType = 'pollen'): FlightSpawn {
  return { kind: 'pickup', lane, offsetY: -80 - index * SPACING, pickupType: type };
}

function hazard(lane: number, index: number, hazardType: HazardType, overrides: Partial<FlightSpawn> = {}): FlightSpawn {
  const definition = HAZARD_DEFINITIONS[hazardType];
  return {
    kind: 'hazard',
    lane,
    offsetY: -140 - index * SPACING,
    hazardType,
    movementType: overrides.movementType || definition.movementType,
    occupiedLanes: overrides.occupiedLanes || definition.occupiedLanes,
    warningTimeMs: overrides.warningTimeMs || definition.warningTimeMs,
    damage: overrides.damage || definition.damage,
    speed: overrides.speed || definition.speed,
    direction: overrides.direction,
  };
}

const formations: Record<PollenFormationId, number[]> = {
  straight: [1, 1, 1, 1, 1],
  shortLine: [0, 0, 0],
  longLine: [2, 2, 2, 2, 2, 2, 2, 2],
  zigzag: [0, 1, 2, 1, 0, 1, 2],
  leftToCenter: [0, 0, 1, 1, 1],
  rightToCenter: [2, 2, 1, 1, 1],
  centerToLeft: [1, 1, 0, 0, 0],
  centerToRight: [1, 1, 2, 2, 2],
  threeLaneWave: [0, 1, 2, 1, 0, 1, 2, 1],
  splitRoute: [0, 0, 1, 2, 2, 1, 0, 2]
};

function formation(id: PollenFormationId, specialAtEnd: FlightPickupType | null = null) {
  const lanes = formations[id];
  return lanes.map((lane, index) => pollen(lane, index, specialAtEnd && index === lanes.length - 1 ? specialAtEnd : 'pollen'));
}

export const FLIGHT_PATTERNS: FlightPatternDefinition[] = [
  {
    id: 'calm-center-line',
    difficulty: 1,
    minimumDistance: 0,
    length: 560,
    regionTags: ['early', 'safe'],
    weight: 6,
    pollen: formation('straight'),
    hazards: [hazard(0, 7, 'pesticideCloud', { occupiedLanes: [0] })]
  },
  {
    id: 'left-pollen-safe-right',
    difficulty: 1,
    minimumDistance: 0,
    length: 520,
    regionTags: ['early'],
    weight: 5,
    pollen: formation('leftToCenter'),
    hazards: [hazard(2, 6, 'pesticideCloud', { occupiedLanes: [2] })]
  },
  {
    id: 'right-pollen-safe-left',
    difficulty: 1,
    minimumDistance: 0,
    length: 520,
    regionTags: ['early'],
    weight: 5,
    pollen: formation('rightToCenter'),
    hazards: [hazard(0, 6, 'pesticideCloud', { occupiedLanes: [0] })]
  },
  {
    id: 'zigzag-around-cloud',
    difficulty: 2,
    minimumDistance: 500,
    length: 720,
    regionTags: ['mid', 'curve'],
    weight: 5,
    pollen: formation('zigzag', 'nectar'),
    hazards: [hazard(2, 4, 'pesticideCloud', { occupiedLanes: [2] }), hazard(0, 8, 'pesticideCloud', { occupiedLanes: [0] })]
  },
  {
    id: 'wave-and-cloud',
    difficulty: 2,
    minimumDistance: 900,
    length: 820,
    regionTags: ['mid', 'hazard'],
    weight: 4,
    pollen: formation('threeLaneWave'),
    hazards: [hazard(1, 5, 'pesticideCloud', { occupiedLanes: [1, 2] })]
  },
  {
    id: 'wasp-crossing',
    difficulty: 3,
    minimumDistance: 1500,
    length: 760,
    regionTags: ['enemy'],
    weight: 4,
    pollen: formation('centerToRight', 'nectar'),
    hazards: [hazard(0, 3, 'corruptedWasp', { occupiedLanes: [0, 1] }), hazard(2, 8, 'pesticideCloud', { occupiedLanes: [2] })]
  },
  {
    id: 'risk-reward-gold',
    difficulty: 3,
    minimumDistance: 2200,
    length: 880,
    regionTags: ['reward', 'split'],
    weight: 3,
    pollen: formation('splitRoute', 'goldenPollen'),
    hazards: [hazard(1, 4, 'pesticideCloud', { occupiedLanes: [1] }), hazard(2, 8, 'corruptedWasp', { occupiedLanes: [1, 2] })]
  },
  {
    id: 'late-mixed-flight',
    difficulty: 4,
    minimumDistance: 3000,
    length: 940,
    regionTags: ['late'],
    weight: 4,
    pollen: formation('threeLaneWave', 'goldenPollen'),
    hazards: [hazard(0, 4, 'birdCrossing', { direction: 1, occupiedLanes: [0, 1] }), hazard(2, 6, 'pesticideCloud', { occupiedLanes: [2] }), hazard(1, 9, 'corruptedWasp', { occupiedLanes: [0, 1, 2] })]
  }
];

export class FlightPatternDirector {
  private lastPatternId = '';

  reset() {
    this.lastPatternId = '';
  }

  next(distance: number): FlightPatternDefinition {
    const available = FLIGHT_PATTERNS.filter(pattern => pattern.minimumDistance <= distance && pattern.id !== this.lastPatternId);
    const pool = available.length ? available : FLIGHT_PATTERNS.filter(pattern => pattern.minimumDistance <= distance);
    const total = pool.reduce((sum, pattern) => sum + pattern.weight, 0);
    let roll = Math.random() * total;
    for (const pattern of pool) {
      roll -= pattern.weight;
      if (roll <= 0) {
        this.lastPatternId = pattern.id;
        return pattern;
      }
    }
    const fallback = pool[pool.length - 1] || FLIGHT_PATTERNS[0];
    this.lastPatternId = fallback.id;
    return fallback;
  }
}
