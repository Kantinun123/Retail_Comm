"use client";

/* ติดตามกลุ่ม Line ลูกค้า (client) — ข้อมูลจาก /api/line-groups */

export type LineStatus = "register" | "not_register" | "no_bot" | "none";

export const LINE_STATUS: Record<LineStatus, { label: string; short: string; chip: string; bar: string }> = {
  register: { label: "ลงทะเบียนแล้ว", short: "ลงทะเบียน", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
  not_register: { label: "ยังไม่ลงทะเบียน", short: "ยังไม่ลงทะเบียน", chip: "bg-amber-50 text-amber-800 border-amber-200", bar: "bg-amber-400" },
  no_bot: { label: "ยังไม่ Add Bot", short: "ไม่ Add Bot", chip: "bg-red-50 text-[#b91c1c] border-red-200", bar: "bg-red-500" },
  none: { label: "ไม่มีข้อมูล", short: "ไม่มีข้อมูล", chip: "bg-slate-100 text-slate-600 border-slate-200", bar: "bg-slate-300" },
};
/** ลำดับในรายการ: ต้องตามมากสุดก่อน */
export const LINE_STATUS_ORDER: LineStatus[] = ["no_bot", "not_register", "none", "register"];

export interface LineJob {
  /** rudy = LHS/Rudy (เลข RD) ; ba = BA งานติดตั้ง (เลขใบเสนอราคา Q…) */
  source: "rudy" | "ba";
  project: string;
  opps: string | null;
  h5: string | null;
  orderDate: string | null;
  amount: number | null;
  status: LineStatus;
  sales: string | null;
}
export interface LineCustomer {
  id: string;
  name: string;
  type: string | null;
  province: string | null;
  dealerCode: string;
  dealerName: string;
  model: string | null;
  coachRep: string | null;
  coachName: string | null;
  areaName: string | null;
  status: LineStatus;
  groupName: string | null;
  groupCreated: string | null;
  source: string | null;
  salesName: string | null;
  salesRep: string | null;
  salesPhone: string | null;
  jobs: LineJob[];
}
export interface LineCounts {
  customers: number;
  register: number;
  not_register: number;
  no_bot: number;
  none: number;
}
export interface LineCoach extends LineCounts {
  repCode: string | null;
  name: string;
  nickname: string | null;
  phone: string | null;
  stores: number;
}
export interface LineTracking {
  period: string;
  months: string[];
  sourceDate: string | null;
  updatedAt?: string;
  totals: LineCounts & { jobs: number };
  coaches: LineCoach[];
  customers: LineCustomer[];
  me: { role: string; repCode: string | null };
}

export async function fetchLineTracking(period?: string): Promise<({ ok: true } & LineTracking) | { ok: false; error: string; status?: number }> {
  try {
    const res = await fetch(`/api/line-groups${period ? `?period=${period}` : ""}`, { cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return { ok: false, error: j?.error ?? "โหลดข้อมูลไม่สำเร็จ", status: res.status };
    return j;
  } catch {
    return { ok: false, error: "เชื่อมต่อไม่สำเร็จ" };
  }
}

/** กลุ่ม Solution ของงาน: Roof Reno = งานเปลี่ยนหลังคา (Rudy REROOF / BA Re-Roof) ; ที่เหลือ = Roof Service */
export const isReroof = (h5: string | null | undefined) => /^re-?roof$/i.test(String(h5 ?? "").trim());
export const solutionLabel = (h5: string | null | undefined) => (isReroof(h5) ? "Roof Reno (เปลี่ยนหลังคา)" : "Roof Service");
/** "Roof Service · TOTAL ROOF" / "Roof Reno (เปลี่ยนหลังคา)" */
export const jobTypeText = (h5: string | null | undefined) => (isReroof(h5) ? solutionLabel(h5) : `Roof Service · ${h5 ?? "-"}`);
/** CSV (เปิดด้วย Excel ได้ ภาษาไทยไม่เพี้ยน) — 1 แถวต่องาน */
export function lineTrackingCsv(t: LineTracking, customers: LineCustomer[]): string {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["เดือน", "Coach", "Area", "รหัสร้าน", "ร้าน", "โมเดล", "ลูกค้า", "ประเภทลูกค้า", "จังหวัด", "สถานะกลุ่ม Line (ลูกค้า)", "ชื่อกลุ่ม Line", "พนักงานขาย", "แหล่ง", "เลขงาน", "เลข OP", "กลุ่ม Solution", "ประเภทงาน", "วันที่เปิดงาน", "ยอด (รวม VAT)", "สถานะของงานนี้"];
  const lines = [head.map(q).join(",")];
  for (const c of customers)
    for (const j of c.jobs)
      lines.push(
        [t.period, c.coachName, c.areaName, c.dealerCode, c.dealerName, c.model, c.name, c.type, c.province, LINE_STATUS[c.status].label, c.groupName, j.sales ?? c.salesName, j.source === "ba" ? "BA" : "Rudy", j.project, j.opps, solutionLabel(j.h5), j.h5, j.orderDate, j.amount, LINE_STATUS[j.status].label]
          .map(q)
          .join(",")
      );
  return "\ufeff" + lines.join("\r\n");
}
