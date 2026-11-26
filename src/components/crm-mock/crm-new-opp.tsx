"use client";
/* เปิด Opp ใหม่ / แก้ไขใบเปิดงาน: หน้าเต็มตามใบเปิดงานของต้นแบบทีม JV
   Step 1–3 ข้อมูลลูกค้า/งาน · Step 4 ข้อมูลส่งถอดแบบ · Step 5 เอกสาร
   รายชื่อร้านและโมเดลดึงจากแอป Retail Comm (ต้องล็อกอิน) ถ้าไม่ได้ใช้รายชื่อร้านตัวอย่างจากต้นแบบ */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/commission/icon";
import { fetchStores, type StoreInfo } from "@/lib/commission/employee-store";
import { cn } from "@/lib/utils";
import {
  ASE_OPTS, BCHARS, BTYPES, CAT_LABEL, CAT_ORDER, CHC_OPTS, COLOR_OPTS, CTYPES, DEPOSIT_PCT, DEPOSIT_SCG, FAMILY, INS_OPTS, MODEL_LABEL, NOW, OWNERS, PKG_OPTS, RC_OPTS,
  ROUND_LABEL, SEA_OPTS, SEGMENT_LABEL, SHAPE_OPTS, SHOPS, SVC_LABEL, TERRAIN, TILE_MODEL_OPTS, TILE_OPTS, WORK_LABEL, baht, dayKey, missingOf, planTotals, segmentOfCtype, template, workOfDet,
  type Cat, type Intake, type Job, type Lead, type Model, type Segment, type Work,
} from "./crm-mock-data";
import { KV, btnGhost, btnPrimary, glass, inputCls, labelCls } from "./crm-ui";
import { TH_PROVINCES, districtsOf } from "./th-geo";

export interface NewJobInput {
  customer: string; phone: string; province: string; segment: Segment; work: Work; model: Model; value: number; owner: string; leadId?: string; intake: Intake;
}

const PHONE_RE = /^0\d{1,2}-?[\dx]{3}-?[\dx]{3,4}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAP_RE = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)/i;
type Fam = (typeof FAMILY)[number];

interface Form {
  name: string; tel: string; ctype: string; fam: string; email: string; lead: string;
  date: string; shop: string; shopCode: string; model: Model;
  btype: string; bchar: string; prov: string; dist: string; loc: string; sea: string; terr: string[];
  warrSame: boolean; warrName: string;
  ref: string; svc: string[]; pkgType: "total" | "standard"; pkg: string; det: Cat[]; round: "all" | "top" | "bottom";
  ase: string; chc: string; st2: "yes" | "no"; truss: string; muk: string; rc: string; eave: number;
  tile: string; tileModel: string; color: string; shape: string; deg: string; ins: string;
  value: string; owner: string; files: { name: string; size: string }[];
}

/** รายละเอียดกระเบื้องที่พนักงานกรอกไว้ตอนคีย์ Lead (ถ้ามี) ใช้เติมใบเปิดงาน */
const leadDetail = (lead: Lead | null) => lead?.interests?.find((i) => i.kind === "service" && i.detail?.type === "กระเบื้องหลังคา")?.detail;
const pickOpt = (opts: readonly string[], v?: string) => (v && opts.includes(v) ? v : opts[0]);
function initForm(lead: Lead | null): Form {
  const hint = lead?.interest ?? "";
  const det: Cat[] = /อะเส/.test(hint) ? ["ase", "truss", "tile", "fascia"] : /ทรัส|โครง/.test(hint) ? ["truss", "tile", "fascia"] : ["tile", "fascia"];
  return {
    name: lead?.name ?? "", tel: lead?.phone ?? "", ctype: "", fam: "", email: "", lead: lead?.id ?? "",
    date: dayKey(NOW.toISOString()), shop: "", shopCode: "", model: "he",
    btype: BTYPES[0], bchar: BCHARS[0], prov: lead?.province ?? "", dist: "", loc: "", sea: SEA_OPTS[1], terr: ["B"],
    warrSame: true, warrName: "",
    ref: "", svc: ["sol"], pkgType: "total", pkg: PKG_OPTS[0], det, round: "all",
    ase: ASE_OPTS[0], chc: CHC_OPTS[0], st2: "no", truss: "", muk: "", rc: "", eave: 2,
    tile: pickOpt(TILE_OPTS, leadDetail(lead)?.brand), tileModel: pickOpt(TILE_MODEL_OPTS, leadDetail(lead)?.model), color: pickOpt(COLOR_OPTS, leadDetail(lead)?.color), shape: "", deg: "", ins: INS_OPTS[2],
    value: "", owner: OWNERS[0], files: [],
  };
}
function formFromJob(j: Job): Form {
  const b = initForm(null);
  const i = j.intake;
  return {
    ...b,
    name: j.customer, tel: j.phone, ctype: i?.ctype ?? (j.segment === "hbd" ? "HBD" : "ลูกค้าทั่วไป"), fam: i?.fam ?? "", email: i?.email ?? "", lead: j.leadId ?? "",
    date: i?.requestDate ?? b.date, shop: i?.shop ?? "", shopCode: i?.shopCode ?? "", model: j.model,
    btype: i?.btype ?? b.btype, bchar: i?.bchar ?? b.bchar, prov: j.province, dist: i?.district ?? "", loc: i?.loc ?? "", sea: i?.sea ?? b.sea, terr: i?.terr ?? b.terr,
    warrSame: i?.warrSame ?? true, warrName: i?.warrName ?? "",
    ref: i?.refJob ?? "", svc: i?.svc ?? b.svc, pkgType: i?.pkgType ?? b.pkgType, pkg: i?.pkg ?? b.pkg, det: i?.det ?? b.det, round: i?.round ?? b.round,
    ase: i?.ase ?? b.ase, chc: i?.chc ?? b.chc, st2: i?.st2 ? "yes" : "no", truss: i?.truss ?? "", muk: i?.muk ?? "", rc: i?.rc ?? "", eave: i?.eave ?? b.eave,
    tile: i?.tile ?? b.tile, tileModel: i?.tileModel ?? b.tileModel, color: i?.color ?? b.color, shape: i?.shape ?? "", deg: i?.deg ?? "", ins: i?.ins ?? b.ins,
    value: j.value > 0 ? j.value.toLocaleString("en-US") : "", owner: j.owner, files: i?.files ?? [],
  };
}

const moneyOf = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
function validate1(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.name.trim().length < 2) e.name = "กรอกชื่อ-สกุลลูกค้า";
  if (!PHONE_RE.test(f.tel.trim())) e.tel = "กรอกเบอร์โทรให้ถูกต้อง เช่น 081-234-5678";
  if (!f.ctype) e.ctype = "เลือกประเภทลูกค้า";
  if (f.email && !EMAIL_RE.test(f.email.trim())) e.email = "รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com";
  if (!f.date) e.date = "เลือกวันที่ขอรับบริการ";
  if (!f.prov.trim()) e.prov = "เลือกจังหวัด";
  if (!f.dist.trim()) e.dist = "เลือกอำเภอ";
  if (f.loc && !MAP_RE.test(f.loc.trim())) e.loc = "ต้องเป็นลิงก์จาก Google Maps เช่น https://maps.app.goo.gl/…";
  if (!f.warrSame && !f.warrName.trim()) e.warrName = "กรอกชื่อ-สกุลที่จะแสดงบนใบรับประกัน";
  return e;
}
/** strict = ตรวจช่องบังคับของ Step 4 ด้วย (ตอนกดถัดไป) ; ไม่ strict = ตรวจเฉพาะรูปแบบตัวเลข (ตอนบันทึกร่าง) */
function validate4(f: Form, strict: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (strict && !f.svc.length) e.svc = "เลือกบริการอย่างน้อย 1 รายการ";
  if (strict && !f.det.length) e.det = "เลือกหมวดที่ต้องการส่งถอดแบบอย่างน้อย 1 หมวด";
  if (f.truss && !(+f.truss >= 0.5 && +f.truss <= 3)) e.truss = "ระยะ max truss ควรอยู่ระหว่าง 0.50–3.00 เมตร";
  if (f.muk && !/^\d+$/.test(f.muk)) e.muk = "จำนวนมุกเป็นจำนวนเต็ม";
  if (f.deg && !(+f.deg >= 10 && +f.deg <= 60)) e.deg = "องศาหลังคาควรอยู่ระหว่าง 10–60 องศา";
  if (strict && moneyOf(f.value) <= 0) e.value = "กรอกมูลค่าประมาณการเบื้องต้น";
  return e;
}
function toIntake(f: Form): Intake {
  return {
    email: f.email.trim() || undefined, ctype: f.ctype, fam: f.fam || undefined, requestDate: f.date,
    shop: f.shop.trim() || undefined, shopCode: f.shopCode || undefined, shopType: !f.shopCode && f.shop in SHOPS ? SHOPS[f.shop] : undefined,
    btype: f.btype, bchar: f.bchar, district: f.dist.trim(), loc: f.loc.trim() || undefined, sea: f.sea, terr: f.terr,
    warrSame: f.warrSame, warrName: f.warrSame ? undefined : f.warrName.trim(),
    refJob: f.ref.trim() || undefined, svc: f.svc, pkgType: f.pkgType, pkg: f.pkg, det: f.det, round: f.round,
    ase: f.ase, chc: f.chc, st2: f.st2 === "yes", truss: f.truss || undefined, muk: f.muk || undefined, rc: f.rc || undefined, eave: f.eave,
    tile: f.tile, tileModel: f.tileModel, color: f.color, shape: f.shape || undefined, deg: f.deg || undefined, ins: f.ins, files: f.files,
  };
}
/** โมเดลร้านในแอป Retail Comm -> โมเดลที่ CRM มีกติกามัดจำ (GT / XP ยังไม่มี) */
const modelOf = (m: string | null): Model | undefined => (m === "Housing Expert" ? "he" : m === "SCG Home" ? "scg" : undefined);
const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const errCls = (err?: string) => cn(inputCls, err && "border-rose-400 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-100");
const roCls = cn(inputCls, "bg-slate-100 text-slate-500");

function Fld({ label, req, err, hint, children }: { label: string; req?: boolean; err?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}{req && <span className="text-rose-500"> *</span>}</span>
      {children}
      {err ? <span className="mt-1 block text-[11px] font-medium text-rose-600">{err}</span> : hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}
function Group({ label, req, err, children }: { label: string; req?: boolean; err?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={labelCls}>{label}{req && <span className="text-rose-500"> *</span>}</div>
      <div className="space-y-1.5">{children}</div>
      {err && <div className="mt-1 text-[11px] font-medium text-rose-600">{err}</div>}
    </div>
  );
}
function Radio({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start gap-2 text-[12.5px] text-slate-700", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <input type="radio" checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" />{label}
    </label>
  );
}
function Check({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start gap-2 text-[12.5px] text-slate-700", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" />{label}
    </label>
  );
}
function Sec({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <section className={cn(glass, "space-y-3 p-4 md:p-5")}>
      <h3 className="flex items-center gap-2 text-[13.5px] font-bold text-slate-900">
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] text-white">{no}</span>{title}
      </h3>
      {children}
    </section>
  );
}
/** ภาพร่างระยะยื่นชายคา (ตัวอย่างประกอบ ไม่ใช่แบบจริงของทีม) */
function EaveSketch({ n }: { n: number }) {
  const rise = [2, 6, 10, 14, 18, 22][n - 1];
  return (
    <svg viewBox="0 0 60 34" className="h-8 w-14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="16" y="24" width="28" height="6" />
      <path d={`M4 24 L56 ${24 - rise}`} />
    </svg>
  );
}

const STEPS = [{ k: 1, label: "Step 1–3 ข้อมูลลูกค้า/งาน" }, { k: 4, label: "Step 4 ข้อมูลส่งถอดแบบ" }, { k: 5, label: "Step 5 เอกสาร" }] as const;

export function NewOppPage({ lead, editJob, jobs, initialStep, onDirty, onCancel, onSave, toast }: {
  lead: Lead | null; editJob: Job | null; jobs: Job[]; initialStep: 1 | 4 | 5; onDirty: (dirty: boolean) => void; onCancel: () => void;
  onSave: (i: NewJobInput, draft: boolean, editId: string | null) => void; toast: (m: string) => void;
}) {
  const edit = !!editJob;
  const [initial] = useState<Form>(() => (editJob ? formFromJob(editJob) : initForm(lead)));
  const [initialJson] = useState(() => JSON.stringify(initial));
  const [f, setF] = useState<Form>(initial);
  const [step, setStep] = useState<1 | 4 | 5>(initialStep);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [found, setFound] = useState<"" | "none" | "found" | "multi">("");
  const [matches, setMatches] = useState<Fam[]>([]);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [storeState, setStoreState] = useState<"loading" | "ok" | "fallback">("loading");
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchStores()
      .then((s) => { if (!alive) return; const act = s.filter((x) => x.isActive); setStores(act); setStoreState(act.length ? "ok" : "fallback"); })
      .catch(() => { if (alive) setStoreState("fallback"); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { onDirty(JSON.stringify(f) !== initialJson); }, [f, initialJson, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errs[k]) setErrs((e) => { const n = { ...e }; delete n[k]; return n; });
  };
  const toTop = () => topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  const segment = segmentOfCtype(f.ctype);
  const work = workOfDet(f.det);
  const value = moneyOf(f.value);
  /** เริ่มดำเนินการแล้ว (เกินขั้นรับแบบ) จะเปลี่ยนกลุ่มลูกค้า/หมวดส่งถอดแบบไม่ได้ เพราะแม่แบบ PT เปลี่ยน */
  const lockFlow = !!editJob && Object.keys(editJob.done).some((k) => k !== "plan_in");

  const shopStore = stores.find((s) => s.name === f.shop.trim());
  const storeModel = shopStore ? modelOf(shopStore.model) : undefined;
  const modelLocked = storeModel !== undefined || !!editJob?.done.deposit;
  const pickShop = (v: string) => {
    const s = stores.find((x) => x.name === v.trim());
    const m = s ? modelOf(s.model) : undefined;
    setF((p) => ({ ...p, shop: v, shopCode: s?.code ?? "", model: m ?? p.model }));
  };

  const applyFam = (c: Fam) => setF((s) => ({ ...s, name: c.name, tel: c.tel, ctype: c.ctype, fam: c.fam, email: c.email }));
  const search = () => {
    const k = q.trim().toLowerCase();
    if (!k) { setFound(""); return; }
    const res = FAMILY.filter((c) => `${c.name}${c.tel}${c.fam}`.toLowerCase().includes(k));
    if (res.length === 1) { applyFam(res[0]); setFound("found"); setErrs({}); }
    else if (res.length > 1) { setMatches(res); setFound("multi"); }
    else setFound("none");
  };
  const sample = () => { applyFam(FAMILY[0]); setF((s) => ({ ...s, loc: "https://maps.app.goo.gl/hatyai01", bchar: BCHARS[1] })); setFound("found"); setErrs({}); };

  const toggleDet = (c: Cat) => {
    if (lockFlow) return;
    setF((s) => {
      let det = s.det.includes(c) ? s.det.filter((x) => x !== c) : [...s.det, c];
      if (c === "ase" && det.includes("ase") && !det.includes("truss")) det = [...det, "truss"];
      if (c === "truss" && !det.includes("truss")) det = det.filter((x) => x !== "ase");
      return { ...s, det: CAT_ORDER.filter((x) => det.includes(x)) };
    });
    if (errs.det) setErrs((e) => { const n = { ...e }; delete n.det; return n; });
  };
  const fetchRef = () => {
    const k = f.ref.trim().toLowerCase();
    if (!k) return;
    const j = jobs.find((x) => x.id.toLowerCase() === k || x.opsId.toLowerCase() === k);
    const i = j?.intake;
    if (!j || !i) { setErrs({ ref: `ไม่พบเลข Job ${f.ref.trim()} ลองเลขเช่น J-2611-0108` }); return; }
    setF((s) => ({
      ...s, svc: i.svc, pkgType: i.pkgType, pkg: i.pkg, det: lockFlow ? s.det : i.det, round: i.round, ase: i.ase, chc: i.chc, st2: i.st2 ? "yes" : "no",
      truss: i.truss ?? "", muk: i.muk ?? "", rc: i.rc ?? "", eave: i.eave, tile: i.tile, tileModel: i.tileModel, color: i.color, shape: i.shape ?? "", deg: i.deg ?? "", ins: i.ins,
    }));
    setErrs({});
    toast(`ดึงข้อมูลส่งถอดแบบจาก ${j.id} แล้ว`);
  };
  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const add = Array.from(list).map((x) => ({ name: x.name, size: fmtSize(x.size) }));
    setF((s) => ({ ...s, files: [...s.files, ...add] }));
    setErrs({});
  };

  const toInput = (): NewJobInput => ({
    customer: f.name.trim(), phone: f.tel.trim(), province: f.prov.trim(), segment, work, model: f.model, value, owner: f.owner, leadId: f.lead || undefined, intake: toIntake(f),
  });
  const next = () => {
    const e = step === 1 ? validate1(f) : validate4(f, true);
    setErrs(e);
    if (Object.keys(e).length) { toTop(); return; }
    setStep(step === 1 ? 4 : 5);
    toTop();
  };
  const back = () => { setErrs({}); setStep(step === 5 ? 4 : 1); toTop(); };
  /** บันทึกร่าง (สร้างใหม่) หรือบันทึกการแก้ไข: ต้องผ่าน Step 1–3 ส่วน Step 4–5 ขาดได้ */
  const save = () => {
    const e1 = validate1(f);
    const e = { ...e1, ...validate4(f, false) };
    if (Object.keys(e).length) { setErrs(e); if (Object.keys(e1).length) setStep(1); else setStep(4); toTop(); return; }
    onSave(toInput(), true, editJob?.id ?? null);
  };
  const create = () => {
    if (f.files.length === 0) { setErrs({ files: "แนบเอกสารอย่างน้อย 1 ไฟล์ก่อนสร้างงาน หรือกดบันทึกร่างไว้ก่อน" }); toTop(); return; }
    onSave(toInput(), false, null);
  };
  const goStep = (k: 1 | 4 | 5) => { setErrs({}); setStep(k); toTop(); };

  const nErr = Object.keys(errs).length;
  const tpl = template(segment, work);
  const tot = planTotals(tpl);
  const needRoom = tpl.some((s) => s.owner === "ROOM");
  const depText = segment === "hbd" ? "ไม่มีมัดจำ (ปิดขายจากแบบ)" : f.model === "scg" ? `มัดจำคงที่ ${baht(DEPOSIT_SCG)}` : value > 0 ? `มัดจำ ${DEPOSIT_PCT}% = ${baht(Math.round((value * DEPOSIT_PCT) / 100))}` : `มัดจำ ${DEPOSIT_PCT}% ของราคา`;
  const miss = missingOf(toIntake(f));
  const step1Ok = Object.keys(validate1(f)).length === 0;
  const shopHint = storeState === "loading" ? "กำลังโหลดรายชื่อร้านจากแอป Retail Comm…" : storeState === "ok" ? `รายชื่อร้านจากแอป Retail Comm (${stores.length} ร้าน) เลือกแล้วโมเดลเติมให้` : "ใช้รายชื่อร้านตัวอย่างจากต้นแบบ · ล็อกอินแอป Retail Comm เพื่อดึงรายชื่อร้านจริง";

  return (
    <div className="space-y-4">
      <div ref={topRef} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button onClick={onCancel} className="mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-indigo-700"><Icon name="arrow_back" style={{ fontSize: 16 }} />กลับ</button>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{edit ? "แก้ไขใบเปิดงาน" : "เปิด Opp ใหม่"}</h1>
          <p className="text-[12.5px] text-slate-500">{edit ? `${editJob.id} · ${editJob.customer}` : lead ? `จาก Lead ${lead.id} · ${lead.name}` : "สร้างงานใหม่ · ใบเปิดงาน Step 1–5"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s) => {
            const done = s.k < step;
            const on = s.k === step;
            const clickable = edit ? !on : done;
            return (
              <button key={s.k} disabled={!clickable} onClick={() => goStep(s.k)}
                className={cn("rounded-full px-3 py-1.5 text-[11.5px] font-bold transition", on ? "bg-indigo-600 text-white shadow" : done ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : clickable ? "bg-white text-slate-600 hover:bg-indigo-50" : "bg-slate-100 text-slate-400")}>
                {done && <Icon name="check" style={{ fontSize: 13 }} className="mr-0.5 align-[-2px]" />}{s.label}
              </button>
            );
          })}
        </div>
      </div>

      {nErr > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12.5px] font-medium text-rose-700">
          {errs.files ?? `กรอกข้อมูลไม่ครบหรือไม่ถูกต้อง ${nErr} ช่อง ตรวจสอบช่องที่ขึ้นสีแดง`}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {step === 1 && (
            <>
              <Sec no="1" title="เลือกลูกค้า / สร้างข้อมูลลูกค้า">
                <div className="flex flex-wrap gap-2">
                  <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="ค้นหาจาก SCG Family ด้วยชื่อ / เบอร์โทร / รหัส Fam" className={cn(inputCls, "min-w-[220px] flex-1")} aria-label="ค้นหาลูกค้า" />
                  <button onClick={search} className={btnPrimary}>ค้นหา</button>
                  <button onClick={sample} className={btnGhost}>เติมข้อมูลตัวอย่าง</button>
                </div>
                {found === "found" && <p className="text-[12px] font-semibold text-emerald-700">ดึงข้อมูลจาก SCG Family แล้ว</p>}
                {found === "none" && <p className="text-[12px] font-medium text-amber-700">ไม่พบลูกค้าใน SCG Family กรอกข้อมูลลูกค้าใหม่ด้านล่างได้เลย</p>}
                {found === "multi" && (
                  <ul className="space-y-1.5">
                    {matches.map((c) => (
                      <li key={c.fam}>
                        <button onClick={() => { applyFam(c); setFound("found"); setErrs({}); }} className="w-full rounded-xl bg-slate-50 px-3 py-2 text-left transition hover:bg-indigo-50">
                          <div className="text-[12.5px] font-semibold text-slate-800">{c.name}</div>
                          <div className="text-[11px] text-slate-500">{c.tel} · {c.fam} · {c.ctype}</div>
                        </button>
                      </li>
                    ))}
                    <li className="px-1 text-[11px] text-slate-400">พบ {matches.length} รายการ เลือกลูกค้าที่ต้องการ</li>
                  </ul>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fld label="ชื่อ-สกุล" req err={errs.name}><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น คุณสมชาย ใจดี" className={errCls(errs.name)} /></Fld>
                  <Fld label="รหัสลูกค้า Fam"><input readOnly value={f.fam} placeholder="ได้จากการค้นหา SCG Family" className={roCls} /></Fld>
                  <Fld label="เบอร์ติดต่อ" req err={errs.tel}><input inputMode="tel" value={f.tel} onChange={(e) => set("tel", e.target.value)} placeholder="0XX-XXX-XXXX" className={errCls(errs.tel)} /></Fld>
                  <Fld label="อีเมล" err={errs.email}><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" className={errCls(errs.email)} /></Fld>
                  <Fld label="ประเภทลูกค้า" req err={errs.ctype} hint={lockFlow ? "งานนี้เริ่มดำเนินการแล้ว เปลี่ยนประเภทลูกค้าไม่ได้" : f.ctype === "HBD" ? "ลูกค้า HBD ปิดขายจากแบบ ไม่มีมัดจำ/สำรวจ" : undefined}>
                    <select value={f.ctype} disabled={lockFlow} onChange={(e) => set("ctype", e.target.value)} className={cn(errCls(errs.ctype), lockFlow && "opacity-60")}>
                      <option value="">-- เลือก --</option>
                      {CTYPES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Fld>
                  <Fld label="รหัส Lead" hint={f.lead ? "ดึงจาก Lead อัตโนมัติ" : undefined}><input readOnly value={f.lead} placeholder="ใส่อัตโนมัติเมื่อเปิดจากหน้า Lead" className={roCls} /></Fld>
                </div>
              </Sec>

              <Sec no="2" title="ข้อมูลขอรับบริการ">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fld label="วันที่ขอรับบริการ" req err={errs.date}><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={errCls(errs.date)} /></Fld>
                  <Fld label="ชื่อร้าน" hint={shopHint}>
                    <input list="crm-shops" value={f.shop} onChange={(e) => pickShop(e.target.value)} placeholder="พิมพ์หรือเลือกร้านผู้แทนจำหน่าย" className={inputCls} />
                    <datalist id="crm-shops">
                      {stores.length > 0
                        ? stores.map((s) => <option key={s.code} value={s.name} label={`${s.code} · ${s.model ?? "-"}`} />)
                        : Object.keys(SHOPS).map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </Fld>
                  <div>
                    <Group label="โมเดล">
                      {(["he", "scg"] as const).map((m) => (
                        <Radio key={m} checked={f.model === m} disabled={modelLocked} onChange={() => set("model", m)} label={<span><b>{MODEL_LABEL[m]}</b> <span className="text-slate-400">· {m === "he" ? `มัดจำ ${DEPOSIT_PCT}% ของราคา` : `มัดจำคงที่ ${baht(DEPOSIT_SCG)}`}</span></span>} />
                      ))}
                    </Group>
                    {storeModel !== undefined && <p className="mt-1 text-[11px] text-emerald-700">กำหนดตามโมเดลร้านในแอป Retail Comm</p>}
                    {shopStore && storeModel === undefined && <p className="mt-1 text-[11px] text-amber-700">ร้านโมเดล {shopStore.model ?? "-"} ยังไม่มีกติกามัดจำในต้นแบบนี้ เลือกโมเดลที่ใช้คิดมัดจำเอง</p>}
                    {!shopStore && editJob?.done.deposit && <p className="mt-1 text-[11px] text-slate-400">รับมัดจำแล้ว เปลี่ยนโมเดลไม่ได้</p>}
                  </div>
                  <Fld label={shopStore ? "โมเดลร้าน (Retail Comm)" : "ประเภทร้าน"} hint={shopStore ? `รหัสร้าน ${shopStore.code}` : "GT = ร้านค้าทั่วไป · MT = Modern Trade"}>
                    <input readOnly value={shopStore ? `${shopStore.model ?? "-"}${shopStore.region ? ` · ${shopStore.region}` : ""}` : f.shop in SHOPS ? SHOPS[f.shop] : ""} className={roCls} />
                  </Fld>
                </div>
              </Sec>

              <Sec no="3" title="ข้อมูลงาน">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fld label="ประเภทอาคาร"><select value={f.btype} onChange={(e) => set("btype", e.target.value)} className={inputCls}>{BTYPES.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                  <Fld label="ลักษณะอาคาร"><select value={f.bchar} onChange={(e) => set("bchar", e.target.value)} className={inputCls}>{BCHARS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                  <Fld label="จังหวัด" req err={errs.prov}>
                    <select value={f.prov} onChange={(e) => { set("prov", e.target.value); set("dist", ""); }} className={errCls(errs.prov)}>
                      <option value="">-- เลือกจังหวัด --</option>
                      {TH_PROVINCES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Fld>
                  <Fld label="อำเภอ" req err={errs.dist}>
                    <select value={f.dist} disabled={!f.prov} onChange={(e) => set("dist", e.target.value)} className={cn(errCls(errs.dist), "disabled:opacity-50")}>
                      <option value="">{f.prov ? "-- เลือกอำเภอ --" : "เลือกจังหวัดก่อน"}</option>
                      {districtsOf(f.prov).map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </Fld>
                </div>
                <Fld label="Location หน้างาน" err={errs.loc} hint="ตัวอย่าง : https://maps.app.goo.gl/xxxxxxxx">
                  <input value={f.loc} onChange={(e) => set("loc", e.target.value)} placeholder="Copy url มาจาก google map ได้เลยค่ะ" className={errCls(errs.loc)} />
                </Fld>
                {f.loc && MAP_RE.test(f.loc.trim()) && <a href={f.loc.trim()} target="_blank" rel="noopener noreferrer" className="inline-block text-[12px] font-semibold text-indigo-600 underline">เปิดตำแหน่งใน Google Maps</a>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Group label="พื้นที่ใกล้ทะเล">{SEA_OPTS.map((o) => <Radio key={o} checked={f.sea === o} onChange={() => set("sea", o)} label={o} />)}</Group>
                  <Group label="ภูมิประเทศ">{Object.entries(TERRAIN).map(([k, t]) => <Check key={k} checked={f.terr.includes(k)} onChange={() => set("terr", toggleIn(f.terr, k))} label={t} />)}</Group>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-1 text-[12.5px] font-bold text-slate-800">ข้อมูลออกใบรับประกัน</div>
                  <Check checked={f.warrSame} onChange={() => set("warrSame", !f.warrSame)} label={`ใช้ชื่อเดียวกับลูกค้า (${f.name.trim() || "ชื่อใน Step 1"})`} />
                  {!f.warrSame && (
                    <div className="mt-2">
                      <Fld label="ชื่อ-สกุล ที่จะแสดงบนใบรับประกัน" req err={errs.warrName} hint="กรณีชื่อเจ้าของบ้าน / ผู้รับประกัน ไม่ตรงกับชื่อลูกค้าที่เปิดงาน">
                        <input value={f.warrName} onChange={(e) => set("warrName", e.target.value)} placeholder="เช่น นายสมชาย ใจดี" className={errCls(errs.warrName)} />
                      </Fld>
                    </div>
                  )}
                </div>
              </Sec>
            </>
          )}

          {step === 4 && (
            <>
              <Sec no="4" title="ข้อมูลงาน สำหรับส่งถอดแบบ">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Fld label="Ref Job no (ไม่บังคับ)" err={errs.ref} hint="ระบุเลข Job เดิมเพื่อดึงข้อมูลส่งถอดแบบมาใช้ เช่น J-2611-0108">
                      <input value={f.ref} onChange={(e) => set("ref", e.target.value)} placeholder="เช่น J-2611-0108" className={errCls(errs.ref)} />
                    </Fld>
                  </div>
                  <button onClick={fetchRef} disabled={!f.ref.trim()} className={btnGhost}>ดึงข้อมูล</button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Group label="บริการที่เลือกไว้" req err={errs.svc}>
                    {Object.entries(SVC_LABEL).map(([k, t]) => <Check key={k} checked={f.svc.includes(k)} onChange={() => set("svc", toggleIn(f.svc, k))} label={t} />)}
                  </Group>
                  <div className="space-y-2">
                    <Group label="แพคเกจขาย">
                      <Radio checked={f.pkgType === "total"} onChange={() => set("pkgType", "total")} label="Total Roof (โครง+กระเบื้อง)" />
                      <Radio checked={f.pkgType === "standard"} onChange={() => set("pkgType", "standard")} label="Standard Roof (โครง หรือ กระเบื้อง อย่างใดอย่างหนึ่ง)" />
                    </Group>
                    <Fld label="Package"><select value={f.pkg} onChange={(e) => set("pkg", e.target.value)} className={inputCls}>{PKG_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                  </div>
                </div>
              </Sec>

              <Sec no="4" title="รายละเอียดส่งถอดแบบ">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Group label="หมวดที่ส่งถอดแบบ" req err={errs.det}>
                    {CAT_ORDER.map((c) => <Check key={c} checked={f.det.includes(c)} disabled={lockFlow} onChange={() => toggleDet(c)} label={CAT_LABEL[c]} />)}
                    <p className="pt-1 text-[11px] text-slate-400">{lockFlow ? "งานนี้เริ่มดำเนินการแล้ว เปลี่ยนหมวดที่ส่งถอดแบบไม่ได้" : "เลือกอะเสต้องมีโครงหลังคาด้วย"}</p>
                  </Group>
                  <Group label="รอบ">
                    {(["all", "top", "bottom"] as const).map((r) => <Radio key={r} checked={f.round === r} onChange={() => set("round", r)} label={ROUND_LABEL[r]} />)}
                  </Group>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[12px] leading-relaxed text-slate-700">
                  <div className="mb-0.5 flex items-center gap-1.5 font-bold text-indigo-700"><Icon name="route" style={{ fontSize: 16 }} />Flow ที่ระบบเลือกให้ตาม Project Timeline</div>
                  <div><b>{SEGMENT_LABEL[segment]}</b> · {WORK_LABEL[work]} · รวม <b>{tot.total} วันทำการ</b> (หลังปิดขาย {tot.afterClose} วัน) · {depText}</div>
                  <div className="mt-1 text-slate-500">{tpl.map((s) => s.label.replace(/ \(.*\)/, "")).join(" → ")}</div>
                  {needRoom && <div className="mt-1 font-medium text-fuchsia-700">งานนี้ต้องส่งข้อมูลให้ห้องแบบ (ขีดแนวอะเส / แบบทรัส + Cutting List)</div>}
                  {!f.ctype && <div className="mt-1 text-amber-700">ยังไม่ได้เลือกประเภทลูกค้า (Step 1) จึงแสดงเป็นลูกค้าทั่วไป</div>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fld label="อะเส"><select value={f.ase} onChange={(e) => set("ase", e.target.value)} className={inputCls}>{ASE_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                  <Fld label="ไม้เชิงชาย"><select value={f.chc} onChange={(e) => set("chc", e.target.value)} className={inputCls}>{CHC_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                </div>
              </Sec>

              <Sec no="4" title="โครงหลังคา">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-[12px] font-semibold text-slate-500">หลังคา 2 step :</span>
                  <Radio checked={f.st2 === "yes"} onChange={() => set("st2", "yes")} label="Yes" />
                  <Radio checked={f.st2 === "no"} onChange={() => set("st2", "no")} label="No" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Fld label="ระยะ max truss (ม.)" err={errs.truss}><input inputMode="decimal" value={f.truss} onChange={(e) => set("truss", e.target.value)} placeholder="เช่น 1.20" className={errCls(errs.truss)} /></Fld>
                  <Fld label="จำนวนมุก" err={errs.muk}><input inputMode="numeric" value={f.muk} onChange={(e) => set("muk", e.target.value)} placeholder="เช่น 4" className={errCls(errs.muk)} /></Fld>
                  <Fld label="Roof condition">
                    <select value={f.rc} onChange={(e) => set("rc", e.target.value)} className={inputCls}><option value="">-- เลือก --</option>{RC_OPTS.map((o) => <option key={o}>{o}</option>)}</select>
                  </Fld>
                </div>
                <div>
                  <div className={labelCls}>ระยะยื่นชายคา</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="ระยะยื่นชายคา">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={f.eave === n} onClick={() => set("eave", n)}
                        className={cn("flex flex-col items-center gap-0.5 rounded-xl border p-2 text-[11px] font-semibold transition", f.eave === n ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300")}>
                        <EaveSketch n={n} />แบบที่ {n}
                      </button>
                    ))}
                  </div>
                </div>
              </Sec>

              <Sec no="4" title="กระเบื้องหลังคา">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fld label="กระเบื้อง"><select value={f.tile} onChange={(e) => set("tile", e.target.value)} className={inputCls}>{TILE_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                  <Fld label="ทรงหลังคา">
                    <select value={f.shape} onChange={(e) => set("shape", e.target.value)} className={inputCls}><option value="">-- เลือก --</option>{SHAPE_OPTS.map((o) => <option key={o}>{o}</option>)}</select>
                  </Fld>
                  <Fld label="รุ่น"><select value={f.tileModel} onChange={(e) => set("tileModel", e.target.value)} className={inputCls}>{TILE_MODEL_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                  <Fld label="องศา" err={errs.deg}><input inputMode="numeric" value={f.deg} onChange={(e) => set("deg", e.target.value)} placeholder="เช่น 30" className={errCls(errs.deg)} /></Fld>
                  <Fld label="สี"><select value={f.color} onChange={(e) => set("color", e.target.value)} className={inputCls}>{COLOR_OPTS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                  <Group label="วัสดุกันความร้อน">{INS_OPTS.map((o) => <Radio key={o} checked={f.ins === o} onChange={() => set("ins", o)} label={o} />)}</Group>
                </div>
              </Sec>

              <Sec no="+" title="ข้อมูลเสริมของ CRM (ไม่มีในต้นแบบ)">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fld label="มูลค่าประมาณการเบื้องต้น (บาท)" req={!edit} err={errs.value} hint="ใช้คำนวณยอดมัดจำและยอดเก็บเงินในหน้าจอ บันทึกร่างโดยไม่ใส่ได้">
                    <input inputMode="numeric" value={f.value} onChange={(e) => set("value", e.target.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ","))} placeholder="เช่น 250,000" className={cn(errCls(errs.value), "text-right tabular-nums")} />
                  </Fld>
                  <Fld label="ผู้ดูแล"><select value={f.owner} onChange={(e) => set("owner", e.target.value)} className={inputCls}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select></Fld>
                </div>
              </Sec>
            </>
          )}

          {step === 5 && (
            <Sec no="5" title="เอกสารที่เกี่ยวกับประมาณการ">
              <p className="text-[11.5px] leading-relaxed text-indigo-700">ส่งเอกสารที่นี่ 1.แบบแปลนหลังคา 2.แบบแปลนพื้นชั้นที่ 2 3.แบบรูปตัด (ถ้ามี) 4.แบบ Detail ชิ้นส่วน (ถ้ามี) · รองรับ PDF, JPG, PNG, DWG</p>
              <label htmlFor="crm-upf" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40", errs.files ? "border-rose-300 bg-rose-50/40" : "border-slate-300 bg-white")}>
                <Icon name="cloud_upload" className="text-indigo-500" style={{ fontSize: 40 }} />
                <span className="text-[14px] font-bold text-slate-800">Browse Files</span>
                <span className="text-[12px] text-slate-500">Drag and drop files here</span>
              </label>
              <input id="crm-upf" type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.dwg" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-slate-500">เอกสารแนบ ({f.files.length})</span>
                <button onClick={() => setF((s) => ({ ...s, files: [...s.files, { name: "แบบแปลนหลังคา_ตัวอย่าง.pdf", size: "1.2 MB" }] }))} className={cn(btnGhost, "!px-3 !py-1.5 !text-[11.5px]")}>+ ใส่ไฟล์ตัวอย่าง</button>
              </div>
              <ul className="space-y-1.5">
                {f.files.map((x, k) => (
                  <li key={k} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12.5px]">
                    <Icon name="draft" className="text-slate-400" style={{ fontSize: 18 }} />
                    <span className="min-w-0 flex-1 truncate font-medium text-indigo-700">{x.name}</span>
                    <span className="text-[11px] text-slate-400">{x.size}</span>
                    <button onClick={() => setF((s) => ({ ...s, files: s.files.filter((_, i) => i !== k) }))} className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-slate-200" aria-label="ลบไฟล์"><Icon name="close" style={{ fontSize: 16 }} /></button>
                  </li>
                ))}
                {f.files.length === 0 && <li className="rounded-xl bg-slate-50 px-3 py-3 text-[12px] text-slate-500">ยังไม่มีไฟล์แนบ ต้องแนบอย่างน้อย 1 ไฟล์ก่อนสร้างงาน (หรือบันทึกร่างไว้ก่อนแล้วแนบภายหลังได้)</li>}
              </ul>
            </Sec>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className={cn(glass, "p-4")}>
            <h3 className="mb-1 text-[13px] font-bold text-slate-900">สรุปใบเปิดงาน</h3>
            <KV k="ลูกค้า" v={f.name.trim() ? `${f.name.trim()}${f.tel.trim() ? ` · ${f.tel.trim()}` : ""}` : "-"} />
            <KV k="ประเภทลูกค้า" v={f.ctype || "-"} />
            <KV k="หน้างาน" v={f.dist.trim() || f.prov.trim() ? `${f.dist.trim() || "-"}, ${f.prov.trim() || "-"}` : "-"} />
            <KV k="ร้าน" v={f.shop.trim() ? `${f.shop.trim()}${f.shopCode ? ` (${f.shopCode})` : ""}` : "-"} />
            <KV k="โมเดล" v={`${MODEL_LABEL[f.model]}`} />
            <KV k="มัดจำ" v={depText} />
            <KV k="Flow" v={`${SEGMENT_LABEL[segment]} · ${WORK_LABEL[work]}`} />
            <KV k="กำหนดรวมตาม PT" v={`${tot.total} วันทำการ`} />
          </section>
          <section className={cn(glass, "space-y-2 p-4")}>
            <h3 className="text-[13px] font-bold text-slate-900">ความครบถ้วน</h3>
            {[
              { ok: step1Ok, label: "Step 1–3 ข้อมูลลูกค้า/งาน", note: step1Ok ? "ครบ" : "ยังขาดช่องบังคับ" },
              { ok: miss.s4.length === 0, label: "Step 4 ข้อมูลส่งถอดแบบ", note: miss.s4.length ? `ขาด: ${miss.s4.join(", ")}` : "ครบ" },
              { ok: !miss.s5, label: "Step 5 เอกสาร", note: miss.s5 ? "ยังไม่มีไฟล์แนบ" : `แนบ ${f.files.length} ไฟล์` },
            ].map((r) => (
              <div key={r.label} className="flex items-start gap-2 text-[12px]">
                <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-white", r.ok ? "bg-emerald-500" : "bg-amber-400")}><Icon name={r.ok ? "check" : "priority_high"} style={{ fontSize: 12 }} /></span>
                <span><span className="font-semibold text-slate-800">{r.label}</span><span className="block text-slate-500">{r.note}</span></span>
              </div>
            ))}
            <p className="border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">{edit ? "แก้ไขแล้วกด \"บันทึกการแก้ไข\" ได้ทุกขั้น ข้อมูลที่ยังขาดเติมทีหลังได้" : "ข้อมูลยังไม่ครบ กด \"บันทึกร่าง\" ไว้ก่อนได้ แล้วกลับมากรอกต่อที่หน้ารายละเอียดงาน"}</p>
          </section>
        </aside>
      </div>

      <div className="sticky bottom-16 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8 lg:bottom-0">
        <div className="flex gap-2">
          <button onClick={onCancel} className={btnGhost}>ยกเลิก</button>
          {step > 1 && <button onClick={back} className={btnGhost}><Icon name="arrow_back" style={{ fontSize: 18 }} />ย้อนกลับ</button>}
        </div>
        <div className="flex gap-2">
          {edit ? (
            <>
              {step < 5 && <button onClick={next} className={btnGhost}>ถัดไป<Icon name="arrow_forward" style={{ fontSize: 18 }} /></button>}
              <button onClick={save} className={btnPrimary}><Icon name="save" style={{ fontSize: 18 }} />บันทึกการแก้ไข</button>
            </>
          ) : (
            <>
              <button onClick={save} className={btnGhost}><Icon name="draft" style={{ fontSize: 18 }} />บันทึกร่าง</button>
              {step < 5 ? <button onClick={next} className={btnPrimary}>ถัดไป<Icon name="arrow_forward" style={{ fontSize: 18 }} /></button>
                : <button onClick={create} className={btnPrimary}><Icon name="rocket_launch" style={{ fontSize: 18 }} />สร้างงาน</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
