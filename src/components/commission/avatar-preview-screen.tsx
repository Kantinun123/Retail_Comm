"use client";

/* หน้าเลือกสไตล์ avatar (DiceBear 61 สไตล์) — เลือกแล้วบันทึกเป็น avatar ประจำตัว
   seed = empId/dealerCode (avatar ประจำตัวไม่ซ้ำกัน) */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { DiceBearAvatar, DICEBEAR_STYLES, type DiceBearStyle } from "./dicebear-avatar";
import { useSession } from "@/lib/commission/session";
import { profileKey } from "@/lib/commission/profile";
import {
  getAvatarStyle,
  saveAvatarStyle,
  subscribeAvatarStyle,
  DEFAULT_STYLE,
} from "@/lib/commission/avatar-style";

export function AvatarPreviewScreen() {
  const { session, ready } = useSession();
  const router = useRouter();

  const pKey = session
    ? profileKey({
        isSales: session.isSales,
        empId: session.empId,
        dealerCode: session.isAdmin ? null : session.dealer.code,
      })
    : null;
  // seed ประจำตัว = empId / dealerCode (ไม่งั้นใช้ 'guest')
  const seed =
    (session?.isSales ? session.empId : session?.dealer.code) || "guest";

  const [selected, setSelected] = useState<DiceBearStyle>(DEFAULT_STYLE as DiceBearStyle);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (!pKey) return;
    const refresh = () => {
      const cfg = getAvatarStyle(pKey);
      if (cfg) setSelected(cfg.styleId as DiceBearStyle);
    };
    refresh();
    return subscribeAvatarStyle(refresh);
  }, [pKey]);

  if (!ready || !session) return null;

  const characters = DICEBEAR_STYLES.filter((s) => s.group === "character");
  const patterns = DICEBEAR_STYLES.filter((s) => s.group === "pattern");

  function save() {
    if (!pKey) return;
    saveAvatarStyle(pKey, { styleId: selected, seed });
    setSavedMsg(true);
    setTimeout(() => {
      setSavedMsg(false);
      router.push("/app/member");
    }, 900);
  }

  return (
    <div className="space-y-4 pb-28">
      <header className="flex items-center gap-2.5 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <Link href="/app/member" className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
          <Icon name="arrow_back" className="text-xl" />
        </Link>
        <span className="font-bold text-[16px] text-[#231313]">เลือกสไตล์ตัวละคร</span>
      </header>

      {/* preview ตัวที่เลือก */}
      <div className="bg-gradient-to-br from-[#d32029] to-[#8f1114] rounded-2xl p-4 flex items-center gap-4">
        <div className="rounded-2xl bg-white/15 border border-white/20 p-1 shrink-0">
          <DiceBearAvatar seed={seed} styleId={selected} size={96} className="rounded-xl" />
        </div>
        <div className="text-white">
          <p className="text-[12px] text-red-100/90">สไตล์ที่เลือก</p>
          <p className="text-[18px] font-bold">
            {DICEBEAR_STYLES.find((s) => s.id === selected)?.label ?? selected}
          </p>
          <p className="text-[11px] text-red-100/80 mt-0.5">avatar ประจำตัวของคุณ</p>
        </div>
      </div>

      <StyleGrid title="ตัวละคร" styles={characters} seed={seed} selected={selected} onPick={setSelected} />
      <StyleGrid title="ลวดลาย / Abstract" styles={patterns} seed={seed} selected={selected} onPick={setSelected} />

      {/* ปุ่มบันทึกแบบติดล่าง */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-[#f7f4f4] to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={save}
            className="w-full py-3 rounded-2xl bg-[#d32029] text-white font-bold text-[15px] shadow-lg shadow-[#d32029]/25 active:scale-[0.99] transition"
          >
            {savedMsg ? "บันทึกแล้ว ✓" : "ใช้สไตล์นี้"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StyleGrid({
  title, styles, seed, selected, onPick,
}: {
  title: string;
  styles: typeof DICEBEAR_STYLES;
  seed: string;
  selected: string;
  onPick: (id: DiceBearStyle) => void;
}) {
  return (
    <section>
      <h3 className="text-[13px] font-bold text-slate-700 mb-2 px-1 flex items-center gap-1.5">
        <Icon name="grid_view" style={{ fontSize: 16 }} className="text-[#d32029]" />
        {title} ({styles.length})
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {styles.map((st) => {
          const on = selected === st.id;
          return (
            <button
              key={st.id}
              onClick={() => onPick(st.id)}
              className={`bg-white rounded-2xl border-2 p-2.5 flex flex-col items-center gap-1.5 transition active:scale-95 ${on ? "border-[#d32029] ring-2 ring-[#d32029]/15" : "border-slate-100"}`}
            >
              <DiceBearAvatar seed={seed} styleId={st.id} size={80} className="rounded-xl" />
              <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">{st.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
