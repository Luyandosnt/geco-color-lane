import { Core } from './Core';

const TRACKS = ['/audio/music/1.mp3', '/audio/music/2.mp3'];

export const Audio = {
  ctx: null as AudioContext | null,
  music: null as HTMLAudioElement | null,
  track: -1,
  musicActive: false,
  musicPaused: false,
  rate: 1,

  tone(freq = 440, duration = .06, type: OscillatorType = 'sine') {
    if (!Core.data.sound) return;
    try {
      this.ctx ??= new AudioContext();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = .035;
      o.connect(g); g.connect(this.ctx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + duration);
      o.stop(this.ctx.currentTime + duration);
    } catch {}
  },

  move() { this.tone(260, .025); },
  catch() { this.tone(620, .05); },
  gold() { this.tone(880, .08); setTimeout(() => this.tone(1180, .1), 70); },
  miss() { this.tone(120, .12, 'sawtooth'); },
  level() { this.tone(520, .06); setTimeout(() => this.tone(780, .08), 65); },

  startMusic() {
    this.stopMusic();
    this.musicActive = true;
    this.musicPaused = false;
    this.rate = 1;
    this.track = Math.floor(Math.random() * TRACKS.length);
    this.playTrack(this.track);
  },

  playTrack(index: number) {
    if (!this.musicActive) return;
    const a = new window.Audio(TRACKS[index]);
    a.preload = 'auto';
    a.volume = Core.data.sound ? .22 : 0;
    a.playbackRate = this.rate;
    a.onended = () => {
      if (!this.musicActive) return;
      this.track = TRACKS.length > 1 ? (index + 1) % TRACKS.length : index;
      this.playTrack(this.track);
    };
    this.music = a;
    a.play().catch(() => {});
  },

  setMusicPace(level: number) {
    // Music pressure rises gently while gameplay itself can accelerate much more.
    this.rate = Math.min(1.10, 1 + Math.max(0, level - 1) * .012);
    if (this.music) this.music.playbackRate = this.rate;
  },

  syncMusicVolume() {
    if (this.music) this.music.volume = Core.data.sound ? .22 : 0;
  },

  pauseMusic() {
    if (!this.musicActive || !this.music) return;
    this.musicPaused = true;
    this.music.pause();
  },

  resumeMusic() {
    if (!this.musicActive || !this.music || !this.musicPaused) return;
    this.musicPaused = false;
    this.music.volume = Core.data.sound ? .22 : 0;
    this.music.playbackRate = this.rate;
    this.music.play().catch(() => {});
  },

  stopMusic() {
    this.musicActive = false;
    this.musicPaused = false;
    if (this.music) {
      this.music.onended = null;
      this.music.pause();
      this.music.currentTime = 0;
      this.music = null;
    }
  }
};