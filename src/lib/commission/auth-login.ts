"use client";

/* =============================================================
   Auth เฟส 2: login จริงด้วย Supabase (email/password)
   -------------------------------------------------------------
   แนวทาง identity bridge: หลัง login สำเร็จ + ได้ profile ที่ approved
   เขียน role/emp_id/dealer_code ลง sessionStorage keys เดิม (ผ่าน doLogin)
   -> readSession()/useSession()/logic.currentRole() ทำงานเหมือนเดิม
      โดยไม่ต้องแก้ทุก screen
   ============================================================= */
import { createClient } from "@/lib/supabase/client";
import { doLogin } from "./session";
import type { Role } from "./types";

export interface AuthLoginResult {
  ok: boolean;
  error?: string;
  /** สถานะ profile ถ้าไม่ approved จะบอกไว้ (pending/rejected) */
  status?: string;
  /** role ใน session หลัง login สำเร็จ */
  role?: Role;
  /** บัญชีที่ admin แจกให้ ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน */
  mustChangePassword?: boolean;
}

const MUST_CHANGE_KEY = "mustChangePw";

/** ตั้ง/ล้างธง "ต้องเปลี่ยนรหัสผ่าน" (AppGuard จะพาไปหน้าเปลี่ยนรหัสจนกว่าจะล้าง) */
export function setMustChangePassword(v: boolean) {
  if (v) sessionStorage.setItem(MUST_CHANGE_KEY, "1");
  else sessionStorage.removeItem(MUST_CHANGE_KEY);
}

/** profile.role ที่เป็น Area Manager / Coach (เห็นเฉพาะร้านที่ดูแลตาม rep_store_assignments) */
export function isAreaRole(role: string | null | undefined): boolean {
  return role === "area" || role === "coach" || role === "re";
}

/** map profile.role -> Role ของ session (area/coach ใช้ทางแยกใน loginWithEmail)
 *  staff ถือเป็นมุมมองพนักงาน (sales-view) */
function toSessionRole(role: string | null): Role {
  switch (role) {
    case "admin":
      return "admin";
    case "sales":
    case "staff":
      return "sales";
    case "dealer":
    case "area":
    case "re":
    default:
      return "dealer";
  }
}

import { usernameToEmail } from "./username";
export { LOCAL_ACCOUNT_DOMAIN, usernameToEmail } from "./username";

/** login ด้วยชื่อผู้ใช้หรืออีเมล + รหัสผ่าน แล้วตั้ง session (identity bridge) */
export async function loginWithEmail(
  username: string,
  password: string
): Promise<AuthLoginResult> {
  const sb = createClient();

  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (authErr || !auth.user) {
    const bad = /invalid login credentials/i.test(authErr?.message ?? "");
    return { ok: false, error: bad ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" : authErr?.message ?? "เข้าสู่ระบบไม่สำเร็จ" };
  }

  // อ่าน profile ของผู้ login (RLS: read own profile)
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("status, role, emp_id, dealer_code, reject_reason, must_change_password")
    .eq("id", auth.user.id)
    .single();

  if (pErr || !profile) {
    await sb.auth.signOut();
    return { ok: false, error: "ไม่พบโปรไฟล์ผู้ใช้" };
  }

  if (profile.status !== "approved") {
    // ยังไม่อนุมัติ/ถูกปฏิเสธ -> ไม่ตั้ง session ; ออกจาก Supabase session ด้วย
    await sb.auth.signOut();
    return {
      ok: false,
      status: profile.status,
      error:
        profile.status === "rejected"
          ? `คำขอถูกปฏิเสธ: ${profile.reject_reason ?? "ติดต่อผู้ดูแลระบบ"}`
          : "บัญชียังไม่ได้รับการอนุมัติ",
    };
  }

  // Area / Coach: ร้านที่ดูแล + ชื่อ มาจาก server (/api/me ใช้ rep_store_assignments) — เหมือน /auth/bridge
  if (isAreaRole(profile.role)) {
    const res = await fetch("/api/me", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; me?: { name?: string | null; storeCodes?: string[] | null } } | null;
    if (!res.ok || !json?.ok || !json.me) {
      await sb.auth.signOut();
      return { ok: false, error: "อ่านข้อมูลร้านที่ดูแลไม่สำเร็จ ลองใหม่อีกครั้ง" };
    }
    doLogin({ role: "area", areaStores: json.me.storeCodes ?? [], areaName: json.me.name ?? undefined });
    setMustChangePassword(!!profile.must_change_password);
    return { ok: true, role: "area", mustChangePassword: !!profile.must_change_password };
  }

  // identity bridge: เขียนลง sessionStorage keys เดิม
  const role = toSessionRole(profile.role);
  doLogin({
    role,
    dealerCode: profile.dealer_code ?? undefined,
    empId: role === "sales" ? profile.emp_id ?? undefined : undefined,
  });

  setMustChangePassword(!!profile.must_change_password);
  return { ok: true, role, mustChangePassword: !!profile.must_change_password };
}

/** หน้าแรกหลัง login ตาม role ของ session */
export function homeForRole(role: Role | undefined | null): string {
  return role === "sales" ? "/app/home-staff" : role === "area" ? "/app/stores" : "/app/home";
}

/** ออกจากระบบทั้ง Supabase session และ sessionStorage */
export async function logoutAll(): Promise<void> {
  const sb = createClient();
  await sb.auth.signOut();
}
