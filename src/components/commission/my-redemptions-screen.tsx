"use client";

/* =============================================================
   หน้าประวัติการแลกของรางวัล (มุมมองสมาชิก) — เต็มหน้า + แท็บกรอง
   เห็นเฉพาะคำขอของตัวเอง, ใช้การ์ด timeline เดียวกับหน้าฉัน
   ============================================================= */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { RedemptionCard } from "./redemption-card";
import { useSession } from "@/lib/commission/session";
import {
  getRedemptions,
  subscribeRedemptions,
} from "@/lib/commission/points-store";
import { profileKey } from "@/lib/commission/profile";
import type { Redemption, RedemptionStatus } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

const FILTERS: { key: RedemptionStatus | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pending", label: "รออนุมัติ" },
  { key: "shipping", label: "รอจัดส่ง" },
  { key: "delivered", label: "ส่งแล้ว" },
  { key: "received", label: "รับของแล้ว" },
  { key: "rejected", label: "ไม่อนุมัติ" },
];

export function MyRedemptionsScreen() {
  const { session, ready } = useSession();
  const focusId = useSearchParams().get("focus");
  const [list, setList] = useState<Redemption[]>([]);
  const [filter, setFilter] = useState<RedemptionStatus | "all">("all");

  const pKey =
    session && !session.isAdmin
      ? profileKey({
          isSales: session.isSales,
          empId: session.empId,
          dealerCode: session.dealer.code,
        })
      : null;

  useEffect(() => {
    if (!pKey) return;
    const refresh = () => setList(getRedemptions(pKey));
    refresh();
    return subscribeRedemptions(refresh);
  }, [pKey]);

  if (!ready || !session) return null;

  const shown =
    filter === "all" ? list : list.filter((r) => r.status === filter);

  return (
    <>
      <header className="flex items-center space-x-2.5 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <Link
          href="/app/member"
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
        >
          <Icon name="arrow_back" className="text-xl" />
        </Link>
        <div className="flex flex-col">
          <span className="font-bold text-[15px] text-[#231313] leading-tight">
            ประวัติการแลกของรางวัล
          </span>
          <span className="text-[11px] font-semibold text-[#b21e1e]">
            ทั้งหมด {list.length} รายการ
          </span>
        </div>
      </header>

      {/* ไม่มี key = แอดมิน/ไม่มีสิทธิ์ */}
      {!pKey ? (
        <div className="py-16 text-center">
          <Icon name="info" className="text-5xl text-slate-200" />
          <p className="text-[13px] text-slate-500 mt-2">
            บัญชีนี้ไม่มีประวัติการแลกของรางวัล
          </p>
        </div>
      ) : (
        <>
          {/* แท็บกรองสถานะ (เลื่อนแนวนอนเห็นครบทุกแท็บ) */}
          <div className="flex gap-1.5 scroll-x-tabs pb-2 mt-1 pr-3">
            {FILTERS.map((f) => {
              const n =
                f.key === "all"
                  ? list.length
                  : list.filter((r) => r.status === f.key).length;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition",
                    filter === f.key
                      ? "bg-[#d32029] text-white"
                      : "bg-white border border-slate-200 text-slate-500"
                  )}
                >
                  {f.label} ({n})
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5 mt-2 pb-4">
            {shown.length === 0 ? (
              <div className="py-16 text-center">
                <Icon name="inbox" className="text-5xl text-slate-200" />
                <p className="text-[13px] text-slate-400 mt-2">
                  ไม่มีรายการในหมวดนี้
                </p>
              </div>
            ) : (
              shown.map((r) => (
                <RedemptionCard key={r.id} r={r} focus={r.id === focusId} />
              ))
            )}
          </div>
        </>
      )}

      <BottomNav active="member" />
    </>
  );
}
