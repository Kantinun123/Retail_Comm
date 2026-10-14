"use client";

/* =============================================================
   การ์ดคำขอแลก + timeline สถานะ (มุมมองสมาชิก)
   ใช้ร่วมกันทั้งในหน้าฉัน (สรุป) และหน้าประวัติการแลกเต็ม
   ============================================================= */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { GiftThumb } from "./gift-thumb";
import {
  confirmReceived,
  statusMeta,
  DELIVERY_METHOD_META,
} from "@/lib/commission/points-store";
import { fileToResizedDataUrl } from "@/lib/commission/image";
import { giftById } from "@/lib/commission/gifts";
import type { Redemption } from "@/lib/commission/types";
import { cn } from "@/lib/utils";

export function RedemptionCard({
  r,
  focus,
}: {
  r: Redemption;
  focus?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (focus && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focus]);

  const fmtDt = (ms: number | null) =>
    ms
      ? new Date(ms).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setErr(null);
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of files) {
        added.push(await fileToResizedDataUrl(f));
      }
      setPhotos((p) => [...p, ...added].slice(0, 6)); // จำกัด 6 รูป
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "แนบรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function doConfirmReceive() {
    confirmReceived(r.ownerKey, r.id, photos);
    setReceiving(false);
    setPhotos([]);
  }

  const rejected = r.status === "rejected";
  // ขั้นของ timeline (ซ่อนขั้นจัดส่งถ้าถูกปฏิเสธ)
  const steps = rejected
    ? [
        { label: "รออนุมัติการแลกแต้ม", at: r.timeline.requested },
        { label: "ไม่อนุมัติการแลกแต้ม", at: r.timeline.reviewed, bad: true },
      ]
    : [
        { label: "รออนุมัติการแลกแต้ม", at: r.timeline.requested },
        { label: "อนุมัติแลกแต้ม", at: r.timeline.reviewed },
        { label: "รอจัดส่งของรางวัล", at: r.timeline.shipping },
        { label: "จัดส่งของรางวัลแล้ว", at: r.timeline.delivered },
        { label: "รับของแล้ว", at: r.timeline.received },
      ];

  const meta = statusMeta(r.status);

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-2xl border border-slate-100 p-3",
        focus && "focus-flash"
      )}
    >
      {/* หัว: ของรางวัล + สถานะ */}
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 flex items-center gap-2.5">
          <GiftThumb
            imageUrl={giftById(r.giftId)?.imageUrl}
            icon={giftById(r.giftId)?.icon ?? "redeem"}
            name={r.giftName}
            size={40}
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 truncate">
              {r.giftName}
            </p>
            <p className="text-[10px] text-slate-400">
              {r.reqNo} · −{Number(r.cost).toLocaleString("th-TH")} แต้ม ·{" "}
              {DELIVERY_METHOD_META[r.method].label}
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

      {/* timeline */}
      <ol className="mt-1 space-y-0">
        {steps.map((s, i) => {
          const done = s.at != null;
          const last = i === steps.length - 1;
          const bad = "bad" in s && s.bad;
          const color = bad ? "#dc2626" : done ? "#16a34a" : "#cbd5e1";
          return (
            <li key={i} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span
                  className="w-3 h-3 rounded-full border-2 shrink-0 mt-0.5"
                  style={{
                    borderColor: color,
                    background: done ? color : "transparent",
                  }}
                />
                {!last && (
                  <span
                    className="w-0.5 flex-1 my-0.5"
                    style={{ background: done ? "#16a34a" : "#e2e8f0", minHeight: 14 }}
                  />
                )}
              </div>
              <div className="pb-2 min-w-0">
                <p
                  className={cn(
                    "text-[12px] leading-tight",
                    done ? "font-semibold text-slate-700" : "text-slate-400"
                  )}
                  style={bad ? { color: "#dc2626" } : undefined}
                >
                  {s.label}
                </p>
                <p className="text-[10px] text-slate-400">
                  {fmtDt(s.at) ?? "รอดำเนินการ"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* รายละเอียดเพิ่ม */}
      {rejected && r.rejectReason && (
        <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 mt-1">
          เหตุผล: {r.rejectReason} · แต้มถูกคืนแล้ว
        </p>
      )}
      {r.status === "delivered" && r.method === "parcel" && r.trackingNo && (
        <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 mt-1 flex items-center gap-1">
          <Icon name="local_shipping" style={{ fontSize: 13 }} className="text-sky-500" />
          เลขพัสดุ: <span className="font-semibold">{r.trackingNo}</span>
        </p>
      )}
      {r.method === "parcel" && r.address && (
        <p className="text-[10px] text-slate-400 mt-1 truncate">
          📍 {r.address}
        </p>
      )}

      {/* ปุ่มยืนยันรับของ (เมื่อจัดส่งแล้ว ยังไม่กดรับ) */}
      {r.status === "delivered" && !receiving && (
        <button
          type="button"
          onClick={() => setReceiving(true)}
          className="mt-2 w-full py-2 rounded-xl bg-[#16a34a] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition"
        >
          <Icon name="inventory_2" style={{ fontSize: 15 }} />
          ยืนยันรับของ
        </button>
      )}

      {/* ฟอร์มแนบรูป + ยืนยันรับของ */}
      {r.status === "delivered" && receiving && (
        <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5 space-y-2">
          <p className="text-[11px] font-bold text-slate-600">
            แนบรูปของที่ได้รับ (ไม่บังคับ)
          </p>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {photos.map((p, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden">
                  <Image
                    src={p}
                    alt={`รูป ${i + 1}`}
                    width={56}
                    height={56}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <Icon name="close" style={{ fontSize: 11 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {err && <p className="text-[10px] text-[#d32029]">{err}</p>}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || photos.length >= 6}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a11119] bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-full disabled:opacity-50 transition"
          >
            <Icon name="add_a_photo" style={{ fontSize: 14 }} />
            {busy ? "กำลังประมวลผล…" : "เพิ่มรูป"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onPickPhotos}
            className="hidden"
          />
          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setReceiving(false);
                setPhotos([]);
                setErr(null);
              }}
              className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 text-[12px] font-bold"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={doConfirmReceive}
              className="flex-1 py-2 rounded-lg bg-[#16a34a] text-white text-[12px] font-bold"
            >
              ยืนยันรับของ
            </button>
          </div>
        </div>
      )}

      {/* รูปหลักฐานเมื่อรับของแล้ว */}
      {r.status === "received" && r.proofPhotos && r.proofPhotos.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-slate-400 mb-1">รูปของที่ได้รับ</p>
          <div className="flex flex-wrap gap-1.5">
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
        </div>
      )}
    </div>
  );
}
