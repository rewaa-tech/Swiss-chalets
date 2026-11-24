"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { Timeline, curve } from "@/fx/timeline";

export interface StoryStep { title: React.ReactNode; text: React.ReactNode }
export interface StoryLabels {
  card: string; held: string; name: string; phone: string; family: string; youth: string; fullDay: string; evening: string; morning: string;
  shamcash: string; account: string; copy: string; copied: string; txn: string; drop: string; submit: string; pending: string;
  received: string; proof: string; review: string; confirmed: string; newBooking: string; documents: string; pause: string; play: string; replay: string;
  amount: string; demoName: string;
}

const N = 4;
const AUTO_GAP = 2200;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktopMq = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/**
 * v3 §8.5-ج — "how to book" told as four short animated scenes on a live booking card.
 * Desktop: scroll-driven (sticky card), hover/click jumps to a step. Mobile: swipeable steps.
 * Auto-plays when idle, pauses off-screen / hidden tab, has pause + replay (WCAG 2.2.2),
 * and shows each scene's final state without motion under prefers-reduced-motion.
 */
export default function BookingStory({ steps, labels: L, compact = false }: { steps: StoryStep[]; labels: StoryLabels; compact?: boolean }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const tl = useRef<Timeline | null>(null);
  const auto = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inView = useRef(false);
  const userPaused = useRef(false);
  const scrollStep = useRef(-1);
  const desktop = useCallback(() => !compact && desktopMq(), [compact]);
  const stepRef = useRef(0);

  const $ = useCallback((sel: string) => (stage.current?.querySelector<HTMLElement>(sel) ?? null), []);
  const setClock = (s: number) => { if (clock.current) clock.current.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

  /** Countdown that obeys the same timeline (pauses with it). */
  const ticker = useCallback((t: Timeline, from: number, every: number, until: () => boolean) => {
    let s = from;
    setClock(s);
    (async () => { try { while (!until() && s > 0) { await t.wait(every); s--; setClock(s); } } catch { /* cancelled */ } })();
  }, []);

  const cursorTo = useCallback(async (t: Timeline, target: Element | null, dur = 700) => {
    const c = $(".sx-cursor"), st = stage.current;
    if (!c || !target || !st) return;
    const r = target.getBoundingClientRect(), s = st.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const from = { x: cr.left - s.left, y: cr.top - s.top }, to = { x: r.left - s.left + r.width * 0.55, y: r.top - s.top + r.height * 0.55 };
    await t.to(c, curve(from, to), { duration: dur, easing: "cubic-bezier(.45,.05,.25,1)" });
  }, [$]);
  const press = useCallback(async (t: Timeline, target: Element | null) => {
    const c = $(".sx-cursor"); if (!c) return;
    const m = getComputedStyle(c).transform;
    const base = m && m !== "none" ? m : "";
    await t.to(c, [{ transform: `${base} scale(1)` }, { transform: `${base} scale(.82)` }, { transform: `${base} scale(1)` }], { duration: 260, fill: "none", composite: "replace" });
    if (target) {
      const rp = document.createElement("span"); rp.className = "sx-ripple"; target.appendChild(rp);
      t.play(rp, [{ transform: "scale(0)", opacity: .5 }, { transform: "scale(2.4)", opacity: 0 }], { duration: 600, fill: "none" })?.finished.finally(() => rp.remove());
    }
  }, [$]);

  // ───────── scenes ─────────
  const scenes = useCallback((): ((t: Timeline) => Promise<void>)[] => [
    // 01 choose time & details
    async (t) => {
      ticker(t, 30 * 60, 1000, () => stepRef.current !== 0);
      const days = stage.current!.querySelectorAll(".sx-day");
      days.forEach((d, i) => t.play(d, [{ opacity: 0, transform: "translateY(8px) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: i * 28 }));
      await t.wait(420);
      const target = $(".sx-day.is-target");
      await cursorTo(t, target, 800);
      await press(t, target);
      t.play(target, [{ background: "#fff", color: "var(--ink)" }, { background: "var(--forest-deep)", color: "#fff" }], { duration: 300 });
      const slots = stage.current!.querySelectorAll(".sx-slot");
      for (const [i, s] of slots.entries()) t.play(s, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 80 + i * 70 });
      await t.wait(520);
      const pick = $(".sx-slot.is-target");
      await cursorTo(t, pick, 600);
      await press(t, pick);
      t.play(pick, [{ boxShadow: "0 0 0 0 rgba(227,185,143,0)", background: "#fff" }, { boxShadow: "0 0 0 3px var(--sand)", background: "var(--forest-deep)" }], { duration: 320 });
      pick?.querySelectorAll("span").forEach((sp) => t.play(sp, [{ color: "var(--ink)" }, { color: "#fff" }], { duration: 320 }));
      await t.to($(".sx-form"), [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420 });
      await t.type($(".sx-name .v"), L.demoName, 55);
      await t.type($(".sx-phone .v"), "09•• ••• •••", 45);
      const fam = $(".sx-fam");
      await cursorTo(t, fam, 500);
      await press(t, fam);
      await t.to(fam, [{ background: "#fff", color: "var(--forest)" }, { background: "var(--forest)", color: "#fff" }], { duration: 300 });
      await t.wait(500);
    },
    // 02 pay with Sham Cash
    async (t) => {
      ticker(t, 29 * 60 + 12, 500, () => stepRef.current !== 1);
      const inner = $(".sx-flip");
      await t.wait(300);
      await t.to(inner, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], { duration: 650, easing: "cubic-bezier(.6,.05,.25,1)" });
      const line = $(".sx-scan");
      await t.to(line, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(118px)", opacity: 1 }, { transform: "translateY(0)", opacity: 1 }, { transform: "translateY(118px)", opacity: 0 }], { duration: 1600, easing: "ease-in-out", fill: "none" });
      await t.to($(".sx-acc"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 380 });
      const copy = $(".sx-copy");
      await cursorTo(t, copy, 650);
      await press(t, copy);
      t.play($(".sx-copy .i-copy"), [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.4)" }], { duration: 200 });
      t.play($(".sx-copy .i-check"), [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }], { duration: 260, delay: 140 });
      await t.to($(".sx-toast"), [{ opacity: 0, transform: "translate(-50%, 10px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 300 });
      const amt = $(".sx-amt");
      for (let v = 0; v <= 120; v += 8) { if (amt) amt.textContent = `$${v}`; await t.wait(28); }
      if (amt) amt.textContent = "$120";
      await t.wait(400);
      await t.to($(".sx-toast"), [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
    },
    // 03 upload proof
    async (t) => {
      setClock(28 * 60 + 40);
      let stop = false;
      ticker(t, 28 * 60 + 40, 1000, () => stop || stepRef.current !== 2);
      const zone = $(".sx-drop"), file = $(".sx-file"), st = stage.current!;
      t.play(zone, [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 380 });
      await t.wait(300);
      if (zone && file) {
        const z = zone.getBoundingClientRect(), s = st.getBoundingClientRect();
        const to = { x: z.left - s.left + z.width / 2 - 22, y: z.top - s.top + z.height / 2 - 26 };
        t.play(zone, [{ borderColor: "#CFC7B8", background: "#fff" }, { borderColor: "var(--ember)", background: "#FBF1E6" }], { duration: 300, delay: 520 });
        t.play($(".sx-ants"), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 450 });
        await t.to(file, [...curve({ x: s.width - 40, y: -30 }, to, 16, 90).map((k, i, a) => ({ ...k, opacity: i === 0 ? 0 : 1, transform: `${k.transform} rotate(${(1 - i / (a.length - 1)) * -18}deg)` }))], { duration: 950, easing: "cubic-bezier(.3,.7,.2,1)" });
        t.play(file, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      }
      await t.to($(".sx-bar > span"), [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 900, easing: "cubic-bezier(.3,.6,.3,1)" });
      t.play($(".sx-ants"), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      await t.to($(".sx-filecard"), [{ opacity: 0, transform: "translateY(10px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 380 });
      await t.to($(".sx-txnrow"), [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      await t.type($(".sx-txn"), "48213977", 70);
      const btn = $(".sx-send");
      await cursorTo(t, btn, 600);
      await press(t, btn);
      stop = true;
      t.play($(".sx-clock"), [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
      await t.to($(".sx-hour"), [{ opacity: 0, transform: "rotate(-90deg) scale(.6)" }, { opacity: 1, transform: "none" }], { duration: 450 });
      await t.wait(700);
    },
    // 04 wait for confirmation
    async (t) => {
      setClock(28 * 60 + 31);
      t.play($(".sx-clock"), [{ opacity: 1 }, { opacity: 0 }], { duration: 1 });
      t.play($(".sx-hour"), [{ opacity: 0 }, { opacity: 1 }], { duration: 1 });
      const dots = stage.current!.querySelectorAll(".sx-tl-dot"), path = $(".sx-tl-line");
      await t.to(path, [{ strokeDashoffset: 300 }, { strokeDashoffset: 200 }], { duration: 450, easing: "linear" });
      t.play(dots[1], [{ background: "var(--line-soft)" }, { background: "var(--success)" }], { duration: 250 });
      await t.to(path, [{ strokeDashoffset: 200 }, { strokeDashoffset: 100 }], { duration: 450, easing: "linear" });
      t.play(dots[2], [{ background: "var(--line-soft)" }, { background: "var(--sand)" }], { duration: 250 });
      await t.to($(".sx-tg"), [{ opacity: 0, transform: "translateY(14px) scale(.7)" }, { opacity: 1, transform: "translateY(-4px) scale(1.04)" }, { opacity: 1, transform: "none" }], { duration: 520 });
      await t.wait(900);
      await t.to(path, [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 450, easing: "linear" });
      t.play(dots[3], [{ background: "var(--line-soft)" }, { background: "var(--success)" }], { duration: 250 });
      t.play($(".sx-tg"), [{ opacity: 1 }, { opacity: 0, transform: "translateY(-10px)" }], { duration: 300 });
      await t.to($(".sx-ok-ring"), [{ strokeDashoffset: 190 }, { strokeDashoffset: 0 }], { duration: 650, easing: "cubic-bezier(.6,.05,.3,1)" });
      await t.to($(".sx-ok-check"), [{ strokeDashoffset: 50 }, { strokeDashoffset: 0 }], { duration: 420 });
      t.play($(".sx-ok"), [{ boxShadow: "0 0 0 0 rgba(46,125,79,.45)" }, { boxShadow: "0 0 0 22px rgba(46,125,79,0)" }], { duration: 900, fill: "none" });
      await t.to($(".sx-badge"), [{ opacity: 0, transform: "scale(.7)" }, { opacity: 1, transform: "scale(1.06)" }, { opacity: 1, transform: "none" }], { duration: 420 });
      await t.to($(".sx-after"), [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 380 });
      await t.wait(1200);
    },
  ], [$, L.demoName, cursorTo, press, ticker]);

  // ───────── player ─────────
  const resetDom = useCallback(() => {
    stage.current?.querySelectorAll<HTMLElement>("[data-type]").forEach((el) => { el.textContent = ""; });
    const amt = stage.current?.querySelector(".sx-amt"); if (amt) amt.textContent = "$0";
  }, []);

  const run = useCallback((i: number) => {
    if (auto.current) clearTimeout(auto.current);
    tl.current?.cancel();
    stage.current?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    resetDom();
    stepRef.current = i;
    setStep(i);
    const sceneEls = stage.current?.querySelectorAll<HTMLElement>(".sx-scene");
    sceneEls?.forEach((el, k) => { el.dataset.on = k === i ? "1" : "0"; });
    const t = new Timeline(stage.current!);
    tl.current = t;
    const rm = reduced();
    if (rm) t.setRate(1e4);
    if (userPaused.current || !inView.current) t.pause();
    const enter = sceneEls?.[i];
    t.play(enter, [{ clipPath: "inset(0 0 100% 0)", opacity: 0, transform: "translateY(-12px)" }, { clipPath: "inset(0 0 0% 0)", opacity: 1, transform: "none" }], { duration: rm ? 1 : 520 });
    scenes()[i](t).then(() => {
      if (t.aborted) return;
      auto.current = setTimeout(() => {
        if (tl.current !== t || userPaused.current || !inView.current || rm) return;
        // On desktop the scroll position owns the step; only loop when the visitor isn't scrolling the section.
        run((i + 1) % N);
      }, AUTO_GAP);
    }).catch(() => { /* cancelled */ });
  }, [resetDom, scenes]);

  // Visibility + hidden tab → pause; scroll-driven steps on desktop.
  useEffect(() => {
    const el = root.current!;
    const io = new IntersectionObserver(([e]) => {
      const was = inView.current;
      inView.current = e.isIntersecting;
      if (e.isIntersecting && !was) { if (!tl.current) run(0); else if (!userPaused.current) tl.current.resume(); }
      if (!e.isIntersecting) tl.current?.pause();
    }, { threshold: 0.25 });
    io.observe(el);
    const vis = () => { if (document.hidden) tl.current?.pause(); else if (inView.current && !userPaused.current) tl.current?.resume(); };
    document.addEventListener("visibilitychange", vis);
    let raf = 0;
    const onScroll = () => {
      if (raf || !desktop() || reduced()) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        if (span <= 0 || r.top > 0 || r.bottom < window.innerHeight * 0.5) return;
        const k = Math.min(N - 1, Math.max(0, Math.floor((-r.top / span) * N)));
        if (k !== scrollStep.current) { scrollStep.current = k; if (k !== stepRef.current) run(k); }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); window.removeEventListener("scroll", onScroll); tl.current?.cancel(); if (auto.current) clearTimeout(auto.current); };
  }, [run, desktop]);

  const jump = (i: number) => {
    if (desktop() && !reduced()) {
      // Keep the scroll position in sync so scrolling continues from this step.
      const el = root.current!, span = el.getBoundingClientRect().height - window.innerHeight;
      if (span > 0) { scrollStep.current = i; window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + (span * (i + 0.5)) / N, behavior: "smooth" }); }
    }
    run(i);
  };
  const togglePause = () => {
    userPaused.current = !userPaused.current;
    setPaused(userPaused.current);
    if (userPaused.current) { tl.current?.pause(); if (auto.current) clearTimeout(auto.current); } else { tl.current?.resume(); if (!tl.current || tl.current.aborted) run(stepRef.current); }
  };

  return (
    <section ref={root} className={`story${compact ? " is-compact" : ""}`} aria-roledescription="عرض تفاعلي">
      <div className="story-sticky">
        <div className="story-steps">
          <span className="story-rail" aria-hidden><span style={{ transform: `scaleY(${(step + 1) / N})` }} /></span>
          <ol>
            {steps.map((s, i) => (
              <li key={i}>
                <button type="button" className={`story-step ${i === step ? "is-on" : i < step ? "is-done" : ""}`} aria-current={i === step ? "step" : undefined}
                  onClick={() => jump(i)} onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches && i !== stepRef.current) jump(i); }}>
                  <span className="num story-n">0{i + 1}</span>
                  <span className="flex flex-col gap-1 min-w-0"><span className="story-t">{s.title}</span><span className="story-d">{s.text}</span></span>
                  <Icon name="arrow" size={18} className="story-arrow" />
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="story-card-wrap">
          <div className="story-card" style={{ "--tilt": `${(step - 1.5) * 0.8}deg` } as React.CSSProperties}>
            <header className="story-head">
              <div className="flex flex-col"><strong>{L.card}</strong><span>{L.held}</span></div>
              <span className="story-timer"><span className="sx-clock-wrap"><span ref={clock} className="num sx-clock" dir="ltr">30:00</span></span>
                <span className="sx-hour" aria-hidden><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" /></svg></span></span>
            </header>

            <div ref={stage} className="story-stage" aria-hidden>
              {/* 01 */}
              <div className="sx-scene sx-s1" data-on="1">
                <div className="sx-cal">{Array.from({ length: 14 }, (_, d) => <span key={d} className={`sx-day num ${[2, 6, 11].includes(d) ? "is-off" : ""} ${d === 8 ? "is-target" : ""} ${[4, 9].includes(d) ? "is-part" : ""}`}>{d + 10}</span>)}</div>
                <div className="sx-slots">
                  <span className="sx-slot"><span>{L.morning}</span><span className="num">$60</span></span>
                  <span className="sx-slot"><span>{L.evening}</span><span className="num">$70</span></span>
                  <span className="sx-slot is-target"><span>{L.fullDay}</span><span className="num">$120</span></span>
                </div>
                <div className="sx-form">
                  <span className="sx-field sx-name"><em>{L.name}</em><b className="v" data-type /></span>
                  <span className="sx-field sx-phone"><em>{L.phone}</em><b className="v num" dir="ltr" data-type /></span>
                  <span className="sx-cats"><span className="sx-fam">{L.family}</span><span>{L.youth}</span></span>
                </div>
              </div>
              {/* 02 */}
              <div className="sx-scene sx-s2" data-on="0">
                <div className="sx-flipbox"><div className="sx-flip">
                  <div className="sx-face sx-front"><span className="sx-logo">{L.shamcash}</span><span className="sx-amt num">$0</span></div>
                  <div className="sx-face sx-back">
                    <svg className="sx-qr" viewBox="0 0 21 21" width="118" height="118" shapeRendering="crispEdges">{QR.map(([x, y], k) => <rect key={k} x={x} y={y} width="1" height="1" fill="#142A1F" />)}</svg>
                    <span className="sx-scan" />
                  </div>
                </div></div>
                <div className="sx-acc"><span className="flex flex-col"><em>{L.account}</em><b className="num" dir="ltr">0991 •••• 2207</b></span>
                  <span className="sx-copy"><span className="i-copy"><Icon name="copy" size={16} /></span><span className="i-check"><Icon name="check" size={16} width={2.4} /></span>{L.copy}</span></div>
                <span className="sx-toast"><Icon name="check" size={14} width={2.4} />{L.copied}</span>
              </div>
              {/* 03 */}
              <div className="sx-scene sx-s3" data-on="0">
                <div className="sx-drop"><span className="sx-ants" /><Icon name="upload" size={22} stroke="var(--ember)" /><span>{L.drop}</span></div>
                <span className="sx-file"><span>PDF</span></span>
                <div className="sx-bar"><span /></div>
                <div className="sx-filecard"><span className="sx-pdf">PDF</span><span className="flex flex-col"><b dir="ltr">shamcash-receipt.pdf</b><em className="num">184 KB · 1</em></span></div>
                <div className="sx-txnrow"><em>{L.txn}</em><b className="sx-txn num" dir="ltr" data-type /></div>
                <span className="sx-send">{L.submit}</span>
              </div>
              {/* 04 */}
              <div className="sx-scene sx-s4" data-on="0">
                <div className="sx-tl">
                  <svg className="sx-tl-svg" viewBox="0 0 300 20" preserveAspectRatio="none"><path className="sx-tl-base" d="M290 10H10" /><path className="sx-tl-line" d="M290 10H10" pathLength="300" /></svg>
                  {[L.received, L.proof, L.review, L.confirmed].map((x, k) => <span key={k} className="sx-tl-step"><span className="sx-tl-dot" style={k === 0 ? { background: "var(--success)" } : undefined} /><em>{x}</em></span>)}
                </div>
                <div className="sx-tg"><span className="sx-tg-ico"><Icon name="chat" size={16} stroke="#fff" /></span><span className="flex flex-col"><b>{L.newBooking}</b><em>{L.pending}</em></span></div>
                <div className="sx-okwrap">
                  <span className="sx-ok"><svg viewBox="0 0 64 64" width="64" height="64"><circle className="sx-ok-ring" cx="32" cy="32" r="30" pathLength="190" /><path className="sx-ok-check" d="M20 33l8 8 16-17" pathLength="50" /></svg></span>
                  <span className="sx-badge">{L.confirmed}</span>
                </div>
                <div className="sx-after"><span className="sx-wa"><Icon name="wa" size={16} stroke="#fff" />WhatsApp</span><em>{L.documents}</em></div>
              </div>
              <span className="sx-cursor"><svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2l17 10-7.5 1.8L15 22l-3.2 1.6-3.6-8.3L2 20z" fill="#fff" stroke="#142A1F" strokeWidth="1.6" strokeLinejoin="round" /></svg></span>
            </div>

            <div className="story-mini">
              <span className="story-mini-hl" style={{ transform: `translateY(${step * 100}%)` }} aria-hidden />
              {steps.map((s, i) => <button key={i} type="button" className={i === step ? "is-on" : ""} onClick={() => jump(i)} tabIndex={-1} aria-hidden><span className="num">0{i + 1}</span>{s.title}</button>)}
            </div>
            <div className="story-ctrl">
              <button type="button" onClick={togglePause} aria-pressed={paused} aria-label={paused ? L.play : L.pause} data-testid="story-pause"><Icon name={paused ? "play" : "pause"} size={18} /></button>
              <button type="button" onClick={() => run(0)} aria-label={L.replay}><Icon name="replay" size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// A stable QR-looking pattern (decorative): finder squares + a fixed pseudo-random fill.
const QR: [number, number][] = (() => {
  const out: [number, number][] = [];
  const finder = (ox: number, oy: number) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (x === 0 || y === 0 || x === 6 || y === 6 || (x > 1 && x < 5 && y > 1 && y < 5)) out.push([ox + x, oy + y]); };
  finder(0, 0); finder(14, 0); finder(0, 14);
  let seed = 7;
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    if (seed % 100 < 46) out.push([x, y]);
  }
  return out;
})();
