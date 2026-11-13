"use client";

/* =============================================================
   หน้า "ฉัน" ของ Admin / หัวหน้า Area / Area / Coach
   - การ์ดของฉัน (รูป ชื่อ ตำแหน่ง เบอร์ อีเมล Line) + แก้ไขข้อมูลของตัวเอง
   - Admin: ทีมผู้ดูแลระบบ
   - กลุ่ม Area: ผังทีมแบบกดขยาย  หัวหน้า Area -> Area -> Coach -> ร้าน -> พนักงาน
     (แต่ละบทบาทเห็นเฉพาะทีมของตัวเอง — API กรองให้)
   สี: หัวหน้า Area = ม่วง · Area = แดง · Coach = เขียว · SE = น้ำเงิน · Admin = เทาเข้ม
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { InstallAppHint } from "./install-app-hint";
import { PushToggle } from "./push-toggle";
import { doLogout, setAreaStore, useHomeHref, useSession } from "@/lib/commission/session";
import { LEVEL_META, POSITION_LABEL, isNewEmployee, tenureFromStartDate } from "@/lib/commission/employee-store";
import {
  countStaff,
  fetchMyProfile,
  groupBy,
  lineHref,
  saveMyProfile,
  sortStores,
  uploadMyPhoto,
  type Contact,
  type Me,
  type MeKind,
  type MyProfileData,
  type OrgStore,
  type Person,
} from "@/lib/commission/my-profile-store";
import { fetchEmployeeRequests, type EmployeeRequest } from "@/lib/commission/employee-request-store";
import { cn } from "@/lib/utils";

const KIND: Record<MeKind, { label: string; hero: string; sub: string; node: string; nodeSub: string; avatar: string }> = {
  admin: { label: "ผู้ดูแลระบบ", hero: "from-slate-700 to-slate-900", sub: "text-slate-300", node: "bg-slate-700", nodeSub: "text-slate-300", avatar: "bg-slate-200 text-slate-700" },
  area_head: { label: "หัวหน้า Area", hero: "from-indigo-600 to-indigo-950", sub: "text-indigo-200", node: "bg-indigo-600", nodeSub: "text-indigo-200", avatar: "bg-indigo-100 text-indigo-700" },
  area: { label: "Area Manager", hero: "from-[#d32029] to-[#7a0f12]", sub: "text-red-100", node: "bg-[#d32029]", nodeSub: "text-red-100", avatar: "bg-red-100 text-[#a11119]" },
  coach: { label: "RE / Coach", hero: "from-emerald-600 to-emerald-950", sub: "text-emerald-100", node: "bg-emerald-600", nodeSub: "text-emerald-100", avatar: "bg-emerald-100 text-emerald-700" },
  re: { label: "RE / Coach", hero: "from-emerald-600 to-emerald-950", sub: "text-emerald-100", node: "bg-emerald-600", nodeSub: "text-emerald-100", avatar: "bg-emerald-100 text-emerald-700" },
};

const PAGE = 4; // ร้านที่แสดงก่อนกด "ดูเพิ่ม"

type SheetPerson = { c: Contact; sub: string; tone: string; tenure?: string | null };

export function MyProfileScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const homeHref = useHomeHref();
  const [data, setData] = useState<MyProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<SheetPerson | null>(null);
  const [pending, setPending] = useState<Map<string, EmployeeRequest[]>>(() => new Map());

  // คำขอเพิ่มพนักงานที่รออนุมัติ (กลุ่ม Area) -> แสดงเป็นเส้นประในร้าน
  useEffect(() => {
    if (!ready || !session?.isArea) return;
    let cancelled = false;
    fetchEmployeeRequests("pending").then((r) => {
      if (cancelled || !r.ok) return;
      const m = new Map<string, EmployeeRequest[]>();
      r.requests.forEach((x) => m.set(x.dealerCode, [...(m.get(x.dealerCode) ?? []), x]));
      setPending(m);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, session?.isArea]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchMyProfile().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else {
        setError(r.status === 401 ? "ต้องเข้าสู่ระบบด้วยบัญชีจริงจึงจะเห็นข้อมูลของตัวเอง" : r.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, reload]);

  if (!ready || !session) return null;

  return (
    <>
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href={homeHref}
            aria-label="กลับ"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">ฉัน</span>
        </div>
        <button
          onClick={() => {
            doLogout();
            router.replace("/");
          }}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a11119] bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition"
        >
          <Icon name="logout" style={{ fontSize: 16 }} />
          ออกจากระบบ
        </button>
      </header>

      <div className="space-y-4 pb-24">
        {error ? (
          <p className="text-[13px] text-[#a11119] bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>
        ) : !data ? (
          <div className="py-16 text-center">
            <Icon name="progress_activity" className="animate-spin text-3xl text-slate-300" />
          </div>
        ) : (
          <>
            <MeCard me={data.me} onEdit={() => setEditing(true)} />

            <section aria-labelledby="acct-title">
              <h2 id="acct-title" className="text-[13px] font-bold text-[#231313] px-1 mb-2">บัญชีของฉัน</h2>
              <Link
                href="/app/change-password"
                className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 hover:-translate-y-0.5 transition-all"
              >
                <Icon name="key" className="text-slate-500" />
                <span className="flex-1 text-[13px] font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</span>
                <Icon name="chevron_right" className="text-slate-300" />
              </Link>
              <PushToggle />
              <InstallAppHint />
            </section>

            {data.me.kind === "admin" ? (
              <AdminTeam admins={data.admins} onOpen={(c) => setSheet({ c, sub: c.title ?? "ผู้ดูแลระบบ", tone: KIND.admin.avatar })} />
            ) : (
              <OrgView data={data} isArea={session.isArea} pending={pending} onOpen={setSheet} onOpenStore={(code) => { setAreaStore(code); router.push("/app/home"); }} />
            )}
          </>
        )}
      </div>

      {editing && data && (
        <EditSheet
          me={data.me}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setReload((n) => n + 1);
          }}
        />
      )}
      {sheet && <ContactSheet p={sheet} onClose={() => setSheet(null)} />}

      <BottomNav active="member" />
    </>
  );
}

/* ---------------- การ์ดของฉัน ---------------- */

function MeCard({ me, onEdit }: { me: Me; onEdit: () => void }) {
  const k = KIND[me.kind] ?? KIND.area;
  return (
    <section className={cn("rounded-3xl bg-gradient-to-br text-white p-4 shadow-lg", k.hero)} aria-label="ข้อมูลของฉัน">
      <div className="flex items-start gap-3">
        <Avatar c={me} size={68} tone="bg-white/20 text-white ring-2 ring-white/70" />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold leading-tight">{me.name}{me.nickname ? ` (${me.nickname})` : ""}</p>
          {me.title && <p className={cn("text-[11.5px] mt-0.5", k.sub)}>{me.title}</p>}
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10.5px] font-bold bg-white/15 rounded-full px-2.5 py-0.5">
            <Icon name="badge" style={{ fontSize: 13 }} />
            {k.label}
            {me.repCode ? ` · ${me.repCode}` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white text-slate-800 text-[11.5px] font-bold px-3 py-1.5 hover:-translate-y-0.5 transition-all"
        >
          <Icon name="edit" style={{ fontSize: 14 }} />
          แก้ไขข้อมูล
        </button>
      </div>
      <div className="mt-3.5 space-y-1.5">
        <ContactRow icon="call" value={me.phone} href={me.phone ? `tel:${me.phone.replace(/[^0-9+]/g, "")}` : null} action="โทร" onEmpty={onEdit} />
        {me.phone2 && <ContactRow icon="call" value={me.phone2} href={`tel:${me.phone2.replace(/[^0-9+]/g, "")}`} action="โทร" />}
        <ContactRow icon="mail" value={me.email} href={me.email ? `mailto:${me.email}` : null} action="อีเมล" />
        <ContactRow icon="chat" label="Line" value={me.lineId} href={me.lineId ? lineHref(me.lineId) : null} action="เปิด" onEmpty={onEdit} />
      </div>
    </section>
  );
}

function ContactRow({ icon, label, value, href, action, onEmpty }: { icon: string; label?: string; value: string | null | undefined; href: string | null; action: string; onEmpty?: () => void }) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={onEmpty}
        disabled={!onEmpty}
        className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-amber-200/60 bg-amber-200/10 px-3 py-2 text-left text-[12.5px] text-amber-100"
      >
        <Icon name={icon} style={{ fontSize: 16 }} />
        <span className="flex-1">{label ? `${label}: ` : ""}ยังไม่ได้ใส่</span>
        {onEmpty && <span className="text-[11px] font-bold">+ เพิ่ม</span>}
      </button>
    );
  }
  return (
    <a
      href={href ?? undefined}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-[12.5px] hover:bg-white/15 transition"
    >
      <Icon name={icon} style={{ fontSize: 16 }} />
      <span className="flex-1 truncate">{label ? `${label}: ` : ""}{value}</span>
      <span className="text-[11px] opacity-80">{action}</span>
    </a>
  );
}

/* ---------------- Admin: ทีมผู้ดูแลระบบ ---------------- */

function AdminTeam({ admins, onOpen }: { admins: Contact[]; onOpen: (c: Contact) => void }) {
  return (
    <section aria-labelledby="admins-title">
      <div className="flex items-baseline justify-between px-1 mb-2">
        <h2 id="admins-title" className="text-[13px] font-bold text-[#231313]">ทีมผู้ดูแลระบบ ({admins.length})</h2>
        <span className="text-[10.5px] text-slate-500">แตะเพื่อติดต่อ</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        {admins.map((a) => (
          <PersonRow key={a.id ?? a.email} c={a} sub={a.title ?? "ผู้ดูแลระบบ"} tone={KIND.admin.avatar} onOpen={() => onOpen(a)} />
        ))}
        {admins.length === 0 && <p className="text-center text-[12px] text-slate-400 py-6">ไม่มีผู้ดูแลระบบคนอื่น</p>}
      </div>
    </section>
  );
}

/* ---------------- ผังทีม (กลุ่ม Area) ---------------- */

function OrgView({
  data,
  isArea,
  onOpen,
  onOpenStore,
  pending,
}: {
  data: MyProfileData;
  isArea: boolean;
  onOpen: (p: SheetPerson) => void;
  onOpenStore: (code: string) => void;
  pending: Map<string, EmployeeRequest[]>;
}) {
  const { me, heads, stores, people } = data;
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [q, setQ] = useState("");
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const kind = me.kind;
  const areaGroups = useMemo(() => groupBy(stores, "areaReps"), [stores]);
  const coachGroups = useMemo(() => groupBy(stores, "coachReps"), [stores]);
  const totals = countStaff(stores);
  const rep = (code: string | null) => (code ? people.get(code) ?? null : null);

  const personSheet = (p: Person): SheetPerson => {
    const store = stores.find((s) => s.code === p.dealerCode);
    const pos = p.position ? POSITION_LABEL[p.position] : "พนักงาน";
    const lv = p.level ? ` ระดับ ${p.level}` : "";
    return { c: p, sub: `${pos}${lv}${store ? ` · ${store.name}` : ""}`, tone: toneOf(p.position), tenure: tenureFromStartDate(p.startDate) };
  };
  const supSheet = (p: Person, label: string, n: number): SheetPerson => ({ c: p, sub: `${label} · ดูแล ${n} ร้าน`, tone: toneOf(p.position) });

  const stats: { label: string; value: number; cls: string }[] =
    kind === "area_head"
      ? [
          { label: "Area", value: areaGroups.filter((g) => g.repCode).length, cls: "text-[#a11119]" },
          { label: "Coach", value: coachGroups.filter((g) => g.repCode).length, cls: "text-emerald-700" },
          { label: "ร้าน", value: stores.length, cls: "text-slate-800" },
          { label: "SE", value: totals.se, cls: "text-blue-700" },
        ]
      : kind === "area"
        ? [
            { label: "Coach", value: coachGroups.filter((g) => g.repCode).length, cls: "text-emerald-700" },
            { label: "ร้าน", value: stores.length, cls: "text-[#a11119]" },
            { label: "SE", value: totals.se, cls: "text-blue-700" },
            { label: "พนักงาน", value: totals.staff, cls: "text-slate-800" },
          ]
        : [
            ...(areaGroups.filter((g) => g.repCode).length > 1 ? [{ label: "Area", value: areaGroups.filter((g) => g.repCode).length, cls: "text-[#a11119]" }] : []),
            { label: "ร้าน", value: stores.length, cls: "text-[#a11119]" },
            { label: "SE", value: totals.se, cls: "text-blue-700" },
            { label: "พนักงาน", value: totals.staff, cls: "text-slate-800" },
          ];

  const storeList = (key: string, list: OrgStore[]) => (
    <StoreList
      listKey={key}
      stores={list}
      open={open}
      toggle={toggle}
      onPerson={(p) => onOpen(personSheet(p))}
      onOpenStore={isArea ? onOpenStore : undefined}
      pending={pending}
    />
  );

  // ---- ค้นหา ----
  const query = q.trim().toLowerCase();
  const hitPeople = query
    ? [...people.values()].filter((p) => `${p.name} ${p.nickname ?? ""}`.toLowerCase().includes(query)).slice(0, 30)
    : [];
  const hitStores = query ? stores.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(query)).slice(0, 20) : [];

  return (
    <>
      <section className={cn("grid gap-2", stats.length === 4 ? "grid-cols-4" : "grid-cols-3")} aria-label="สรุปทีม">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm py-2.5 text-center">
            <p className={cn("tnum text-[18px] font-bold leading-none", s.cls)}>{s.value}</p>
            <p className="text-[10.5px] text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </section>

      <div className="relative">
        <label htmlFor="org-search" className="sr-only">ค้นหาในทีม</label>
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
        <input
          id="org-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === "area_head" ? "ค้นหา Area / Coach / ร้าน / พนักงาน" : "ค้นหาชื่อพนักงาน / ชื่อเล่น / ร้าน"}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] focus:outline-none focus:border-[#d32029]"
        />
      </div>

      {query ? (
        <section className="space-y-2" aria-label="ผลการค้นหา">
          {hitPeople.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
              {hitPeople.map((p) => (
                <PersonRow key={p.repCode} c={p} sub={personSheet(p).sub} tone={toneOf(p.position)} onOpen={() => onOpen(personSheet(p))} />
              ))}
            </div>
          )}
          {hitStores.length > 0 && storeList("search", hitStores)}
          {hitPeople.length === 0 && hitStores.length === 0 && <p className="text-center text-[12px] text-slate-400 py-6">ไม่พบ &quot;{q}&quot;</p>}
        </section>
      ) : (
        <section aria-labelledby="org-title" className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="org-title" className="text-[13px] font-bold text-[#231313]">ผังทีมของฉัน</h2>
            <span className="text-[10.5px] text-slate-500">แตะเพื่อขยาย</span>
          </div>

          {/* หัวหน้า (เหนือฉัน) */}
          {kind !== "area_head" &&
            heads.map((h) => (
              <ChainNode key={h.id ?? h.email} c={h} sub="หัวหน้า Area" cls="bg-indigo-50 border-indigo-200" tone={KIND.area_head.avatar} onOpen={() => onOpen({ c: h, sub: h.title ?? "หัวหน้า Area", tone: KIND.area_head.avatar })} />
            ))}
          {kind !== "area_head" && heads.length > 0 && <Connector />}

          {/* Coach: Area ของร้านที่ดูแล */}
          {(kind === "coach" || kind === "re") && (
            <>
              <div className={cn("grid gap-2", areaGroups.filter((g) => g.repCode).length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {areaGroups.map((g) => {
                  const a = rep(g.repCode);
                  if (!a) return null;
                  return <ChainNode key={a.repCode} c={a} sub={`Area · ${g.stores.length} ร้าน`} cls="bg-red-50 border-red-100" tone={KIND.area.avatar} onOpen={() => onOpen(supSheet(a, "Area Manager", g.stores.length))} />;
                })}
              </div>
              <Connector />
            </>
          )}

          {/* ฉัน */}
          <div className="flex justify-center">
            <div className={cn("rounded-2xl px-3 py-2 flex items-center gap-2.5 text-white shadow-sm", (KIND[kind] ?? KIND.area).node)}>
              <Avatar c={me} size={30} tone="bg-white/25 text-white" />
              <div>
                <p className="text-[12.5px] font-bold leading-tight">{me.nickname || me.name} (ฉัน)</p>
                <p className={cn("text-[10px]", (KIND[kind] ?? KIND.area).nodeSub)}>{(KIND[kind] ?? KIND.area).label}</p>
              </div>
            </div>
          </div>
          <Connector />

          {/* ใต้ฉัน */}
          {kind === "area_head" &&
            areaGroups.map((g) => {
              const a = rep(g.repCode);
              const key = `a:${g.repCode ?? "none"}`;
              const t = countStaff(g.stores);
              const coaches = groupBy(g.stores, "coachReps");
              return (
                <GroupCard
                  key={key}
                  open={open.has(key)}
                  onToggle={() => toggle(key)}
                  c={a}
                  fallback="ยังไม่ระบุ Area"
                  sub={`Coach ${coaches.filter((x) => x.repCode).length} · ${g.stores.length} ร้าน · SE ${t.se}`}
                  warn={g.stores.some((s) => s.seCount === 0) ? `${g.stores.filter((s) => s.seCount === 0).length} ร้านไม่มี SE` : null}
                  border="border-red-100"
                  tone={KIND.area.avatar}
                  onContact={a ? () => onOpen(supSheet(a, "Area Manager", g.stores.length)) : undefined}
                >
                  {coaches.map((cg) => {
                    const c = rep(cg.repCode);
                    const ck = `${key}|c:${cg.repCode ?? "none"}`;
                    return (
                      <GroupCard
                        key={ck}
                        open={open.has(ck)}
                        onToggle={() => toggle(ck)}
                        c={c}
                        fallback="ยังไม่ระบุ Coach"
                        sub={`${cg.stores.length} ร้าน · SE ${countStaff(cg.stores).se}`}
                        border="border-emerald-100"
                        tone={KIND.coach.avatar}
                        compact
                        onContact={c ? () => onOpen(supSheet(c, "RE / Coach", cg.stores.length)) : undefined}
                      >
                        {storeList(ck, cg.stores)}
                      </GroupCard>
                    );
                  })}
                </GroupCard>
              );
            })}

          {kind === "area" &&
            coachGroups.map((g) => {
              const c = rep(g.repCode);
              const key = `c:${g.repCode ?? "none"}`;
              return (
                <GroupCard
                  key={key}
                  open={open.has(key)}
                  onToggle={() => toggle(key)}
                  c={c}
                  fallback="ยังไม่ระบุ Coach"
                  sub={`${g.stores.length} ร้าน · SE ${countStaff(g.stores).se}`}
                  warn={g.stores.some((s) => s.seCount === 0) ? `${g.stores.filter((s) => s.seCount === 0).length} ร้านไม่มี SE` : null}
                  border="border-emerald-100"
                  tone={KIND.coach.avatar}
                  onContact={c ? () => onOpen(supSheet(c, "RE / Coach", g.stores.length)) : undefined}
                >
                  {storeList(key, g.stores)}
                </GroupCard>
              );
            })}

          {(kind === "coach" || kind === "re") &&
            (areaGroups.length > 1 ? (
              areaGroups.map((g) => {
                const a = rep(g.repCode);
                const key = `ca:${g.repCode ?? "none"}`;
                return (
                  <GroupCard
                    key={key}
                    open={open.has(key)}
                    onToggle={() => toggle(key)}
                    c={a}
                    fallback="ยังไม่ระบุ Area"
                    sub={`ร้านใน Area นี้ ${g.stores.length} ร้าน`}
                    border="border-red-100"
                    tone={KIND.area.avatar}
                    compact
                  >
                    {storeList(key, g.stores)}
                  </GroupCard>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5">
                <p className="text-[11.5px] font-bold text-slate-700 px-1 pb-2">ร้านที่ฉันดูแล ({stores.length})</p>
                {storeList("mine", sortStores(stores))}
              </div>
            ))}

          {stores.length === 0 && <p className="text-center text-[12px] text-slate-400 py-6">ยังไม่มีร้านที่ผูกกับบัญชีนี้</p>}
        </section>
      )}
    </>
  );
}

function Connector() {
  return <div className="mx-auto h-3 w-0.5 bg-slate-300" aria-hidden />;
}

function ChainNode({ c, sub, cls, tone, onOpen }: { c: Contact; sub: string; cls: string; tone: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={cn("w-full flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left hover:-translate-y-0.5 transition-all", cls)}>
      <Avatar c={c} size={32} tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-slate-900 truncate">{c.nickname ? `${c.name} (${c.nickname})` : c.name}</p>
        <p className="text-[10.5px] text-slate-500">{sub}</p>
      </div>
      <Icon name="call" className="text-slate-400" style={{ fontSize: 16 }} />
    </button>
  );
}

function GroupCard({
  c,
  fallback,
  sub,
  warn,
  border,
  tone,
  open,
  onToggle,
  onContact,
  compact,
  children,
}: {
  c: Contact | null;
  fallback: string;
  sub: string;
  warn?: string | null;
  border: string;
  tone: string;
  open: boolean;
  onToggle: () => void;
  onContact?: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border shadow-sm", border, compact && "shadow-none")}>
      <div className="flex items-center gap-2.5 p-2.5">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
          {c ? <Avatar c={c} size={compact ? 30 : 36} tone={tone} /> : <span className={cn("rounded-full flex items-center justify-center bg-slate-100 text-slate-400", compact ? "w-[30px] h-[30px]" : "w-9 h-9")}><Icon name="help" style={{ fontSize: 16 }} /></span>}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-slate-900 truncate">{c ? (c.nickname ? `${c.name} (${c.nickname})` : c.name) : fallback}</span>
            <span className="block text-[10.5px] text-slate-500">{sub}</span>
            {warn && <span className="inline-block mt-0.5 text-[10px] font-semibold rounded-md bg-amber-50 text-amber-800 px-1.5 py-0.5">{warn}</span>}
          </span>
          <Icon name={open ? "expand_less" : "expand_more"} className="text-slate-400 shrink-0" />
        </button>
        {onContact && (
          <button type="button" onClick={onContact} aria-label="ติดต่อ" className="shrink-0 w-8 h-8 rounded-full bg-red-50 text-[#d32029] flex items-center justify-center">
            <Icon name="call" style={{ fontSize: 16 }} />
          </button>
        )}
      </div>
      {open && <div className="px-2.5 pb-2.5 space-y-2">{children}</div>}
    </div>
  );
}

function StoreList({
  listKey,
  stores,
  open,
  toggle,
  onPerson,
  onOpenStore,
  pending,
}: {
  listKey: string;
  stores: OrgStore[];
  open: Set<string>;
  toggle: (k: string) => void;
  onPerson: (p: Person) => void;
  onOpenStore?: (code: string) => void;
  /** คำขอเพิ่มพนักงานที่รออนุมัติ แยกตามร้าน (แสดงเป็นเส้นประ ยังไม่นับเป็นพนักงาน) */
  pending?: Map<string, EmployeeRequest[]>;
}) {
  const moreKey = `${listKey}|more`;
  const showAll = open.has(moreKey) || stores.length <= PAGE + 1;
  const shown = showAll ? stores : stores.slice(0, PAGE);
  return (
    <div className="space-y-1.5">
      {shown.map((s) => {
        const key = `${listKey}|s:${s.code}`;
        const isOpen = open.has(key);
        return (
          <div key={s.code} className={cn("rounded-xl border", s.seCount === 0 ? "border-amber-200 bg-amber-50/50" : "border-slate-100 bg-slate-50/60")}>
            <button type="button" onClick={() => toggle(key)} aria-expanded={isOpen} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-slate-900 truncate">{s.name}</span>
                <span className="block text-[10.5px] text-slate-500">
                  {s.code} · {s.seCount > 0 ? `SE ${s.seCount}` : <span className="text-amber-700 font-semibold">ไม่มี SE</span>} · {s.staff.length} คน
                </span>
              </span>
              <Icon name={isOpen ? "expand_less" : "chevron_right"} className="text-slate-400 shrink-0" />
            </button>
            {isOpen && (
              <div className="px-2 pb-2 space-y-1">
                {s.staff.length === 0 && <p className="text-[11px] text-slate-400 px-2 py-1">ยังไม่มีรายชื่อพนักงาน</p>}
                <div className="bg-white rounded-xl divide-y divide-slate-50">
                  {s.staff.map((p) => (
                    <PersonRow key={p.repCode} c={p} sub={staffSub(p)} tone={toneOf(p.position)} level={p.level} isNew={isNewEmployee(p.startDate)} onOpen={() => onPerson(p)} />
                  ))}
                </div>
                {(pending?.get(s.code) ?? []).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-3 py-2 text-[11.5px] text-amber-900">
                    <Icon name="hourglass_top" style={{ fontSize: 15 }} />
                    <span className="flex-1 truncate">
                      {r.payload.name}{r.payload.nickname ? ` (${r.payload.nickname})` : ""} · รออนุมัติ
                    </span>
                  </div>
                ))}
                {onOpenStore && (
                  <Link
                    href={`/app/employee-requests?new=1&store=${encodeURIComponent(s.code)}`}
                    className="w-full py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11.5px] font-bold flex items-center justify-center gap-1"
                  >
                    <Icon name="person_add" style={{ fontSize: 15 }} />
                    แจ้งพนักงานใหม่ของร้านนี้
                  </Link>
                )}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {onOpenStore && (
                    <button type="button" onClick={() => onOpenStore(s.code)} className="py-2 rounded-xl bg-[#d32029] text-white text-[11.5px] font-bold flex items-center justify-center gap-1">
                      <Icon name="monitoring" style={{ fontSize: 15 }} />
                      ดูข้อมูลร้าน
                    </button>
                  )}
                  <Link href={`/app/store/${s.code}`} className={cn("py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11.5px] font-bold flex items-center justify-center gap-1", !onOpenStore && "col-span-2")}>
                    <Icon name="groups" style={{ fontSize: 15 }} />
                    ทีมงานเต็ม
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!showAll && (
        <button type="button" onClick={() => toggle(moreKey)} className="w-full py-1.5 text-[11.5px] font-semibold text-slate-600">
          ดูอีก {stores.length - PAGE} ร้าน
          <Icon name="expand_more" style={{ fontSize: 16 }} className="align-middle" />
        </button>
      )}
    </div>
  );
}

function staffSub(p: Person): string {
  const pos = p.position ? POSITION_LABEL[p.position] : "พนักงาน";
  const t = tenureFromStartDate(p.startDate);
  return t ? `${pos} · อายุงาน ${t}` : pos;
}

function toneOf(position: string | null): string {
  if (position === "area_mng") return KIND.area.avatar;
  if (position === "coach") return KIND.coach.avatar;
  if (position === "se") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function PersonRow({ c, sub, tone, level, isNew, onOpen }: { c: Contact; sub: string; tone: string; level?: string | null; isNew?: boolean; onOpen: () => void }) {
  const lv = level && level in LEVEL_META ? LEVEL_META[level as keyof typeof LEVEL_META] : null;
  return (
    <button type="button" onClick={onOpen} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition">
      <Avatar c={c} size={34} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold text-slate-900 truncate">{c.nickname ? `${c.name} (${c.nickname})` : c.name}</span>
        <span className="block text-[10.5px] text-slate-500 truncate">{sub}</span>
      </span>
      {lv && <span className={cn("shrink-0 text-[10px] font-bold border rounded-md px-1.5 py-0.5", lv.className)}>{level}</span>}
      {isNew && <span className="shrink-0 text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-amber-50 text-amber-800">ใหม่</span>}
      <Icon name="call" className={cn("shrink-0", c.phone ? "text-[#d32029]" : "text-slate-200")} style={{ fontSize: 16 }} />
    </button>
  );
}

function Avatar({ c, size, tone }: { c: Contact; size: number; tone: string }) {
  const initials = (c.nickname || c.name || "?").replace(/\s+/g, "").slice(0, 2);
  return c.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.photoUrl} alt="" loading="lazy" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className={cn("rounded-full flex items-center justify-center font-bold shrink-0", tone)} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden>
      {initials}
    </span>
  );
}

/* ---------------- การ์ดติดต่อ (bottom sheet) ---------------- */

function ContactSheet({ p, onClose }: { p: SheetPerson; onClose: () => void }) {
  const { c } = p;
  const tel = c.phone ? `tel:${c.phone.replace(/[^0-9+]/g, "")}` : null;
  const actions = [
    { icon: "call", label: "โทร", href: tel, cls: "bg-red-50 text-[#a11119]" },
    { icon: "chat", label: "Line", href: c.lineId ? lineHref(c.lineId) : null, cls: "bg-emerald-50 text-emerald-700" },
    { icon: "mail", label: "อีเมล", href: c.email ? `mailto:${c.email}` : null, cls: "bg-blue-50 text-blue-700" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`ติดต่อ ${c.name}`}>
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-8">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200 mb-4" />
        <div className="flex flex-col items-center text-center">
          <Avatar c={c} size={76} tone={p.tone} />
          <p className="mt-2.5 text-[16px] font-bold text-slate-900">{c.nickname ? `${c.name} (${c.nickname})` : c.name}</p>
          <p className="text-[11.5px] text-slate-500 mt-0.5">{p.sub}</p>
          {p.tenure && <p className="text-[11px] text-slate-400">อายุงาน {p.tenure}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {actions.map((a) =>
            a.href ? (
              <a key={a.label} href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cn("rounded-2xl py-3 flex flex-col items-center gap-1 text-[11.5px] font-bold", a.cls)}>
                <Icon name={a.icon} />
                {a.label}
              </a>
            ) : (
              <span key={a.label} className="rounded-2xl py-3 flex flex-col items-center gap-1 text-[11.5px] font-bold bg-slate-50 text-slate-300" aria-disabled>
                <Icon name={a.icon} />
                {a.label}
              </span>
            )
          )}
        </div>
        <dl className="mt-4 text-[12.5px] divide-y divide-slate-100">
          <InfoRow k="เบอร์" v={c.phone} />
          <InfoRow k="Line" v={c.lineId} />
          <InfoRow k="อีเมล" v={c.email} />
        </dl>
      </div>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className={cn("text-right break-all", v ? "text-slate-900" : "text-slate-300")}>{v || "ยังไม่ได้ใส่"}</dd>
    </div>
  );
}

/* ---------------- แก้ไขข้อมูลของฉัน ---------------- */

function EditSheet({ me, onClose, onSaved }: { me: Me; onClose: () => void; onSaved: () => void }) {
  const [nickname, setNickname] = useState(me.nickname ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [phone2, setPhone2] = useState(me.phone2 ?? "");
  const [lineId, setLineId] = useState(me.lineId ?? "");
  const [photo, setPhoto] = useState(me.photoUrl);
  const [busy, setBusy] = useState<"save" | "photo" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isRep = me.editable === "rep";

  async function onPhoto(f: File | undefined) {
    if (!f) return;
    setBusy("photo");
    setErr(null);
    const r = await uploadMyPhoto(f);
    setBusy(null);
    if (r.ok && r.url) setPhoto(r.url);
    else setErr(r.error ?? "อัปโหลดรูปไม่สำเร็จ");
  }

  async function onSave() {
    setBusy("save");
    setErr(null);
    const r = await saveMyProfile({ nickname, phone, lineId, ...(isRep ? { phone2 } : {}) });
    setBusy(null);
    if (r.ok) onSaved();
    else setErr(r.error ?? "บันทึกไม่สำเร็จ");
  }

  const input = "w-full bg-[#faf8f8] text-slate-900 text-[13.5px] rounded-xl px-3 py-2.5 border border-slate-200 focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10 focus:bg-white transition";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="edit-me-title">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 id="edit-me-title" className="text-[15px] font-bold text-slate-900">แก้ไขข้อมูลของฉัน</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <Avatar c={{ ...me, photoUrl: photo }} size={84} tone={(KIND[me.kind] ?? KIND.area).avatar} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3.5 py-1.5 text-[12px] font-bold text-slate-700 disabled:opacity-50"
          >
            <Icon name="photo_camera" style={{ fontSize: 15 }} />
            {busy === "photo" ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[12px] font-bold text-slate-700 mb-1">ชื่อ-นามสกุล</p>
            <p className="text-[13.5px] rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600">{me.name}</p>
          </div>
          <div>
            <label htmlFor="me-nick" className="block text-[12px] font-bold text-slate-700 mb-1">ชื่อเล่น</label>
            <input id="me-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} className={input} />
          </div>
          <div className={cn("grid gap-2", isRep ? "grid-cols-2" : "grid-cols-1")}>
            <div>
              <label htmlFor="me-phone" className="block text-[12px] font-bold text-slate-700 mb-1">เบอร์โทร</label>
              <input id="me-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className={input} />
            </div>
            {isRep && (
              <div>
                <label htmlFor="me-phone2" className="block text-[12px] font-bold text-slate-700 mb-1">เบอร์สำรอง</label>
                <input id="me-phone2" type="tel" inputMode="tel" value={phone2} onChange={(e) => setPhone2(e.target.value)} maxLength={20} className={input} />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="me-line" className="block text-[12px] font-bold text-slate-700 mb-1">Line ID</label>
            <input id="me-line" value={lineId} onChange={(e) => setLineId(e.target.value)} maxLength={50} placeholder="เช่น sample.line" autoCapitalize="none" spellCheck={false} className={input} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-700 mb-1">อีเมล (ชื่อผู้ใช้)</p>
            <p className="text-[13.5px] rounded-xl bg-slate-50 px-3 py-2.5 text-slate-500 flex items-center justify-between">
              <span className="truncate">{me.email ?? "-"}</span>
              <Icon name="lock" style={{ fontSize: 15 }} />
            </p>
            <p className="text-[10.5px] text-slate-400 mt-1">ชื่อ-นามสกุลและอีเมลแก้ได้โดยผู้ดูแลระบบเท่านั้น</p>
          </div>
        </div>

        {err && <p className="mt-3 text-[12px] text-[#a11119] bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

        <button
          type="button"
          onClick={onSave}
          disabled={busy !== null}
          className="mt-4 w-full h-12 rounded-2xl bg-slate-800 text-white font-bold text-[14px] hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          {busy === "save" ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
