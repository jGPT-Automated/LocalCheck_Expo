/* @ds-bundle: {"format":4,"namespace":"OmniVitalDesignSystem_521e08","components":[],"sourceHashes":{"ui_kits/consumer_app/Components.jsx":"bc268ea6393b","ui_kits/consumer_app/Screens.jsx":"c574289cb729"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.OmniVitalDesignSystem_521e08 = window.OmniVitalDesignSystem_521e08 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/consumer_app/Components.jsx
try { (() => {
// OmniVital Consumer App — Shared Components
// Exports: Navbar, ProductCard, RitualCard, StatCard, StreakBar, Badge, Tag, GlassCard

const OV_LOGO = `<svg width="36" height="36" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="180" height="180" rx="20" fill="#121212"/><g style="transform:scale(95%);transform-origin:center"><path fill="#17a589" d="M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z"/><path fill="#17a589" d="M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z"/></g></svg>`;
const PRODUCTS = [{
  id: 1,
  name: "OV Drive",
  slug: "ov-drive",
  tagline: "Caffeine-free alertness and clean drive.",
  slot: "morning",
  price: 64,
  color: "#0D9488",
  hero: "Cordyceps Militaris",
  cat: "Energy"
}, {
  id: 2,
  name: "OV Adapt",
  slug: "ov-adapt",
  tagline: "Resilient performance under load.",
  slot: "morning",
  price: 68,
  color: "#F59E0B",
  hero: "KSM-66 Ashwagandha",
  cat: "Stress Resilience"
}, {
  id: 3,
  name: "OV Bright",
  slug: "ov-bright",
  tagline: "Steadier mood and calmer baseline.",
  slot: "midday",
  price: 72,
  color: "#F472B6",
  hero: "affron® Saffron",
  cat: "Mood"
}, {
  id: 4,
  name: "OV Quiet Focus",
  slug: "ov-quiet-focus",
  tagline: "Calm concentration without sedation.",
  slot: "midday",
  price: 66,
  color: "#818CF8",
  hero: "Cognizin® CDP-Choline",
  cat: "Focus"
}, {
  id: 5,
  name: "OV Neuro Night",
  slug: "ov-neuro-night",
  tagline: "Premium brain-first night recovery.",
  slot: "evening",
  price: 74,
  color: "#7C3AED",
  hero: "Magnesium Glycinate",
  cat: "Sleep"
}, {
  id: 6,
  name: "OV Cortex",
  slug: "ov-cortex",
  tagline: "Composure under pressure and cognitive clarity.",
  slot: "evening",
  price: 78,
  color: "#DC2626",
  hero: "BaCognize® Bacopa",
  cat: "Cognition"
}];

// ─── Navbar ─────────────────────────────────────────────
function Navbar({
  scrolled = false,
  onNav,
  screen
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      padding: "14px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      transition: "all 0.5s ease",
      background: scrolled ? "hsla(0,0%,4%,0.85)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid hsla(0,0%,100%,0.07)" : "1px solid transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer"
    },
    onClick: () => onNav("landing")
  }, /*#__PURE__*/React.createElement("div", {
    dangerouslySetInnerHTML: {
      __html: OV_LOGO
    },
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      overflow: "hidden"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "#f5f5f5"
    }
  }, "OmniVital")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      alignItems: "center"
    }
  }, ["Products", "Experience", "Science"].map(l => /*#__PURE__*/React.createElement("span", {
    key: l,
    style: {
      position: "relative",
      padding: "8px 16px",
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#8c8c8c",
      cursor: "pointer"
    },
    onClick: () => onNav("landing")
  }, l))), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav("auth"),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "10px 20px",
      borderRadius: 2,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "white",
      background: "linear-gradient(135deg,hsl(168,76%,42%),hsl(168,76%,36%))",
      border: "none",
      cursor: "pointer",
      boxShadow: "0 4px 16px -4px hsla(168,76%,42%,0.35)"
    }
  }, screen === "dashboard" ? "The Collective" : "Sign In / Join"));
}

// ─── ProductCard ────────────────────────────────────────
function ProductCard({
  product,
  onSelect
}) {
  const [hov, setHov] = React.useState(false);
  const dailyPrice = (product.price / 30).toFixed(2);
  return /*#__PURE__*/React.createElement("div", {
    onClick: () => onSelect(product),
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      cursor: "pointer",
      position: "relative",
      overflow: "hidden",
      borderRadius: 2,
      background: "hsla(0,0%,100%,0.03)",
      backdropFilter: "blur(20px)",
      border: `1px solid ${hov ? "hsla(0,0%,100%,0.12)" : "hsla(0,0%,100%,0.06)"}`,
      transition: "all 0.5s",
      boxShadow: `0 0 80px -30px ${product.color}12, 0 0 0 1px ${product.color}08`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -40,
      left: "50%",
      transform: "translateX(-50%)",
      width: 160,
      height: 160,
      borderRadius: "50%",
      background: product.color,
      opacity: hov ? 0.1 : 0.05,
      filter: "blur(40px)",
      transition: "opacity 0.7s",
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      aspectRatio: "1/1",
      overflow: "hidden",
      background: `linear-gradient(135deg,${product.color}15 0%,hsl(0,0%,5%) 70%)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 200,
      transform: hov ? "scale(1.05)" : "scale(1)",
      transition: "transform 0.7s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: "50%",
      background: product.color,
      opacity: 0.85,
      boxShadow: `0 0 40px ${product.color}66`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top,hsl(0,0%,4%) 0%,hsla(0,0%,4%,0.4) 40%,transparent 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      right: 12,
      fontSize: 9,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "hsla(0,0%,100%,0.7)",
      padding: "3px 10px",
      borderRadius: 999,
      backdropFilter: "blur(12px)",
      background: "hsla(0,0%,100%,0.06)",
      border: "1px solid hsla(0,0%,100%,0.08)"
    }
  }, product.cat)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      padding: "20px 20px 18px",
      marginTop: -24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: hov ? "hsl(168,76%,42%)" : "#f5f5f5",
      marginBottom: 4,
      transition: "color 0.3s"
    }
  }, product.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#8c8c8c",
      fontWeight: 300,
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, product.tagline), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      fontWeight: 600,
      padding: "3px 10px",
      borderRadius: 999,
      border: `1px solid ${product.color}35`,
      color: product.color,
      background: `${product.color}08`
    }
  }, product.hero)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      color: "#f5f5f5",
      letterSpacing: "-0.01em"
    }
  }, "$", dailyPrice), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#8c8c8c",
      marginLeft: 6
    }
  }, "/ daily ritual"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#595959",
      marginTop: 2
    }
  }, "$", product.price, "/mo billed monthly")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "hsl(168,76%,42%)",
      transition: "gap 0.3s"
    }
  }, "Explore Formula ", /*#__PURE__*/React.createElement("span", null, "\u2192"))));
}

// ─── RitualCard ─────────────────────────────────────────
function RitualCard({
  product,
  logged = false,
  onLog
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: logged ? `${product.color}0a` : "hsla(0,0%,4%,0.6)",
      backdropFilter: "blur(12px)",
      border: `1px solid ${logged ? product.color + "44" : "hsla(0,0%,100%,0.07)"}`,
      borderRadius: 2,
      padding: "18px 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: logged ? 0 : 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 8,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: logged ? `${product.color}22` : "hsla(0,0%,12%,1)",
      borderLeft: logged ? "none" : `3px solid ${product.color}`
    }
  }, logged ? /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: product.color,
    strokeWidth: "2.5"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#595959",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "#f5f5f5"
    }
  }, product.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#8c8c8c",
      marginTop: 2
    }
  }, product.tagline))), !logged && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "#595959",
      marginBottom: 8
    }
  }, "Log today \u2014 How do you feel?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, [1, 2, 3, 4, 5].map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => onLog && onLog(product.id, s),
    style: {
      flex: 1,
      padding: "7px 0",
      borderRadius: 8,
      background: "hsla(0,0%,12%,1)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      fontSize: 11,
      fontWeight: 600,
      color: "#8c8c8c",
      cursor: "pointer"
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = product.color;
      e.currentTarget.style.color = product.color;
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = "hsla(0,0%,100%,0.07)";
      e.currentTarget.style.color = "#8c8c8c";
    }
  }, s)))), logged && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${product.color}18`,
      fontSize: 11,
      color: product.color,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })), "Logged today"));
}

// ─── StreakBar ───────────────────────────────────────────
function StreakBar({
  days = [true, true, true, true, false, true, true]
}) {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, days.map((active, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: 28,
      borderRadius: 4,
      transition: "all 0.3s",
      background: active ? "hsl(168,76%,42%)" : "hsla(0,0%,12%,1)",
      border: active ? "none" : "1px solid hsla(0,0%,100%,0.07)",
      boxShadow: active ? "0 0 8px -2px hsla(168,76%,42%,0.4)" : "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "#595959"
    }
  }, labels[i]))));
}

// ─── StatCard ────────────────────────────────────────────
function StatCard({
  value,
  label,
  color = "#f5f5f5"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: "center",
      padding: "14px 8px",
      background: "hsla(0,0%,4%,0.6)",
      backdropFilter: "blur(20px)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 700,
      color
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "#8c8c8c",
      marginTop: 4
    }
  }, label));
}

// Export to window
Object.assign(window, {
  Navbar,
  ProductCard,
  RitualCard,
  StreakBar,
  StatCard,
  PRODUCTS,
  OV_LOGO
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consumer_app/Components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/consumer_app/Screens.jsx
try { (() => {
// OmniVital Consumer App — Screen Components
// LandingScreen, ProductDetailScreen, AuthScreen, DashboardScreen

// ─── LandingScreen ──────────────────────────────────────
function LandingScreen({
  onNav
}) {
  const [subscribe, setSubscribe] = React.useState(false);
  const slots = [{
    label: "Morning",
    icon: "☀",
    desc: "Activate",
    products: [PRODUCTS[0], PRODUCTS[1]]
  }, {
    label: "Midday",
    icon: "◑",
    desc: "Sustain",
    products: [PRODUCTS[2], PRODUCTS[3]]
  }, {
    label: "Evening",
    icon: "☾",
    desc: "Recover",
    products: [PRODUCTS[4], PRODUCTS[5]]
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsl(0,0%,4%)",
      minHeight: "100vh",
      color: "#f5f5f5",
      fontFamily: "Inter,sans-serif"
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "hsl(0,0%,4%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "radial-gradient(ellipse 80% 60% at 50% 40%,hsla(168,50%,15%,0.45) 0%,transparent 70%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg,hsl(0,0%,4%) 0%,transparent 20%,transparent 72%,hsl(0,0%,4%) 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0.025,
      backgroundImage: "linear-gradient(hsla(168,76%,42%,1) 1px,transparent 1px),linear-gradient(90deg,hsla(168,76%,42%,1) 1px,transparent 1px)",
      backgroundSize: "52px 52px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 10,
      textAlign: "center",
      padding: "0 24px",
      maxWidth: 720
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.5em",
      textTransform: "uppercase",
      color: "hsl(168,76%,42%)",
      marginBottom: 28
    }
  }, "Premium Performance Wellness"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: "clamp(3rem,8vw,5.5rem)",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      lineHeight: 0.92,
      margin: "0 0 20px",
      color: "#f5f5f5"
    }
  }, "Your Ritual,", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      background: "linear-gradient(135deg,hsl(168,76%,42%),hsl(168,76%,58%))",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text"
    }
  }, "Precision"), " Built."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: "#8c8c8c",
      fontWeight: 400,
      letterSpacing: "0.01em",
      lineHeight: 1.65,
      maxWidth: 380,
      margin: "0 auto 44px"
    }
  }, "Six precision formulas. Three daily windows.", /*#__PURE__*/React.createElement("br", null), "Engineered for how you actually perform."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      justifyContent: "flex-start",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      padding: "13px 36px",
      background: "hsl(168,76%,42%)",
      color: "white",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      borderRadius: 4,
      border: "none",
      cursor: "pointer",
      boxShadow: "0 0 0 1px hsla(168,76%,42%,0.3),0 6px 28px -6px hsla(168,76%,42%,0.55)"
    },
    onClick: () => document.getElementById("ritual-section")?.scrollIntoView({
      block: "start"
    })
  }, "Explore The Ritual"), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: "13px 32px",
      background: "hsla(0,0%,100%,0.05)",
      color: "#8c8c8c",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      borderRadius: 4,
      border: "1px solid hsla(0,0%,100%,0.10)",
      cursor: "pointer"
    },
    onClick: () => onNav("auth")
  }, "Join The Collective"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 32,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      cursor: "pointer"
    },
    onClick: () => document.getElementById("ritual-section")?.scrollIntoView({
      block: "start"
    })
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      letterSpacing: "0.4em",
      textTransform: "uppercase",
      color: "hsla(0,0%,100%,0.25)"
    }
  }, "Explore"), /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "8",
    viewBox: "0 0 12 8",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1L6 6L11 1",
    stroke: "hsla(0,0%,100%,0.3)",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), /*#__PURE__*/React.createElement("section", {
    id: "ritual-section",
    style: {
      padding: "80px 24px",
      maxWidth: 1100,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 64
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      width: 40,
      background: "hsla(0,0%,100%,0.12)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.35em",
      textTransform: "uppercase",
      color: "#8c8c8c"
    }
  }, "The Ritual"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      width: 40,
      background: "hsla(0,0%,100%,0.12)"
    }
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: "clamp(2rem,4vw,3rem)",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "#f5f5f5",
      margin: "0 0 16px"
    }
  }, "Six formulas. ", /*#__PURE__*/React.createElement("span", {
    style: {
      background: "linear-gradient(135deg,hsl(168,76%,42%),hsl(42,80%,55%))",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent"
    }
  }, "Three windows.")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#8c8c8c",
      maxWidth: 400,
      margin: "0 auto"
    }
  }, "Considered actives, in clinical doses, organised into a structure that compounds.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 16px",
      background: "hsla(0,0%,100%,0.03)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: subscribe ? "#8c8c8c" : "#f5f5f5",
      transition: "color 0.3s"
    }
  }, "One-time"), /*#__PURE__*/React.createElement("div", {
    onClick: () => setSubscribe(!subscribe),
    style: {
      width: 44,
      height: 24,
      borderRadius: 12,
      background: subscribe ? "hsl(168,76%,42%)" : "hsla(0,0%,100%,0.12)",
      cursor: "pointer",
      position: "relative",
      transition: "background 0.3s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 3,
      left: subscribe ? 23 : 3,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "white",
      transition: "left 0.3s"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: subscribe ? "#f5f5f5" : "#8c8c8c",
      transition: "color 0.3s"
    }
  }, "Subscribe & Save 20%"))), slots.map(slot => /*#__PURE__*/React.createElement("div", {
    key: slot.label,
    style: {
      marginBottom: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "hsla(168,76%,42%,0.7)"
    }
  }, slot.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "#595959"
    }
  }, slot.label, " \xB7 ", slot.desc)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
      gap: 12
    }
  }, slot.products.map(p => /*#__PURE__*/React.createElement(ProductCard, {
    key: p.id,
    product: subscribe ? {
      ...p,
      price: Math.round(p.price * 0.8)
    } : p,
    onSelect: () => onNav("pdp", p)
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "8px 32px",
      marginTop: 32,
      paddingTop: 32,
      borderTop: "1px solid hsla(0,0%,100%,0.07)"
    }
  }, ["Patented Actives", "Clinical Dosages", "3rd-Party Tested", "GMP-Certified", "Non-GMO", "Vegan"].map(b => /*#__PURE__*/React.createElement("span", {
    key: b,
    style: {
      fontSize: 9,
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      color: "#595959"
    }
  }, b)))));
}

// ─── ProductDetailScreen ─────────────────────────────────
function ProductDetailScreen({
  product,
  onNav
}) {
  const [tab, setTab] = React.useState("bio");
  const [subscribe, setSubscribe] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const tabs = [{
    id: "bio",
    label: "Bio-Availability"
  }, {
    id: "sourcing",
    label: "Sourcing"
  }, {
    id: "ritual",
    label: "Daily Ritual"
  }];
  const tabContent = {
    bio: product.bio || "Uses patented extraction standardized for maximum bioavailability with gradual gastric release over 2–3 hours for steady effect.",
    sourcing: product.sourcing || "Sourced from certified organic farms with full chain-of-custody documentation. Third-party tested for heavy metals, pesticides, and microbial contamination. GMP-certified.",
    ritual: product.ritual || "Take daily with your morning meal. Pairs well with OV Adapt for a complete morning protocol. Consistent daily use supports cumulative benefit."
  };
  const displayPrice = subscribe ? Math.round(product.price * 0.8) : product.price;
  const dailyPrice = (displayPrice / 30).toFixed(2);
  const color = product.color;
  const slotIcons = {
    morning: "☀",
    midday: "◑",
    evening: "☾"
  };
  const benefits = product.benefit_bullets || ["Supports natural ATP production and mitochondrial health", "Promotes sustained alertness without caffeine dependency", "Helps maintain steady energy levels throughout the day", "Supports physical and mental stamina under daily demands"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsl(0,0%,4%)",
      minHeight: "100vh",
      color: "#f5f5f5",
      fontFamily: "Inter,sans-serif",
      paddingTop: 72
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: "0 auto",
      padding: "24px 24px 80px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav("landing"),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 10,
      color: "#8c8c8c",
      background: "none",
      border: "none",
      cursor: "pointer",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      marginBottom: 28,
      padding: 0
    }
  }, "\u2190 Back to Rituals"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 48,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 16,
      overflow: "hidden",
      background: "hsl(0,0%,7%)",
      border: "1px solid hsla(0,0%,100%,0.06)",
      aspectRatio: "1/1"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: "100%",
      background: `linear-gradient(135deg,${color}18 0%,hsl(0,0%,5%) 60%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      borderRadius: "50%",
      background: color,
      opacity: 0.9,
      boxShadow: `0 0 60px ${color}66`,
      margin: "0 auto 16px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      color: color,
      opacity: 0.8
    }
  }, product.hero))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: `linear-gradient(to top,${color}12,transparent 50%)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 500,
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      padding: "4px 12px",
      borderRadius: 999,
      border: `1px solid ${color}44`,
      color,
      background: `${color}10`
    }
  }, product.cat), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      fontSize: 9,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#8c8c8c"
    }
  }, slotIcons[product.slot], " ", product.slot)), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: "clamp(2rem,4vw,3rem)",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1,
      color: "#f5f5f5",
      margin: "0 0 8px"
    }
  }, product.name), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: "#8c8c8c",
      fontWeight: 300,
      margin: "0 0 12px",
      lineHeight: 1.5
    }
  }, product.tagline), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "#595959",
      margin: "0 0 16px"
    }
  }, "Hero Ingredient: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#f5f5f5",
      fontWeight: 500
    }
  }, product.hero)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 32,
      fontWeight: 700,
      color: "#f5f5f5",
      letterSpacing: "-0.02em"
    }
  }, "$", dailyPrice), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#8c8c8c",
      marginLeft: 6
    }
  }, "/ daily ritual")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#595959",
      marginBottom: 16
    }
  }, subscribe ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      textDecoration: "line-through",
      opacity: 0.5
    }
  }, "$", product.price, "/mo"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(42,80%,55%)",
      fontWeight: 600,
      marginLeft: 6
    }
  }, "$", Math.round(product.price * 0.8), "/mo with 20% off")) : `$${product.price}/mo billed monthly`), /*#__PURE__*/React.createElement("div", {
    onClick: () => setSubscribe(!subscribe),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "6px 12px 6px 6px",
      borderRadius: 999,
      border: subscribe ? "1px solid hsla(42,80%,55%,0.35)" : "1px solid hsla(0,0%,100%,0.1)",
      background: subscribe ? "hsla(42,80%,55%,0.08)" : "hsla(0,0%,100%,0.03)",
      cursor: "pointer",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 16,
      borderRadius: 8,
      background: subscribe ? "hsl(42,80%,55%)" : "hsla(0,0%,100%,0.12)",
      position: "relative",
      transition: "background 0.3s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 2,
      left: subscribe ? 16 : 2,
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: "white",
      transition: "left 0.3s"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: subscribe ? "hsl(42,80%,55%)" : "#8c8c8c",
      fontWeight: 500
    }
  }, "Subscribe & Save 20%")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "#595959",
      margin: "0 0 20px"
    }
  }, "2 capsules daily"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 24
    }
  }, benefits.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: "50%",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `${color}15`,
      border: `1px solid ${color}30`,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "3"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#8c8c8c",
      lineHeight: 1.6
    }
  }, b)))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAdded(true),
    style: {
      width: "100%",
      padding: "15px 0",
      background: added ? "hsla(0,0%,12%,1)" : `linear-gradient(135deg,${color},${color}cc)`,
      color: added ? "#8c8c8c" : "white",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      marginBottom: 20,
      boxShadow: added ? "none" : `0 4px 24px -6px ${color}55`,
      transition: "all 0.3s"
    }
  }, added ? "In Your Ritual ✓" : "Add to Ritual"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 20,
      marginBottom: 24,
      flexWrap: "wrap"
    }
  }, [["🧪", "Clinically Dosed"], ["🛡", "3rd-Party Tested"], ["🌿", "Clean Sourced"]].map(([icon, label]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      color: "#595959"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12
    }
  }, icon), label))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      background: "hsla(0,0%,12%,1)",
      borderRadius: 8,
      padding: 4,
      marginBottom: 16
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => setTab(t.id),
    style: {
      flex: 1,
      padding: "8px 0",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      background: tab === t.id ? "hsl(0,0%,7%)" : "transparent",
      color: tab === t.id ? "#f5f5f5" : "#595959",
      border: "none",
      borderRadius: 6,
      cursor: "pointer",
      transition: "all 0.2s",
      boxShadow: tab === t.id ? "0 1px 4px hsla(0,0%,0%,0.3)" : "none"
    }
  }, t.label))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#8c8c8c",
      lineHeight: 1.7,
      margin: 0
    }
  }, tabContent[tab]))))));
}

// ─── AuthScreen ──────────────────────────────────────────
function AuthScreen({
  onNav
}) {
  const [mode, setMode] = React.useState("signin");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsl(0,0%,4%)",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter,sans-serif",
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 400
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-block",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 14,
      background: "hsl(0,0%,7%)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      overflow: "hidden",
      margin: "0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    dangerouslySetInnerHTML: {
      __html: OV_LOGO.replace('width="36" height="36"', 'width="48" height="48"')
    }
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "#f5f5f5",
      margin: "0 0 8px"
    }
  }, mode === "signin" ? "Welcome Back" : "Join The Collective"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "#8c8c8c"
    }
  }, mode === "signin" ? "Sign in to your ritual." : "Create your account and build your ritual.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsla(0,0%,7%,0.8)",
      backdropFilter: "blur(20px)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 2,
      padding: 28
    }
  }, mode === "signup" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      fontSize: 10,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#595959",
      marginBottom: 6
    }
  }, "Full Name"), /*#__PURE__*/React.createElement("input", {
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 14px",
      background: "hsla(0,0%,100%,0.04)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 2,
      color: "#f5f5f5",
      fontSize: 13,
      fontFamily: "Inter,sans-serif",
      outline: "none"
    },
    placeholder: "Your name"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      fontSize: 10,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#595959",
      marginBottom: 6
    }
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 14px",
      background: "hsla(0,0%,100%,0.04)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 2,
      color: "#f5f5f5",
      fontSize: 13,
      fontFamily: "Inter,sans-serif",
      outline: "none"
    },
    placeholder: "you@example.com",
    type: "email"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      fontSize: 10,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#595959",
      marginBottom: 6
    }
  }, "Password"), /*#__PURE__*/React.createElement("input", {
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 14px",
      background: "hsla(0,0%,100%,0.04)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 2,
      color: "#f5f5f5",
      fontSize: 13,
      fontFamily: "Inter,sans-serif",
      outline: "none"
    },
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    type: "password"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav("dashboard"),
    style: {
      width: "100%",
      padding: "13px 0",
      background: "hsl(168,76%,42%)",
      color: "white",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      borderRadius: 2,
      border: "none",
      cursor: "pointer",
      boxShadow: "0 6px 28px -6px hsla(168,76%,42%,0.5)"
    }
  }, mode === "signin" ? "Sign In →" : "Create Account →"), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: "center",
      fontSize: 11,
      color: "#595959",
      marginTop: 20
    }
  }, mode === "signin" ? "Don't have an account? " : "Already have an account? ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(168,76%,42%)",
      cursor: "pointer"
    },
    onClick: () => setMode(mode === "signin" ? "signup" : "signin")
  }, mode === "signin" ? "Join The Collective" : "Sign In")))));
}

// ─── DashboardScreen ─────────────────────────────────────
function DashboardScreen({
  onNav
}) {
  const [loggedIds, setLoggedIds] = React.useState([1, 5]);
  const streakDays = [true, true, true, true, false, true, true];
  const ritualProducts = [PRODUCTS[0], PRODUCTS[1], PRODUCTS[3], PRODUCTS[4]];
  const grouped = {
    morning: ritualProducts.filter(p => p.slot === "morning"),
    midday: ritualProducts.filter(p => p.slot === "midday"),
    evening: ritualProducts.filter(p => p.slot === "evening")
  };
  const slotIcons = {
    morning: "☀",
    midday: "◑",
    evening: "☾"
  };
  const tips = [{
    tag: "Protocol",
    title: "The morning stack matters most.",
    body: "Your cortisol peak is within 30–45 minutes of waking. Take your adaptogens before coffee."
  }, {
    tag: "Insight",
    title: "Consistency beats optimization.",
    body: "A ritual taken daily at 70% beats a perfect stack taken 3 days a week."
  }];
  const chat = [{
    init: "MR",
    name: "Marcus R.",
    time: "2h ago",
    msg: "Day 14 on OV Drive + OV Adapt. Sleep quality noticeably better.",
    badge: true
  }, {
    init: "SK",
    name: "Sofia K.",
    time: "1h ago",
    msg: "Yes! Pairing OV Bright at midday — total game changer for afternoon energy.",
    badge: false
  }, {
    init: "OV",
    name: "OmniVital Team",
    time: "30m ago",
    msg: "Most members notice cognitive support around days 7–14 as compounds build.",
    isTeam: true
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsl(0,0%,4%)",
      minHeight: "100vh",
      color: "#f5f5f5",
      fontFamily: "Inter,sans-serif"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "radial-gradient(ellipse at top left,hsla(168,76%,42%,0.06) 0%,transparent 50%)",
      pointerEvents: "none",
      zIndex: 0
    }
  }), /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 40,
      background: "hsla(0,0%,4%,0.85)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid hsla(0,0%,100%,0.07)",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer"
    },
    onClick: () => onNav("landing")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      background: "hsl(0,0%,7%)",
      borderRadius: 8,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    dangerouslySetInnerHTML: {
      __html: OV_LOGO.replace('width="36" height="36"', 'width="32" height="32"')
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "#f5f5f5"
    }
  }, "OmniVital")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 900,
      letterSpacing: "0.25em",
      textTransform: "uppercase",
      padding: "3px 8px",
      borderRadius: 999,
      border: "1px solid hsla(42,80%,55%,0.3)",
      color: "hsl(42,80%,60%)",
      background: "hsla(42,80%,55%,0.08)"
    }
  }, "OVO\xB7G"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 8,
      background: "hsla(168,76%,42%,0.1)",
      border: "1px solid hsla(168,76%,42%,0.2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      background: "linear-gradient(135deg,hsl(168,76%,42%),hsl(42,80%,55%))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 10,
      fontWeight: 900,
      color: "white"
    }
  }, "J"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#f5f5f5"
    }
  }, "Jessica")), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav("landing"),
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "#8c8c8c",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "6px 12px",
      borderRadius: 8
    }
  }, "Sign Out"))), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 800,
      margin: "0 auto",
      padding: "36px 24px 80px",
      position: "relative",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: "0.3em",
      textTransform: "uppercase",
      color: "hsl(168,76%,42%)",
      fontWeight: 500,
      marginBottom: 8
    }
  }, "Your Dashboard"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "#f5f5f5",
      margin: "0 0 6px"
    }
  }, "Good morning, Jessica."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#8c8c8c",
      margin: 0
    }
  }, "4 products in your ritual. 50% complete today.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    value: "7",
    label: "Day Streak",
    color: "#f5f5f5"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "50%",
    label: "Today",
    color: "hsl(168,76%,42%)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "4",
    label: "Active",
    color: "hsl(42,80%,55%)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsla(0,0%,4%,0.6)",
      backdropFilter: "blur(20px)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 16,
      padding: "20px 20px 16px",
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "hsl(42,80%,55%)"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#f5f5f5"
    }
  }, "7-Day Streak")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 24,
      fontWeight: 700,
      color: "#f5f5f5"
    }
  }, "7 ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 400,
      color: "#8c8c8c"
    }
  }, "days"))), /*#__PURE__*/React.createElement(StreakBar, {
    days: streakDays
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#f5f5f5",
      margin: 0
    }
  }, "Your Ritual Stack"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "hsl(168,76%,42%)",
      cursor: "pointer"
    }
  }, "+ Add")), Object.entries(grouped).map(([slot, prods]) => prods.length === 0 ? null : /*#__PURE__*/React.createElement("div", {
    key: slot,
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "hsla(168,76%,42%,0.7)"
    }
  }, slotIcons[slot]), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "#595959"
    }
  }, slot)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, prods.map(p => /*#__PURE__*/React.createElement(RitualCard, {
    key: p.id,
    product: p,
    logged: loggedIds.includes(p.id),
    onLog: id => setLoggedIds(prev => [...prev, id])
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "hsl(42,80%,55%)",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#f5f5f5",
      margin: 0
    }
  }, "From The Collective")), tips.map((tip, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "hsla(0,0%,4%,0.6)",
      backdropFilter: "blur(20px)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 16,
      padding: 20,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      padding: "3px 10px",
      borderRadius: 999,
      border: "1px solid hsla(42,80%,55%,0.2)",
      color: "hsl(42,80%,60%)",
      background: "hsla(42,80%,55%,0.05)"
    }
  }, tip.tag), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "#f5f5f5",
      margin: "10px 0 6px"
    }
  }, tip.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#8c8c8c",
      lineHeight: 1.6
    }
  }, tip.body)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "hsl(168,76%,42%)",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M23 21v-2a4 4 0 0 0-3-3.87"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 0 1 0 7.75"
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#f5f5f5",
      margin: 0
    }
  }, "The Collective \u2014 Chat"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontSize: 8,
      fontWeight: 900,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      padding: "3px 8px",
      borderRadius: 999,
      border: "1px solid hsla(42,80%,55%,0.3)",
      color: "hsl(42,80%,60%)",
      background: "hsla(42,80%,55%,0.08)"
    }
  }, "OVO\xB7G Members")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsla(0,0%,4%,0.6)",
      backdropFilter: "blur(20px)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 16,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 16px 8px",
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, chat.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 10,
      fontWeight: 900,
      background: m.isTeam ? "linear-gradient(135deg,hsl(168,76%,42%),hsl(42,80%,55%))" : "hsla(0,0%,12%,1)",
      color: "#f5f5f5"
    }
  }, m.init), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: "#f5f5f5"
    }
  }, m.name), m.badge && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8,
      fontWeight: 900,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      padding: "2px 6px",
      borderRadius: 999,
      border: "1px solid hsla(42,80%,55%,0.3)",
      color: "hsl(42,80%,60%)",
      background: "hsla(42,80%,55%,0.08)"
    }
  }, "OVO\xB7G"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "#595959",
      marginLeft: "auto"
    }
  }, m.time)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      color: m.isTeam ? "hsl(168,76%,42%)" : "#8c8c8c",
      lineHeight: 1.5
    }
  }, m.msg))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid hsla(0,0%,100%,0.07)",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 26,
      height: 26,
      borderRadius: "50%",
      background: "linear-gradient(135deg,hsl(168,76%,42%),hsl(42,80%,55%))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 9,
      fontWeight: 900,
      color: "white",
      flexShrink: 0
    }
  }, "J"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      background: "hsla(0,0%,100%,0.03)",
      border: "1px solid hsla(0,0%,100%,0.07)",
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      flex: 1,
      background: "transparent",
      border: "none",
      outline: "none",
      color: "#f5f5f5",
      fontSize: 12,
      fontFamily: "Inter,sans-serif"
    },
    placeholder: "Share with The Collective..."
  }), /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "hsl(168,76%,42%)",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "22",
    y1: "2",
    x2: "11",
    y2: "13"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "22 2 15 22 11 13 2 9 22 2"
  }))))))));
}
Object.assign(window, {
  LandingScreen,
  ProductDetailScreen,
  AuthScreen,
  DashboardScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/consumer_app/Screens.jsx", error: String((e && e.message) || e) }); }

})();
