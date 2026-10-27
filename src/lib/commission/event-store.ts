"use client";

/* =============================================================
   Event check-in — client data layer

   แนวทาง B (server-authoritative): source of truth อยู่ที่ Supabase
   - ฝั่งสมาชิก: fetchVisibleEvents / performEventCheckin
   - ฝั่ง admin: fetchAdminEvents / createEvent / closeEvent
   เป็น cache + pub/sub ของผลลัพธ์จาก /api/events
   ============================================================= */

export interface VisibleEvent {
  id: number;
  title: string;
  description: string;
  points: number;
  startsAt: string;
  endsAt: string;
  meetingUrl: string | null;
  inWindow: boolean;
  checkedIn: boolean;
}

export interface AdminEvent {
  id: number;
  title: string;
  description: string;
  code: string;
  points: number;
  startsAt: string;
  endsAt: string;
  meetingUrl: string | null;
  // audience cascade 3 ชั้น (null = ไม่จำกัดชั้นนั้น)
  audienceModels: string[] | null;
  audienceDealers: string[] | null;
  audienceEmployees: string[] | null;
  active: boolean;
  checkinCount: number;
  createdAt: string;
}

export interface EventCheckinResult {
  ok: boolean;
  already: boolean;
  points: number;
  error?: string;
}

export interface NewEventInput {
  title: string;
  description?: string;
  code: string;
  points: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
  meetingUrl?: string;
  // audience cascade 3 ชั้น (เว้นว่าง = ไม่จำกัดชั้นนั้น)
  audienceModels?: string[];
  audienceDealers?: string[];
  audienceEmployees?: string[];
  createdBy?: string;
}

/* ---------------- cache + pub/sub (visible events ต่อ empId) ---------------- */
const visibleCache = new Map<string, VisibleEvent[]>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeEvents(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCachedVisibleEvents(empId: string | null): VisibleEvent[] {
  if (!empId) return [];
  return visibleCache.get(empId) ?? [];
}

/* ---------------- map helpers (snake -> camel) ---------------- */
type RawVisible = {
  id: number;
  title: string;
  description: string;
  points: number | string;
  starts_at: string;
  ends_at: string;
  meeting_url: string | null;
  in_window: boolean;
  checked_in: boolean;
};

function mapVisible(r: RawVisible): VisibleEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    points: Number(r.points),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    meetingUrl: r.meeting_url,
    inWindow: !!r.in_window,
    checkedIn: !!r.checked_in,
  };
}

type RawAdmin = RawVisible & {
  code: string;
  audience_models: string[] | null;
  audience_dealers: string[] | null;
  audience_employees: string[] | null;
  active: boolean;
  checkin_count: number;
  created_at: string;
};

function mapAdmin(r: RawAdmin): AdminEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    code: r.code,
    points: Number(r.points),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    meetingUrl: r.meeting_url,
    audienceModels: r.audience_models,
    audienceDealers: r.audience_dealers,
    audienceEmployees: r.audience_employees,
    active: r.active,
    checkinCount: Number(r.checkin_count ?? 0),
    createdAt: r.created_at,
  };
}

/* ---------------- member API ---------------- */

/** โหลดกิจกรรมที่เห็นได้ตอนนี้ แล้วอัปเดต cache */
export async function fetchVisibleEvents(empId: string): Promise<VisibleEvent[]> {
  const res = await fetch(`/api/events?empId=${encodeURIComponent(empId)}`, {
    method: "GET",
    cache: "no-store",
  });
  const raw = (await res.json()) as { ok?: boolean; events?: RawVisible[] };
  const events = raw.ok && Array.isArray(raw.events) ? raw.events.map(mapVisible) : [];
  if (raw.ok) {
    visibleCache.set(empId, events);
    emit();
  }
  return events;
}

/** เช็คอินกิจกรรม — server ตัดสินทั้งหมด */
export async function performEventCheckin(
  empId: string,
  eventId: number,
  code: string
): Promise<EventCheckinResult> {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empId, eventId, code }),
  });
  const raw = (await res.json()) as {
    ok?: boolean;
    already?: boolean;
    points?: number | string;
    error?: string;
  };
  const result: EventCheckinResult = {
    ok: !!raw.ok,
    already: !!raw.already,
    points: Number(raw.points ?? 0),
    error: raw.error,
  };
  // สำเร็จ -> refresh visible (ให้ checkedIn อัปเดต)
  if (result.ok) {
    await fetchVisibleEvents(empId).catch(() => {});
  }
  return result;
}

/* ---------------- admin API ---------------- */

export async function fetchAdminEvents(): Promise<AdminEvent[]> {
  const res = await fetch("/api/events/admin", { method: "GET", cache: "no-store" });
  const raw = (await res.json()) as { ok?: boolean; events?: RawAdmin[] };
  return raw.ok && Array.isArray(raw.events) ? raw.events.map(mapAdmin) : [];
}

export async function createEvent(
  input: NewEventInput
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/events/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const raw = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: !!raw.ok, error: raw.error };
}

export async function closeEvent(id: number): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/events/admin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, active: false }),
  });
  const raw = (await res.json()) as { ok?: boolean; error?: string };
  return { ok: !!raw.ok, error: raw.error };
}
