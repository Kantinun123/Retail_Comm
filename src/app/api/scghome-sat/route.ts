import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REAL_AUTH } from "@/lib/supabase/api-scope";
import { canAccessDealer, getAuthContext } from "@/lib/supabase/auth-context";

/**
 * ความพึงพอใจด้าน "สินค้าและร้าน" ของ SCG Home (แบบสอบถามแยกจากงานบริการ)
 * - GET /api/scghome-sat?dealerCode=XXX  -> สรุป: เฉลี่ยรายข้อ + รายเดือน + ความเห็นล่าสุด (ไม่มี PII)
 * - ไม่มี dealerCode = ทุกร้าน (admin)
 * - มี session จริง -> บังคับขอบเขตร้าน ; ไม่มี (เดโม) -> พฤติกรรมเดิมของแอป
 */

const QUESTIONS = [
  ["q_variety", "ความหลากหลายของสินค้า"],
  ["q_quality", "คุณภาพของสินค้า"],
  ["q_availability", "มีสินค้าพร้อมส่งมอบตามเวลา"],
  ["q_price", "ราคาสินค้า"],
  ["q_promotion", "โปรโมชั่นสินค้า"],
  ["q_display", "การจัดแสดงสินค้าและบรรยากาศร้าน"],
  ["q_staff", "ความกระตือรือร้นของพนักงาน"],
  ["q_payment", "ความสะดวกในการชำระเงิน"],
  ["q_delivery", "การจัดส่งสินค้า"],
  ["q_revisit", "กลับมาใช้ซ้ำ / แนะนำต่อ"],
] as const;

type Row = Record<string, number | string | null>;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function GET(req: NextRequest) {
  const dealerCode = req.nextUrl.searchParams.get("dealerCode")?.trim() || null;
  try {
    const ctx = await getAuthContext();
    // โหมด login จริง: ไม่มี session = ปฏิเสธ (เดิมปล่อยผ่านแบบเดโม)
    if (!ctx && REAL_AUTH) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    if (ctx) {
      if (dealerCode && !canAccessDealer(ctx, dealerCode)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (!dealerCode && ctx.allowedDealerCodes !== "all") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    }

    const sb = createServiceClient();
    const cols = ["period", "eval_date", "overall", "improve_text", "impress_text", ...QUESTIONS.map(([k]) => k)].join(",");
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      let q = sb.from("scghome_sat_lines").select(cols).order("eval_date", { ascending: false }).range(from, from + 999);
      if (dealerCode) q = q.eq("dealer_code", dealerCode);
      const { data, error } = await q;
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      rows.push(...((data ?? []) as unknown as Row[]));
      if (!data || data.length < 1000) break;
    }

    const nums = (k: string) => rows.map((r) => r[k]).filter((v): v is number => v != null && v !== "").map(Number);
    const overall = avg(nums("overall"));

    const questions = QUESTIONS.map(([k, label]) => ({ key: k, label, avg: avg(nums(k)), n: nums(k).length }));

    const byMonth = new Map<string, number[]>();
    for (const r of rows) {
      if (r.overall == null) continue;
      const p = String(r.period);
      (byMonth.get(p) ?? byMonth.set(p, []).get(p)!).push(Number(r.overall));
    }
    const months = [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([period, xs]) => ({ period, count: xs.length, overall: avg(xs) }));

    const improve = rows
      .filter((r) => r.improve_text)
      .slice(0, 5)
      .map((r) => ({ date: r.eval_date, text: String(r.improve_text) }));

    return NextResponse.json({ ok: true, count: rows.length, overall, questions, months, improve });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
