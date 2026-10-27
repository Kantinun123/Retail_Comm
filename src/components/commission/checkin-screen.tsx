"use client";

/* =============================================================
   หน้าเช็คอินรายวัน (Daily Check-in)
   - เฉพาะพนักงานขาย (sales) — role อื่นถูกพาออก
   - server-authoritative: อ่าน/เขียนผ่าน /api/checkin (checkin-store)
   - ปฏิทิน 7 วัน + ปุ่มเช็คอิน + ลิงก์ไปแลกของรางวัล
   - ธีม SCG แดง ให้เข้ากับหน้าสมาชิก
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { useSession } from "@/lib/commission/session";
import {
  CHECKIN_REWARDS,
  CHECKIN_CYCLE_TOTAL,
  fetchCheckinState,
  performCheckin,
  type CheckinState,
} from "@/lib/commission/checkin-store";
import { notify } from "@/lib/commission/notifications";
import { cn } from "@/lib/utils";

const DAYS = [1, 2, 3, 4, 5, 6, 7];

function fmtPts(n: number): string {
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export function CheckinScreen() {
  const { session, ready } = useSession();
  const router = useRouter();

  const empId = session?.isSales ? session.empId : null;
  const [state, setState] = useState<CheckinState | null>(null);
  // เริ่มที่ true เสมอ -> ไม่ต้อง setLoading(true) ใน effect (เลี่ยง cascading render)
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // เฉพาะ sales — role อื่นพาออกไปหน้าสมาชิก
  useEffect(() => {
    if (ready && session && !session.isSales) {
      router.replace("/app/member");
    }
  }, [ready, session, router]);

  // reload แบบ manual (หลังเช็คอิน) — ไม่ผูกกับ effect
  const reload = useCallback(async () => {
    if (!empId) return;
    const s = await fetchCheckinState(empId);
    setState(s);
    return s;
  }, [empId]);

  // โหลดครั้งแรก: fetch ใน effect พร้อม cancel flag
  // (setState ใน async callback ไม่ใช่ synchronous -> ไม่ trigger cascading render)
  useEffect(() => {
    if (!empId) return;
    let cancelled = false;
    fetchCheckinState(empId)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [empId]);

  async function onCheckin() {
    if (!empId || busy) return;
    setBusy(true);
    try {
      const res = await performCheckin(empId);
      if (res.ok && !res.already) {
        setToast(`เช็คอินสำเร็จ รับ +${fmtPts(res.points)} แต้ม 🎉`);
        // แจ้งเตือนเข้ากระดิ่ง (เก็บประวัติ, เฉพาะพนักงานคนนี้)
        notify({
          title: "เช็คอินรายวันสำเร็จ",
          detail: `+${fmtPts(res.points)} แต้ม · ต่อเนื่อง ${res.streak} วัน 🔥`,
          icon: "event_available",
          audience: [`emp:${empId}`],
          link: "/app/check-in",
        });
      } else if (res.already) {
        setToast("วันนี้เช็คอินไปแล้ว พรุ่งนี้มาใหม่นะ");
      } else {
        setToast(res.error ?? "เช็คอินไม่สำเร็จ");
      }
      await reload();
    } catch {
      setToast("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (!ready || !session) return null;
  if (!session.isSales) return null;

  const checkedToday = state?.checkedToday ?? false;
  const streak = state?.currentStreak ?? 0;
  const total = state?.checkinTotal ?? 0;
  const nextDay = state?.nextDay ?? 1;
  const nextPoints = state?.nextPoints ?? CHECKIN_REWARDS[1];
  // วันในรอบที่ "เก็บแล้ว" = ถ้าเช็คแล้ววันนี้ = currentDay, ไม่งั้น = nextDay-1 (วันก่อนหน้าในรอบ)
  const claimedInCycle = checkedToday
    ? state?.currentDay ?? 0
    : Math.max(0, nextDay - 1);

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href="/app/member"
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">เช็คอินรายวัน</span>
        </div>
        <Link
          href="/app/member"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#a11119] hover:underline"
        >
          <Icon name="redeem" style={{ fontSize: 16 }} />
          แลกของรางวัล
        </Link>
      </header>

      <div className="space-y-4 pb-4">
        {/* การ์ด hero: streak + แต้มสะสม */}
        <section className="rounded-2xl bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white p-4 shadow-lg shadow-[#d32029]/20">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-[26px] shrink-0">
              🔥
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-red-100/90">เช็คอินต่อเนื่อง</p>
              <p className="text-[26px] font-bold leading-tight">
                {streak} วันติด
              </p>
              <p className="text-[12px] text-red-100/85 mt-0.5">
                แต้มเช็คอินสะสม {fmtPts(total)} แต้ม
              </p>
            </div>
          </div>
        </section>

        {/* ปฏิทินรางวัล 7 วัน */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5">
              <Icon name="calendar_month" className="text-lg text-[#d32029]" />
              <span>รางวัล 7 วัน</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              รอบนี้ · {claimedInCycle}/7
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {DAYS.map((d) => {
              const reward = CHECKIN_REWARDS[d];
              const claimed = d <= claimedInCycle;
              const isNext = !checkedToday && d === nextDay;
              const isBig = d === 7;
              return (
                <div
                  key={d}
                  className={cn(
                    "rounded-xl p-2 flex flex-col items-center justify-center text-center min-h-[84px] border transition",
                    claimed
                      ? "bg-[#fff5f5] border-[#d32029]/25"
                      : isNext
                        ? "bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white border-transparent shadow-md shadow-[#d32029]/25"
                        : isBig
                          ? "bg-white border-dashed border-[#d32029]/40"
                          : "bg-white border-slate-200",
                    // วัน 7 กินเต็มแถว (col-span) ให้เด่น
                    isBig && "col-span-4"
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      claimed
                        ? "text-[#a11119]"
                        : isNext
                          ? "text-white"
                          : isBig
                            ? "text-[#a11119]"
                            : "text-slate-500"
                    )}
                  >
                    {isNext ? "วันนี้" : isBig ? "วัน 7 · รางวัลใหญ่" : `วัน ${d}`}
                  </span>
                  <span className="text-[20px] my-0.5">
                    {claimed ? "✅" : isBig ? "🏆" : isNext ? "🎁" : "🪙"}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      claimed
                        ? "text-emerald-600"
                        : isNext
                          ? "text-white"
                          : "text-slate-500"
                    )}
                  >
                    {claimed ? "✓ " : "+"}
                    {fmtPts(reward)}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-3">
            ครบ 7 วันรับรวม {fmtPts(CHECKIN_CYCLE_TOTAL)} แต้ม แล้วเริ่มรอบใหม่
          </p>
        </section>

        {/* ปุ่มเช็คอิน */}
        <button
          type="button"
          onClick={onCheckin}
          disabled={busy || loading || checkedToday}
          className={cn(
            "w-full py-3.5 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition active:scale-[0.99]",
            checkedToday
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-[#d32029] to-[#8f1114] text-white shadow-lg shadow-[#d32029]/25"
          )}
        >
          {loading ? (
            "กำลังโหลด..."
          ) : checkedToday ? (
            <>
              <Icon name="check_circle" style={{ fontSize: 20 }} />
              เช็คอินวันนี้แล้ว
            </>
          ) : busy ? (
            "กำลังเช็คอิน..."
          ) : (
            <>
              <Icon name="touch_app" style={{ fontSize: 20 }} />
              เช็คอินวันนี้ รับ +{fmtPts(nextPoints)} แต้ม
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-400 text-center">
          กดได้วันละ 1 ครั้ง · แต้มรวมเข้ากระเป๋าแต้มกิจกรรม แลกของรางวัลได้ที่หน้าฉัน
        </p>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 max-w-[90%]">
          <div className="bg-[#231313] text-white text-[13px] font-medium px-4 py-2.5 rounded-full shadow-lg text-center">
            {toast}
          </div>
        </div>
      )}

      <BottomNav active="member" />
    </>
  );
}
