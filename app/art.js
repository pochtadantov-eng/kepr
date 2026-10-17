// Собственные SVG-иллюстрации для плиток главного экрана.
// Нарисованы вручную, стилизованы под изометрию с мягким светом.
window.ART = {
  safe: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
      <linearGradient id="co1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#d99a00"/></linearGradient>
      <linearGradient id="sv1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5e5e8"/><stop offset="1" stop-color="#9a9aa0"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="110" rx="42" ry="6" fill="#000" opacity=".55"/>
    <path d="M22 90 L22 102 L98 102 L98 90 Z" fill="url(#pd1)"/>
    <rect x="26" y="40" width="68" height="54" rx="8" fill="url(#sv1)"/>
    <rect x="32" y="46" width="56" height="42" rx="5" fill="#3a3a3e"/>
    <circle cx="68" cy="67" r="11" fill="#5a5a60" stroke="#2a2a2d" stroke-width="2"/>
    <circle cx="68" cy="67" r="2" fill="#2a2a2d"/>
    <rect x="38" y="63" width="14" height="8" rx="1.5" fill="#2a2a2d"/>
    <ellipse cx="60" cy="30" rx="18" ry="6" fill="#000" opacity=".3"/>
    <circle cx="60" cy="22" r="14" fill="url(#co1)" stroke="#b07a00" stroke-width="1.5"/>
    <text x="60" y="27" text-anchor="middle" font-size="13" font-weight="900" fill="#8a5a00" font-family="Arial">₽</text>
    <path d="M46 36 L60 24 L74 36" fill="none" stroke="#fff" stroke-width="1.5" opacity=".4"/>
  </svg>`,
  sim: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pd2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
      <linearGradient id="sh1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b5bff"/><stop offset="1" stop-color="#3a1f99"/></linearGradient>
      <linearGradient id="si1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#d99a00"/></linearGradient>
      <linearGradient id="bl1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="110" rx="46" ry="6" fill="#000" opacity=".55"/>
    <path d="M14 94 L14 106 L106 106 L106 94 Z" fill="url(#pd2)"/>
    <path d="M26 46 L26 96 L50 96 L50 56 L38 46 Z" fill="url(#sh1)" stroke="#1f0f66" stroke-width="1"/>
    <path d="M60 42 L60 96 L84 96 L84 52 L74 42 Z" fill="url(#si1)" stroke="#8a5a00" stroke-width="1"/>
    <rect x="64" y="60" width="16" height="12" rx="2" fill="#8a5a00"/>
    <path d="M65 63 h14 M65 66 h14 M65 69 h14" stroke="#ffe066" stroke-width=".8"/>
    <text x="72" y="86" text-anchor="middle" font-size="9" font-weight="900" fill="#8a5a00" font-family="Arial">SIM</text>
    <circle cx="92" cy="82" r="12" fill="url(#bl1)" stroke="#0b1f55" stroke-width="1"/>
    <text x="92" y="86" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="Arial">5G</text>
  </svg>`,
  pop: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pd3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
      <linearGradient id="st1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d9dc"/><stop offset="1" stop-color="#86868a"/></linearGradient>
      <linearGradient id="rd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4b4b"/><stop offset="1" stop-color="#9b1414"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="110" rx="46" ry="6" fill="#000" opacity=".55"/>
    <path d="M14 94 L14 106 L106 106 L106 94 Z" fill="url(#pd3)"/>
    <path d="M28 48 L92 48 L84 96 L36 96 Z" fill="url(#st1)"/>
    <rect x="28" y="44" width="64" height="8" rx="2" fill="url(#rd1)"/>
    <path d="M36 44 L36 96 M44 44 L44 96 M52 44 L52 96 M60 44 L60 96 M68 44 L68 96 M76 44 L76 96 M84 44 L84 96" stroke="#9b1414" stroke-width="2" opacity=".6"/>
    <g fill="#ffe066">
      <circle cx="42" cy="40" r="6"/><circle cx="38" cy="36" r="4"/><circle cx="46" cy="34" r="5"/>
      <circle cx="56" cy="30" r="7"/><circle cx="62" cy="36" r="5"/><circle cx="52" cy="38" r="4"/>
      <circle cx="72" cy="32" r="6"/><circle cx="78" cy="38" r="5"/><circle cx="68" cy="40" r="4"/>
      <circle cx="84" cy="42" r="4"/><circle cx="34" cy="42" r="3"/>
    </g>
    <g fill="#fff8c6" opacity=".9">
      <circle cx="44" cy="38" r="2"/><circle cx="58" cy="33" r="2"/><circle cx="74" cy="35" r="2"/>
    </g>
  </svg>`,
  card: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pd4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
      <linearGradient id="cd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f2f5"/><stop offset="1" stop-color="#b8b8be"/></linearGradient>
      <linearGradient id="hr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#d99a00"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="110" rx="46" ry="6" fill="#000" opacity=".55"/>
    <path d="M14 94 L14 106 L106 106 L106 94 Z" fill="url(#pd4)"/>
    <g transform="translate(18 44) rotate(-6)">
      <rect width="68" height="44" rx="6" fill="url(#cd1)"/>
      <rect x="6" y="10" width="14" height="10" rx="2" fill="#c9a24a"/>
      <path d="M6 30 h20 M6 34 h30" stroke="#86868a" stroke-width="1.4"/>
    </g>
    <g transform="translate(62 50)">
      <path d="M14 6 C14 0, 22 0, 22 8 C22 14, 14 20, 14 20 C14 20, 6 14, 6 8 C6 0, 14 0, 14 6 Z" fill="url(#hr1)" stroke="#8a5a00" stroke-width="1"/>
    </g>
  </svg>`,
  piggy: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pd5" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
      <linearGradient id="pg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3c6"/><stop offset="1" stop-color="#d96a8a"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="110" rx="42" ry="6" fill="#000" opacity=".55"/>
    <path d="M22 94 L22 106 L98 106 L98 94 Z" fill="url(#pd5)"/>
    <ellipse cx="60" cy="68" rx="34" ry="24" fill="url(#pg1)"/>
    <path d="M34 56 L28 44 L44 50 Z" fill="url(#pg1)"/>
    <ellipse cx="76" cy="68" rx="10" ry="8" fill="#d96a8a"/>
    <circle cx="74" cy="66" r="1.6" fill="#2a0f1a"/><circle cx="78" cy="66" r="1.6" fill="#2a0f1a"/>
    <circle cx="50" cy="62" r="2" fill="#2a0f1a"/>
    <rect x="52" y="52" width="12" height="2.4" rx="1" fill="#2a0f1a"/>
    <rect x="40" y="88" width="4" height="6" fill="#d96a8a"/><rect x="72" y="88" width="4" height="6" fill="#d96a8a"/>
  </svg>`,
};
