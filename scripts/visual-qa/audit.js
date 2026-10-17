// Runs inside the page (page.evaluate). Measures what is actually drawn on a
// phone-sized viewport and returns findings in two groups:
//   fail:  defects that are never acceptable (Apple "UI Design Dos and Don'ts":
//          content fits the screen, text never overlaps; LocalCheck DESIGN.md
//          layout rules: names and numbers never cut off)
//   debt:  Apple minimums the app doesn't meet everywhere yet (11pt text,
//          4.5:1 contrast, 44pt targets). Counted per screen; a change may
//          not raise a count above the committed baseline.
() => {
  const W = window.innerWidth, H = window.innerHeight;
  const fail = [], debt = { smallText: [], lowContrast: [], smallTarget: [] };
  const label = (el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 48);
  const isIcon = (cs) => /feather|material|ionicons|fontawesome|entypo|octicons|anticon/i.test(cs.fontFamily);
  const clips = (cs) => /hidden|clip|auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY);
  const scrolls = (cs) => /auto|scroll/.test(cs.overflowX + cs.overflowY);
  const hidden = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return true;
    }
    return false;
  };
  // The part of an element actually drawn: its box cut by clipping ancestors
  // and the viewport.
  const drawn = (el) => {
    const r = el.getBoundingClientRect();
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (clips(getComputedStyle(p))) {
        const q = p.getBoundingClientRect();
        L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom);
      }
    }
    L = Math.max(L, 0); T = Math.max(T, 0); R = Math.min(R, W); B = Math.min(B, H);
    return R - L > 1 && B - T > 1 ? { left: L, top: T, right: R, bottom: B } : null;
  };
  // Covered by a sheet, the tab bar or a pinned bar: not on screen.
  const covered = (el, v) => {
    const hit = document.elementFromPoint((v.left + v.right) / 2, (v.top + v.bottom) / 2);
    return hit && !(hit === el || el.contains(hit) || hit.contains(el)) && getComputedStyle(hit).pointerEvents !== "none";
  };
  const inScroll = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (scrolls(getComputedStyle(p))) return true;
    return false;
  };
  const rgb = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const backgroundOf = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const c = rgb(getComputedStyle(p).backgroundColor);
      if (c && (c.length < 4 || c[3] > 0.5)) return c;
    }
    return [13, 13, 16];
  };
  const dimmed = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) if (Number(getComputedStyle(p).opacity) < 0.6) return true;
    return false;
  };

  const texts = [];
  for (const el of document.querySelectorAll('div[dir="auto"], span[dir="auto"]')) {
    const t = label(el);
    if (!t || [...el.children].some((c) => c.matches('div[dir="auto"]'))) continue;
    const cs = getComputedStyle(el);
    if (isIcon(cs) || hidden(el)) continue;
    const v = drawn(el);
    if (!v || covered(el, v)) continue;
    texts.push({ el, t, cs, r: el.getBoundingClientRect(), v, rolling: /^[0-9WL+\-–]$/.test(t) });
  }

  for (const { el, t, cs, r, v, rolling } of texts) {
    if (rolling) continue; // RollingNumber digit columns are clipped on purpose
    const size = parseFloat(cs.fontSize);
    const lh = parseFloat(cs.lineHeight) || size * 1.2;
    if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX + cs.overflow)) fail.push(["cut off", t]);
    else if (el.scrollHeight - el.clientHeight > lh * 0.45 && /hidden|clip/.test(cs.overflowY + cs.overflow)) fail.push(["cut off (lines)", t]);
    if (!inScroll(el)) {
      const cutX = Math.max(v.left - r.left, r.right - v.right), cutY = Math.max(v.top - r.top, r.bottom - v.bottom);
      if (cutX > 2 || cutY > lh * 0.3) fail.push(["clipped by its box", t]);
      if (r.right > W + 1 || r.left < -1) fail.push(["off screen", t]);
    }
    // Size and contrast are measured on each run of text (nested Text
    // renders spans that carry their own colour).
    const hasOwnText = (n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    for (const ink of [el, ...el.querySelectorAll("span")].filter(hasOwnText)) {
    const ics = getComputedStyle(ink);
    const isize = parseFloat(ics.fontSize);
    const it = (ink.textContent || "").trim().slice(0, 48);
    if (isize < 11) debt.smallText.push(`${it} (${isize}px)`);
    if (!dimmed(ink)) {
      const fg = rgb(ics.color), bg = backgroundOf(ink);
      if (fg) {
        const a = fg.length > 3 ? fg[3] : 1;
        const mixed = fg.slice(0, 3).map((c, i) => c * a + bg[i] * (1 - a));
        const L1 = lum(mixed), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const large = isize >= 18 || (isize >= 14 && Number(ics.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) debt.lowContrast.push(`${it} (${ratio.toFixed(1)}:1)`);
      }
    }
    }
  }

  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.rolling || b.rolling || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
    const oy = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
    if (ox > 3 && oy > Math.min(a.v.bottom - a.v.top, b.v.bottom - b.v.top) * 0.35) fail.push(["overlaps", `${a.t} / ${b.t}`]);
  }

  // Content must fit the width: no sideways page scroll.
  if (document.scrollingElement.scrollWidth > W + 1) fail.push(["page scrolls sideways", `${document.scrollingElement.scrollWidth}px wide`]);

  // Tap targets (hitSlop isn't visible on web, so this is debt, not failure).
  for (const el of document.querySelectorAll('[role="button"], [role="tab"], [role="link"], [role="switch"]')) {
    if (hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > H) continue;
    if (r.width < 44 || r.height < 44) {
      const v = drawn(el);
      if (v && !covered(el, v)) debt.smallTarget.push(`${label(el) || el.getAttribute("aria-label") || "control"} (${Math.round(r.width)}x${Math.round(r.height)})`);
    }
  }
  return { fail, debt };
}
