"use client";
/* ฟอร์มขอ BOQ สินค้า DECAAR (พนักงานขายเท่านั้น) — ไฟล์แนบอัปโหลดทันทีที่เลือก แล้วส่งพร้อมคำขอ */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import {
  BUILDING_TYPES, CUST_TYPES, JOB_TYPES, NEEDS, SLA_DAYS, createBoq, fetchBoqProducts, fmtNum,
  type BoqProduct, type BoqRecorder, type UploadedFile,
} from "@/lib/commission/boq-store";
import { BoqHeader, Chips, FileUploader, Section, btn, inputCls, labelCls } from "./boq-shared";

type Point = { key: number; code: string; length: string; width: string; detail: string };
const opt = (l: string[]) => l.map((x) => ({ key: x, label: x }));
const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** รูปตัวอย่าง: รูปย่อ แตะเพื่อดูเต็มจอ (แตะอีกครั้งเพื่อปิด) */
function ExampleImage({ src, caption }: { src: string; caption: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-2 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element -- รูปตัวอย่างใน public */}
        <img src={src} alt={caption} className="w-24 h-16 object-cover rounded-lg border border-white shadow-sm shrink-0" />
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-sky-800 flex items-center gap-1"><Icon name="image_search" style={{ fontSize: 16 }} />ดูรูปตัวอย่าง</p>
          <p className="text-[10.5px] text-slate-600 leading-snug">{caption}</p>
        </div>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-3" onClick={() => setOpen(false)} role="dialog" aria-label={caption}>
          {/* eslint-disable-next-line @next/next/no-img-element -- รูปตัวอย่างใน public */}
          <img src={src} alt={caption} className="max-w-full max-h-[80vh] object-contain rounded-lg bg-white" />
          <p className="text-[12px] text-white/90 mt-3 text-center">{caption}</p>
          <p className="text-[11px] text-white/60 mt-1">แตะที่ใดก็ได้เพื่อปิด · ซูมด้วยสองนิ้วได้</p>
        </div>
      )}
    </>
  );
}

const OLD_MENU = "สินค้าเดิมของคำขอนี้ (เลิกแสดงแล้ว)";
const menuOf = (p: BoqProduct) => p.menu ?? OLD_MENU;

/** เลือกสินค้า 2 ขั้น: กลุ่มสินค้า (dropdown 18 กลุ่ม) -> รุ่น/สีในกลุ่ม (ค้นหาได้) */
export function ProductPicker({ products, value, onPick }: { products: BoqProduct[]; value: string; onPick: (code: string) => void }) {
  const prod = products.find((p) => p.code === value);
  const [open, setOpen] = useState(!value);
  const [menu, setMenu] = useState(prod ? menuOf(prod) : "");
  const [q, setQ] = useState("");
  const menus = useMemo(() => {
    const m = new Map<string, { label: string; sort: number; n: number }>();
    for (const p of products) {
      const label = menuOf(p);
      const cur = m.get(label) ?? { label, sort: p.menu ? (p.menu_sort ?? 999) : 1000, n: 0 };
      cur.n++;
      m.set(label, cur);
    }
    return [...m.values()].sort((a, b) => a.sort - b.sort);
  }, [products]);
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase();
    const inMenu = products.filter((p) => menuOf(p) === menu);
    return k ? inMenu.filter((p) => `${p.code} ${p.name} ${p.sub ?? ""}`.toLowerCase().includes(k)) : inMenu;
  }, [q, menu, products]);
  if (prod && !open) {
    return (
      <button type="button" onClick={() => { setMenu(menuOf(prod)); setOpen(true); }} className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold text-slate-500">{menuOf(prod)}</p>
        <p className="text-[13px] font-semibold text-slate-800 mt-0.5">{prod.name}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          รหัส {prod.code}
          {prod.size ? ` · ${prod.size} ซม.` : ""} · {prod.unit === "m" ? "ความยาว (ม.)" : "กว้าง × ยาว"}
        </p>
        <p className="text-[11px] text-[#d32029] mt-1 font-semibold">แตะเพื่อเปลี่ยนสินค้า</p>
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[11px] font-semibold text-slate-500 mb-1">1. กลุ่มสินค้า</p>
        <select value={menu} onChange={(e) => { setMenu(e.target.value); setQ(""); }} className={cn(inputCls, "bg-white")}>
          <option value="">— เลือกกลุ่มสินค้า —</option>
          {menus.map((m) => (
            <option key={m.label} value={m.label}>{m.label} ({m.n})</option>
          ))}
        </select>
      </div>
      {menu && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 mb-1">2. รุ่น / สี</p>
          {hits.length > 8 || q ? (
            <div className="relative mb-2">
              <Icon name="search" className="absolute left-3 top-2.5 text-slate-400" style={{ fontSize: 18 }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารุ่น / สี / ขนาด / รหัส" className={cn(inputCls, "pl-9")} />
            </div>
          ) : null}
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white">
            {hits.map((p) => (
              <button key={p.code} type="button" onClick={() => { onPick(p.code); setOpen(false); setQ(""); }} className={cn("w-full text-left px-3 py-2 hover:bg-red-50", p.code === value && "bg-red-50")}>
                <p className="text-[12px] font-medium text-slate-800">{p.name}</p>
                <p className="text-[10px] text-slate-500">{p.code}{p.sub ? ` · ${p.sub}` : ""} · {p.unit === "m" ? "ความยาว (ม.)" : "กว้าง × ยาว"}</p>
              </button>
            ))}
            {hits.length === 0 && <p className="text-[12px] text-slate-400 p-3 text-center">ไม่พบสินค้า</p>}
          </div>
        </div>
      )}
      {prod && (
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-slate-500 underline">ใช้สินค้าเดิม</button>
      )}
      <p className="text-[10px] text-slate-400">ไม่รวมอุปกรณ์ (คลิป กาว สกรู สี) ห้องแบบใส่ใน BOQ ให้</p>
    </div>
  );
}

export function BoqFormScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<BoqProduct[]>([]);
  const [recorder, setRecorder] = useState<BoqRecorder | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [email, setEmail] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [custType, setCustType] = useState("");
  const [custOther, setCustOther] = useState("");
  const [jobType, setJobType] = useState("");
  const [building, setBuilding] = useState("");
  const [need, setNeed] = useState("");
  const [points, setPoints] = useState<Point[]>([{ key: 1, code: "", length: "", width: "", detail: "" }]);
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [plans, setPlans] = useState<UploadedFile[]>([]);
  const [budget, setBudget] = useState("");
  const [wantDate, setWantDate] = useState("");
  const [note, setNote] = useState("");
  const [opNo, setOpNo] = useState("");
  const [busy, setBusy] = useState(0);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  useEffect(() => {
    if (ready && session && !session.isSales) router.replace("/app/boq");
  }, [ready, session, router]);
  useEffect(() => {
    let cancelled = false;
    fetchBoqProducts()
      .then((d) => {
        if (cancelled) return;
        setProducts(d.products);
        setRecorder(d.recorder);
      })
      .catch((e) => !cancelled && setLoadErr(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, []);

  const unitOf = (code: string) => products.find((p) => p.code === code)?.unit;
  const budgetNum = num(budget);
  const missing = [
    !customer.trim() && "ชื่อลูกค้า",
    !custType && "ประเภทลูกค้า",
    custType === "อื่นๆ" && !custOther.trim() && "ระบุประเภทลูกค้า",
    !jobType && "ประเภทงาน",
    !building && "ประเภทอาคาร",
    !need && "ความต้องการ",
    points.some((p) => !p.code) && "สินค้าทุกจุด",
    points.some((p) => p.code && (!(num(p.length) > 0) || (unitOf(p.code) === "area" && !(num(p.width) > 0)))) && "พื้นที่ทุกจุด",
    photos.length === 0 && "รูปจุดที่ใช้สินค้า",
    plans.length === 0 && "แบบแปลน",
    !(budgetNum > 0) && "งบประมาณ",
    recorder && !recorder.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && "Email ผู้บันทึก",
  ].filter(Boolean) as string[];

  const submit = async () => {
    setTried(true);
    setSaveErr("");
    if (missing.length || busy) return;
    setSaving(true);
    try {
      const r = await createBoq({
        customerName: customer,
        customerPhone: phone,
        province,
        customerType: custType,
        customerTypeOther: custOther,
        jobType,
        buildingType: building,
        need,
        budget: budgetNum,
        wantDate: wantDate || undefined,
        note,
        opNo,
        recorderEmail: email,
        points: points.map((p) => ({ productCode: p.code, length: num(p.length), width: unitOf(p.code) === "area" ? num(p.width) : undefined, detail: p.detail })),
        files: [...photos, ...plans],
      });
      router.replace(`/app/boq/${r.id}`);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
      setSaving(false);
    }
  };

  if (!ready || !session?.isSales) return null;
  const setPoint = (i: number, patch: Partial<Point>) => setPoints((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const onBusy = (b: boolean) => setBusy((n) => Math.max(0, n + (b ? 1 : -1)));

  return (
    <>
      <BoqHeader title="สร้างคำขอ BOQ DECAAR" back="/app/boq" />
      <div className="space-y-3 pb-6">
        {loadErr && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">โหลดรายการสินค้าไม่สำเร็จ: {loadErr}</p>}

        <Section no="1-3" title="ผู้บันทึกข้อมูล" hint="ระบบดึงจากบัญชีพนักงานที่เข้าระบบ">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] text-slate-500">ร้านที่สังกัด</p>
            <p className="text-[13px] font-semibold text-slate-800">{recorder ? `${recorder.dealerName} (${recorder.dealerCode})` : "…"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] text-slate-500">ชื่อ-นามสกุลผู้บันทึก</p>
            <p className="text-[13px] font-semibold text-slate-800">{recorder?.name ?? "…"}</p>
          </div>
          {recorder?.email ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-[10px] text-slate-500">Email ผู้บันทึก</p>
              <p className="text-[13px] font-semibold text-slate-800">{recorder.email}</p>
            </div>
          ) : recorder ? (
            <div>
              <label className={labelCls}>Email ผู้บันทึก</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="ยังไม่มีในระบบ — กรอกครั้งแรก ระบบจะจำไว้" className={inputCls} />
            </div>
          ) : null}
        </Section>

        <Section no="4" title="ข้อมูลลูกค้า">
          <div>
            <label className={labelCls}>ชื่อ-นามสกุลลูกค้า</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={120} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>เบอร์โทร</label>
              <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>จังหวัดหน้างาน</label>
              <input value={province} onChange={(e) => setProvince(e.target.value)} maxLength={60} className={inputCls} />
            </div>
          </div>
        </Section>

        <Section no="5" title="ประเภทลูกค้า">
          <Chips options={opt(CUST_TYPES)} value={custType} onChange={setCustType} />
          {custType === "อื่นๆ" && <input value={custOther} onChange={(e) => setCustOther(e.target.value)} placeholder="ระบุ" maxLength={100} className={inputCls} />}
        </Section>
        <Section no="6" title="ประเภทงาน"><Chips options={opt(JOB_TYPES)} value={jobType} onChange={setJobType} /></Section>
        <Section no="7" title="ประเภทอาคาร"><Chips options={opt(BUILDING_TYPES)} value={building} onChange={setBuilding} /></Section>
        <Section no="8" title="ความต้องการของลูกค้า">
          <Chips options={NEEDS} value={need} onChange={setNeed} />
          {need && <p className="text-[11px] text-slate-500">ห้องแบบต้องส่งภายใน <b>{SLA_DAYS(need)} วันทำการ</b> (ไม่นับเสาร์-อาทิตย์และวันหยุด)</p>}
        </Section>

        <Section no="9" title={`จุดที่ต้องการทำ BOQ (${points.length} จุด)`} hint="เลขจุดให้ตรงกับเลขที่เขียนบนรูปข้อ 10">
          {points.map((p, i) => {
            const unit = unitOf(p.code);
            const qty = unit === "area" ? num(p.width) * num(p.length) : num(p.length);
            return (
              <div key={p.key} className="rounded-2xl border-2 border-slate-200 p-3 space-y-3 bg-white">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white text-[13px] font-bold grid place-items-center">{i + 1}</span>
                  <p className="text-[13px] font-bold text-slate-800">จุดที่ {i + 1}</p>
                  {points.length > 1 && (
                    <button type="button" onClick={() => setPoints((a) => a.filter((_, j) => j !== i))} className="ml-auto text-slate-400 hover:text-red-600" aria-label="ลบจุด">
                      <Icon name="delete" style={{ fontSize: 20 }} />
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelCls}>สินค้า</label>
                  <ProductPicker products={products} value={p.code} onPick={(code) => setPoint(i, { code, length: "", width: "" })} />
                </div>
                {unit && (
                  <div>
                    <label className={labelCls}>
                      พื้นที่งาน · <span className="text-[#d32029]">{unit === "m" ? "เมตร (ความยาว)" : "กว้าง × ยาว (เมตร)"}</span>{" "}
                      <span className="font-normal text-slate-400">(ตามสินค้า)</span>
                    </label>
                    {unit === "area" ? (
                      <div className="flex items-center gap-2">
                        <input inputMode="decimal" value={p.width} onChange={(e) => setPoint(i, { width: e.target.value })} placeholder="กว้าง (ม.)" className={inputCls} />
                        <span className="text-slate-400">×</span>
                        <input inputMode="decimal" value={p.length} onChange={(e) => setPoint(i, { length: e.target.value })} placeholder="ยาว (ม.)" className={inputCls} />
                      </div>
                    ) : (
                      <input inputMode="decimal" value={p.length} onChange={(e) => setPoint(i, { length: e.target.value })} placeholder="ความยาวรวม (ม.)" className={inputCls} />
                    )}
                    {qty > 0 && <p className="text-[12px] text-emerald-700 font-semibold mt-1.5">= {fmtNum(qty)} {unit === "area" ? "ตร.ม." : "ม."}</p>}
                  </div>
                )}
                <div>
                  <label className={labelCls}>รายละเอียด (ถ้ามี)</label>
                  <input value={p.detail} onChange={(e) => setPoint(i, { detail: e.target.value })} maxLength={300} placeholder="เช่น สี Warm Grey, ผิว Smooth, ติดตั้งแนวตั้ง" className={inputCls} />
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setPoints((a) => [...a, { key: Date.now(), code: "", length: "", width: "", detail: "" }])}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#d32029]/40 text-[#d32029] text-[13px] font-bold"
          >
            + เพิ่มจุด
          </button>
        </Section>

        <Section no="10" title="รูปจุดที่ใช้สินค้า" hint="ใส่เลขจุดบนรูปให้ตรงกับข้อ 9">
          <ExampleImage src="/boq/example-photo.jpg" caption="เขียนเลขจุดบนรูปให้ตรงกับข้อ 9 พร้อมชื่อสินค้า / สี / หมายเหตุการติดตั้ง" />
          <FileUploader kind="photo" label="แนบรูป / ถ่ายรูป" hint="หลายรูปได้ · ระบบย่อรูปก่อนส่ง" accept="image/*" files={photos} onChange={setPhotos} onBusy={onBusy} />
        </Section>
        <Section no="11" title="แบบแปลนพื้นที่">
          <ExampleImage src="/boq/example-plan.jpg" caption="แบบแปลน / รูปด้าน ที่มีระยะกว้าง-ยาว-สูง กำกับชัดเจน" />
          <FileUploader kind="plan" label="แนบแบบแปลน" hint="รูปหรือ PDF" accept="image/*,application/pdf" files={plans} onChange={setPlans} onBusy={onBusy} />
        </Section>
        {/* "แบบเดิมจากลูกค้า (ถ้ามี)" ซ่อนไว้ตามที่ผู้ใช้ขอ (API ยังรองรับ kind old_design) */}
        <Section no="12" title="งบประมาณของลูกค้า (บาท)">
          <input
            inputMode="numeric"
            value={budget}
            onChange={(e) => {
              const n = e.target.value.replace(/[^\d]/g, "");
              setBudget(n ? Number(n).toLocaleString("th-TH") : "");
            }}
            placeholder="เช่น 150,000"
            className={cn(inputCls, "text-[16px] font-semibold")}
          />
        </Section>

        <Section title="ข้อมูลเพิ่มเติม">
          <div>
            <label className={labelCls}>วันที่ต้องการรับ BOQ / วันนัดลูกค้า</label>
            <input type="date" value={wantDate} onChange={(e) => setWantDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>หมายเหตุถึงห้องแบบ</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="เช่น ติดตั้งแนวตั้ง เข้าโครงเหล็กหน้างาน" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>เลข Opportunity (CRM) ถ้ามี</label>
            <input value={opNo} onChange={(e) => setOpNo(e.target.value)} maxLength={40} placeholder="OP2026…" className={inputCls} />
          </div>
        </Section>

        {tried && missing.length > 0 && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">ยังขาด: {missing.join(", ")}</div>}
        {saveErr && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">{saveErr}</div>}
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/app/boq")} className={cn(btn, "bg-white border border-slate-200 text-slate-600")}>ยกเลิก</button>
          <button type="button" onClick={submit} disabled={saving || busy > 0} className={cn(btn, "flex-1 bg-[#d32029] text-white")}>
            {saving ? "กำลังส่ง..." : busy > 0 ? "รออัปโหลดไฟล์..." : "ส่งคำขอให้ห้องแบบ"}
          </button>
        </div>
      </div>
    </>
  );
}
