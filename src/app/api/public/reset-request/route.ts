import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * ร้านค้าส่งคำขอรีเซ็ตรหัสผ่าน (ไม่ต้อง login)
 * POST { dealerCode, contactName, phone, note? }
 * - ตอบสำเร็จเหมือนกันทุกกรณี (ไม่บอกว่าร้านนี้มีบัญชีหรือไม่) กันการเดาข้อมูล
 * - ร้านละ 1 คำขอที่ค้างอยู่ (unique index) ; จำกัดความยาวข้อความ
 */
export async function POST(req: NextRequest) {
  let body: { dealerCode?: string; contactName?: string; phone?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const dealerCode = String(body.dealerCode ?? "").trim();
  const contactName = String(body.contactName ?? "").trim().slice(0, 100);
  const phone = String(body.phone ?? "").trim().slice(0, 30);
  const note = String(body.note ?? "").trim().slice(0, 300) || null;

  if (!dealerCode || !contactName || !phone) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกร้าน ชื่อผู้ติดต่อ และเบอร์โทร" }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const { data: dealer } = await sb.from("dealers").select("code").eq("code", dealerCode).maybeSingle();
    if (dealer) {
      const { error } = await sb
        .from("password_reset_requests")
        .insert({ dealer_code: dealerCode, contact_name: contactName, phone, note });
      // 23505 = มีคำขอค้างของร้านนี้อยู่แล้ว -> ถือว่าสำเร็จ
      if (error && error.code !== "23505") {
        return NextResponse.json({ ok: false, error: "ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
