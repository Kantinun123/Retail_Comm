import { NextResponse } from "next/server";
import { canAccessDealer, getAuthContext, repDealerIfAllowed, type AuthContext } from "@/lib/supabase/auth-context";

/** โหมด login จริง (production) — ต้องมี session จริงทุก request ; ไม่ตั้ง = โหมดเดโม (พฤติกรรมเดิม) */
export const REAL_AUTH = process.env.NEXT_PUBLIC_REAL_AUTH === "1";

export type ScopeResult =
  | { ok: true; ctx: AuthContext | null; dealerCode: string | null; repCode: string | null }
  | { ok: false; res: NextResponse };

const deny = (status: 401 | 403, error: string): ScopeResult => ({
  ok: false,
  res: NextResponse.json({ ok: false, error }, { status }),
});

/**
 * บังคับขอบเขตข้อมูลของ API ตามผู้ login (ใช้ร่วมกันทุก route ที่รับ ?dealerCode= / ?repCode=)
 * - ไม่มี session จริง: โหมด real auth -> 401 ; โหมดเดโม -> ใช้ค่าจาก query ตามเดิม
 * - admin: ตามที่ขอ (dealerCode ว่าง = ทุกร้าน)
 * - ร้าน / Area / Coach / หัวหน้า Area: ต้องเป็นร้านที่เข้าถึงได้ ; ไม่ระบุร้าน -> ใช้ร้านเดียวที่มี (ถ้ามีร้านเดียว) ไม่งั้น 403
 *   ดูรายพนักงาน (repCode) ได้เฉพาะเมื่อระบุร้านที่เข้าถึงได้ด้วย
 * - พนักงาน (sales): perRep=true -> บังคับเป็นงานของตัวเอง (repCode ของตัวเอง) ;
 *   perRep=false (ข้อมูลระดับร้าน) -> บังคับเป็นร้านที่สังกัด
 */
export async function resolveScope(
  dealerCode: string | null,
  repCode: string | null,
  opts: { perRep?: boolean } = {}
): Promise<ScopeResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    if (REAL_AUTH) return deny(401, "unauthenticated");
    return { ok: true, ctx: null, dealerCode, repCode };
  }

  if (ctx.role === "sales") {
    if (opts.perRep) {
      if (!ctx.repCode) return deny(403, "forbidden");
      return { ok: true, ctx, dealerCode: null, repCode: ctx.repCode };
    }
    if (!ctx.dealerCode) return deny(403, "forbidden");
    return { ok: true, ctx, dealerCode: ctx.dealerCode, repCode: null };
  }

  if (ctx.allowedDealerCodes === "all") return { ok: true, ctx, dealerCode, repCode };

  // ดูรายพนักงาน: พนักงานต้องอยู่ในร้านที่เข้าถึงได้ -> แสดงงานทั้งหมดของคนนั้น (เหมือนที่พนักงานเห็นเอง)
  if (repCode && opts.perRep) {
    const repDealer = await repDealerIfAllowed(ctx, repCode, dealerCode);
    if (!repDealer) return deny(403, "forbidden");
    return { ok: true, ctx, dealerCode: null, repCode };
  }

  let dc = dealerCode;
  if (!dc) {
    if (ctx.allowedDealerCodes.length !== 1) return deny(403, "forbidden");
    dc = ctx.allowedDealerCodes[0];
  }
  if (!canAccessDealer(ctx, dc)) return deny(403, "forbidden");
  return { ok: true, ctx, dealerCode: dc, repCode };
}
