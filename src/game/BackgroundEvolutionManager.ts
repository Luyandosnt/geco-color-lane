import Phaser from 'phaser';

type EraName = 'ancient' | 'restoration' | 'modern' | 'future';
type MotifKind = 'bird' | 'leaf' | 'aircraft' | 'drone' | 'diamond' | 'tower' | 'beam' | 'ribbon';
type LanePersonality = 'nature' | 'flow' | 'warm';

type EraDefinition = {
  name: EraName;
  score: number;
  transition: number;
  sky: number;
  horizon: number;
  glow: number;
  accent: number;
  particle: number;
  laneBoost: number;
  particleCount: number;
  motion: number;
  motifs: MotifKind[];
};

type WorldParticle = Phaser.GameObjects.Arc & {
  lane: number;
  phase: number;
  speed: number;
  drift: number;
  personality: LanePersonality;
};

type Motif = Phaser.GameObjects.Container & {
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
  kind: MotifKind;
  variants: Record<MotifKind, Phaser.GameObjects.GameObject[]>;
};

type WorldState = Omit<EraDefinition, 'name' | 'score' | 'transition' | 'motifs'>;

const LANE_PERSONALITIES: LanePersonality[] = ['nature', 'flow', 'warm'];

const ERAS: EraDefinition[] = [
  {
    name: 'ancient',
    score: 0,
    transition: 3600,
    sky: 0x1a1009,
    horizon: 0x8b5a22,
    glow: 0xd6a45f,
    accent: 0xb7791f,
    particle: 0xd8b47a,
    laneBoost: .02,
    particleCount: 24,
    motion: .35,
    motifs: ['bird', 'diamond', 'diamond', 'bird', 'diamond', 'diamond']
  },
  {
    name: 'restoration',
    score: 20,
    transition: 4200,
    sky: 0x102018,
    horizon: 0xb98b2b,
    glow: 0x8bf0a0,
    accent: 0x74c365,
    particle: 0xc7f9a6,
    laneBoost: .045,
    particleCount: 36,
    motion: .55,
    motifs: ['leaf', 'ribbon', 'leaf', 'ribbon', 'diamond', 'leaf']
  },
  {
    name: 'modern',
    score: 50,
    transition: 4300,
    sky: 0x071721,
    horizon: 0x0ea5e9,
    glow: 0x67e8f9,
    accent: 0x38bdf8,
    particle: 0x7dd3fc,
    laneBoost: .065,
    particleCount: 46,
    motion: .72,
    motifs: ['tower', 'beam', 'aircraft', 'tower', 'beam', 'aircraft', 'diamond']
  },
  {
    name: 'future',
    score: 100,
    transition: 5000,
    sky: 0x080b1f,
    horizon: 0x7c3aed,
    glow: 0x22d3ee,
    accent: 0xfacc15,
    particle: 0xc4b5fd,
    laneBoost: .09,
    particleCount: 60,
    motion: .95,
    motifs: ['drone', 'ribbon', 'beam', 'diamond', 'drone', 'ribbon', 'diamond', 'beam']
  }
];

const MAX_PARTICLES = 60;
const MAX_MOTIFS = 30;

export class BackgroundEvolutionManager {
  private scene: Phaser.Scene;
  private lanes: number[];
  private laneColors: number[];
  private activeEra = 0;
  private targetEra = 0;
  private transitionTime = 1;
  private transitionDuration = 1;
  private time = 0;
  private energy = .22;
  private state: WorldState = this.stateFromEra(ERAS[0]);
  private fromState: WorldState = this.stateFromEra(ERAS[0]);
  private toState: WorldState = this.stateFromEra(ERAS[0]);

  private far!: Phaser.GameObjects.Container;
  private middle!: Phaser.GameObjects.Container;
  private near!: Phaser.GameObjects.Container;
  private sky!: Phaser.GameObjects.Rectangle;
  private horizon!: Phaser.GameObjects.Rectangle;
  private sunGlow!: Phaser.GameObjects.Arc;
  private lensGlow!: Phaser.GameObjects.Arc;
  private grid!: Phaser.GameObjects.Grid;
  private laneGlows: Phaser.GameObjects.Rectangle[] = [];
  private particles: WorldParticle[] = [];
  private motifs: Motif[] = [];

  constructor(scene: Phaser.Scene, lanes: number[], laneColors: number[]) {
    this.scene = scene;
    this.lanes = lanes;
    this.laneColors = laneColors;
  }

  create() {
    this.far = this.scene.add.container(0, 0).setDepth(-30);
    this.middle = this.scene.add.container(0, 0).setDepth(-20);
    this.near = this.scene.add.container(0, 0).setDepth(-8);

    this.sky = this.scene.add.rectangle(195, 422, 390, 844, this.state.sky, 1);
    this.horizon = this.scene.add.rectangle(195, 570, 390, 430, this.state.horizon, .045).setBlendMode(Phaser.BlendModes.ADD);
    this.sunGlow = this.scene.add.circle(88, 170, 130, this.state.glow, .055).setBlendMode(Phaser.BlendModes.ADD);
    this.lensGlow = this.scene.add.circle(280, 300, 90, this.state.accent, .025).setBlendMode(Phaser.BlendModes.ADD);
    this.grid = this.scene.add.grid(195, 486, 390, 620, 39, 52, 0x000000, 0, this.state.glow, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.far.add([this.sky, this.horizon, this.sunGlow, this.lensGlow, this.grid]);

    this.lanes.forEach((x, i) => {
      this.laneGlows[i] = this.scene.add.rectangle(x, 430, 128, 720, this.laneColors[i], .055).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    });

    for (let i = 0; i < MAX_PARTICLES; i++) this.particles.push(this.createParticle(i));
    for (let i = 0; i < MAX_MOTIFS; i++) this.motifs.push(this.createMotif(i));
  }

  update(score: number, streak: number, lives: number, activeLane: number, delta: number) {
    this.time += delta;
    const eraIndex = this.resolveEra(score);
    if (eraIndex !== this.targetEra) this.beginTransition(eraIndex);
    this.blendState(delta);

    const targetEnergy = Phaser.Math.Clamp(.18 + Math.min(streak, 12) * .043 - (3 - lives) * .06, .1, .78);
    this.energy += (targetEnergy - this.energy) * .025;

    this.updateLighting();
    this.updateLanes(activeLane);
    this.updateParticles(activeLane, delta);
    this.updateMotifs(delta);
    this.updateParallax();
  }

  private createParticle(index: number) {
    const lane = index % this.lanes.length;
    const p = this.scene.add.circle(this.lanes[lane] + Phaser.Math.Between(-42, 42), Phaser.Math.Between(110, 810), Phaser.Math.Between(1, 3), this.state.particle, 0).setBlendMode(Phaser.BlendModes.ADD) as WorldParticle;
    p.lane = lane;
    p.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    p.speed = Phaser.Math.FloatBetween(.010, .036);
    p.drift = Phaser.Math.FloatBetween(.0008, .0024);
    p.personality = LANE_PERSONALITIES[lane];
    this.near.add(p);
    return p;
  }

  private createMotif(index: number) {
    const def = ERAS[0], kind = def.motifs[index % def.motifs.length];
    const motif = this.makeMotif(index);
    motif.baseX = Phaser.Math.Between(24, 366);
    motif.baseY = Phaser.Math.Between(135, 790);
    motif.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    motif.speed = Phaser.Math.FloatBetween(.18, .7);
    this.setMotifKind(motif, kind);
    this.middle.add(motif);
    return motif;
  }

  private makeMotif(index: number) {
    const color = index % 3 === 0 ? this.state.glow : this.state.accent;
    const motif = this.scene.add.container(0, 0).setAlpha(0) as Motif;
    const flight = (kind: MotifKind, alpha: number) => {
      const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(kind === 'bird' ? 2 : 3, color, alpha).lineBetween(-8, 0, 0, -4).lineBetween(0, -4, 8, 0);
      if (kind !== 'bird') g.lineBetween(0, -4, 0, 6);
      return g;
    };
    const ribbon = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    ribbon.lineStyle(2, color, .12).lineBetween(-32, 10, 0, -8).lineBetween(0, -8, 32, 8);
    motif.variants = {
      bird: [flight('bird', .12)],
      leaf: [this.scene.add.ellipse(0, 0, 9, 16, color, .14).setAngle(30).setBlendMode(Phaser.BlendModes.ADD)],
      aircraft: [flight('aircraft', .16)],
      drone: [flight('drone', .18), this.scene.add.circle(0, 2, 2, color, .16).setBlendMode(Phaser.BlendModes.ADD)],
      diamond: [this.scene.add.rectangle(0, 0, 15, 15, color, .08).setAngle(45).setBlendMode(Phaser.BlendModes.ADD)],
      tower: [this.scene.add.rectangle(0, 0, 4, 90, color, .11).setBlendMode(Phaser.BlendModes.ADD)],
      beam: [this.scene.add.rectangle(0, 0, 130, 3, color, .09).setBlendMode(Phaser.BlendModes.ADD)],
      ribbon: [ribbon]
    };
    Object.values(motif.variants).flat().forEach(child => motif.add(child));
    motif.kind = 'diamond';
    return motif;
  }

  private updateLighting() {
    const breathe = Math.sin(this.time / 2600) * .018;
    this.sky.setFillStyle(this.state.sky, 1);
    this.horizon.setFillStyle(this.state.horizon, .035 + this.energy * .08);
    this.horizon.y = 610 - this.energy * 100;
    this.sunGlow.setFillStyle(this.state.glow, .045 + this.energy * .08 + breathe);
    this.sunGlow.setScale(1 + Math.sin(this.time / 3800) * .05);
    this.lensGlow.setFillStyle(this.state.accent, .018 + this.energy * .045);
    this.lensGlow.x = 270 + Math.sin(this.time / 5100) * 22;
    this.lensGlow.y = 280 + Math.cos(this.time / 6200) * 16;
    this.grid.setOutlineStyle(this.state.glow, this.targetEra === 3 ? .035 + this.energy * .045 : this.targetEra === 2 ? .012 + this.energy * .018 : 0);
  }

  private updateLanes(activeLane: number) {
    this.laneGlows.forEach((glow, i) => {
      const pulse = Math.sin(this.time / 1500 + i * 1.9) * .019;
      const laneEnergy = i === activeLane ? .05 : 0;
      glow.setFillStyle(this.laneColors[i], .038 + pulse + this.energy * this.state.laneBoost + laneEnergy);
    });
  }

  private updateParticles(activeLane: number, delta: number) {
    const visible = Math.min(MAX_PARTICLES, Math.round(this.state.particleCount + this.energy * 6));
    this.particles.forEach((p, i) => {
      const laneColor = this.laneParticleColor(p.lane);
      const show = i < visible;
      const laneLift = p.lane === activeLane ? .035 : 0;
      p.setFillStyle(i % 4 === 0 ? laneColor : this.state.particle, show ? .035 + this.energy * .11 + laneLift : 0);
      p.y -= delta * p.speed * (.85 + this.state.motion + this.energy);
      const wave = Math.sin(this.time * p.drift + p.phase);
      p.x += wave * (.04 + this.energy * .045 + this.state.motion * .025);
      if (p.personality === 'warm') p.y -= Math.max(0, Math.sin(this.time * .002 + p.phase)) * .025 * delta;
      if (p.personality === 'flow') p.x += Math.sin(this.time * .003 + p.phase) * .08;
      if (p.y < 92 || p.x < -20 || p.x > 410) this.resetParticle(p);
    });
  }

  private updateMotifs(delta: number) {
    const era = ERAS[this.targetEra];
    const visible = Math.min(MAX_MOTIFS, 10 + this.targetEra * 5 + Math.round(this.energy * 5));
    this.motifs.forEach((motif, i) => {
      const desired = era.motifs[i % era.motifs.length];
      if (motif.kind !== desired) this.setMotifKind(motif, desired);
      const alpha = i < visible ? .045 + this.energy * .09 : 0;
      const xMove = Math.sin(this.time / (5200 - this.targetEra * 450) + motif.phase) * (4 + this.state.motion * 7);
      const yMove = Math.cos(this.time / (6100 - this.targetEra * 420) + motif.phase) * (3 + this.state.motion * 5);
      const laneAvoid = motif.baseY > 350 && motif.baseY < 700 ? Math.sign(motif.baseX - 195) * 10 : 0;
      motif.setPosition(motif.baseX + xMove + laneAvoid, motif.baseY + yMove);
      motif.setAlpha(alpha);
      motif.rotation += delta * .00003 * motif.speed * (this.targetEra + 1);
      if (motif.baseX > 430) motif.baseX = -30;
      if (motif.kind === 'bird' || motif.kind === 'aircraft' || motif.kind === 'drone') motif.baseX += delta * .006 * motif.speed * (1 + this.state.motion);
    });
  }

  private updateParallax() {
    this.far.x = Math.sin(this.time / 9000) * 2;
    this.far.y = Math.cos(this.time / 11000) * 2;
    this.middle.x = Math.sin(this.time / 6500) * (3 + this.energy * 5);
    this.middle.y = Math.cos(this.time / 7600) * (2 + this.energy * 3);
    this.near.x = Math.sin(this.time / 4300) * (2 + this.energy * 4);
  }

  private setMotifKind(motif: Motif, kind: MotifKind) {
    Object.entries(motif.variants).forEach(([name, children]) => children.forEach(child => child.setVisible(name === kind)));
    motif.kind = kind;
  }

  private resetParticle(p: WorldParticle) {
    p.y = Phaser.Math.Between(735, 830);
    p.x = this.lanes[p.lane] + Phaser.Math.Between(-46, 46);
  }

  private beginTransition(index: number) {
    this.activeEra = this.targetEra;
    this.targetEra = index;
    this.transitionTime = 0;
    this.transitionDuration = ERAS[index].transition;
    this.fromState = { ...this.state };
    this.toState = this.stateFromEra(ERAS[index]);
  }

  private blendState(delta: number) {
    this.transitionTime = Math.min(this.transitionDuration, this.transitionTime + delta);
    const t = this.transitionDuration <= 0 ? 1 : Phaser.Math.Easing.Sine.InOut(this.transitionTime / this.transitionDuration);
    this.state = {
      sky: this.mixColor(this.fromState.sky, this.toState.sky, t),
      horizon: this.mixColor(this.fromState.horizon, this.toState.horizon, t),
      glow: this.mixColor(this.fromState.glow, this.toState.glow, t),
      accent: this.mixColor(this.fromState.accent, this.toState.accent, t),
      particle: this.mixColor(this.fromState.particle, this.toState.particle, t),
      laneBoost: Phaser.Math.Linear(this.fromState.laneBoost, this.toState.laneBoost, t),
      particleCount: Phaser.Math.Linear(this.fromState.particleCount, this.toState.particleCount, t),
      motion: Phaser.Math.Linear(this.fromState.motion, this.toState.motion, t)
    };
  }

  private resolveEra(score: number) {
    let era = 0;
    ERAS.forEach((def, i) => { if (score >= def.score) era = i; });
    return era;
  }

  private stateFromEra(era: EraDefinition): WorldState {
    return {
      sky: era.sky,
      horizon: era.horizon,
      glow: era.glow,
      accent: era.accent,
      particle: era.particle,
      laneBoost: era.laneBoost,
      particleCount: era.particleCount,
      motion: era.motion
    };
  }

  private laneParticleColor(lane: number) {
    if (lane === 0) return this.mixColor(this.laneColors[lane], 0xb7f7a0, .45);
    if (lane === 1) return this.mixColor(this.laneColors[lane], 0x93c5fd, .38);
    return this.mixColor(this.laneColors[lane], 0xfacc15, .34);
  }

  private mixColor(from: number, to: number, t: number) {
    const fr = (from >> 16) & 255, fg = (from >> 8) & 255, fb = from & 255;
    const tr = (to >> 16) & 255, tg = (to >> 8) & 255, tb = to & 255;
    const r = Math.round(Phaser.Math.Linear(fr, tr, t));
    const g = Math.round(Phaser.Math.Linear(fg, tg, t));
    const b = Math.round(Phaser.Math.Linear(fb, tb, t));
    return (r << 16) | (g << 8) | b;
  }
}
