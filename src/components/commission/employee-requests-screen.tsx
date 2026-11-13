"use client";

/* =============================================================
   คำขอเพิ่มพนักงานใหม่ — /app/employee-requests
   - Coach / Area / หัวหน้า Area: ส่งคำขอ + ติดตามสถานะ (คำขอของคนอื่นในร้านที่ดูแล = ดูอย่างเดียว)
     ?new=1&store=<code> เปิดแบบฟอร์มพร้อมเลือกร้านไว้
   - Admin: ตรวจ / แก้ / ใส่รหัสระบบขาย / อนุมัติ (สร้าง SR####) หรือไม่อนุมัติพร้อมเหตุผล
   ============================================================= */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { EmployeeRequestForm, type StoreOpt } from "./employee-request-form";
import { useHomeHref, useSession } from "@/lib/commission/session";
import { refreshAdminPending } from "@/lib/commission/admin-pending";
import { fetchMyProfile } from "@/lib/commission/my-profile-store";
import { fetchStores, LEVEL_META } from "@/lib/commission/employee-store";
import { REQUEST_POSITIONS, type EmployeeRequestPayload } from "@/lib/commission/employee-request-shared";
import {
  STATUS_META,
  approveEmployeeRequest,
  cancelEmployeeRequest,
  fetchEmployeeRequests,
  rejectEmployeeRequest,
  thaiDate,
  thaiDateTime,
  type EmployeeRequest,
  type RequestStatus,
} from "@/lib/commission/employee-request-store";
import { cn } from "@/lib/utils";

type Tab = "pending" | "approved" | "closed";
const TABS: { key: Tab; label: string; match: RequestStatus[] }[] = [
  { key: "pending", label: "รออนุมัติ", match: ["pending"] },
  { key: "approved", label: "อนุมัติแล้ว", match: ["approved"] },
  { key: "closed", label: "ไม่อนุมัติ / ยกเลิก", match: ["rejected", "cancelled"] },
];

type FormState = { initial?: { id?: number; dealerCode?: string | null; payload?: EmployeeRequestPayload | null; photoUrl?: string | null }; adminFor?: number } | null;
type AdminEdit = { dealerCode: string; payload: EmployeeRequestPayload; photoUrl: string | null };

export function EmployeeRequestsScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const homeHref = useHomeHref();
  const isAdmin = !!session?.isAdmin;

  const [requests, setRequests] = useState<EmployeeRequest[] | null>(null);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("pending");
  const [onlyMine, setOnlyMine] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    sp.get("new") === "1" ? { initial: { dealerCode: sp.get("store") } } : null
  );
  const [edits, setEdits] = useState<Record<number, AdminEdit>>({});
  const [ids, setIds] = useState<Record<number, { netsuiteId: string; baAppId: string; diId: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // รายการคำขอ
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchEmployeeRequests().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setRequests(r.requests);
        setError(null);
      } else {
        setRequests([]);
        setError(r.status === 401 ? "ต้องเข้าสู่ระบบด้วยบัญชีจริงจึงจะใช้งานได้" : r.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, reload]);

  // ร้านที่เลือกได้ในแบบฟอร์ม: ผู้แจ้ง = ร้านที่ดูแล (จากผังทีม) ; admin = ทุกร้านที่เปิดใช้งาน
  useEffect(() => {
    if (!ready || !session) return;
    let cancelled = false;
    if (session.isAdmin) {
      fetchStores().then((list) => {
        if (!cancelled) setStores(list.filter((s) => s.isActive).map((s) => ({ code: s.code, name: s.name, model: s.model, region: s.region })));
      });
    } else {
      fetchMyProfile().then((r) => {
        if (cancelled || !r.ok) return;
        const { stores: ss, people } = r.data;
        const areaOf = (s: (typeof ss)[number]) => {
          const a = s.areaReps[0] ? people.get(s.areaReps[0]) : null;
          return a ? `Area ${a.nickname || a.name.split(" ")[0]}` : null;
        };
        const multiArea = new Set(ss.map((s) => s.areaReps[0] ?? "")).size > 1 && r.data.me.kind !== "area";
        setStores(
          [...ss]
            .sort((a, b) => (multiArea ? (areaOf(a) ?? "").localeCompare(areaOf(b) ?? "", "th") : 0) || a.name.localeCompare(b.name, "th"))
            .map((s) => ({ code: s.code, name: s.name, model: s.model, region: s.region, group: multiArea ? areaOf(s) : null }))
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { pending: 0, approved: 0, closed: 0 };
    (requests ?? []).forEach((r) => {
      const t = TABS.find((x) => x.match.includes(r.status));
      if (t) c[t.key]++;
    });
    return c;
  }, [requests]);

  if (!ready || !session) return null;
  if (!isAdmin && !session.isArea) {
    return <p className="mt-10 text-center text-sm text-slate-500">หน้านี้สำหรับ Coach / Area / Admin</p>;
  }

  const hasOthers = (requests ?? []).some((r) => !r.mine);
  const shown = (requests ?? []).filter((r) => TABS.find((t) => t.key === tab)!.match.includes(r.status) && (!onlyMine || r.mine));
  const done = (text: string) => {
    setMsg({ type: "ok", text });
    setReload((n) => n + 1);
    if (isAdmin) refreshAdminPending();
  };

  async function onCancel(r: EmployeeRequest) {
    if (!window.confirm(`ยกเลิกคำขอของ ${r.payload.name}?`)) return;
    setBusy(r.id);
    const res = await cancelEmployeeRequest(r.id);
    setBusy(null);
    if (res.ok) done("ยกเลิกคำขอแล้ว");
    else setMsg({ type: "err", text: res.error });
  }

  async function onApprove(r: EmployeeRequest) {
    const e = edits[r.id] ?? { dealerCode: r.dealerCode, payload: r.payload, photoUrl: r.photoUrl };
    const dup = r.duplicates.length ? `\n\n⚠️ อาจซ้ำกับ ${r.duplicates.map((d) => d.repCode).join(", ")}` : "";
    if (!window.confirm(`อนุมัติและสร้างพนักงาน "${e.payload.name}"?${dup}`)) return;
    setBusy(r.id);
    const res = await approveEmployeeRequest(r.id, e.dealerCode, e.payload, ids[r.id] ?? { netsuiteId: "", baAppId: "", diId: "" }, e.photoUrl);
    setBusy(null);
    if (res.ok) done(`อนุมัติแล้ว · สร้าง ${res.repCode}`);
    else setMsg({ type: "err", text: res.error });
  }

  async function onReject(r: EmployeeRequest) {
    const reason = window.prompt("เหตุผลที่ไม่อนุมัติ (ผู้แจ้งจะเห็นข้อความนี้)", "");
    if (reason === null) return;
    if (!reason.trim()) return setMsg({ type: "err", text: "กรุณาใส่เหตุผล" });
    setBusy(r.id);
    const res = await rejectEmployeeRequest(r.id, reason.trim());
    setBusy(null);
    if (res.ok) done("บันทึกไม่อนุมัติแล้ว");
    else setMsg({ type: "err", text: res.error });
  }

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link href={homeHref} aria-label="กลับ" className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] text-[#231313] leading-tight">{isAdmin ? "คำขอเพิ่มพนักงาน" : "แจ้งเพิ่มพนักงานใหม่"}</span>
            <span className="text-[11px] font-semibold text-[#b21e1e]">{isAdmin ? "ตรวจ / แก้ / อนุมัติ" : "คำขอของฉัน + ร้านที่ดูแล"}</span>
          </div>
        </div>
      </header>

      <div className="space-y-3 pb-24">
        {!isAdmin && (
          <button
            type="button"
            onClick={() => setForm({ initial: {} })}
            className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-bold text-[14px] flex items-center justify-center gap-1.5 shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <Icon name="person_add" />
            แจ้งพนักงานใหม่
          </button>
        )}

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition",
                tab === t.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              {t.label} {counts[t.key] > 0 && <span className="tnum">{counts[t.key]}</span>}
            </button>
          ))}
        </div>
        {!isAdmin && hasOthers && (
          <label className="flex items-center gap-2 text-[12px] text-slate-600 px-1">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-emerald-600" />
            แสดงเฉพาะคำขอที่ฉันแจ้ง
          </label>
        )}

        {msg && (
          <p className={cn("text-[12px] rounded-lg px-3 py-2 border", msg.type === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-[#a11119] border-red-200")} role="status">
            {msg.text}
          </p>
        )}

        {error ? (
          <p className="text-[13px] text-[#a11119] bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>
        ) : requests === null ? (
          <div className="py-12 text-center">
            <Icon name="progress_activity" className="animate-spin text-3xl text-slate-300" />
          </div>
        ) : shown.length === 0 ? (
          <p className="text-center text-[12.5px] text-slate-400 py-10">ไม่มีคำขอในหมวดนี้</p>
        ) : (
          shown.map((r) => {
            const e = edits[r.id];
            const p = e?.payload ?? r.payload;
            const store = e ? stores.find((s) => s.code === e.dealerCode)?.name ?? e.dealerCode : r.dealerName ?? r.dealerCode;
            const st = STATUS_META[r.status];
            const pos = REQUEST_POSITIONS.find((x) => x.key === p.position)?.label ?? "-";
            const lv = p.level ? LEVEL_META[p.level] : null;
            return (
              <article key={r.id} className={cn("bg-white rounded-2xl border shadow-sm p-3.5", r.status === "pending" ? "border-amber-200" : "border-slate-100")}>
                <div className="flex items-start gap-3">
                  {(e?.photoUrl ?? r.photoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(e?.photoUrl ?? r.photoUrl)!} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold text-[13px] flex items-center justify-center shrink-0" aria-hidden>
                      {(p.nickname || p.name).replace(/\s+/g, "").slice(0, 2)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-slate-900">{p.name}{p.nickname ? ` (${p.nickname})` : ""}</p>
                    <p className="text-[11.5px] text-slate-500">{pos}{lv ? ` · ระดับ ${p.level}` : ""} · {store}</p>
                  </div>
                  <span className={cn("shrink-0 inline-flex items-center gap-1 text-[10.5px] font-bold border rounded-full px-2 py-0.5", st.cls)}>
                    <Icon name={st.icon} style={{ fontSize: 13 }} />
                    {r.status === "approved" && r.createdRepCode ? r.createdRepCode : st.label}
                  </span>
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
                  <Info k="เบอร์" v={p.phone} />
                  <Info k="อีเมล" v={p.email} />
                  <Info k="วันเข้างาน" v={thaiDate(p.startDate)} />
                  <Info k="Line" v={p.lineId} />
                  {p.education && <Info k="วุฒิ" v={p.major ? `${p.education} · ${p.major}` : p.education} wide />}
                  {p.notes && <Info k="หมายเหตุ" v={p.notes} wide />}
                </dl>
                <p className="text-[10.5px] text-slate-400 mt-2">
                  แจ้งโดย {r.mine ? "ฉัน" : `${r.requesterRole ?? ""} ${r.requesterName ?? ""}`.trim()} · {thaiDateTime(r.createdAt)}
                  {r.reviewedAt ? ` · ตรวจเมื่อ ${thaiDateTime(r.reviewedAt)}` : ""}
                </p>

                {r.status === "pending" && r.duplicates.length > 0 && (
                  <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                    <p className="text-[11.5px] font-bold text-amber-900 flex items-center gap-1">
                      <Icon name="warning" style={{ fontSize: 14 }} />
                      อาจซ้ำกับพนักงานที่มีอยู่
                    </p>
                    {r.duplicates.map((d) => (
                      <p key={d.repCode} className="text-[11px] text-amber-800">
                        {d.repCode} {d.name} · {d.dealerName ?? "ไม่ระบุร้าน"} · {d.isActive ? "ทำงานอยู่" : "พักงาน"}
                      </p>
                    ))}
                  </div>
                )}
                {r.status === "rejected" && r.rejectReason && (
                  <p className="mt-2 text-[11.5px] text-[#a11119] bg-red-50 rounded-lg px-3 py-2">เหตุผล: {r.rejectReason}</p>
                )}
                {r.status === "approved" && r.createdRepCode && (
                  <Link href={`/app/store/${r.dealerCode}`} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-700">
                    ดูในทีมงานร้าน <Icon name="chevron_right" style={{ fontSize: 15 }} />
                  </Link>
                )}

                {/* ผู้แจ้ง: แก้ / ยกเลิก / ส่งใหม่ */}
                {!isAdmin && r.mine && r.status === "pending" && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button type="button" onClick={() => setForm({ initial: { id: r.id, dealerCode: r.dealerCode, payload: r.payload, photoUrl: r.photoUrl } })} className="py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-700">
                      แก้ไขคำขอ
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => onCancel(r)} className="py-2 rounded-xl border border-red-200 text-[12px] font-bold text-[#a11119] disabled:opacity-40">
                      ยกเลิกคำขอ
                    </button>
                  </div>
                )}
                {!isAdmin && r.mine && r.status === "rejected" && (
                  <button type="button" onClick={() => setForm({ initial: { dealerCode: r.dealerCode, payload: r.payload, photoUrl: r.photoUrl } })} className="mt-3 w-full py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] font-bold text-emerald-700">
                    แก้แล้วส่งใหม่
                  </button>
                )}

                {/* Admin: รหัสระบบขาย + แก้ / อนุมัติ / ไม่อนุมัติ */}
                {isAdmin && r.status === "pending" && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-600">รหัสระบบขาย (ไม่บังคับ — ใช้ผูกยอดขาย/ค่าคอมฯ)</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ["netsuiteId", "NetSuite"],
                          ["baAppId", "BA App"],
                          ["diId", "DI"],
                        ] as const
                      ).map(([k, label]) => (
                        <input
                          key={k}
                          aria-label={label}
                          placeholder={label}
                          value={ids[r.id]?.[k] ?? ""}
                          onChange={(ev) => setIds((x) => ({ ...x, [r.id]: { ...(x[r.id] ?? { netsuiteId: "", baAppId: "", diId: "" }), [k]: ev.target.value } }))}
                          className="w-full bg-[#faf8f8] text-[12px] rounded-lg px-2.5 py-2 border border-slate-200"
                        />
                      ))}
                    </div>
                    <button type="button" onClick={() => setForm({ adminFor: r.id, initial: { dealerCode: e?.dealerCode ?? r.dealerCode, payload: p, photoUrl: e?.photoUrl ?? r.photoUrl } })} className="w-full py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-700 flex items-center justify-center gap-1">
                      <Icon name="edit" style={{ fontSize: 15 }} />
                      {e ? "แก้ข้อมูลแล้ว · แก้อีกครั้ง" : "แก้ข้อมูลก่อนอนุมัติ"}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" disabled={busy === r.id} onClick={() => onApprove(r)} className="py-2.5 rounded-xl bg-[#d32029] text-white text-[13px] font-bold disabled:opacity-40">
                        {busy === r.id ? "กำลังบันทึก..." : "อนุมัติ"}
                      </button>
                      <button type="button" disabled={busy === r.id} onClick={() => onReject(r)} className="py-2.5 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-bold disabled:opacity-40">
                        ไม่อนุมัติ
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {form && (
        <EmployeeRequestForm
          mode={form.adminFor ? "admin" : "submit"}
          stores={stores}
          initial={form.initial}
          onClose={() => {
            setForm(null);
            if (sp.get("new")) router.replace("/app/employee-requests");
          }}
          onDone={(res) => {
            if (form.adminFor) {
              setEdits((x) => ({ ...x, [form.adminFor!]: res }));
              setForm(null);
              return;
            }
            setForm(null);
            setTab("pending");
            if (sp.get("new")) router.replace("/app/employee-requests");
            done(form.initial?.id ? "บันทึกการแก้ไขแล้ว" : "ส่งคำขอแล้ว รอ Admin อนุมัติ");
          }}
        />
      )}

      <BottomNav active="member" />
    </>
  );
}

function Info({ k, v, wide }: { k: string; v: string | null | undefined; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="inline text-slate-400">{k} </dt>
      <dd className="inline text-slate-800 break-all">{v || "-"}</dd>
    </div>
  );
}
