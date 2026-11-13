"use client";

/* =============================================================
   หน้าหลักของ Area / Coach / หัวหน้า Area — การ์ดเลือกเรื่อง (แบบเดียวกับ Admin)
   - ดูข้อมูล: ผลประโยชน์มุมมองร้านค้า (เลือกร้าน) / มุมมองพนักงาน (เลือกร้าน + คน) / ร้านที่ดูแลและทีมงาน
   - งานของฉัน: ติดตามการตรวจร้าน / แจ้งเพิ่มพนักงานใหม่ / เปิดแจ้งเตือนบนมือถือ
   - Coach: งานของฉันขึ้นก่อน (ตรวจร้านเป็นงานหลักรายเดือน) ; Area / หัวหน้า Area: ดูข้อมูลขึ้นก่อน
   - เห็นเฉพาะร้านที่ดูแล ; เซิร์ฟเวอร์ตรวจสิทธิ์ร้าน/พนักงานซ้ำทุกครั้ง
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { SearchableSelect, type ComboOption } from "./searchable-select";
import { doLogout, setAreaStaff, setAreaStore, useSession } from "@/lib/commission/session";
import { fetchStores, type StoreInfo } from "@/lib/commission/employee-store";
import { fetchSaleReps, type SaleRep } from "@/lib/commission/sale-reps-store";
import { fetchEmployeeRequests } from "@/lib/commission/employee-request-store";
import { chronicText, EVAL_FORM_URL, fetchTracking, monthLabel, shortDate, type TrackStore, type Tracking } from "@/lib/commission/eval-tracking-store";
import { enablePush, getPushState, type PushState } from "@/lib/commission/push-client";
import { cn } from "@/lib/utils";

type Picker = null | "store" | "staff";

const KIND_LABEL: Record<string, string> = { area: "Area Manager", coach: "Coach", re: "Coach", area_head: "หัวหน้า Area" };

export function AreaHomeScreen() {
  const { session, ready } = useSession();
  const router = useRouter();

  const [stores, setStores] = useState<StoreInfo[] | null>(null);
  const [track, setTrack] = useState<Tracking | null>(null);
  const [reqCounts, setReqCounts] = useState<{ pending: number; fix: number } | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const [picker, setPicker] = useState<Picker>(null);
  const [model, setModel] = useState("");
  const [region, setRegion] = useState("");
  const [dealer, setDealer] = useState("");
  const [reps, setReps] = useState<{ dealer: string; list: SaleRep[] } | null>(null);
  const [rep, setRep] = useState("");

  const isArea = !!session?.isArea;
  const areaStores = session?.areaStores;

  // หน้านี้เฉพาะกลุ่ม Area ; role อื่นกลับหน้าหลักของตัวเอง
  useEffect(() => {
    if (ready && session && !session.isArea) router.replace(session.isSales ? "/app/home-staff" : "/app/home");
  }, [ready, session, router]);

  // ร้านที่ดูแล (เฉพาะที่เปิดใช้งาน)
  useEffect(() => {
    if (!ready || !isArea) return;
    let cancelled = false;
    fetchStores()
      .then((list) => !cancelled && setStores(list.filter((s) => s.isActive && (areaStores ?? []).includes(s.code))))
      .catch(() => !cancelled && setStores([]));
    return () => {
      cancelled = true;
    };
  }, [ready, isArea, areaStores]);

  // ตัวเลขสรุปเล็กน้อยของการ์ด (ตรวจร้านเดือนนี้ / คำขอพนักงาน / สถานะแจ้งเตือน)
  useEffect(() => {
    if (!ready || !isArea) return;
    let cancelled = false;
    fetchTracking().then((r) => !cancelled && r.ok && setTrack(r));
    fetchEmployeeRequests().then((r) => {
      if (cancelled || !r.ok) return;
      const resent = new Set(r.requests.filter((x) => x.mine && x.status !== "rejected").map((x) => x.payload.name.trim()));
      setReqCounts({
        pending: r.requests.filter((x) => x.status === "pending").length,
        fix: r.requests.filter((x) => x.mine && x.status === "rejected" && !resent.has(x.payload.name.trim())).length,
      });
    });
    getPushState().then((s) => !cancelled && setPush(s));
    return () => {
      cancelled = true;
    };
  }, [ready, isArea]);

  // มุมมองพนักงาน: โหลดรายชื่อเมื่อเลือกร้าน
  useEffect(() => {
    if (picker !== "staff" || !dealer) return;
    let cancelled = false;
    fetchSaleReps(dealer)
      .then((list) => !cancelled && setReps({ dealer, list }))
      .catch(() => !cancelled && setReps({ dealer, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [picker, dealer]);

  // สถานะตรวจเดือนนี้รายร้าน (ใช้ในรายการเลือกร้าน)
  const evalByStore = useMemo(() => {
    const m = new Map<string, TrackStore>();
    track?.coaches.forEach((c) => c.stores.forEach((s) => m.set(s.code, s)));
    return m;
  }, [track]);

  const list = useMemo(() => stores ?? [], [stores]);
  const models = useMemo(() => [...new Set(list.map((s) => s.model).filter((x): x is string => !!x))].sort(), [list]);
  const regions = useMemo(
    () => [...new Set(list.filter((s) => !model || s.model === model).map((s) => s.region).filter((x): x is string => !!x))].sort(),
    [list, model]
  );
  const storeOptions: ComboOption[] = useMemo(
    () =>
      list
        .filter((s) => (!model || s.model === model) && (!region || s.region === region))
        .map((s) => {
          const e = evalByStore.get(s.code);
          const ev = !e ? "" : e.status === "done" ? ` · ✓ ตรวจแล้ว ${shortDate(e.submissions[0]?.evalDate ?? null)}` : ` · ${chronicText(e, true) ?? "ยังไม่ตรวจเดือนนี้"}`;
          return { value: s.code, label: s.name, sub: `รหัส ${s.code}${s.region ? " · " + s.region : ""}${ev}`, tag: s.model ?? undefined };
        }),
    [list, model, region, evalByStore]
  );
  const repList = reps && reps.dealer === dealer ? reps.list : null;
  const repOptions: ComboOption[] = useMemo(
    () => (repList ?? []).map((r) => ({ value: r.repCode, label: r.name, sub: r.crCode ?? r.repCode })),
    [repList]
  );

  if (!ready || !session) return null;
  if (!session.isArea) return null;

  const kind = session.areaKind ?? "area";
  const isCoach = kind === "coach" || kind === "re";
  const storeCount = stores?.length ?? session.areaStores.length;

  function openPicker(p: Exclude<Picker, null>) {
    setPicker((cur) => (cur === p ? null : p));
    setModel("");
    setRegion("");
    setDealer("");
    setRep("");
  }
  function goStore() {
    if (!dealer) return;
    setAreaStore(dealer);
    router.push("/app/home");
  }
  function goStaff() {
    if (!dealer || !rep) return;
    setAreaStaff(dealer, rep, repList?.find((r) => r.repCode === rep)?.name ?? null);
    router.push("/app/home-staff");
  }
  async function turnOnPush() {
    setPushBusy(true);
    setPushMsg(null);
    const r = await enablePush();
    setPushBusy(false);
    if (r.ok) {
      setPush("on");
      setPushMsg("เปิดแล้ว · ส่งข้อความทดสอบไปที่เครื่องนี้แล้ว");
    } else {
      setPushMsg(r.error ?? "เปิดการแจ้งเตือนไม่สำเร็จ");
      setPush(await getPushState());
    }
  }

  const selCls =
    "w-full appearance-none bg-white text-slate-900 text-[13px] font-semibold rounded-xl pl-3 pr-9 py-2.5 border border-slate-200 focus:border-[#d32029] focus:ring-2 focus:ring-[#d32029]/15 transition";
  const filters = (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ประเภทร้าน</label>
        <select value={model} onChange={(e) => { setModel(e.target.value); setRegion(""); setDealer(""); setRep(""); }} className={selCls}>
          <option value="">ทั้งหมด ({list.length})</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400" style={{ fontSize: 16 }} />
      </div>
      <div className="relative">
        <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ภาค</label>
        <select value={region} onChange={(e) => { setRegion(e.target.value); setDealer(""); setRep(""); }} className={selCls}>
          <option value="">ทั้งหมด</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-2 bottom-2.5 text-slate-400" style={{ fontSize: 16 }} />
      </div>
    </div>
  );
  const storeSelect = (
    <div>
      <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">ร้าน ({storeOptions.length}) — พิมพ์ค้นได้</label>
      <SearchableSelect
        options={storeOptions}
        value={dealer || null}
        onChange={(v) => { setDealer(v); setRep(""); }}
        placeholder={stores === null ? "กำลังโหลดร้าน..." : "เลือกหรือพิมพ์ค้นหาร้าน"}
        searchPlaceholder="พิมพ์ชื่อร้าน / รหัส"
        emptyText="ไม่พบร้านที่ค้นหา"
      />
    </div>
  );

  // ---------- การ์ด ----------
  const viewSection = (
    <section key="view">
      <h3 className="text-[12px] font-bold text-[#8f1114] mb-2 px-1">ดูข้อมูล</h3>
      <div className="space-y-2.5">
        <div className="rounded-2xl border border-red-100 bg-white shadow-sm">
          <CardButton icon="storefront" tone="red" title="ดูผลประโยชน์ มุมมองร้านค้า" sub="ยอดขาย · ผลประโยชน์ · แบบรับเข้า ของร้านที่เลือก" open={picker === "store"} onClick={() => openPicker("store")} />
          {picker === "store" && (
            <div className="border-t border-slate-100 p-3 space-y-2.5 bg-slate-50/50">
              {filters}
              {storeSelect}
              <button type="button" disabled={!dealer} onClick={goStore} className="w-full py-2.5 rounded-xl bg-[#d32029] text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.99] transition">
                เข้าดูมุมมองร้านค้า
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
          <CardButton icon="badge" tone="sky" title="ดูผลประโยชน์ มุมมองพนักงาน" sub="เห็นแบบเดียวกับพนักงาน · เลือกร้าน + คน" open={picker === "staff"} onClick={() => openPicker("staff")} />
          {picker === "staff" && (
            <div className="border-t border-slate-100 p-3 space-y-2.5 bg-slate-50/50">
              {filters}
              {storeSelect}
              {dealer && (
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5 px-0.5">พนักงานในร้าน — พิมพ์ค้นได้</label>
                  {repList === null ? (
                    <p className="text-[12px] text-slate-400 py-2 text-center">กำลังโหลดรายชื่อ...</p>
                  ) : repList.length === 0 ? (
                    <p className="text-[12px] text-slate-400 py-2 text-center">ร้านนี้ไม่มีพนักงานในระบบ</p>
                  ) : (
                    <SearchableSelect
                      options={repOptions}
                      value={rep || null}
                      onChange={setRep}
                      placeholder="เลือกหรือพิมพ์ค้นหาพนักงาน"
                      searchPlaceholder="พิมพ์ชื่อพนักงาน"
                      emptyText="ไม่พบพนักงานที่ค้นหา"
                    />
                  )}
                </div>
              )}
              <button type="button" disabled={!dealer || !rep} onClick={goStaff} className="w-full py-2.5 rounded-xl bg-sky-600 text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.99] transition">
                เข้าดูมุมมองพนักงาน
              </button>
            </div>
          )}
        </div>

        <LinkCard href="/app/stores" icon="groups" tone="red" title="ร้านที่ดูแลและทีมงาน" sub={`รายชื่อร้าน ${storeCount} ร้าน · พนักงาน · Area/Coach`} />
      </div>
    </section>
  );

  const missing = track ? track.totals.missing : null;
  const urgent = track?.coaches.flatMap((c) => c.stores).filter((s) => s.status === "missing").sort((a, b) => Number(b.chronic) - Number(a.chronic))[0];
  const workSection = (
    <section key="work">
      <h3 className="text-[12px] font-bold text-[#1d4ed8] mb-2 px-1">งานของฉัน</h3>
      <div className="space-y-2.5">
        <div className={cn("rounded-2xl bg-white shadow-sm border", track && track.totals.chronic > 0 ? "border-amber-300 border-2" : "border-blue-100")}>
          <Link href="/app/eval-tracking" className="p-3.5 flex items-center gap-3 active:scale-[0.99] transition">
            <IconBox icon="fact_check" tone="blue" badge={missing || null} badgeTone="amber" />
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-bold text-slate-900">{track ? `ติดตามการตรวจร้าน ${monthLabel(track.period)}` : "ติดตามการตรวจร้าน"}</p>
              <p className="text-[11px] text-slate-500">
                {track ? `ตรวจแล้ว ${track.totals.done}/${track.totals.stores} · เหลือ ${track.daysLeft} วัน` : "ครบ / ขาด / ซ้ำ รายเดือน"}
              </p>
              {track && track.totals.chronic > 0 && (
                <p className="text-[11px] font-bold text-[#a11119] flex items-center gap-0.5">
                  <Icon name="error" style={{ fontSize: 13 }} />
                  ค้างจากเดือนก่อน {track.totals.chronic} ร้าน
                </p>
              )}
            </div>
            <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
          </Link>
          {isCoach && urgent && (
            <div className="px-3.5 pb-3.5 -mt-1">
              <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", urgent.chronic ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-200")}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-slate-900 truncate">{urgent.name}</span>
                  <span className={cn("block text-[10.5px]", urgent.chronic ? "text-[#a11119] font-bold" : "text-amber-800")}>
                    {urgent.code} · {chronicText(urgent, true) ?? "ยังไม่ตรวจเดือนนี้"}
                  </span>
                </span>
                <a href={EVAL_FORM_URL} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-blue-600 text-white text-[11.5px] font-bold px-3 py-1.5">
                  ทำแบบประเมิน
                </a>
              </div>
              {(missing ?? 0) > 1 && <p className="mt-1.5 text-[11px] text-slate-500 px-0.5">ยังไม่ตรวจอีก {(missing ?? 0) - 1} ร้าน · ดูทั้งหมดในหน้าติดตาม</p>}
            </div>
          )}
        </div>

        <LinkCard
          href="/app/employee-requests"
          icon="person_add"
          tone="emerald"
          title="แจ้งเพิ่มพนักงานใหม่"
          sub={
            reqCounts && (reqCounts.pending > 0 || reqCounts.fix > 0)
              ? [reqCounts.pending > 0 ? `รออนุมัติ ${reqCounts.pending}` : "", reqCounts.fix > 0 ? `ต้องแก้ไข ${reqCounts.fix}` : ""].filter(Boolean).join(" · ")
              : "ส่งข้อมูลพนักงานเข้าใหม่ให้ Admin อนุมัติ · ดูคำขอของฉัน"
          }
          badge={reqCounts?.fix || null}
        />

        {(push === "off" || push === "needs-install" || pushMsg) && (
          <div className="rounded-2xl border border-violet-100 bg-white shadow-sm p-3.5 flex items-center gap-3">
            <IconBox icon="notifications_active" tone="violet" />
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-bold text-slate-900">แจ้งเตือนบนมือถือ</p>
              <p className="text-[11px] text-slate-500">
                {pushMsg ??
                  (push === "needs-install"
                    ? "iPhone: เพิ่มแอปไปยังหน้าจอโฮม แล้วเปิดจากไอคอน จึงเปิดได้"
                    : "เตือนเมื่อมีร้านค้างตรวจ / คำขอพนักงาน")}
              </p>
            </div>
            {push === "off" && (
              <button type="button" disabled={pushBusy} onClick={turnOnPush} className="shrink-0 rounded-full bg-violet-600 text-white text-[12px] font-bold px-3.5 py-1.5 disabled:opacity-50">
                เปิด
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <span className="font-bold text-[16px] text-[#231313]">หน้าหลัก</span>
        <button
          onClick={() => {
            doLogout();
            router.replace("/");
          }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      </header>

      <div className="space-y-5 pb-4">
        <Link
          href="/app/member"
          className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 shadow-sm p-3 hover:border-red-200 active:scale-[0.99] transition"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Icon name="person" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[15px] text-[#231313] leading-tight truncate">{session.areaName ?? KIND_LABEL[kind] ?? "Area"}</p>
            <p className="text-[11px] font-semibold text-[#b21e1e] mt-0.5">
              {KIND_LABEL[kind] ?? "Area"} · ดูแล {storeCount} ร้าน
            </p>
          </div>
          <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
        </Link>

        <p className="text-[13.5px] font-bold text-[#231313] px-1">เลือกเรื่องที่ต้องการดู</p>

        {isCoach ? [workSection, viewSection] : [viewSection, workSection]}

        <p className="text-[11px] text-slate-400 text-center">เห็นเฉพาะร้านที่ดูแล · เลือกการ์ดเพื่อเข้าดูข้อมูล</p>
      </div>

      <BottomNav active="areaHome" />
    </>
  );
}

/* ---------- ย่อย ---------- */
const TONE: Record<string, string> = {
  red: "bg-red-50 text-[#d32029]",
  sky: "bg-sky-50 text-sky-600",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  violet: "bg-violet-50 text-[#7c3aed]",
};

function IconBox({ icon, tone, badge, badgeTone = "red" }: { icon: string; tone: string; badge?: number | null; badgeTone?: "red" | "amber" }) {
  return (
    <div className={cn("relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", TONE[tone])}>
      <Icon name={icon} className="text-2xl" />
      {!!badge && (
        <span
          aria-label={`${badge} รายการ`}
          className={cn(
            "absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white",
            badgeTone === "amber" ? "bg-amber-500" : "bg-[#d32029]"
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </div>
  );
}

function CardButton({ icon, tone, title, sub, open, onClick }: { icon: string; tone: string; title: string; sub: string; open: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} className="w-full p-3.5 flex items-center gap-3 active:scale-[0.99] transition">
      <IconBox icon={icon} tone={tone} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[14.5px] font-bold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
      <Icon name={open ? "expand_less" : "chevron_right"} className="text-slate-300 text-xl shrink-0" />
    </button>
  );
}

function LinkCard({ href, icon, tone, title, sub, badge }: { href: string; icon: string; tone: string; title: string; sub: string; badge?: number | null }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-100 bg-white shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] hover:border-red-200 hover:-translate-y-0.5 transition-all"
    >
      <IconBox icon={icon} tone={tone} badge={badge} />
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-bold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
      <Icon name="chevron_right" className="text-slate-300 text-xl shrink-0" />
    </Link>
  );
}
