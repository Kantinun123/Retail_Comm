"use client";

/* อนุมัติผู้ใช้ร้านค้า (admin) — ต้องล็อกอินด้วยบัญชีจริง (Microsoft/อีเมล) ที่ role = admin */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { useSession } from "@/lib/commission/session";
import { refreshAdminPending } from "@/lib/commission/admin-pending";
import { cn } from "@/lib/utils";

type Tab = "pending" | "approved" | "rejected";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  status: string;
  role: string | null;
  rep_code: string | null;
  username: string;
  dealer_code: string | null;
  dealer_name: string | null;
  requested_dealer_code: string | null;
  requested_dealer_name: string | null;
  existing_dealer_user: string | null;
  reject_reason: string | null;
  created_at: string;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "รออนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ปฏิเสธ/ระงับ" },
];

type RoleFilter = "all" | "dealer" | "area" | "coach";
const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "dealer", label: "ร้านค้า" },
  { key: "area", label: "Area" },
  { key: "coach", label: "Coach" },
];
const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  dealer: { label: "ร้านค้า", cls: "bg-red-50 text-[#a11119] border-red-200" },
  area: { label: "Area", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  area_head: { label: "หัวหน้า Area", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  coach: { label: "Coach", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  re: { label: "RE", cls: "bg-slate-50 text-slate-700 border-slate-200" },
  sales: { label: "พนักงาน", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function AdminUsersScreen() {
  const { session, ready } = useSession();
  const [tab, setTab] = useState<Tab>("pending");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [reload, setReload] = useState(0);
  // รหัสผ่านชั่วคราวที่เพิ่งสร้าง/รีเซ็ต — แสดงครั้งเดียว ไม่เก็บที่อื่น
  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [dealers, setDealers] = useState<{ code: string; name: string }[]>([]);
  const [newDealer, setNewDealer] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");

  // คำขอรีเซ็ตรหัสผ่านจากร้านค้า
  interface ResetReq {
    id: number;
    dealer_code: string;
    dealer_name: string | null;
    account_email: string | null;
    contact_name: string;
    phone: string;
    note: string | null;
    created_at: string;
  }
  const [resetReqs, setResetReqs] = useState<ResetReq[]>([]);
  const [resetReload, setResetReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/reset-requests", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !cancelled && j.ok && setResetReqs(j.requests))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resetReload]);

  async function handleReset(r: ResetReq, action: "reset" | "dismiss") {
    if (action === "reset" && !window.confirm(`ยืนยันตัวตนผู้ติดต่อแล้ว และรีเซ็ตรหัสผ่านร้าน ${r.dealer_name ?? r.dealer_code}?`)) return;
    setBusy(`req-${r.id}`);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/reset-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: r.id, action }),
      });
      const j = await res.json();
      if (!j.ok) {
        setMsg({ type: "err", text: j.error ?? "ทำรายการไม่สำเร็จ" });
      } else {
        if (j.credentials) setCreds(j.credentials);
        setMsg({ type: "ok", text: action === "reset" ? "รีเซ็ตแล้ว" : "ปิดคำขอแล้ว" });
        setResetReload((n) => n + 1);
        refreshAdminPending();
      }
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    fetch("/api/public/dealers")
      .then((r) => r.json())
      .then((j) => j.ok && setDealers(j.dealers))
      .catch(() => {});
  }, []);

  async function createAccount() {
    if (!newDealer) return;
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", dealerCode: newDealer, username: newUsername }),
      });
      const j = await res.json();
      if (!j.ok) {
        setMsg({ type: "err", text: j.error ?? "สร้างบัญชีไม่สำเร็จ" });
      } else {
        setCreds(j.credentials);
        setNewDealer("");
        setNewUsername("");
        setMsg({ type: "ok", text: "สร้างบัญชีแล้ว" });
        setReload((r) => r + 1);
      }
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users?status=${tab}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setAuthErr(
            res.status === 401
              ? "ต้องเข้าสู่ระบบด้วยบัญชีจริง (Microsoft หรืออีเมล) ที่เป็น admin จึงจะจัดการผู้ใช้ได้ — การเข้าแบบเดโมใช้ไม่ได้"
              : "บัญชีนี้ไม่มีสิทธิ์ admin"
          );
          setUsers([]);
          return;
        }
        const j = await res.json();
        setAuthErr(null);
        setUsers(j.ok ? j.users : []);
      })
      .catch(() => !cancelled && setUsers([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, reload]);

  async function act(u: UserRow, action: "approve" | "reject" | "revoke" | "reset") {
    let reason: string | undefined;
    if (action === "reject" || action === "revoke") {
      const r = window.prompt(action === "reject" ? "เหตุผลที่ปฏิเสธ" : "เหตุผลที่ระงับ", "");
      if (r === null) return;
      reason = r;
    }
    setBusy(u.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, action, reason, dealerCode: u.requested_dealer_code }),
      });
      const j = await res.json();
      if (!j.ok) {
        setMsg({ type: "err", text: j.error ?? "ทำรายการไม่สำเร็จ" });
      } else {
        if (j.credentials) setCreds(j.credentials);
        setMsg({ type: "ok", text: action === "approve" ? "อนุมัติแล้ว" : "บันทึกแล้ว" });
        setReload((r) => r + 1);
        refreshAdminPending();
      }
    } finally {
      setBusy(null);
    }
  }

  const q = query.trim().toLowerCase();
  const shown = users.filter((u) => {
    const r = u.role === "area_head" ? "area" : u.role ?? ""; // หัวหน้า Area อยู่ในกลุ่ม Area
    if (roleFilter !== "all" && r !== roleFilter) return false;
    if (!q) return true;
    return [u.username, u.full_name, u.dealer_code, u.dealer_name, u.requested_dealer_code, u.requested_dealer_name, u.rep_code]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  });

  if (!ready || !session) return null;
  if (!session.isAdmin) {
    return <p className="mt-10 text-center text-sm text-slate-500">เฉพาะผู้ดูแลระบบ</p>;
  }

  return (
    <div className="pb-24">
      <div className="flex items-center gap-2 py-4">
        <Link href="/app/home" aria-label="กลับ" className="p-2 -ml-2 rounded-xl hover:bg-slate-100">
          <Icon name="arrow_back" className="text-xl" />
        </Link>
        <h1 className="text-[17px] font-bold text-slate-900">บัญชีผู้ใช้</h1>
      </div>

      {creds && (
        <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
          <p className="text-[12px] font-bold text-amber-900">บัญชีสำหรับส่งให้ผู้ใช้ (แสดงครั้งเดียว)</p>
          <p className="text-[13px] mt-1.5 text-slate-800">
            ชื่อผู้ใช้: <b className="select-all">{creds.email}</b>
          </p>
          <p className="text-[13px] text-slate-800">
            รหัสผ่านชั่วคราว: <b className="select-all font-mono">{creds.tempPassword}</b>
          </p>
          <p className="text-[11px] text-amber-800 mt-1.5">
            ต้องตั้งรหัสผ่านใหม่ตอนเข้าครั้งแรก · ปิดกล่องนี้แล้วจะดูรหัสไม่ได้อีก
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => navigator.clipboard?.writeText(`ชื่อผู้ใช้: ${creds.email}\nรหัสผ่านชั่วคราว: ${creds.tempPassword}`)}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-[12px] font-bold"
            >
              คัดลอก
            </button>
            <button
              onClick={() => setCreds(null)}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-[12px] font-bold"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {resetReqs.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5">
          <p className="text-[13px] font-bold text-amber-900 mb-2">
            คำขอรีเซ็ตรหัสผ่าน ({resetReqs.length})
          </p>
          <div className="space-y-2">
            {resetReqs.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-amber-100 p-3">
                <p className="text-[13px] font-bold text-slate-900">
                  {r.dealer_name ?? r.dealer_code} ({r.dealer_code})
                </p>
                <p className="text-[12px] text-slate-600 mt-0.5">
                  {r.contact_name} · โทร {r.phone}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {r.account_email ? `บัญชี: ${r.account_email}` : "ร้านนี้ยังไม่มีบัญชีที่อนุมัติแล้ว"}
                  {" · "}
                  {new Date(r.created_at).toLocaleString("th-TH")}
                </p>
                {r.note && <p className="text-[11px] text-slate-500 mt-1">หมายเหตุ: {r.note}</p>}
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={busy === `req-${r.id}` || !r.account_email}
                    onClick={() => handleReset(r, "reset")}
                    className="flex-1 py-2 rounded-xl bg-[#d32029] text-white text-[12px] font-bold disabled:opacity-40"
                  >
                    รีเซ็ตรหัสผ่าน
                  </button>
                  <button
                    disabled={busy === `req-${r.id}`}
                    onClick={() => handleReset(r, "dismiss")}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-[12px] font-bold disabled:opacity-40"
                  >
                    ปิดคำขอ
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-amber-800 mt-2">
            ติดต่อกลับที่เบอร์ในคำขอเพื่อยืนยันตัวตนก่อนกดรีเซ็ต
          </p>
        </div>
      )}

      <div className="mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
        <p className="text-[13px] font-bold text-slate-900 mb-2">สร้างบัญชีให้ร้าน</p>
        <select
          value={newDealer}
          onChange={(e) => {
            setNewDealer(e.target.value);
            setNewUsername(e.target.value);
          }}
          className="w-full bg-[#faf8f8] text-[13px] rounded-xl px-3 py-2.5 border border-slate-200"
        >
          <option value="">เลือกร้าน</option>
          {dealers.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
        <label htmlFor="new-username" className="sr-only">ชื่อผู้ใช้</label>
        <input
          id="new-username"
          type="text"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
          placeholder="ชื่อผู้ใช้: รหัสร้าน + ชื่อย่อ 4 ตัว (เช่น 5100895smrt)"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full mt-2 bg-[#faf8f8] text-[13px] rounded-xl px-3 py-2.5 border border-slate-200"
        />
        <button
          onClick={createAccount}
          disabled={!newDealer || !newUsername || creating}
          className="w-full mt-2.5 py-2.5 rounded-xl bg-[#d32029] text-white text-[13px] font-bold disabled:opacity-40"
        >
          {creating ? "กำลังสร้าง..." : "สร้างบัญชีและสุ่มรหัสผ่าน"}
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setLoading(true);
              setTab(t.key);
            }}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] font-bold border transition",
              tab === t.key
                ? "bg-[#d32029] text-white border-[#d32029]"
                : "bg-white text-slate-600 border-slate-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <p
          className={cn(
            "mb-3 text-[12px] rounded-lg px-3 py-2 border",
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-[#a11119] border-red-200"
          )}
        >
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setRoleFilter(f.key)}
            aria-pressed={roleFilter === f.key}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border transition",
              roleFilter === f.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label htmlFor="user-search" className="sr-only">ค้นหาผู้ใช้</label>
      <input
        id="user-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหา ชื่อผู้ใช้ / ชื่อร้าน / รหัสร้าน / ชื่อคน"
        className="w-full mb-3 bg-white text-[13px] rounded-xl px-3 py-2.5 border border-slate-200"
      />

      {authErr ? (
        <p className="text-[13px] text-[#a11119] bg-red-50 border border-red-200 rounded-xl p-4">{authErr}</p>
      ) : loading ? (
        <p className="text-center text-slate-400 text-sm py-10">กำลังโหลด...</p>
      ) : shown.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-10">ไม่มีรายการ</p>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-400 px-1">{shown.length} บัญชี</p>
          {shown.map((u) => {
            const storeName = u.dealer_name ?? u.requested_dealer_name;
            const storeCode = u.dealer_code ?? u.requested_dealer_code;
            const badge = u.role ? ROLE_BADGE[u.role] : undefined;
            const isStaff = u.role === "area" || u.role === "coach" || u.role === "re" || u.role === "area_head";
            return (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-bold text-slate-900">
                    {isStaff ? u.full_name || u.username : storeName ?? (u.full_name || u.username)}
                  </p>
                  {badge && (
                    <span className={cn("shrink-0 px-2 py-0.5 rounded-md border text-[10.5px] font-bold", badge.cls)}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {isStaff
                    ? `รหัสพนักงาน ${u.rep_code ?? "-"}`
                    : storeName
                      ? `รหัสร้าน ${storeCode}${u.full_name && u.full_name !== storeName ? ` · ${u.full_name}` : ""}`
                      : "ไม่ได้ระบุร้าน"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ชื่อผู้ใช้: <span className="font-mono text-slate-600">{u.username}</span>
                  {u.phone ? ` · ${u.phone}` : ""}
                </p>
                {u.status === "pending" && u.existing_dealer_user && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2">
                    ร้านนี้มีบัญชีอยู่แล้ว ({u.existing_dealer_user}) — ต้องระงับบัญชีเดิมก่อนจึงอนุมัติได้
                  </p>
                )}
                {u.status === "rejected" && u.reject_reason && (
                  <p className="text-[11px] text-slate-500 mt-1">เหตุผล: {u.reject_reason}</p>
                )}
                <div className="flex gap-2 mt-2.5">
                  {u.status !== "approved" && u.requested_dealer_code && (
                    <button
                      disabled={busy === u.id || !!u.existing_dealer_user}
                      onClick={() => act(u, "approve")}
                      className="flex-1 py-2 rounded-xl bg-[#d32029] text-white text-[12px] font-bold disabled:opacity-40"
                    >
                      อนุมัติ
                    </button>
                  )}
                  {u.status === "pending" && (
                    <button
                      disabled={busy === u.id}
                      onClick={() => act(u, "reject")}
                      className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-[12px] font-bold disabled:opacity-40"
                    >
                      ปฏิเสธ
                    </button>
                  )}
                  {u.status === "approved" && (
                    <button
                      disabled={busy === u.id}
                      onClick={() => {
                        if (window.confirm(`รีเซ็ตรหัสผ่านของ ${u.username}? รหัสเดิมจะใช้ไม่ได้ทันที`)) {
                          act(u, "reset");
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[12px] font-bold disabled:opacity-40"
                    >
                      รีเซ็ตรหัสผ่าน
                    </button>
                  )}
                  {u.status === "approved" && (
                    <button
                      disabled={busy === u.id}
                      onClick={() => act(u, "revoke")}
                      className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-[12px] font-bold disabled:opacity-40"
                    >
                      ระงับบัญชี
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
