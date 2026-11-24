export const RUNTIME_CSS = /* css */ `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:var(--pm-font);color:var(--pm-text);-webkit-font-smoothing:antialiased}
.pm-viewport{position:fixed;inset:0;background:#000}
.pm-stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:50% 50%;overflow:hidden;background:var(--pm-bg);contain:strict}
.pm-overlay{position:absolute;inset:0;z-index:50;pointer-events:none;overflow:hidden}
.pm-scene{position:absolute;inset:0;overflow:hidden;background:var(--pm-bg);visibility:hidden}
.pm-bg,.pm-decor,.pm-fill{position:absolute;inset:0;pointer-events:none}
.pm-bg{background:radial-gradient(1400px 900px at 80% 0%, var(--pm-bg2), transparent 70%), var(--pm-bg);overflow:hidden}
.pm-decor{z-index:1;overflow:hidden}
.pm-decor svg,.pm-bg svg{position:absolute;inset:0;width:100%;height:100%}
.pm-content{position:absolute;inset:0;z-index:2;padding:120px 150px;display:flex;flex-direction:column;justify-content:center;gap:28px}
.pm-title{font-family:var(--pm-display);font-weight:700;line-height:1.04;letter-spacing:-0.02em;margin:0;max-width:1500px;text-wrap:balance}
.pm-title .pm-w{display:inline-block;white-space:nowrap}
.pm-sub{font-size:40px;color:var(--pm-muted);margin:0;max-width:1300px;line-height:1.3;font-weight:500}
.pm-body{font-size:34px;color:var(--pm-muted);margin:0;max-width:1250px;line-height:1.45}
.pm-kicker{width:120px;height:8px;border-radius:8px;background:linear-gradient(90deg,var(--pm-accent),var(--pm-accent2))}
.pm-caret{display:inline-block;margin-left:4px;font-weight:400}
.pm-mask{display:inline-block;overflow:hidden;vertical-align:bottom;padding-bottom:.08em}
.pm-mask-inner{display:inline-block}
.pm-c{display:inline-block;white-space:pre}

/* hero / closing */
.pm-l-hero .pm-content,.pm-l-closing .pm-content{align-items:center;text-align:center}
.pm-l-hero .pm-sub,.pm-l-closing .pm-sub{font-size:44px}
.pm-pills{display:flex;gap:20px;flex-wrap:wrap;justify-content:center;margin-top:16px}
.pm-pill{padding:18px 34px;border-radius:999px;font-size:30px;font-weight:600;background:var(--pm-surface);border:2px solid color-mix(in srgb,var(--pm-accent) 60%,transparent)}
.pm-l-closing .pm-pill:first-child{background:var(--pm-accent);color:var(--pm-bg);border-color:transparent}

/* bullets & split */
.pm-col{display:flex;flex-direction:column;gap:28px;min-width:0}
.pm-bullets{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:22px}
.pm-bullets li{display:flex;gap:28px;align-items:baseline;font-size:38px;line-height:1.3;padding:18px 28px;border-radius:20px;background:var(--pm-surface);border:1px solid rgba(255,255,255,.08)}
.pm-mark{font-family:var(--pm-display);font-weight:700;color:var(--pm-accent);font-size:30px;min-width:48px}
.pm-hl{position:absolute;left:0;bottom:0;height:4px;width:100%;transform-origin:0 50%;transform:scaleX(0);border-radius:4px}
.pm-l-split-image .pm-content{flex-direction:row;align-items:center;gap:90px}
.pm-l-split-image .pm-col{flex:1.1}
.pm-l-split-image .pm-bullets li{font-size:32px}
.pm-media{flex:1;margin:0;height:760px;border-radius:36px;overflow:hidden;position:relative;box-shadow:0 40px 120px rgba(0,0,0,.45)}
.pm-media img,.pm-media video{width:100%;height:100%;object-fit:cover;display:block}
.pm-media-empty{background:linear-gradient(140deg,var(--pm-accent),var(--pm-accent2));display:grid;place-items:center}
.pm-glyph{font-family:var(--pm-display);font-size:420px;font-weight:700;color:rgba(255,255,255,.85);mix-blend-mode:overlay}

/* stats */
.pm-stats{display:grid;gap:32px;margin-top:24px}
.pm-stat{padding:48px 40px;border-radius:32px;background:var(--pm-surface);border:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;gap:14px}
.pm-num{font-family:var(--pm-display);font-weight:700;font-size:104px;line-height:1;background:linear-gradient(120deg,var(--pm-accent),var(--pm-accent2));-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}
.pm-stat-label{font-size:30px;color:var(--pm-muted);line-height:1.3}
.pm-l-big-number .pm-content{align-items:center;text-align:center;gap:18px}
.pm-huge{font-size:300px;letter-spacing:-0.04em}
.pm-huge-label{font-size:46px;font-weight:600}

/* chart */
.pm-chart{display:flex;align-items:flex-end;gap:40px;height:560px;margin-top:20px;padding:0 20px;border-bottom:2px solid rgba(255,255,255,.15)}
.pm-bar{flex:1;height:100%;display:flex;flex-direction:column;align-items:stretch}
.pm-bar-track{flex:1;display:flex;align-items:flex-end}
.pm-bar-fill{width:100%;border-radius:18px 18px 4px 4px;background:linear-gradient(180deg,var(--pm-accent),color-mix(in srgb,var(--pm-accent2) 70%,transparent));transform-origin:50% 100%;position:relative}
.pm-bar-val{position:absolute;top:-62px;left:0;right:0;text-align:center;font-family:var(--pm-display);font-weight:700;font-size:40px}
.pm-bar-label{text-align:center;font-size:26px;color:var(--pm-muted);padding-top:18px;height:70px}

/* cards & timeline */
.pm-cards,.pm-timeline{display:grid;gap:30px;margin-top:20px}
.pm-card{padding:44px 38px;border-radius:30px;background:var(--pm-surface);border:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;gap:16px;backdrop-filter:blur(6px)}
.pm-card h3,.pm-step h3{font-family:var(--pm-display);font-size:38px;margin:0;line-height:1.15}
.pm-card p,.pm-step p{font-size:27px;color:var(--pm-muted);margin:0;line-height:1.4}
.pm-badge{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;font-weight:700;font-size:30px;background:linear-gradient(135deg,var(--pm-accent),var(--pm-accent2));color:var(--pm-bg)}
.pm-timeline{position:relative;padding-top:20px}
.pm-timeline::before{content:"";position:absolute;left:0;right:0;top:52px;height:4px;background:linear-gradient(90deg,var(--pm-accent),var(--pm-accent2));opacity:.5;border-radius:4px}
.pm-step{position:relative;display:flex;flex-direction:column;gap:16px;padding-right:20px}
.pm-step .pm-badge{border-radius:50%;box-shadow:0 0 0 10px var(--pm-bg)}

/* Onda cards (runtime/onda): the host is the slot the card is zoomed to fit */
.pm-card-host{position:relative;min-width:0;min-height:0}
.pm-card-full{flex:1;align-self:stretch}
.pm-card-list{flex:1;align-self:stretch;margin-top:8px}
.pm-content.pm-with-card{flex-direction:row;align-items:center;gap:72px;text-align:left}
.pm-with-card .pm-card-col{flex:1 1 0;min-width:0;align-items:flex-start}
.pm-with-card .pm-pills{justify-content:flex-start}
.pm-card-side{flex:1 1 0;align-self:stretch}

/* quote */
.pm-l-quote .pm-content{padding:140px 220px}
.pm-quote{margin:0;position:relative}
.pm-quote p{font-family:var(--pm-display);font-size:68px;line-height:1.22;margin:0;font-weight:600;text-wrap:balance}
.pm-qmark{position:absolute;left:-120px;top:-90px;font-size:300px;line-height:1;color:var(--pm-accent);opacity:.7;font-family:Georgia,serif}
.pm-l-quote cite{font-size:36px;color:var(--pm-accent);font-style:normal;font-weight:600}
.pm-title-small{color:var(--pm-muted)}

/* ── per-slide styles ─────────────────────────────────────────── */
.pm-bg::after{content:"";position:absolute;inset:0;pointer-events:none}
/* solid: accent-tinted frame, opaque cards with accent edge */
.pm-s-solid .pm-bg::after{background:linear-gradient(160deg,color-mix(in srgb,var(--pm-accent) 48%,var(--pm-bg)),color-mix(in srgb,var(--pm-accent) 22%,var(--pm-bg)) 75%);opacity:.92}
.pm-s-solid .pm-stat,.pm-s-solid .pm-card,.pm-s-solid .pm-bullets li{background:color-mix(in srgb,var(--pm-bg) 88%,var(--pm-accent));border:0;border-left:8px solid var(--pm-accent);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.pm-s-solid .pm-kicker{width:200px;height:12px}
.pm-s-solid .pm-pill{background:var(--pm-accent);color:var(--pm-bg);border-color:transparent}
/* outline: crisp outlines, uppercase title */
.pm-s-outline .pm-title{text-transform:uppercase;letter-spacing:.02em}
.pm-s-outline .pm-stat,.pm-s-outline .pm-card,.pm-s-outline .pm-bullets li,.pm-s-outline .pm-media{background:transparent;border:3px solid var(--pm-accent2);border-radius:6px}
.pm-s-outline .pm-badge{background:transparent;border:3px solid var(--pm-accent2);color:var(--pm-accent2);border-radius:6px}
.pm-s-outline .pm-num{background:none;color:var(--pm-text);-webkit-text-stroke:3px var(--pm-accent2);color:transparent}
.pm-s-outline .pm-bg::after{background-image:linear-gradient(color-mix(in srgb,var(--pm-accent2) 12%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--pm-accent2) 12%,transparent) 1px,transparent 1px);background-size:80px 80px}
/* gradient: vivid gradient type + cards */
.pm-s-gradient .pm-title{background:linear-gradient(100deg,var(--pm-text) 10%,var(--pm-accent) 55%,var(--pm-accent2));-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:.08em}
.pm-s-gradient .pm-title *{background:inherit;-webkit-background-clip:text;background-clip:text;color:transparent}
.pm-s-gradient .pm-stat,.pm-s-gradient .pm-card,.pm-s-gradient .pm-bullets li{background:linear-gradient(135deg,color-mix(in srgb,var(--pm-accent) 32%,transparent),color-mix(in srgb,var(--pm-accent2) 22%,transparent));border:1px solid rgba(255,255,255,.18);border-radius:36px}
.pm-s-gradient .pm-bg::after{background:radial-gradient(1000px 700px at 15% 100%,color-mix(in srgb,var(--pm-accent2) 35%,transparent),transparent 70%)}
/* editorial: left aligned, rules, oversized numbers */
.pm-s-editorial:not(.pm-l-split-image) .pm-content{align-items:flex-start!important;text-align:left!important;padding-left:200px}
.pm-s-editorial .pm-title{font-weight:800;letter-spacing:-.035em;border-left:10px solid var(--pm-accent);padding-left:40px;margin-left:-50px}
.pm-s-editorial .pm-stat,.pm-s-editorial .pm-card,.pm-s-editorial .pm-bullets li{background:transparent;border:0;border-top:2px solid color-mix(in srgb,var(--pm-text) 35%,transparent);border-radius:0;padding-left:0;padding-right:0}
.pm-s-editorial .pm-num{font-size:140px;background:none;color:var(--pm-accent)}
.pm-s-editorial .pm-kicker{display:none}
.pm-s-editorial .pm-bg::after{background:var(--pm-bg);opacity:.55}
.pm-s-editorial .pm-pills{justify-content:flex-start}
/* split: color block behind half the frame */
.pm-s-split .pm-bg::after{background:linear-gradient(105deg,color-mix(in srgb,var(--pm-accent) 45%,var(--pm-bg)) 0 44%,transparent 44.1%)}
.pm-s-split .pm-stat,.pm-s-split .pm-card,.pm-s-split .pm-bullets li{background:color-mix(in srgb,var(--pm-bg) 80%,transparent);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14)}
.pm-s-split .pm-title{text-shadow:0 6px 30px rgba(0,0,0,.35)}
.pm-s-split .pm-mark,.pm-s-split .pm-badge{color:var(--pm-text)}

/* ── portrait stage (mobile / tablet app view): 1080×1920, stacked layouts ── */
.pm-portrait{--pm-ts:.72}
.pm-portrait .pm-stage{width:1080px;height:1920px}
.pm-portrait .pm-content{padding:170px 90px 230px;gap:34px}
.pm-portrait .pm-title{max-width:100%}
.pm-portrait .pm-sub{font-size:42px}
.pm-portrait .pm-body{font-size:36px}
.pm-portrait .pm-bullets li{font-size:38px;padding:22px 28px}
.pm-portrait .pm-l-split-image .pm-content{flex-direction:column;align-items:stretch;justify-content:center;gap:56px}
.pm-portrait .pm-l-split-image .pm-col{flex:none}
.pm-portrait .pm-l-split-image .pm-bullets li{font-size:34px}
.pm-portrait .pm-media{flex:none;height:620px}
.pm-portrait .pm-glyph{font-size:320px}
.pm-portrait .pm-stats{grid-template-columns:repeat(2,1fr)!important;gap:28px}
.pm-portrait .pm-stat{padding:40px 34px}
.pm-portrait .pm-num{font-size:92px}
.pm-portrait .pm-huge{font-size:230px}
.pm-portrait .pm-chart{height:880px;gap:22px;padding:0}
.pm-portrait .pm-bar-val{font-size:32px;top:-52px}
.pm-portrait .pm-bar-label{font-size:24px}
.pm-portrait .pm-cards{grid-template-columns:1fr!important;gap:24px}
.pm-portrait .pm-card{padding:34px 34px;display:grid;grid-template-columns:64px 1fr;column-gap:28px;row-gap:8px;align-items:start}
.pm-portrait .pm-card .pm-badge,.pm-portrait .pm-step .pm-badge{grid-row:span 2}
.pm-portrait .pm-timeline{grid-template-columns:1fr!important;gap:44px;padding-top:0}
.pm-portrait .pm-timeline::before{left:30px;right:auto;top:10px;bottom:10px;width:4px;height:auto}
.pm-portrait .pm-step{display:grid;grid-template-columns:64px 1fr;column-gap:32px;row-gap:8px;padding-right:0}
.pm-portrait .pm-content.pm-with-card{flex-direction:column;align-items:stretch;gap:48px}
.pm-portrait .pm-with-card .pm-card-col{flex:none}
.pm-portrait .pm-card-side{flex:1 1 0;min-height:560px}
.pm-portrait .pm-l-quote .pm-content{padding:200px 110px}
.pm-portrait .pm-quote p{font-size:60px}
.pm-portrait .pm-qmark{position:static;display:block;height:150px;margin-bottom:10px;font-size:240px}
.pm-portrait .pm-s-editorial:not(.pm-l-split-image) .pm-content{padding-left:130px}
.pm-portrait .pm-s-split .pm-bg::after{background:linear-gradient(172deg,color-mix(in srgb,var(--pm-accent) 45%,var(--pm-bg)) 0 34%,transparent 34.1%)}
.pm-portrait .pm-pills{gap:16px}
.pm-portrait .pm-pill{font-size:30px}
.pm-portrait .pm-badge-corner{font-size:30px}

/* ── web page format (scrolling, responsive; sections scaled from the design width with CSS zoom) ── */
html.pm-web-root,html.pm-web-root body{height:auto;overflow-x:hidden;overflow-y:auto;background:var(--pm-bg);scroll-behavior:smooth}
.pm-web .pm-websec{position:relative;scroll-margin-top:64px;overflow:hidden}
.pm-web .pm-web-zoom{width:1920px}
.pm-web.pm-portrait .pm-web-zoom{width:1080px}
.pm-web .pm-scene{position:relative;inset:auto;visibility:visible;min-height:980px}
.pm-web .pm-content{position:relative;inset:auto;min-height:980px;padding:150px 150px 120px}
.pm-web .pm-websec:first-of-type .pm-scene,.pm-web .pm-websec:first-of-type .pm-content{min-height:calc(100vh / var(--pm-z, 1))}
.pm-web.pm-portrait .pm-scene,.pm-web.pm-portrait .pm-content{min-height:1500px}
.pm-web.pm-portrait .pm-content{padding:200px 90px 150px}
.pm-web .pm-websec+.pm-websec .pm-scene{border-top:1px solid color-mix(in srgb,var(--pm-text) 8%,transparent)}
.pm-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:64px;display:flex;align-items:center;gap:24px;padding:0 28px;background:color-mix(in srgb,var(--pm-bg) 72%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid color-mix(in srgb,var(--pm-text) 10%,transparent);font:500 15px/1 var(--pm-font)}
.pm-brand{font:700 18px/1 var(--pm-display);color:var(--pm-text);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw}
.pm-links{display:flex;gap:4px;margin-left:auto;overflow:hidden}
.pm-links a{color:var(--pm-muted);text-decoration:none;padding:8px 12px;border-radius:10px;white-space:nowrap}
.pm-links a:hover,.pm-links a:focus-visible{color:var(--pm-text);background:var(--pm-surface);outline:none}
.pm-menu{display:none;margin-left:auto;background:transparent;border:0;color:var(--pm-text);width:40px;height:40px;border-radius:10px;cursor:pointer}
.pm-scrollbar{position:absolute;left:0;right:0;bottom:-1px;height:2px;background:linear-gradient(90deg,var(--pm-accent),var(--pm-accent2));transform-origin:0 50%;transform:scaleX(0)}
.pm-foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:28px;color:var(--pm-muted);font:14px/1.4 var(--pm-font);border-top:1px solid color-mix(in srgb,var(--pm-text) 10%,transparent)}
@media (max-width:820px){
  .pm-links{display:none;position:absolute;top:64px;left:0;right:0;flex-direction:column;padding:10px;background:var(--pm-bg);border-bottom:1px solid color-mix(in srgb,var(--pm-text) 10%,transparent)}
  .pm-nav.open .pm-links{display:flex}
  .pm-menu{display:grid;place-items:center}
  .pm-brand{max-width:70vw}
}

/* engine helpers */
.pm-blob{position:absolute;width:1200px;height:1200px;border-radius:50%;filter:blur(40px)}
.pm-grid3d{position:absolute;left:-50%;right:-50%;bottom:-20%;height:90%;background-size:120px 120px;transform:perspective(600px) rotateX(62deg);transform-origin:50% 100%}
.pm-particle{position:absolute;border-radius:50%}
.pm-dotgrid{position:absolute;inset:40px;display:grid;align-items:center;justify-items:center;opacity:.6}
.pm-dotgrid span{width:8px;height:8px;border-radius:50%}
.pm-aurora{position:absolute;left:-20%;width:140%;height:260px;filter:blur(70px);border-radius:50%}
.pm-conic{position:absolute;left:50%;top:50%;width:2600px;height:2600px;margin:-1300px 0 0 -1300px;border-radius:50%;filter:blur(60px)}
.pm-glass{position:absolute;border:2px solid;background:rgba(255,255,255,.04);backdrop-filter:blur(4px)}
.pm-shutter{position:absolute;top:0;bottom:0;transform:scaleY(0);transform-origin:50% 0}
.pm-tile{position:absolute;transform:scale(0)}
.pm-curtain{position:absolute;inset:0;transform:translateX(-101%)}
.pm-badge-corner{position:absolute;right:32px;top:28px;z-index:60;padding:10px 20px;border-radius:12px;background:rgba(0,0,0,.55);color:#fff;font:600 24px/1 ui-monospace,monospace;letter-spacing:.02em}

/* remocn components (React/Remotion, mounted in a <Player>) */
.pm-rc-ghost{display:inline-block;max-width:100%;visibility:hidden}
.pm-rc-box{position:absolute;pointer-events:none}
.pm-rc-fill{position:absolute;inset:0}
.pm-rc-icon{position:absolute;right:110px;top:90px;width:180px;height:180px}
.pm-portrait .pm-rc-icon{right:70px;top:70px;width:150px;height:150px}
.pm-l-showcase .pm-content{align-items:center;text-align:center;justify-content:flex-start;padding:70px 110px 60px;gap:18px}
.pm-l-showcase .pm-sub{font-size:32px}
.pm-showcase{position:relative;flex:1;width:100%;min-height:0;border-radius:28px;overflow:hidden}
.pm-web .pm-l-showcase .pm-showcase{flex:none;height:720px}
.pm-portrait .pm-l-showcase .pm-content{padding:110px 70px 90px}

/* player chrome */
.pm-controls{position:fixed;left:16px;right:16px;bottom:14px;z-index:100;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;background:rgba(10,10,14,.72);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);color:#fff;font:500 13px/1 ui-sans-serif,system-ui,sans-serif;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}
body.pm-ui-on .pm-controls,body:not(.pm-playing) .pm-controls{opacity:1;transform:none}
.pm-btn{appearance:none;border:0;background:transparent;color:#fff;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;cursor:pointer;flex:none}
.pm-btn:hover{background:rgba(255,255,255,.12)}
.pm-btn:focus-visible{outline:2px solid #fff;outline-offset:1px}
.pm-btn.on{color:#a5b4fc;background:rgba(165,180,252,.15)}
.pm-time{font-variant-numeric:tabular-nums;opacity:.85;min-width:84px}
.pm-scene-label{opacity:.7;white-space:nowrap}
.pm-progress{position:relative;flex:1;height:6px;border-radius:6px;background:rgba(255,255,255,.18);cursor:pointer;touch-action:none}
.pm-progress:hover{height:8px}
.pm-progress-fill{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#818cf8,#22d3ee)}
.pm-knob{position:absolute;right:-7px;top:50%;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(129,140,248,.35)}
.pm-marker{position:absolute;top:-3px;bottom:-3px;width:2px;background:rgba(255,255,255,.55);border-radius:2px}
.pm-bigplay{position:fixed;left:50%;top:50%;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:99;backdrop-filter:blur(8px);transition:opacity .2s,transform .2s}
.pm-bigplay svg{width:44px;height:44px}
body.pm-playing .pm-bigplay{opacity:0;pointer-events:none;transform:scale(.8)}
@media (max-width:520px){.pm-scene-label,.pm-time{display:none}}
@media (prefers-reduced-motion: reduce){.pm-controls{transition:none}}
`;
