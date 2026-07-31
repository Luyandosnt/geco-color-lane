export const Core = {
  key: 'geco.colorlane.save',
  data: { highScore: 0, coins: 0, sound: true, vibration: true },
  boot() {
    try { this.data = { ...this.data, ...JSON.parse(localStorage.getItem(this.key) || '{}') }; } catch {}
  },
  save() { localStorage.setItem(this.key, JSON.stringify(this.data)); },
  finish(score: number, coins: number) {
    this.data.highScore = Math.max(this.data.highScore, score);
    this.data.coins += coins;
    this.save();
    if (this.data.vibration && navigator.vibrate) navigator.vibrate(60);
  },
  event(name: string, data: Record<string, unknown> = {}) { console.info('[GECO Analytics]', name, data); }
};
