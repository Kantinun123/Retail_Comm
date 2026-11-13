"use client";

/* =============================================================
   ร้านค้าและทีมงาน — หน้าเริ่มต้นของกล่องเดียวที่รวม
   (ทีมงานรายร้าน + จัดการร้านค้า + จัดการพนักงาน)
   - admin: รายการทุกร้าน + สรุปพนักงานแยกตำแหน่ง + ตัวกรอง Model -> ภาค -> ค้นหา
            + เปิด/ปิดใช้งานร้าน ; กดชื่อร้านเข้าหน้ารายละเอียด (แก้ทีมงานที่นั่น)
   - ร้านค้า/พนักงาน: พาไปหน้ารายละเอียดร้านตัวเองทันที (ดูอย่างเดียว)
   ============================================================= */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { useSession, useHomeHref, setAreaStore, doLogout } from "@/lib/commission/session";
import { getStoreTeamCaps } from "@/lib/commission/permissions";
import { chronicText, fetchTracking, shortDate, type TrackStore } from "@/lib/commission/eval-tracking-store";
import {
  fetchStores,
  setStoreActive,
  type StoreInfo,
} from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";

const ALL = "__all__";

function modelAccent(model: string | null): string {
  if (!model) return "bg-slate-100 text-slate-600";
  if (model.includes("Housing")) return "bg-red-50 text-[#d32029]";
  if (model.includes("SCG")) return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export function StoresScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const homeHref = useHomeHref();
  const caps = getStoreTeamCaps(session);
  // ร้านของตัวเอง (ร้านค้า/พนักงาน) — admin ไม่ใช้
  const ownCode = session?.dealer.code || null;

  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [model, setModel] = useState(ALL);
  const [region, setRegion] = useState(ALL);
  const [showInactive, setShowInactive] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // Area/Coach: สถานะตรวจประเมินเดือนนี้รายร้าน (ป้ายบนการ์ดร้าน)
  const [evalMap, setEvalMap] = useState<{ map: Map<string, TrackStore>; inProgress: boolean } | null>(null);
  const isAreaUser = !!session?.isArea;

  useEffect(() => {
    if (!ready || !isAreaUser) return;
    let cancelled = false;
    fetchTracking().then((r) => {
      if (cancelled || !r.ok) return;
      const map = new Map<string, TrackStore>();
      r.coaches.forEach((c) => c.stores.forEach((s) => map.set(s.code, s)));
      setEvalMap({ map, inProgress: r.period === r.today.slice(0, 7) });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, isAreaUser]);

  useEffect(() => {
    if (!ready || !session || !caps.canViewAllStores) return;
    fetchStores()
      .then((list) =>
        // Area/Coach เห็นเฉพาะร้านที่ดูแล (API กรองซ้ำอีกชั้นเมื่อมี session จริง)
        setStores(
          session.isArea ? list.filter((s) => session.areaStores.includes(s.code)) : list
        )
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ready, session, caps.canViewAllStores]);

  // ร้านค้า/พนักงาน ไม่เห็นรายการทุกร้าน -> พาไปหน้ารายละเอียดร้านตัวเอง
  useEffect(() => {
    if (ready && session && !caps.canViewAllStores && ownCode) {
      router.replace(`/app/store/${ownCode}`);
    }
  }, [ready, session, caps.canViewAllStores, ownCode, router]);

  const models = useMemo(() => countBy(stores, (s) => s.model), [stores]);
  const regions = useMemo(
    () =>
      countBy(
        model === ALL ? stores : stores.filter((s) => (s.model ?? "") === model),
        (s) => s.region
      ),
    [stores, model]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      if (model !== ALL && (s.model ?? "") !== model) return false;
      if (region !== ALL && (s.region ?? "") !== region) return false;
      if (!showInactive && !s.isActive) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.code.includes(q)) return false;
      return true;
    });
  }, [stores, model, region, showInactive, query]);

  if (!ready || !session) return null;

  if (!caps.canViewAllStores) {
    // มีร้านของตัวเอง -> กำลังพาไป ; ไม่มีร้านเลย -> แจ้งว่าไม่มีสิทธิ์
    if (ownCode) return null;
    return (
      <>
        <Header homeHref={homeHref} />
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
            <Icon name="lock" className="text-3xl" />
          </div>
          <p className="mt-3 text-[15px] font-bold text-slate-900">
            ไม่พบร้านค้าที่ผูกกับบัญชีนี้
          </p>
          <Link
            href={homeHref}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#d32029]"
          >
            <Icon name="arrow_back" className="text-lg" />
            กลับหน้าภาพรวม
          </Link>
        </div>
        <BottomNav active="database" />
      </>
    );
  }

  const activeCount = stores.filter((s) => s.isActive).length;
  const inactiveCount = stores.length - activeCount;

  // สรุปพนักงานแยกตำแหน่ง รวมทุกร้าน (เฉพาะร้านที่เปิดใช้งาน)
  const totals = stores.reduce(
    (a, s) => {
      if (!s.isActive) return a;
      a.se += s.seCount;
      a.seA += s.seACount;
      a.seS += s.seSCount;
      a.seB += s.seBCount;
      a.seNoLevel += s.seNoLevelCount;
      a.saleFloor += s.saleFloorCount;
      a.exec += s.execCount;
      a.other += s.otherCount;
      a.total += s.empCount;
      return a;
    },
    { se: 0, seA: 0, seS: 0, seB: 0, seNoLevel: 0, saleFloor: 0, exec: 0, other: 0, total: 0 }
  );

  // Area/Coach/หัวหน้า Area: เลือกร้านแล้วเปิดหน้าหลักของร้านนั้น (ทุกกล่องกรองเฉพาะร้านนี้)
  function openStoreData(code: string) {
    setAreaStore(code);
    router.push("/app/home");
  }

  async function onToggle(s: StoreInfo) {
    setBusy(s.code);
    setMsg(null);
    const res = await setStoreActive(s.code, !s.isActive);
    setBusy(null);
    if (res.ok) {
      setStores((prev) =>
        prev.map((x) => (x.code === s.code ? { ...x, isActive: !x.isActive } : x))
      );
    } else {
      setMsg({ type: "err", text: res.error ?? "ทำรายการไม่สำเร็จ" });
    }
  }

  return (
    <>
      <Header homeHref={homeHref} />

      <div className="space-y-4 pb-4">
        {/* ตัวนับร้าน — Area/Coach เห็นเฉพาะร้านที่เปิดอยู่ จึงแสดงจำนวนที่ตรวจเดือนนี้แทน "ปิด/ยกเลิก" */}
        <section className="grid grid-cols-3 gap-2">
          <Stat label="ร้านทั้งหมด" value={stores.length} tone="slate" />
          <Stat label="เปิดใช้งาน" value={activeCount} tone="emerald" />
          {session.isArea ? (
            <Stat label="ตรวจแล้วเดือนนี้" value={stores.filter((s) => evalMap?.map.get(s.code)?.status === "done").length} tone="slate" />
          ) : (
            <Stat label="ปิด/ยกเลิก" value={inactiveCount} tone="red" />
          )}
        </section>

        {/* สรุปพนักงานแยกตำแหน่ง (รวมทุกร้าน) */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
          <p className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5 mb-2">
            <Icon name="groups" style={{ fontSize: 16 }} className="text-[#d32029]" />
            พนักงานแยกตามตำแหน่ง (รวมทุกร้าน)
          </p>
          <div className="grid grid-cols-4 gap-2">
            <PosStat
              label="SE"
              value={totals.se}
              breakdown={[
                { label: "A", value: totals.seA },
                { label: "S", value: totals.seS },
                { label: "B", value: totals.seB },
                { label: "ไม่ระบุ", value: totals.seNoLevel },
              ]}
            />
            <PosStat label="Sale floor" value={totals.saleFloor} />
            <PosStat label="ผู้บริหารร้าน" value={totals.exec} />
            <PosStat label="อื่นๆ" value={totals.other} />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            รวม {totals.total.toLocaleString("th-TH")} คนในร้าน · ไม่รวม Area/Coach (ดูแลหลายร้าน)
          </p>
        </section>

        {/* ตัวกรอง */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              style={{ fontSize: 18 }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นชื่อร้าน / รหัส"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-[#d32029]"
            />
          </div>
          <ChipRow
            label="Model"
            items={models}
            value={model}
            total={stores.length}
            onChange={(v) => {
              setModel(v);
              setRegion(ALL);
            }}
          />
          <ChipRow
            label="ภาค"
            items={regions}
            value={region}
            total={model === ALL ? stores.length : regions.reduce((a, r) => a + r.count, 0)}
            onChange={setRegion}
          />
          <div className="mt-2 flex items-center justify-between px-0.5">
            <span className="text-[10.5px] text-slate-400">พบ {filtered.length} ร้าน</span>
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1 active:scale-95"
            >
              <Icon
                name={showInactive ? "visibility" : "visibility_off"}
                style={{ fontSize: 15 }}
              />
              {showInactive ? "แสดงทั้งหมด" : "เฉพาะเปิดใช้งาน"}
            </button>
          </div>
        </section>

        {msg && (
          <p className="text-[12px] font-semibold rounded-lg px-3 py-2 bg-red-50 text-[#a11119] border border-red-200">
            {msg.text}
          </p>
        )}

        {/* การ์ดร้าน */}
        {loading ? (
          <div className="py-10 text-center">
            <Icon name="progress_activity" className="animate-spin text-3xl text-[#d32029]" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <div
                key={s.code}
                className={cn(
                  "bg-white rounded-2xl border shadow-sm p-3.5",
                  s.isActive ? "border-slate-100" : "border-slate-200 opacity-70"
                )}
              >
                <div className="flex items-start gap-3">
                  <Link
                    href={`/app/store/${s.code}`}
                    className="min-w-0 flex-1 group flex gap-3"
                  >
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.photoUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center shrink-0">
                        <Icon name="storefront" className="text-2xl" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "text-[9.5px] font-bold px-1.5 py-0.5 rounded-md",
                          modelAccent(s.model)
                        )}
                      >
                        {s.model ?? "–"}
                      </span>
                      <span
                        className={cn(
                          "text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border",
                          s.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}
                      >
                        {s.isActive ? "Active" : "Non-active"}
                      </span>
                      {session.isArea && evalMap?.map.get(s.code) && <EvalChip s={evalMap.map.get(s.code)!} inProgress={evalMap.inProgress} />}
                    </div>
                    <p className="text-[14px] font-bold text-slate-900 mt-1 leading-tight group-hover:text-[#d32029] transition flex items-center gap-1">
                      {s.name}
                      <Icon name="chevron_right" className="text-slate-300 group-hover:text-[#d32029]" style={{ fontSize: 16 }} />
                    </p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      {s.code} · {s.region ?? "ไม่ระบุภาค"} · {s.empCount} คน
                    </p>
                    {s.empCount > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.seCount > 0 && <PosChip label="SE" n={s.seCount} />}
                        {s.saleFloorCount > 0 && <PosChip label="Sale floor" n={s.saleFloorCount} />}
                        {s.execCount > 0 && <PosChip label="ผู้บริหาร" n={s.execCount} />}
                        {s.otherCount > 0 && <PosChip label="อื่นๆ" n={s.otherCount} />}
                      </div>
                    )}
                    </div>
                  </Link>
                  {caps.canToggleStore && (
                    <button
                      onClick={() => onToggle(s)}
                      disabled={busy === s.code}
                      className={cn(
                        "relative w-14 h-7 rounded-full transition shrink-0 disabled:opacity-50",
                        s.isActive ? "bg-emerald-500" : "bg-slate-300"
                      )}
                      aria-pressed={s.isActive}
                      title={s.isActive ? "ปิดใช้งานร้าน" : "เปิดใช้งานร้าน"}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all",
                          s.isActive ? "left-7" : "left-0.5"
                        )}
                      />
                    </button>
                  )}
                </div>
                {session.isArea && (
                  <button
                    type="button"
                    onClick={() => openStoreData(s.code)}
                    className={cn(
                      "mt-2.5 w-full py-2 rounded-xl text-[12.5px] font-bold flex items-center justify-center gap-1.5 hover:-translate-y-0.5 transition-all",
                      session.areaViewDealer === s.code
                        ? "bg-[#d32029] text-white"
                        : "bg-red-50 text-[#d32029] border border-red-100"
                    )}
                  >
                    <Icon name="monitoring" style={{ fontSize: 16 }} />
                    {session.areaViewDealer === s.code ? "กำลังดูร้านนี้ · เปิดหน้าข้อมูล" : "ดูข้อมูลร้าน (ยอดขาย / ผลประโยชน์)"}
                  </button>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-[12px] text-slate-400 text-center py-6">
                ไม่พบร้านที่ตรงกับตัวกรอง
              </p>
            )}
          </div>
        )}

        {caps.canToggleStore && (
          <p className="text-[11px] text-slate-400 text-center">
            ปิดใช้งาน = ร้านยกเลิก/พักไว้ (ไม่ลบข้อมูล) · เปิดใหม่ได้ทุกเมื่อ
          </p>
        )}
      </div>

      <BottomNav active="database" />
    </>
  );
}

/* ---------- ย่อย ---------- */
/** ป้ายสถานะตรวจประเมินเดือนนี้ของร้าน (Area/Coach) */
function EvalChip({ s, inProgress }: { s: TrackStore; inProgress: boolean }) {
  const chronic = chronicText(s, inProgress);
  const [text, cls] =
    s.status === "done"
      ? [`✓ ตรวจแล้ว ${shortDate(s.submissions[0]?.evalDate ?? null)}`, "bg-emerald-50 text-emerald-700 border-emerald-200"]
      : chronic
        ? [chronic, "bg-red-600 text-white border-red-600"]
        : ["ยังไม่ตรวจเดือนนี้", "bg-amber-50 text-amber-800 border-amber-200"];
  return <span className={cn("text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border", cls)}>{text}</span>;
}

function PosStat({
  label,
  value,
  breakdown,
}: {
  label: string;
  value: number;
  /** รายการย่อยในกล่อง เช่น SE แยกระดับ A/S/B */
  breakdown?: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-xl bg-[#faf8f8] border border-slate-200/70 p-2 text-center">
      <p className="tnum text-[17px] font-bold text-[#a11119]">{value}</p>
      <p className="text-[9.5px] text-slate-500 leading-tight">{label}</p>
      {breakdown && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 space-y-0.5">
          {breakdown.map((b) => (
            <p
              key={b.label}
              className="flex items-center justify-between text-[9.5px] text-slate-500 leading-tight"
            >
              <span>{b.label}</span>
              <span className="tnum font-semibold text-slate-700">{b.value}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function PosChip({ label, n }: { label: string; n: number }) {
  return (
    <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md bg-[#faf1f1] text-[#a11119] border border-red-100 tnum">
      {label} {n}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "red";
}) {
  const toneMap = {
    slate: "text-slate-700",
    emerald: "text-emerald-600",
    red: "text-[#d32029]",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-center">
      <p className={cn("tnum text-[20px] font-bold", toneMap[tone])}>{value}</p>
      <p className="text-[10.5px] text-slate-400">{label}</p>
    </div>
  );
}

function ChipRow({
  label,
  items,
  value,
  onChange,
  total,
}: {
  label: string;
  items: { key: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
  total: number;
}) {
  return (
    <div className="mt-2.5">
      <p className="text-[10.5px] font-semibold text-slate-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={value === ALL} onClick={() => onChange(ALL)} label="ทั้งหมด" count={total} />
        {items.map((it) => (
          <Chip
            key={it.key}
            active={value === it.key}
            onClick={() => onChange(it.key)}
            label={it.key}
            count={it.count}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition active:scale-95 whitespace-nowrap",
        active
          ? "bg-[#d32029] text-white border-[#d32029]"
          : "bg-white text-slate-600 border-slate-200 hover:border-red-200"
      )}
    >
      {label}
      <span className={cn("ml-1 tnum", active ? "text-red-100" : "text-slate-400")}>
        {count}
      </span>
    </button>
  );
}

function countBy(
  stores: StoreInfo[],
  get: (s: StoreInfo) => string | null
): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of stores) {
    const k = (get(s) ?? "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function Header({ homeHref }: { homeHref: string }) {
  const { session } = useSession();
  const router = useRouter();
  const isArea = !!session?.isArea;
  // Area ที่ยังไม่เลือกร้าน: หน้านี้คือหน้าแรก -> ไม่มีปุ่มย้อน แต่มีปุ่มออกจากระบบ
  const showBack = homeHref !== "/app/stores";
  return (
    <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
      <div className="flex items-center space-x-2.5">
        {showBack && (
          <Link
            href={homeHref}
            aria-label="กลับ"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
        )}
        <div className="flex flex-col">
          <span className="font-bold text-[15px] text-[#231313] leading-tight">
            {isArea ? "ร้านที่ดูแล" : "ร้านค้าและทีมงาน"}
          </span>
          <span className="text-[11px] font-semibold text-[#b21e1e]">
            {isArea ? session?.areaName ?? "Area / Coach" : "เฉพาะผู้ดูแลระบบ (Admin)"}
          </span>
        </div>
      </div>
      {isArea ? (
        <button
          type="button"
          onClick={() => {
            doLogout();
            router.replace("/");
          }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      ) : (
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#d32029]">
          <Icon name="store" className="text-xl" />
        </div>
      )}
    </header>
  );
}
