/**
 * Tiny animation timeline on top of the Web Animations API (v3 §8.5-ج.5).
 * Every wait is itself an Animation, so pause / resume / cancel apply uniformly
 * to motion and to pauses between steps. No external library.
 */
export class Timeline {
  private anims = new Set<Animation>();
  private clock: HTMLElement;
  aborted = false;
  paused = false;
  rate = 1;

  constructor(host: HTMLElement) {
    this.clock = document.createElement("i");
    this.clock.hidden = true;
    host.appendChild(this.clock);
  }

  private track(a: Animation) {
    this.anims.add(a);
    a.playbackRate = this.rate;
    if (this.paused) a.pause();
    const done = () => this.anims.delete(a);
    a.finished.then(done, done);
    return a;
  }

  /** Animate and wait for the end. Rejects with "abort" if the timeline was cancelled. */
  async to(el: Element | null | undefined, frames: Keyframe[] | PropertyIndexedKeyframes, opts: KeyframeAnimationOptions = {}) {
    if (this.aborted) throw new Error("abort");
    if (!el) return;
    const a = this.track(el.animate(frames, { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards", ...opts }));
    try { await a.finished; } catch { throw new Error("abort"); }
    if (this.aborted) throw new Error("abort");
  }

  /** Fire-and-forget animation that still obeys pause / cancel. */
  play(el: Element | null | undefined, frames: Keyframe[] | PropertyIndexedKeyframes, opts: KeyframeAnimationOptions = {}) {
    if (!el || this.aborted) return null;
    const a = this.track(el.animate(frames, { duration: 500, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards", ...opts }));
    a.finished.catch(() => {});
    return a;
  }

  wait(ms: number) { return this.to(this.clock, [{ opacity: 0 }, { opacity: 0 }], { duration: ms, fill: "none", easing: "linear" }); }

  /** Typewriter: one character every `speed` ms (default 45). */
  async type(el: HTMLElement | null | undefined, text: string, speed = 45) {
    if (!el) return;
    el.textContent = "";
    for (const ch of Array.from(text)) { el.textContent += ch; await this.wait(speed); }
  }

  pause() { this.paused = true; this.anims.forEach((a) => a.pause()); }
  resume() { this.paused = false; this.anims.forEach((a) => a.play()); }
  setRate(r: number) { this.rate = r; this.anims.forEach((a) => { a.playbackRate = r; }); }
  cancel() { this.aborted = true; this.anims.forEach((a) => a.cancel()); this.anims.clear(); this.clock.remove(); }
}

/** Point on a quadratic Bézier between a and b, bending `bend` px to the side. */
export function curve(a: { x: number; y: number }, b: { x: number; y: number }, steps = 14, bend = 40): Keyframe[] {
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * (bend / 200), my = (a.y + b.y) / 2 + (b.x - a.x) * (bend / 200) - bend * 0.3;
  const out: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = u * u * a.x + 2 * u * t * mx + t * t * b.x, y = u * u * a.y + 2 * u * t * my + t * t * b.y;
    out.push({ transform: `translate(${x}px, ${y}px)`, offset: t });
  }
  return out;
}
