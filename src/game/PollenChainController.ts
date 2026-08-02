export class PollenChainController {
  current = 0;
  best = 0;
  total = 0;

  reset() {
    this.current = 0;
    this.best = 0;
    this.total = 0;
  }

  collect() {
    this.current++;
    this.total++;
    this.best = Math.max(this.best, this.current);
    return this.current === 10 || this.current === 25 || this.current === 50 ? this.current : 0;
  }

  miss() {
    this.current = 0;
  }

  restorationMultiplier() {
    return 1 + Math.min(.75, this.current * .025);
  }
}
