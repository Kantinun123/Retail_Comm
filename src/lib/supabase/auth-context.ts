import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * ตัวตนผู้ใช้จริงฝั่ง server (จาก cookie session ของ Supabase Auth + profiles)
 * - คืน null ถ้าไม่มี session จริง (รวมถึง anonymous ของโหมดเดโม) หรือโปรไฟล์ยังไม่ approved
 * - allowedDealerCodes: "all" = ทุกร้าน (admin), ไม่งั้นเป็นรายการร้านที่เข้าถึงได้
 *   - area/re : ร้านที่ผูกใน rep_store_assignments ด้วย profiles.rep_code
 *   - dealer  : ร้านเดียวตาม profiles.dealer_code
 */
export interface AuthContext {
  userId: string;
  email: string | null;
  role: string;
  repCode: string | null;
  dealerCode: string | null;
  allowedDealerCodes: "all" | string[];
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user || user.is_anonymous) return null;

  const { data: profile } = await sb
    .from("profiles")
    .select("role, status, rep_code, dealer_code")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status !== "approved" || !profile.role) return null;

  let allowed: "all" | string[] = [];
  if (profile.role === "admin") {
    allowed = "all";
  } else if (profile.role === "area" || profile.role === "re") {
    if (profile.rep_code) {
      const svc = createServiceClient();
      const { data } = await svc
        .from("rep_store_assignments")
        .select("dealer_code")
        .eq("rep_code", profile.rep_code);
      allowed = Array.from(new Set((data ?? []).map((r) => r.dealer_code as string)));
    }
  } else if (profile.dealer_code) {
    allowed = [profile.dealer_code];
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role,
    repCode: profile.rep_code ?? null,
    dealerCode: profile.dealer_code ?? null,
    allowedDealerCodes: allowed,
  };
}

/** ร้าน dealerCode อยู่ในขอบเขตของผู้ใช้หรือไม่ */
export function canAccessDealer(ctx: AuthContext, dealerCode: string): boolean {
  return ctx.allowedDealerCodes === "all" || ctx.allowedDealerCodes.includes(dealerCode);
}
