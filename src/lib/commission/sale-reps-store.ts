"use client";

/* รายชื่อพนักงานขาย (sale_reps) — ใช้ตอน login พนักงาน + หาโปรไฟล์ rep */

export interface SaleRep {
  repCode: string;
  crCode: string | null;
  name: string;
  dealerCode: string | null;
  dealerName: string | null;
  dealerModel: string | null;
}

type RawRep = {
  rep_code: string;
  cr_code: string | null;
  name: string;
  dealer_code: string | null;
  dealer_name: string | null;
  dealer_model: string | null;
};

function mapRep(r: RawRep): SaleRep {
  return {
    repCode: r.rep_code,
    crCode: r.cr_code,
    name: r.name,
    dealerCode: r.dealer_code,
    dealerName: r.dealer_name,
    dealerModel: r.dealer_model,
  };
}

/** พนักงานในร้าน (สำหรับ dropdown login) */
export async function fetchSaleReps(dealerCode: string | null): Promise<SaleRep[]> {
  const q = dealerCode ? `?dealerCode=${encodeURIComponent(dealerCode)}` : "";
  const res = await fetch(`/api/sale-reps${q}`, { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; reps?: RawRep[] };
  return raw.ok && Array.isArray(raw.reps) ? raw.reps.map(mapRep) : [];
}

/** หา rep คนเดียวจาก repCode (ใช้เติมข้อมูลโปรไฟล์ถ้า session ขาด) */
export async function fetchSaleRep(repCode: string): Promise<SaleRep | null> {
  const res = await fetch(`/api/sale-reps?repCode=${encodeURIComponent(repCode)}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as { ok?: boolean; reps?: RawRep[] };
  const list = raw.ok && Array.isArray(raw.reps) ? raw.reps.map(mapRep) : [];
  return list.find((r) => r.repCode === repCode) ?? list[0] ?? null;
}
