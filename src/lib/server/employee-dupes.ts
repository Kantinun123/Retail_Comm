import type { createServiceClient } from "@/lib/supabase/service";
import { normalizeName, normalizePhone } from "@/lib/commission/employee-request-shared";

export interface DupMatch {
  repCode: string;
  name: string;
  dealerCode: string | null;
  dealerName: string | null;
  isActive: boolean;
  reason: ("name" | "phone" | "email")[];
}

type Sb = ReturnType<typeof createServiceClient>;

/** โหลดพนักงานทั้งหมดครั้งเดียว (~250 แถว) แล้วเทียบในหน่วยความจำ */
export async function loadRepIndex(sb: Sb) {
  const [{ data: reps }, { data: dealers }] = await Promise.all([
    sb.from("sale_reps").select("rep_code, name, phone, phone2, email, dealer_code, is_active"),
    sb.from("dealers").select("code, name"),
  ]);
  const dealerName = new Map((dealers ?? []).map((d) => [d.code as string, d.name as string]));
  return { reps: reps ?? [], dealerName };
}

/** หาพนักงานที่ชื่อ / เบอร์ / อีเมลตรงกับคำขอ */
export function findDupes(
  index: Awaited<ReturnType<typeof loadRepIndex>>,
  p: { name: string; phone: string | null; email: string | null }
): DupMatch[] {
  const n = normalizeName(p.name);
  const ph = normalizePhone(p.phone);
  const em = (p.email ?? "").trim().toLowerCase();
  const out: DupMatch[] = [];
  for (const r of index.reps) {
    const reason: DupMatch["reason"] = [];
    if (n && normalizeName(String(r.name ?? "")) === n) reason.push("name");
    if (ph && (normalizePhone(r.phone as string) === ph || normalizePhone(r.phone2 as string) === ph)) reason.push("phone");
    if (em && String(r.email ?? "").trim().toLowerCase() === em) reason.push("email");
    if (reason.length) {
      out.push({
        repCode: r.rep_code as string,
        name: r.name as string,
        dealerCode: (r.dealer_code as string | null) ?? null,
        dealerName: r.dealer_code ? index.dealerName.get(r.dealer_code as string) ?? null : null,
        isActive: !!r.is_active,
        reason,
      });
    }
  }
  return out.slice(0, 5);
}
