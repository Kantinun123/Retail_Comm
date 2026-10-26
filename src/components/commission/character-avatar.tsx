"use client";

/* =============================================================
   ตัวละครสัดส่วนคนปกติ + สไตล์ฟีล Animal Crossing
   (gradient หัว/ตัว + highlight + ตาเงา + แก้มชมพู + เงานุ่ม)
   species: human + 30 สัตว์ — ลำตัว/เสื้อผ้า/ชุดฮีโร่ใช้ร่วมกันทุกสายพันธุ์
   viewBox 120x210
   ============================================================= */
import { useId } from "react";
import type { CharacterConfig } from "@/lib/commission/character";
import { costumeById } from "@/lib/commission/character";

function shade(hex: string, amt = -22): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function CharacterAvatar({
  config,
  size = 150,
  showBg = true,
  className,
}: {
  config: CharacterConfig;
  size?: number;
  showBg?: boolean;
  className?: string;
}) {
  const c = config;
  const uid = useId().replace(/:/g, "");
  const isAnimal = !!c.species && c.species !== "human";
  const outline = "#3a2a22";
  const costume = c.costume && c.costume !== "none" ? costumeById(c.costume) : undefined;

  // สีหัว/ผิว: สัตว์ใช้ furColor, คนใช้ skin
  const headColor = isAnimal ? c.furColor : c.skin;
  const headDark = shade(headColor, -30);
  const headLight = shade(headColor, 40);

  // ลำตัว
  const shoulderW = c.gender === "female" ? 26 : 30;
  const waistW = c.gender === "female" ? 18 : 22;
  const topY = 92, waistY = 150;

  const topColor = costume ? costume.suit : c.topColor;
  const bottomColor = costume ? costume.suit : c.bottomColor;
  const shoesColor = costume ? costume.accent : c.shoesColor;
  const sleeveColor = costume
    ? costume.suit
    : c.top === "hoodie" || c.top === "jacket" || c.top === "suit" || c.top === "polo"
      ? c.topColor
      : headColor;

  // gradient ids (unique ต่อ instance)
  const gHead = `h${uid}`, gTop = `t${uid}`, gBg = `b${uid}`;

  return (
    <svg
      viewBox="0 0 120 210"
      width={size}
      height={(size * 210) / 120}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={gHead} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor={headLight} />
          <stop offset="100%" stopColor={headColor} />
        </radialGradient>
        <radialGradient id={gTop} cx="40%" cy="22%" r="95%">
          <stop offset="0%" stopColor={shade(topColor, 28)} />
          <stop offset="100%" stopColor={topColor} />
        </radialGradient>
        {showBg && (
          <radialGradient id={gBg} cx="50%" cy="38%" r="72%">
            <stop offset="0%" stopColor={shade(c.bgColor, 14)} />
            <stop offset="100%" stopColor={c.bgColor} />
          </radialGradient>
        )}
      </defs>

      {showBg && <circle cx="60" cy="70" r="58" fill={`url(#${gBg})`} />}

      {isAnimal ? (
        /* ============ โหมดสัตว์: ทรงป้อม AC (หัวโต ตัวกลม แขนขาสั้น) ============ */
        <AnimalChibi
          c={c}
          costume={costume}
          gHead={`url(#${gHead})`}
          gTop={`url(#${gTop})`}
          headColor={headColor}
          headDark={headDark}
          headLight={headLight}
          topColor={topColor}
          bottomColor={bottomColor}
          shoesColor={shoesColor}
          outline={outline}
        />
      ) : (
        /* ============ โหมดคน: สัดส่วนปกติ ============ */
        <>
          {costume?.cape && (
            <path d="M34 94 Q22 150 14 186 L60 168 L106 186 Q98 150 86 94 Z" fill={costume.cape} stroke={shade(costume.cape, -25)} strokeWidth="1.2" />
          )}
          {!costume && <BagBack c={c} />}
          <ellipse cx="60" cy="202" rx="34" ry="7" fill="#000" opacity="0.08" />
          <Legs c={c} headColor={headColor} bottomColor={bottomColor} shoesColor={shoesColor} outline={outline} costume={!!costume} />
          <Arm side="back" shoulderW={shoulderW} topY={topY} color={sleeveColor} skin={headColor} outline={outline} />
          <Torso shoulderW={shoulderW} waistW={waistW} topY={topY} waistY={waistY} grad={`url(#${gTop})`} outline={outline} />
          {costume ? <CostumeDetail costume={costume} topY={topY} waistY={waistY} /> : <TopDetail c={c} shoulderW={shoulderW} topY={topY} waistY={waistY} />}
          <ellipse cx="50" cy={topY + 14} rx="7" ry="10" fill="#fff" opacity="0.18" />
          <Arm side="front" shoulderW={shoulderW} topY={topY} color={sleeveColor} skin={headColor} outline={outline} />
          <rect x="54" y="80" width="12" height="14" rx="4.5" fill={headColor} stroke={headDark} strokeWidth="0.8" />
          <HumanHead c={c} grad={`url(#${gHead})`} headColor={headColor} headDark={headDark} outline={outline} />
          <HairBack c={c} />
          <Brows c={c} />
          <Eyes c={c} animal={false} />
          <Nose c={c} />
          <Mouth c={c} />
          <ellipse cx="42" cy="62" rx="4.5" ry="2.8" fill="#ff9d9d" opacity="0.45" />
          <ellipse cx="78" cy="62" rx="4.5" ry="2.8" fill="#ff9d9d" opacity="0.45" />
          {(!costume || costume.mask === "none") && <Accessory c={c} />}
          {costume && costume.mask !== "none" && <HeroMask costume={costume} />}
          <HairFront c={c} hideTop={costume?.mask === "full"} />
          {(!costume || costume.mask !== "full") && <Hat c={c} outline={outline} />}
        </>
      )}
    </svg>
  );
}

/* ================= ANIMAL CHIBI (ทรงป้อม AC) =================
   หัวโต (center 60,56 r~38) · ตัวกลม (ellipse) · แขนขาสั้นป้อม
   reuse: AnimalHead/Eyes/Mouth/Accessory/Hat/SpeciesBodyBack/HeroMask
   โดยครอบด้วย transform ให้เข้ากับ layout ใหม่ */
function AnimalChibi({
  c, costume, gHead, gTop, headColor, headDark, headLight, topColor, bottomColor, shoesColor, outline,
}: {
  c: CharacterConfig;
  costume: import("@/lib/commission/character").CostumeDef | undefined;
  gHead: string; gTop: string;
  headColor: string; headDark: string; headLight: string;
  topColor: string; bottomColor: string; shoesColor: string; outline: string;
}) {
  const winged = isWinged(c.species) && !costume;
  // พิกัดตัวป้อม — ขอบบนตัว (cy-ry = 115) ให้คาบขอบล่างหัว (~112) เพื่อให้ติดกัน
  const bodyCx = 60, bodyCy = 142, bodyRx = 30, bodyRy = 27;
  const shoeC = costume ? shoesColor : shoesColor;

  return (
    <>
      {/* ผ้าคลุมชุดฮีโร่ (ถ้ามี) */}
      {costume?.cape && (
        <path d="M38 120 Q28 160 22 182 L60 170 L98 182 Q92 160 82 120 Z" fill={costume.cape} stroke={shade(costume.cape, -25)} strokeWidth="1.2" />
      )}
      {/* เป้ */}
      {!costume && c.bag === "backpack" && <rect x="82" y="126" width="18" height="34" rx="7" fill="#e8a33d" stroke="#b97d1f" strokeWidth="1.2" />}
      {!costume && c.bag === "sling" && <path d="M44 120 L82 160" stroke="#8e44ad" strokeWidth="6" strokeLinecap="round" />}

      {/* เงานุ่มใต้ตัว */}
      <ellipse cx="60" cy="188" rx="30" ry="6.5" fill="#000" opacity="0.08" />

      {/* หาง/กระดอง (เลื่อนให้พอดีตัวป้อม) */}
      <g transform="translate(0,12)">
        <SpeciesBodyBack species={c.species} furColor={headColor} furDark={headDark} furLight={headLight} />
      </g>

      {/* ขาสั้นป้อม */}
      <ellipse cx="50" cy="174" rx="9.5" ry="11" fill={bottomColor} stroke={outline} strokeWidth="1.2" />
      <ellipse cx="70" cy="174" rx="9.5" ry="11" fill={bottomColor} stroke={outline} strokeWidth="1.2" />
      {/* รองเท้า */}
      <ellipse cx="50" cy="183" rx="9" ry="5" fill={shoeC} stroke={outline} strokeWidth="1.1" />
      <ellipse cx="70" cy="183" rx="9" ry="5" fill={shoeC} stroke={outline} strokeWidth="1.1" />

      {/* คอ (เชื่อมหัว~112 กับตัว~115) — วาดก่อนลำตัวให้อยู่หลัง */}
      <rect x="51" y="104" width="18" height="16" rx="6" fill={headColor} stroke={headDark} strokeWidth="0.8" />

      {/* ลำตัวกลม */}
      <ellipse cx={bodyCx} cy={bodyCy} rx={bodyRx} ry={bodyRy} fill={gTop} stroke={outline} strokeWidth="1.3" />
      {/* ดีเทลเสื้อ/ชุด */}
      {costume ? (
        <>
          <rect x={bodyCx - 18} y={bodyCy + 14} width="36" height="6" rx="2" fill={costume.accent} opacity="0.9" />
          <Emblem kind={costume.emblem} cx={bodyCx} cy={bodyCy - 2} color={costume.emblemColor} />
        </>
      ) : (
        <>
          {c.top === "jacket" || c.top === "suit" ? <line x1={bodyCx} y1={bodyCy - 24} x2={bodyCx} y2={bodyCy + 24} stroke={shade(topColor, -40)} strokeWidth="1.6" /> : null}
          {c.top === "vest" ? <><rect x={bodyCx - 20} y={bodyCy - 18} width="6" height="40" fill="#f4a51c" opacity="0.9" /><rect x={bodyCx + 14} y={bodyCy - 18} width="6" height="40" fill="#f4a51c" opacity="0.9" /></> : null}
        </>
      )}
      {/* ไฮไลต์ตัว */}
      <ellipse cx={bodyCx - 11} cy={bodyCy - 12} rx="8" ry="6" fill="#fff" opacity="0.2" />

      {/* แขน/ปีกสั้นป้อม */}
      {winged ? (
        <>
          <path d="M32 138 Q18 144 20 162 Q27 156 34 152 Z" fill={headColor} stroke={headDark} strokeWidth="1" />
          <path d="M88 138 Q102 144 100 162 Q93 156 86 152 Z" fill={headColor} stroke={headDark} strokeWidth="1" />
        </>
      ) : (
        <>
          <ellipse cx="31" cy="140" rx="8" ry="11" fill={costume ? topColor : headColor} stroke={outline} strokeWidth="1.1" transform="rotate(18 31 140)" />
          <ellipse cx="89" cy="140" rx="8" ry="11" fill={costume ? topColor : headColor} stroke={outline} strokeWidth="1.1" transform="rotate(-18 89 140)" />
        </>
      )}

      {/* ===== หัวโต (scale รอบ center 60,52) — ขอบล่างหัว ~112 คาบตัว(top 115) ===== */}
      <g transform="translate(60,74) scale(1.28) translate(-60,-52)">
        <AnimalHead c={c} grad={gHead} headColor={headColor} headDark={headDark} headLight={headLight} outline={outline} />
        <Eyes c={c} animal />
        <Mouth c={c} />
        <ellipse cx="42" cy="62" rx="4.5" ry="2.8" fill="#ff9d9d" opacity="0.45" />
        <ellipse cx="78" cy="62" rx="4.5" ry="2.8" fill="#ff9d9d" opacity="0.45" />
        {(!costume || costume.mask === "none") && <Accessory c={c} />}
        {costume && costume.mask !== "none" && <HeroMask costume={costume} />}
        {(!costume || costume.mask !== "full") && <Hat c={c} outline={outline} />}
      </g>
    </>
  );
}

/* ================= HUMAN HEAD ================= */
function HumanHead({ c, grad, headColor, headDark, outline }: { c: CharacterConfig; grad: string; headColor: string; headDark: string; outline: string }) {
  let d: string;
  switch (c.faceShape) {
    case "oval": d = "M60 20 C78 20 89 34 89 52 C89 73 76 85 60 85 C44 85 31 73 31 52 C31 34 42 20 60 20 Z"; break;
    case "square": d = "M34 48 C34 28 46 22 60 22 C74 22 86 28 86 48 L86 60 C86 78 75 84 60 84 C45 84 34 78 34 60 Z"; break;
    case "heart": d = "M60 22 C76 22 88 32 88 50 C88 70 72 84 60 86 C48 84 32 70 32 50 C32 32 44 22 60 22 Z"; break;
    default: d = "M60 20 C80 20 90 36 90 54 C90 74 77 86 60 86 C43 86 30 74 30 54 C30 36 40 20 60 20 Z";
  }
  return (
    <>
      <Ears headColor={headColor} headDark={headDark} outline={outline} />
      <path d={d} fill={grad} stroke={outline} strokeWidth="1.5" />
      <ellipse cx="48" cy="38" rx="11" ry="8" fill="#fff" opacity="0.22" />
    </>
  );
}

function Ears({ headColor, headDark, outline, small }: { headColor: string; headDark: string; outline: string; small?: boolean }) {
  const r = small ? 5.5 : 7;
  return (
    <>
      <ellipse cx="31" cy="54" rx={r} ry={r + 2} fill={headColor} stroke={outline} strokeWidth="1.3" />
      <ellipse cx="89" cy="54" rx={r} ry={r + 2} fill={headColor} stroke={outline} strokeWidth="1.3" />
      <ellipse cx="31" cy="54" rx={r - 2.5} ry={r - 1} fill={headDark} opacity="0.3" />
      <ellipse cx="89" cy="54" rx={r - 2.5} ry={r - 1} fill={headDark} opacity="0.3" />
    </>
  );
}

/* ================= ANIMAL HEAD (30 species) ================= */
function AnimalHead({ c, grad, headColor, headDark, headLight, outline }: { c: CharacterConfig; grad: string; headColor: string; headDark: string; headLight: string; outline: string }) {
  const sp = c.species;
  const E = (cx: number, cy: number, rx: number, ry: number, fill: string) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} />;
  const earTuft = (col: string) => (
    <>
      <path d={`M36 32 L32 12 L48 28 Z`} fill={col} /><path d={`M84 32 L88 12 L72 28 Z`} fill={col} />
    </>
  );
  // base round head + highlight ใช้ร่วม
  const base = (extra?: React.ReactNode, headEls?: React.ReactNode) => (
    <>
      {headEls}
      <circle cx="60" cy="52" r="30" fill={grad} stroke={outline} strokeWidth="1.4" />
      <ellipse cx="48" cy="40" rx="10" ry="7" fill="#fff" opacity="0.26" />
      {extra}
    </>
  );
  const snout = (col: string, cy = 60) => <ellipse cx="60" cy={cy} rx="11" ry="8" fill={col} />;

  switch (sp) {
    case "cat":
      return base(<>
        <line x1="36" y1="56" x2="50" y2="58" stroke={headDark} strokeWidth="0.8" /><line x1="84" y1="56" x2="70" y2="58" stroke={headDark} strokeWidth="0.8" />
      </>, <>
        <path d="M38 34 L34 10 L52 28 Z" fill={headColor} /><path d="M82 34 L86 10 L68 28 Z" fill={headColor} />
        <path d="M40 30 L39 16 L48 27 Z" fill="#ffd9b0" /><path d="M80 30 L81 16 L72 27 Z" fill="#ffd9b0" />
      </>);
    case "dog":
      return base(snout("#f0e0cc"), <>
        <ellipse cx="32" cy="50" rx="7" ry="15" fill={headDark} /><ellipse cx="88" cy="50" rx="7" ry="15" fill={headDark} />
      </>);
    case "bear":
      return base(snout("#e8d2b0"), <>
        <circle cx="38" cy="28" r="9" fill={headColor} /><circle cx="82" cy="28" r="9" fill={headColor} />
        <circle cx="38" cy="28" r="4.5" fill={headDark} /><circle cx="82" cy="28" r="4.5" fill={headDark} />
      </>);
    case "rabbit":
      return base(undefined, <>
        <ellipse cx="48" cy="18" rx="6" ry="20" fill={headColor} /><ellipse cx="72" cy="18" rx="6" ry="20" fill={headColor} />
        <ellipse cx="48" cy="18" rx="3" ry="13" fill="#f2b8c8" /><ellipse cx="72" cy="18" rx="3" ry="13" fill="#f2b8c8" />
      </>);
    case "fox":
      return base(<path d="M60 44 q10 6 7 19 q-7 5 -14 0 q-3 -13 7 -19Z" fill="#f7f0ea" />, <>
        <path d="M36 32 L33 8 L52 26 Z" fill={headColor} /><path d="M84 32 L87 8 L68 26 Z" fill={headColor} />
        <path d="M39 28 L38 14 L48 26 Z" fill="#231" /><path d="M81 28 L82 14 L72 26 Z" fill="#231" />
      </>);
    case "panda":
      return base(<>
        <ellipse cx="48" cy="52" rx="6" ry="8" fill="#2a2a2a" transform="rotate(-15 48 52)" />
        <ellipse cx="72" cy="52" rx="6" ry="8" fill="#2a2a2a" transform="rotate(15 72 52)" />
      </>, <>
        <circle cx="38" cy="30" r="9" fill="#2a2a2a" /><circle cx="82" cy="30" r="9" fill="#2a2a2a" />
      </>);
    case "tiger":
      return base(<>
        <path d="M47 42 h8 M65 42 h8 M43 52 h7 M70 52 h7 M54 36 v-5 M66 36 v-5" stroke={headDark} strokeWidth="1.6" />
      </>, earTuft(headColor));
    case "lion":
      return (<>
        <circle cx="60" cy="52" r="33" fill={headDark} />
        <circle cx="60" cy="52" r="24" fill={grad} />
        <ellipse cx="50" cy="42" rx="8" ry="6" fill="#fff" opacity="0.26" />
      </>);
    case "elephant":
      return base(<path d="M60 58 q0 18 -4 28 q-1 4 3 4" stroke={headDark} strokeWidth="6" fill="none" strokeLinecap="round" />, <>
        <ellipse cx="30" cy="50" rx="10" ry="14" fill={headColor} /><ellipse cx="90" cy="50" rx="10" ry="14" fill={headColor} />
      </>);
    case "pig":
      return base(<>
        <ellipse cx="60" cy="60" rx="9" ry="7" fill={headDark} opacity="0.5" />
        <circle cx="56" cy="60" r="1.6" fill="#231" /><circle cx="64" cy="60" r="1.6" fill="#231" />
      </>, <>
        <path d="M40 32 l-5 -8 10 4 Z" fill={headColor} /><path d="M80 32 l5 -8 -10 4 Z" fill={headColor} />
      </>);
    case "sheep":
      return base(undefined, <>
        <circle cx="42" cy="28" r="9" fill="#f7f5f2" /><circle cx="78" cy="28" r="9" fill="#f7f5f2" /><circle cx="60" cy="22" r="10" fill="#f7f5f2" />
      </>);
    case "penguin":
      return (<>
        <circle cx="60" cy="52" r="30" fill={grad} stroke={outline} strokeWidth="1.4" />
        <path d="M40 50 a20 22 0 0 1 40 0 q-20 12 -40 0Z" fill="#fff" />
        <ellipse cx="48" cy="40" rx="8" ry="6" fill="#fff" opacity="0.2" />
        <path d="M53 52 L67 52 L60 62 Z" fill="#f4a51c" />
      </>);
    case "bird":
      return base(<path d="M53 58 L67 58 L60 66 Z" fill="#f4a51c" />, <path d="M54 24 l2 -10 2 7 3 -9 2 11Z" fill={headDark} />);
    case "frog":
      return (<>
        <circle cx="60" cy="54" r="29" fill={grad} stroke={outline} strokeWidth="1.4" />
        <circle cx="44" cy="34" r="11" fill={headColor} stroke={outline} strokeWidth="1.2" /><circle cx="76" cy="34" r="11" fill={headColor} stroke={outline} strokeWidth="1.2" />
        <circle cx="44" cy="33" r="6" fill="#fff" /><circle cx="76" cy="33" r="6" fill="#fff" />
        <circle cx="44" cy="34" r="3" fill="#231" /><circle cx="76" cy="34" r="3" fill="#231" />
      </>);
    case "hamster":
      return base(<>
        <ellipse cx="42" cy="62" rx="9" ry="7" fill="#fff" opacity="0.4" /><ellipse cx="78" cy="62" rx="9" ry="7" fill="#fff" opacity="0.4" />
      </>, <>
        <circle cx="42" cy="30" r="8" fill={headColor} /><circle cx="78" cy="30" r="8" fill={headColor} />
        <circle cx="42" cy="30" r="4" fill={headDark} opacity="0.5" /><circle cx="78" cy="30" r="4" fill={headDark} opacity="0.5" />
      </>);
    case "squirrel":
      return base(snout("#f0d8b8", 60), <>
        <ellipse cx="42" cy="28" rx="6" ry="9" fill={headColor} /><ellipse cx="78" cy="28" rx="6" ry="9" fill={headColor} />
      </>);
    case "monkey":
      return base(<ellipse cx="60" cy="58" rx="13" ry="12" fill="#e8c8a0" />, <>
        <circle cx="30" cy="52" r="8" fill={headColor} /><circle cx="90" cy="52" r="8" fill={headColor} />
      </>);
    case "owl":
      return base(<>
        <circle cx="48" cy="50" r="10" fill="#f0e8d8" /><circle cx="72" cy="50" r="10" fill="#f0e8d8" />
        <path d="M54 58 L66 58 L60 66 Z" fill="#e0a000" />
      </>, <>
        <path d="M42 28 l-4 -12 9 7 Z" fill={headColor} /><path d="M78 28 l4 -12 -9 7 Z" fill={headColor} />
      </>);
    case "deer":
      return base(snout("#e8d0b8", 60), <>
        <path d="M46 26 l-4 -14 M46 26 l-9 -8 M74 26 l4 -14 M74 26 l9 -8" stroke="#8a6a4a" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="34" cy="48" rx="6" ry="9" fill={headColor} /><ellipse cx="86" cy="48" rx="6" ry="9" fill={headColor} />
      </>);
    case "zebra":
      return base(<>
        <path d="M46 40 h8 M66 40 h8 M44 52 h7 M69 52 h7 M54 33 v8 M66 33 v8" stroke="#2a2a2a" strokeWidth="2.4" />
        <ellipse cx="60" cy="62" rx="6" ry="4" fill="#9a9a9a" />
      </>, <>
        <ellipse cx="44" cy="28" rx="5" ry="9" fill={headColor} /><ellipse cx="76" cy="28" rx="5" ry="9" fill={headColor} />
      </>);
    case "raccoon":
      return base(<>
        <path d="M44 54 q8 -6 16 0 q8 -6 16 0 q-3 10 -16 10 q-13 0 -16 -10Z" fill="#3a3a3a" />
        <ellipse cx="60" cy="64" rx="2.6" ry="2" fill="#231" />
      </>, <>
        <path d="M38 30 L35 14 L50 26 Z" fill={headDark} /><path d="M82 30 L85 14 L70 26 Z" fill={headDark} />
      </>);
    case "koala":
      return base(<ellipse cx="60" cy="60" rx="5" ry="6" fill="#5a5a6a" />, <>
        <circle cx="34" cy="42" r="11" fill={headColor} /><circle cx="86" cy="42" r="11" fill={headColor} />
        <circle cx="34" cy="42" r="6" fill={headLight} /><circle cx="86" cy="42" r="6" fill={headLight} />
      </>);
    case "turtle":
      return base(<path d="M50 44 q10 -5 20 0 M48 54 q12 -4 24 0" stroke={headDark} strokeWidth="1.3" fill="none" opacity="0.5" />);
    case "kangaroo":
      return base(snout("#f0d8c0", 60), <>
        <ellipse cx="44" cy="24" rx="5" ry="13" fill={headColor} /><ellipse cx="76" cy="24" rx="5" ry="13" fill={headColor} />
      </>);
    case "giraffe":
      return base(<path d="M46 40 h5 M69 40 h5" stroke={headDark} strokeWidth="1.3" />, <>
        <rect x="44" y="20" width="4" height="9" rx="2" fill={shade(headColor, -20)} /><rect x="72" y="20" width="4" height="9" rx="2" fill={shade(headColor, -20)} />
        <circle cx="46" cy="19" r="3" fill={headColor} /><circle cx="74" cy="19" r="3" fill={headColor} />
      </>);
    case "dolphin":
      return base(<path d="M52 60 q8 4 16 0" stroke={headDark} strokeWidth="1.6" fill="none" strokeLinecap="round" />, <path d="M60 22 q6 -8 2 -14 q8 4 6 14Z" fill={shade(headColor, -15)} />);
    case "wolf":
      return base(<path d="M60 46 q8 5 6 15 q-6 5 -12 0 q-2 -10 6 -15Z" fill="#c8c8d4" />, <>
        <path d="M37 30 L33 10 L51 27 Z" fill={headColor} /><path d="M83 30 L87 10 L69 27 Z" fill={headColor} />
      </>);
    case "redpanda":
      return base(<>
        <path d="M42 46 l-3 -5 M78 46 l3 -5" stroke="#fff" strokeWidth="1.6" />
      </>, <>
        <path d="M38 30 L35 14 L50 27 Z" fill={headColor} /><path d="M82 30 L85 14 L70 27 Z" fill={headColor} />
        <path d="M40 27 L38 17 L47 26 Z" fill="#fff" /><path d="M80 27 L82 17 L73 26 Z" fill="#fff" />
      </>);
    case "parrot":
      return base(<path d="M54 56 L66 56 L60 66 Z" fill="#f4a51c" />, <path d="M54 24 l2 -9 2 6 3 -8 2 10Z" fill="#d32029" />);
    case "crocodile":
      return base(<>
        <ellipse cx="60" cy="66" rx="12" ry="5" fill={headDark} />
        <path d="M50 66 l2 3 2 -3 2 3 2 -3 2 3 2 -3" stroke="#fff" strokeWidth="1" fill="none" />
      </>, <>
        <path d="M46 28 q-3 -8 4 -9 M74 28 q3 -8 -4 -9" fill={headColor} />
      </>);
    default:
      return base();
  }
}

/* ================= EYES (ตาเงาใหญ่ฟีล AC) ================= */
function Eyes({ c, animal }: { c: CharacterConfig; animal: boolean }) {
  const lx = 49, rx = 71, ey = 54;
  const lashes = (x: number) =>
    c.lashes === "none" || animal ? null : c.lashes === "long" ? (
      <>
        <path d={`M${x - 8} ${ey - 6} l-4 -4`} stroke="#231313" strokeWidth="1.6" strokeLinecap="round" />
        <path d={`M${x} ${ey - 9} l0 -5`} stroke="#231313" strokeWidth="1.6" strokeLinecap="round" />
        <path d={`M${x + 8} ${ey - 6} l4 -4`} stroke="#231313" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ) : (
      <path d={`M${x - 7} ${ey - 7} q7 -4 14 0`} stroke="#231313" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    );

  // animal + round/star eyes = จุดดำเงาโต
  if (animal || c.eyes === "round" || c.eyes === "star") {
    const big = animal;
    const rxE = big ? 4.6 : 4;
    return (
      <>
        <ellipse cx={lx} cy={ey} rx={big ? 5 : 6.5} ry={big ? 6.5 : 9} fill="#fff" stroke="#231313" strokeWidth={big ? 0.8 : 1} />
        <ellipse cx={rx} cy={ey} rx={big ? 5 : 6.5} ry={big ? 6.5 : 9} fill="#fff" stroke="#231313" strokeWidth={big ? 0.8 : 1} />
        <circle cx={lx + 0.5} cy={ey + 1} r={rxE} fill="#2a1c14" /><circle cx={rx + 0.5} cy={ey + 1} r={rxE} fill="#2a1c14" />
        <circle cx={lx + 2} cy={ey - 1} r="1.5" fill="#fff" /><circle cx={rx + 2} cy={ey - 1} r="1.5" fill="#fff" />
        <circle cx={lx - 1} cy={ey + 2.5} r="0.7" fill="#fff" opacity="0.6" /><circle cx={rx - 1} cy={ey + 2.5} r="0.7" fill="#fff" opacity="0.6" />
        {lashes(lx)}{lashes(rx)}
      </>
    );
  }
  if (c.eyes === "happy")
    return (<>
      <path d={`M${lx - 7} ${ey + 1} q7 -8 14 0`} stroke="#231313" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={`M${rx - 7} ${ey + 1} q7 -8 14 0`} stroke="#231313" strokeWidth="3" fill="none" strokeLinecap="round" />
      {lashes(lx)}{lashes(rx)}
    </>);
  if (c.eyes === "sleepy")
    return (<>
      <path d={`M${lx - 7} ${ey - 1} q7 3 14 0`} stroke="#231313" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={`M${rx - 7} ${ey - 1} q7 3 14 0`} stroke="#231313" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx={lx} cy={ey + 1} r="2.6" fill="#231313" /><circle cx={rx} cy={ey + 1} r="2.6" fill="#231313" />
    </>);
  if (c.eyes === "wink")
    return (<>
      <ellipse cx={lx} cy={ey} rx="6.5" ry="8.5" fill="#fff" stroke="#231313" strokeWidth="1" />
      <circle cx={lx + 1} cy={ey + 1} r="3.8" fill="#2a1c14" /><circle cx={lx + 2.2} cy={ey - 0.5} r="1.2" fill="#fff" />
      <path d={`M${rx - 7} ${ey} q7 6 14 0`} stroke="#231313" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>);
  return null;
}

function Brows({ c }: { c: CharacterConfig }) {
  const col = shade(c.hairColor, -10);
  const y = 44;
  switch (c.brows) {
    case "thick": return (<><rect x="42" y={y - 2} width="13" height="4" rx="2" fill={col} /><rect x="65" y={y - 2} width="13" height="4" rx="2" fill={col} /></>);
    case "thin": return (<><path d={`M43 ${y} q6 -3 12 0`} stroke={col} strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d={`M65 ${y} q6 -3 12 0`} stroke={col} strokeWidth="1.5" fill="none" strokeLinecap="round" /></>);
    case "worried": return (<><path d={`M43 ${y + 2} q6 2 12 -2`} stroke={col} strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d={`M65 ${y} q6 -2 12 2`} stroke={col} strokeWidth="2.5" fill="none" strokeLinecap="round" /></>);
    default: return (<><path d={`M43 ${y} q6 -4 12 0`} stroke={col} strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d={`M65 ${y} q6 -4 12 0`} stroke={col} strokeWidth="2.5" fill="none" strokeLinecap="round" /></>);
  }
}

function Nose({ c }: { c: CharacterConfig }) {
  const sh = shade(c.skin, -35);
  switch (c.nose) {
    case "none": return null;
    case "line": return <path d="M60 62 l0 5" stroke={sh} strokeWidth="1.6" strokeLinecap="round" />;
    case "button": return <circle cx="60" cy="65" r="2.6" fill={sh} opacity="0.6" />;
    default: return <circle cx="60" cy="65" r="1.6" fill={sh} opacity="0.7" />;
  }
}

function Mouth({ c }: { c: CharacterConfig }) {
  switch (c.mouth) {
    case "grin": return <path d="M52 72 q8 9 16 0 q-8 4 -16 0 Z" fill="#fff" stroke="#231313" strokeWidth="1.7" strokeLinejoin="round" />;
    case "neutral": return <path d="M55 74 h10" stroke="#231313" strokeWidth="2" strokeLinecap="round" />;
    case "open": return <ellipse cx="60" cy="75" rx="4.5" ry="5.5" fill="#b5424a" stroke="#231313" strokeWidth="1.4" />;
    case "smirk": return <path d="M54 73 q7 5 13 -2" stroke="#231313" strokeWidth="2.1" fill="none" strokeLinecap="round" />;
    default: return <path d="M54 72 q6 6 13 0" stroke="#231313" strokeWidth="2.1" fill="none" strokeLinecap="round" />;
  }
}

/* ================= ARMS / WINGS ================= */
const WINGED = new Set(["bird", "penguin", "parrot", "owl"]);
function isWinged(species: string): boolean {
  return WINGED.has(species);
}

function Arm({ side, shoulderW, topY, color, skin, outline, wing }: { side: "front" | "back"; shoulderW: number; topY: number; color: string; skin: string; outline: string; wing?: string }) {
  const cx = 60;
  const dir = side === "front" ? -1 : 1;
  const sx = cx + dir * (shoulderW - 4);
  // ปีก (นก): แทนแขน — รูปหยดโค้งลงข้างลำตัว
  if (wing) {
    const tipX = cx + dir * (shoulderW + 12);
    return (
      <path
        d={`M${sx} ${topY} Q${tipX} ${topY + 14} ${cx + dir * (shoulderW + 3)} ${topY + 36} Q${cx + dir * (shoulderW - 1)} ${topY + 24} ${sx} ${topY + 10} Z`}
        fill={wing}
        stroke={shade(wing, -28)}
        strokeWidth="1"
      />
    );
  }
  const elbowX = cx + dir * (shoulderW + 6);
  const wristX = cx + dir * (shoulderW + 2);
  return (
    <g>
      <path d={`M${sx} ${topY} Q${elbowX} ${topY + 22} ${wristX} ${topY + 44}`} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx={wristX} cy={topY + 46} r="4.5" fill={skin} stroke={outline} strokeWidth="1.1" />
    </g>
  );
}

/* ================= ส่วนร่างกายหลังลำตัว: หาง / กระดอง ================= */
function SpeciesBodyBack({ species, furColor, furDark, furLight }: { species: string; furColor: string; furDark: string; furLight: string }) {
  // หางโผล่ข้างขวาล่างของลำตัว (x~78, y~128)
  const tail = (d: string, fill = furColor, stroke = furDark) => <path d={d} fill={fill} stroke={stroke} strokeWidth="0.8" />;
  switch (species) {
    case "cat":
      return tail("M76 132 q24 8 24 -16 q0 -13 -9 -13 q7 11 -4 22 q-9 9 -11 7 Z");
    case "dog":
      return tail("M78 128 q18 -4 20 -20 q1 -8 -6 -8 q0 12 -14 20 Z");
    case "fox":
      return (<>
        {tail("M74 130 q28 4 33 -20 q3 -15 -7 -17 q5 13 -9 22 q-11 8 -17 7 q3 5 0 8 Z")}
        <path d="M100 95 q9 -3 7 -13 q-7 2 -9 9 Z" fill="#f7f0ea" />
      </>);
    case "squirrel":
      return tail("M74 128 q6 -34 26 -34 q10 0 10 10 q-16 0 -22 14 q-6 12 -6 16 q-5 -2 -8 -6 Z", furLight, furDark);
    case "tiger":
    case "leopard":
      return (<>
        {tail("M78 130 q20 6 22 -14 q0 -10 -7 -10 q5 9 -4 18 q-7 7 -11 6 Z")}
        <path d="M88 122 h8 M90 114 h8 M92 106 h7" stroke={furDark} strokeWidth="1.3" />
      </>);
    case "lion":
      return (<>
        {tail("M78 130 q22 8 22 -18 q0 -8 -6 -8 q4 10 -4 18 q-7 6 -12 8 Z")}
        <circle cx="100" cy="106" r="5" fill={furDark} />
      </>);
    case "monkey":
      return tail("M78 126 q24 -2 24 -24 q0 -10 -8 -10 q2 14 -12 22 q-6 4 -6 8 Z");
    case "wolf":
      return tail("M76 130 q26 6 28 -18 q1 -12 -8 -12 q6 12 -6 22 q-9 7 -14 8 Z", furColor, furDark);
    case "raccoon":
      return (<>
        {tail("M76 130 q26 6 28 -18 q1 -12 -8 -12 q6 12 -6 22 q-9 7 -14 8 Z")}
        <path d="M86 124 q10 2 15 -4 M90 114 q8 2 13 -3" stroke={furDark} strokeWidth="2.4" fill="none" />
      </>);
    case "deer":
    case "kangaroo":
      return tail("M78 130 q16 8 20 24 q1 4 -3 4 q-12 -8 -22 -16 Z", furColor, furDark);
    case "zebra":
      return (<>
        {tail("M80 128 q10 10 10 26 q0 3 -3 3 q-8 -8 -12 -18 Z", furColor, furDark)}
        <ellipse cx="88" cy="150" rx="3" ry="5" fill="#2a2a2a" />
      </>);
    case "turtle":
      // กระดองหลัง
      return (<>
        <ellipse cx="60" cy="118" rx="26" ry="24" fill={furDark} />
        <ellipse cx="60" cy="118" rx="18" ry="17" fill={furColor} />
        <path d="M60 100 v36 M44 110 h32 M44 126 h32" stroke={furDark} strokeWidth="1.3" />
      </>);
    case "crocodile":
      return (<>
        {tail("M78 134 q22 10 30 26 q2 4 -3 4 q-16 -8 -30 -18 Z", furColor, furDark)}
        <path d="M86 138 l3 -5 3 5 3 -5 3 5" stroke={furDark} strokeWidth="1.3" fill="none" />
      </>);
    default:
      return null; // หมู หมี โคอาลา กระต่าย แพนด้า ช้าง แกะ แฮมสเตอร์ ฯลฯ ไม่มีหางเด่น
  }
}

function Torso({ shoulderW, waistW, topY, waistY, grad, outline }: { shoulderW: number; waistW: number; topY: number; waistY: number; grad: string; outline: string }) {
  const cx = 60;
  const d = `M${cx - shoulderW} ${topY} Q${cx - shoulderW - 2} ${(topY + waistY) / 2} ${cx - waistW} ${waistY} Q${cx} ${waistY + 6} ${cx + waistW} ${waistY} Q${cx + shoulderW + 2} ${(topY + waistY) / 2} ${cx + shoulderW} ${topY} Q${cx} ${topY - 8} ${cx - shoulderW} ${topY} Z`;
  return <path d={d} fill={grad} stroke={outline} strokeWidth="1.3" />;
}

function TopDetail({ c, shoulderW, topY, waistY }: { c: CharacterConfig; shoulderW: number; topY: number; waistY: number }) {
  const cx = 60;
  if (c.top === "vest")
    return (<>
      <rect x={cx - shoulderW + 4} y={topY + 2} width="7" height={waistY - topY} fill="#f4a51c" opacity="0.9" />
      <rect x={cx + shoulderW - 11} y={topY + 2} width="7" height={waistY - topY} fill="#f4a51c" opacity="0.9" />
    </>);
  if (c.top === "jacket" || c.top === "suit") return <line x1={cx} y1={topY} x2={cx} y2={waistY} stroke={shade(c.topColor, -40)} strokeWidth="1.8" />;
  if (c.top === "hoodie")
    return (<>
      <path d={`M${cx - 10} ${topY + 2} Q${cx} ${topY + 14} ${cx + 10} ${topY + 2}`} stroke={shade(c.topColor, -30)} strokeWidth="2.5" fill="none" />
      <line x1={cx - 3} y1={topY + 10} x2={cx - 3} y2={topY + 26} stroke="#ffffff88" strokeWidth="1.5" />
      <line x1={cx + 3} y1={topY + 10} x2={cx + 3} y2={topY + 26} stroke="#ffffff88" strokeWidth="1.5" />
    </>);
  if (c.top === "polo") return <path d={`M${cx - 6} ${topY} l6 8 6 -8`} fill="#ffffff" opacity="0.85" />;
  return null;
}

function CostumeDetail({ costume, topY, waistY }: { costume: import("@/lib/commission/character").CostumeDef; topY: number; waistY: number }) {
  const cx = 60, midY = (topY + waistY) / 2 - 4;
  return (
    <>
      <rect x={cx - 20} y={waistY - 14} width="40" height="7" rx="2" fill={costume.accent} opacity="0.9" />
      <rect x={cx - 4} y={waistY - 15} width="8" height="9" rx="2" fill={shade(costume.accent, 30)} />
      <Emblem kind={costume.emblem} cx={cx} cy={midY} color={costume.emblemColor} />
    </>
  );
}

function Emblem({ kind, cx, cy, color }: { kind: import("@/lib/commission/character").Emblem; cx: number; cy: number; color: string }) {
  switch (kind) {
    case "star": return <path d={`M${cx} ${cy - 9} l2.6 6.4 6.9 0 -5.6 4.3 2.1 6.6-6 -4.1 -6 4.1 2.1 -6.6 -5.6 -4.3 6.9 0 Z`} fill={color} />;
    case "bolt": return <path d={`M${cx + 3} ${cy - 9} l-9 11 5 0 -4 8 10 -12 -5 0 3 -6 Z`} fill={color} />;
    case "shield": return <path d={`M${cx} ${cy - 9} l9 3 0 7 q0 7 -9 10 q-9 -3 -9 -10 l0 -7 Z`} fill={color} />;
    case "flame": return <path d={`M${cx} ${cy - 10} q7 7 4 14 q-1 4 -4 5 q-3 -1 -4 -5 q-3 -7 4 -14 Z`} fill={color} />;
    case "moon": return <path d={`M${cx + 4} ${cy - 8} a9 9 0 1 0 0 16 a7 7 0 1 1 0 -16 Z`} fill={color} />;
    case "drop": return <path d={`M${cx} ${cy - 9} q6 8 0 15 q-6 -7 0 -15 Z`} fill={color} />;
    case "leaf": return <path d={`M${cx - 7} ${cy + 6} q0 -14 14 -14 q0 14 -14 14 Z`} fill={color} />;
    case "diamond": return <path d={`M${cx} ${cy - 9} l7 9 -7 9 -7 -9 Z`} fill={color} />;
    case "heart": return <path d={`M${cx} ${cy + 6} q-9 -6 -9 -12 a4.5 4.5 0 0 1 9 -1 a4.5 4.5 0 0 1 9 1 q0 6 -9 12 Z`} fill={color} />;
    default: return null;
  }
}

function HeroMask({ costume }: { costume: import("@/lib/commission/character").CostumeDef }) {
  const col = costume.suit;
  if (costume.mask === "eye") return <path d="M34 50 q26 -12 52 0 l0 9 q-26 9 -52 0 Z" fill={col} stroke={shade(col, -25)} strokeWidth="1" />;
  if (costume.mask === "visor") return (<><rect x="34" y="50" width="52" height="11" rx="5" fill={col} /><rect x="38" y="53" width="44" height="5" rx="2.5" fill={shade(col, 40)} opacity="0.7" /></>);
  if (costume.mask === "full") return (<>
    <path d="M30 54 C30 34 42 22 60 22 C78 22 90 34 90 54 C90 74 77 86 60 86 C43 86 30 74 30 54 Z" fill={col} stroke={shade(col, -25)} strokeWidth="1.3" />
    <path d="M40 54 q9 -6 17 0 q-9 6 -17 0 Z" fill="#fff" /><path d="M63 54 q9 -6 17 0 q-9 6 -17 0 Z" fill="#fff" />
  </>);
  return null;
}

function Legs({ c, headColor, bottomColor, shoesColor, outline, costume }: { c: CharacterConfig; headColor: string; bottomColor: string; shoesColor: string; outline: string; costume: boolean }) {
  const skin = headColor;
  if (!costume && c.bottom === "skirt") {
    return (<>
      <path d="M42 148 L78 148 L86 178 L34 178 Z" fill={bottomColor} stroke={outline} strokeWidth="1.2" />
      <path d="M48 176 q-1 14 0 22 q1 4 4 4 q3 0 4 -4 l1 -20Z" fill={skin} stroke={outline} strokeWidth="1" />
      <path d="M63 176 q1 14 0 22 q-1 4 -4 4 q-3 0 -4 -4 l-1 -20Z" fill={skin} stroke={outline} strokeWidth="1" />
      <ellipse cx="52" cy="202" rx="8" ry="4.5" fill={shoesColor} stroke={outline} strokeWidth="1" />
      <ellipse cx="68" cy="202" rx="8" ry="4.5" fill={shoesColor} stroke={outline} strokeWidth="1" />
    </>);
  }
  const shortLeg = !costume && c.bottom === "shorts";
  const pantsEndY = shortLeg ? 170 : 196;
  return (
    <>
      <path d={`M50 150 q-3 ${shortLeg ? 18 : 40} -1 ${pantsEndY - 150} q1 5 5 5 q3 0 4 -5 l1 -${pantsEndY - 152}Z`} fill={bottomColor} stroke={outline} strokeWidth="1.2" />
      <path d={`M70 150 q3 ${shortLeg ? 18 : 40} 1 ${pantsEndY - 150} q-1 5 -5 5 q-3 0 -4 -5 l-1 -${pantsEndY - 152}Z`} fill={bottomColor} stroke={outline} strokeWidth="1.2" />
      {shortLeg && (<>
        <path d="M50 170 q-1 16 0 24 q1 4 4 4 q3 0 4 -4 l1 -22Z" fill={skin} stroke={outline} strokeWidth="1" />
        <path d="M70 170 q1 16 0 24 q-1 4 -4 4 q-3 0 -4 -4 l-1 -22Z" fill={skin} stroke={outline} strokeWidth="1" />
      </>)}
      {renderShoes(c, shoesColor, outline, costume)}
    </>
  );
}

function renderShoes(c: CharacterConfig, shoesColor: string, outline: string, costume: boolean) {
  const y = 200;
  if (costume || c.shoes === "boots")
    return (<>
      <path d={`M44 ${y - 10} h16 v12 q0 4 -8 4 q-8 0 -8 -4 Z`} fill={shoesColor} stroke={outline} strokeWidth="1.2" />
      <path d={`M60 ${y - 10} h16 v12 q0 4 -8 4 q-8 0 -8 -4 Z`} fill={shoesColor} stroke={outline} strokeWidth="1.2" />
    </>);
  if (c.shoes === "sandals")
    return (<>
      <ellipse cx="52" cy={y + 2} rx="10" ry="4.5" fill={shoesColor} stroke={outline} strokeWidth="1" />
      <ellipse cx="68" cy={y + 2} rx="10" ry="4.5" fill={shoesColor} stroke={outline} strokeWidth="1" />
    </>);
  return (<>
    <ellipse cx="52" cy={y + 2} rx="11" ry="6" fill={shoesColor} stroke={outline} strokeWidth="1.2" />
    <ellipse cx="68" cy={y + 2} rx="11" ry="6" fill={shoesColor} stroke={outline} strokeWidth="1.2" />
  </>);
}

function BagBack({ c }: { c: CharacterConfig }) {
  if (c.bag === "backpack") return <rect x="80" y="96" width="20" height="40" rx="7" fill="#e8a33d" stroke="#b97d1f" strokeWidth="1.2" />;
  if (c.bag === "sling") return <path d="M42 96 L82 140" stroke="#8e44ad" strokeWidth="6" strokeLinecap="round" />;
  return null;
}

function HairBack({ c }: { c: CharacterConfig }) {
  const col = c.hairColor;
  if (c.hair === "long") return (<><path d="M28 50 q-5 44 9 58 L34 62 Z" fill={col} /><path d="M92 50 q5 44 -9 58 L86 62 Z" fill={col} /></>);
  if (c.hair === "ponytail") return <path d="M88 44 q20 8 13 40 q-2 9 -9 9 q9 -22 -7 -46Z" fill={col} />;
  return null;
}

function HairFront({ c, hideTop }: { c: CharacterConfig; hideTop?: boolean }) {
  if (hideTop || c.hair === "bald") return null;
  const col = c.hairColor, hi = shade(col, 30);
  let d: string;
  switch (c.hair) {
    case "long": d = "M30 54 q0 -36 30 -36 q30 0 30 36 q-9 -20 -30 -20 q-21 0 -30 20Z"; break;
    case "curly": d = "M30 52 q-2 -32 30 -32 q32 0 30 32 q-5 -8 -11 -4 q-4 -9 -11 -5 q-5 -8 -10 -3 q-6 -7 -11 -1 q-5 -3 -10 5 q-4 -1 -7 13Z"; break;
    case "bun": d = "M30 54 q0 -34 30 -34 q30 0 30 34 q-9 -18 -30 -18 q-21 0 -30 18Z"; break;
    case "ponytail": d = "M31 54 q0 -34 29 -34 q29 0 29 34 q-9 -18 -29 -18 q-20 0 -29 18Z"; break;
    case "spiky": d = "M30 52 l6 -18 6 14 5 -20 7 16 6 -18 6 18 6 -12 4 16 q-28 -12 -52 0Z"; break;
    default: d = "M31 52 q0 -34 29 -34 q29 0 29 34 q-14 -15 -29 -15 q-15 0 -29 15Z";
  }
  return (<>{c.hair === "bun" && <circle cx="60" cy="18" r="8" fill={col} />}<path d={d} fill={col} /><path d={d} fill={hi} opacity="0.16" transform="translate(-2,-2)" /></>);
}

function Accessory({ c }: { c: CharacterConfig }) {
  switch (c.accessory) {
    case "glasses": return (<g stroke="#231313" strokeWidth="2" fill="none"><circle cx="49" cy="56" r="8.5" /><circle cx="71" cy="56" r="8.5" /><line x1="57.5" y1="56" x2="62.5" y2="56" /></g>);
    case "sunglasses": return (<g><path d="M40 52 h19 v6 q-9.5 6 -19 0 Z" fill="#231313" /><path d="M61 52 h19 v6 q-9.5 6 -19 0 Z" fill="#231313" /><line x1="59" y1="53" x2="61" y2="53" stroke="#231313" strokeWidth="2" /></g>);
    case "mask": return <path d="M43 58 h34 v9 q-17 11 -34 0 Z" fill="#9fe0e6" stroke="#6bbcc4" strokeWidth="1" />;
    case "earring": return (<><circle cx="31" cy="63" r="2.3" fill="#f4b400" stroke="#e0932a" strokeWidth="0.6" /><circle cx="89" cy="63" r="2.3" fill="#f4b400" stroke="#e0932a" strokeWidth="0.6" /></>);
    default: return null;
  }
}

function Hat({ c, outline }: { c: CharacterConfig; outline: string }) {
  switch (c.hat) {
    case "cap": return (<><path d="M30 42 Q60 10 90 42 L90 34 Q60 16 30 34 Z" fill={c.hatColor} stroke={outline} strokeWidth="1.2" /><rect x="24" y="38" width="42" height="9" rx="4" fill={c.hatColor} stroke={outline} strokeWidth="1.2" /></>);
    case "beanie": return (<><path d="M30 46 q30 -40 60 0 q0 -16 -30 -22 q-30 6 -30 22Z" fill={c.hatColor} stroke={outline} strokeWidth="1.2" /><rect x="30" y="44" width="60" height="10" rx="5" fill={shade(c.hatColor, -20)} /></>);
    case "hardhat": return (<><path d="M28 38 a32 24 0 0 1 64 0 Z" fill="#f4c430" stroke="#c99a10" strokeWidth="1.2" /><rect x="24" y="36" width="72" height="8" rx="4" fill="#e0a800" /><rect x="57" y="14" width="6" height="22" fill="#e0a800" /></>);
    case "crown": return <path d="M36 38 L42 18 L52 32 L60 14 L68 32 L78 18 L84 38 Z" fill="#f4b400" stroke="#d49400" strokeWidth="1.3" strokeLinejoin="round" />;
    default: return null;
  }
}
