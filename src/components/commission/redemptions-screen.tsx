"use client";

/* =============================================================
   หน้าจัดการคำขอแลกของรางวัล (เฉพาะผู้ดูแลระบบ)
   เห็นคำขอจากสมาชิกทุกคน -> อนุมัติ / ไม่อนุมัติ / กดจัดส่ง
   (โหมดจำลองในเครื่อง: เห็นคำขอที่สร้างในเครื่องนี้)
   ============================================================= */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { GiftThumb } from "./gift-thumb";
import { giftById } from "@/lib/commission/gifts";
import { useSession } from "@/lib/commission/session";
import {
  getAllRedemptions,
  updateRedemptionStatus,
  subscribeRedemptions,
  statusMeta,
  DELIVERY_METHOD_META,
} from "@/lib/commission/points-store";
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

function fmtDt(ms: number | null): string {
  if (!ms) return "-";
  return new Date(ms).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RedemptionsScreen() {
  const { session, ready } = useSession();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const [all, setAll] = useState<Redemption[]>([]);
  const [filter, setFilter] = useState<RedemptionStatus | "all">(
    focusId ? "all" : "pending"
  );

  useEffect(() => {
    const refresh = () => setAll(getAllRedemptions());
    refresh();
    return subscribeRedemptions(refresh);
  }, []);

  if (!ready || !session) return null;

  // เฉพาะผู้ดูแลระบบ
  if (!session.isAdmin) {
    return (
      <>
        <header className="flex items-center space-x-2.5 py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
          <Link
            href="/app/dashboard"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">คำขอแลกของรางวัล</span>
        </header>
        <div className="py-16 text-center">
          <Icon name="lock" className="text-5xl text-slate-200" />
          <p className="text-[13px] text-slate-500 mt-2">
            หน้านี้สำหรับผู้ดูแลระบบเท่านั้น
          </p>
        </div>
        <BottomNav active="dashboard" />
      </>
    );
  }

  const list =
    filter === "all" ? all : all.filter((r) => r.status === filter);
  const pendingCount = all.filter((r) => r.status === "pending").length;

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href="/app/dashboard"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] text-[#231313] leading-tight">
              คำขอแลกของรางวัล
            </span>
            <span className="text-[11px] font-semibold text-[#b21e1e]">
              รออนุมัติ {pendingCount} รายการ
            </span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#d32029]">
          <Icon name="redeem" className="text-xl" />
        </div>
      </header>

      {/* ตัวกรองสถานะ (เลื่อนแนวนอนเห็นครบทุกแท็บ) */}
      <div className="flex gap-1.5 scroll-x-tabs pb-2 mt-1 pr-3">
        {FILTERS.map((f) => {
          const n =
            f.key === "all"
              ? all.length
              : all.filter((r) => r.status === f.key).length;
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
        {list.length === 0 ? (
          <div className="py-16 text-center">
            <Icon name="inbox" className="text-5xl text-slate-200" />
            <p className="text-[13px] text-slate-400 mt-2">ไม่มีคำขอในหมวดนี้</p>
          </div>
        ) : (
          list.map((r) => (
            <AdminRedemptionCard key={r.id} r={r} focus={r.id === focusId} />
          ))
        )}
      </div>

      <BottomNav active="dashboard" />
    </>
  );
}

function AdminRedemptionCard({ r, focus }: { r: Redemption; focus?: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [tracking, setTracking] = useState("");
  const meta = statusMeta(r.status);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // เลื่อนไปที่การ์ดที่ถูกเจาะจงจากการแจ้งเตือน
  useEffect(() => {
    if (focus && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focus]);

  function act(action: "approve" | "reject" | "deliver") {
    if (action === "reject") {
      updateRedemptionStatus(r.ownerKey, r.id, "reject", { rejectReason: reason });
      setRejecting(false);
      setReason("");
    } else if (action === "deliver") {
      updateRedemptionStatus(r.ownerKey, r.id, "deliver", { trackingNo: tracking });
      setTracking("");
    } else {
      updateRedemptionStatus(r.ownerKey, r.id, "approve");
    }
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-2xl bg-white border border-slate-100 shadow-sm p-3.5",
        focus && "focus-flash"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex items-center gap-2.5">
          <GiftThumb
            imageUrl={giftById(r.giftId)?.imageUrl}
            icon={giftById(r.giftId)?.icon ?? "redeem"}
            name={r.giftName}
            size={40}
          />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-800 truncate">
              {r.giftName}
            </p>
            <p className="text-[11px] text-slate-400">
              {r.reqNo} · {r.ownerName}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ background: meta.color + "1a", color: meta.color }}
        >
          <Icon name={meta.icon} style={{ fontSize: 13 }} />
          {meta.label}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span>แต้ม: <span className="font-semibold text-slate-700">{Number(r.cost).toLocaleString("th-TH")}</span></span>
        <span className="flex items-center gap-1">
          <Icon name={DELIVERY_METHOD_META[r.method].icon} style={{ fontSize: 13 }} />
          {DELIVERY_METHOD_META[r.method].label}
        </span>
        <span>ขอเมื่อ: {fmtDt(r.timeline.requested)}</span>
        {r.timeline.reviewed && <span>พิจารณา: {fmtDt(r.timeline.reviewed)}</span>}
      </div>

      {r.method === "parcel" && r.address && (
        <p className="text-[11px] text-slate-500 mt-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5">
          📍 {r.address}
        </p>
      )}
      {r.status === "rejected" && r.rejectReason && (
        <p className="text-[11px] text-red-600 mt-1.5">เหตุผล: {r.rejectReason}</p>
      )}
      {(r.status === "delivered" || r.status === "received") && r.trackingNo && (
        <p className="text-[11px] text-slate-600 mt-1.5">เลขพัสดุ: {r.trackingNo}</p>
      )}
      {r.status === "received" && (
        <div className="mt-1.5">
          <p className="text-[11px] text-emerald-700 flex items-center gap-1">
            <Icon name="inventory_2" style={{ fontSize: 13 }} />
            สมาชิกรับของแล้ว · {fmtDt(r.timeline.received)}
          </p>
          {r.proofPhotos && r.proofPhotos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {r.proofPhotos.map((p, i) => (
                <Image
                  key={i}
                  src={p}
                  alt={`หลักฐาน ${i + 1}`}
                  width={56}
                  height={56}
                  unoptimized
                  className="w-14 h-14 rounded-lg object-cover border border-slate-100"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* การกระทำตามสถานะ */}
      {r.status === "pending" && !rejecting && (
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-[12px] font-bold active:scale-[0.99] transition"
          >
            ไม่อนุมัติ
          </button>
          <button
            type="button"
            onClick={() => act("approve")}
            className="flex-1 py-2 rounded-xl bg-[#16a34a] text-white text-[12px] font-bold active:scale-[0.99] transition"
          >
            อนุมัติ
          </button>
        </div>
      )}
      {r.status === "pending" && rejecting && (
        <div className="mt-2.5 space-y-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เหตุผลที่ไม่อนุมัติ"
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-300 focus:bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-[12px] font-bold"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => act("reject")}
              className="flex-1 py-2 rounded-xl bg-[#dc2626] text-white text-[12px] font-bold"
            >
              ยืนยันไม่อนุมัติ (คืนแต้ม)
            </button>
          </div>
        </div>
      )}
      {r.status === "shipping" && (
        <div className="mt-2.5 space-y-2">
          {r.method === "parcel" && (
            <input
              type="text"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="เลขพัสดุ (ถ้ามี)"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-300 focus:bg-white"
            />
          )}
          <button
            type="button"
            onClick={() => act("deliver")}
            className="w-full py-2 rounded-xl bg-[#0ea5e9] text-white text-[12px] font-bold active:scale-[0.99] transition"
          >
            ยืนยันจัดส่งแล้ว
          </button>
        </div>
      )}
    </div>
  );
}
