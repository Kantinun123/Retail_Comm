"use client";

/* คำขอเพิ่มพนักงานใหม่ (Coach / Area / หัวหน้า Area แจ้ง -> Admin อนุมัติ) */
import { fileToResizedBlob } from "./image";
import type { EmployeeRequestPayload } from "./employee-request-shared";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface DupMatch {
  repCode: string;
  name: string;
  dealerCode: string | null;
  dealerName: string | null;
  isActive: boolean;
  reason: ("name" | "phone" | "email")[];
}

export interface EmployeeRequest {
  id: number;
  status: RequestStatus;
  dealerCode: string;
  dealerName: string | null;
  payload: EmployeeRequestPayload;
  photoUrl: string | null;
  requesterName: string | null;
  requesterRole: string | null;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  createdRepCode: string | null;
  duplicates: DupMatch[];
}

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string; status?: number };

async function call<T>(url: string, init?: RequestInit): Promise<Res<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return { ok: false, error: j?.error ?? "ทำรายการไม่สำเร็จ", status: res.status };
    return j as { ok: true } & T;
  } catch {
    return { ok: false, error: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const fetchEmployeeRequests = (status?: RequestStatus) =>
  call<{ requests: EmployeeRequest[] }>(`/api/employee-requests${status ? `?status=${status}` : ""}`);

export const checkDuplicates = (p: { name: string; phone: string; email: string }) =>
  call<{ matches: DupMatch[] }>(
    `/api/employee-requests?mode=dupes&name=${encodeURIComponent(p.name)}&phone=${encodeURIComponent(p.phone)}&email=${encodeURIComponent(p.email)}`
  );

export const createEmployeeRequest = (dealerCode: string, payload: EmployeeRequestPayload, photoUrl: string | null) =>
  call<{ id: number }>("/api/employee-requests", { method: "POST", ...json({ dealerCode, payload, photoUrl }) });

export const updateEmployeeRequest = (id: number, dealerCode: string, payload: EmployeeRequestPayload, photoUrl: string | null) =>
  call("/api/employee-requests", { method: "PATCH", ...json({ id, action: "update", dealerCode, payload, photoUrl }) });

export const cancelEmployeeRequest = (id: number) =>
  call("/api/employee-requests", { method: "PATCH", ...json({ id, action: "cancel" }) });

export const approveEmployeeRequest = (
  id: number,
  dealerCode: string,
  payload: EmployeeRequestPayload,
  systemIds: { netsuiteId: string; baAppId: string; diId: string },
  photoUrl: string | null
) => call<{ repCode: string }>("/api/admin/employee-requests", { method: "POST", ...json({ id, action: "approve", dealerCode, payload, systemIds, photoUrl }) });

export const rejectEmployeeRequest = (id: number, reason: string) =>
  call("/api/admin/employee-requests", { method: "POST", ...json({ id, action: "reject", reason }) });

export async function uploadRequestPhoto(file: File): Promise<Res<{ url: string }>> {
  let blob: Blob;
  try {
    blob = await fileToResizedBlob(file, 800);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ประมวลผลรูปไม่สำเร็จ" };
  }
  const fd = new FormData();
  fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
  return call<{ url: string }>("/api/employee-requests/photo", { method: "POST", body: fd });
}

export const STATUS_META: Record<RequestStatus, { label: string; cls: string; icon: string }> = {
  pending: { label: "รออนุมัติ", cls: "bg-amber-50 text-amber-800 border-amber-200", icon: "hourglass_top" },
  approved: { label: "อนุมัติแล้ว", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "check_circle" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-red-50 text-[#a11119] border-red-200", icon: "cancel" },
  cancelled: { label: "ยกเลิกแล้ว", cls: "bg-slate-100 text-slate-500 border-slate-200", icon: "block" },
};

export function thaiDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function thaiDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
