"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { DataTable, money2, type TableDef } from "./data-table";
import { useSession } from "@/lib/commission/session";
import {
  applyUpload,
  getDataset,
  resetDataset,
  uploadedSections,
  type Dataset,
  type DatasetSection,
} from "@/lib/commission/dataset";
import { downloadSection, parseSection } from "@/lib/commission/excel";
import { storeTable, empTable } from "@/lib/commission/sales-table";
import {
  getSalesTeam,
  dealerByCode,
  getPointEmployees,
} from "@/lib/commission/logic";
import {
  addAdjustment,
  adjustmentTotal,
  getAdjustments,
  subscribeAdjustments,
} from "@/lib/commission/point-adjustments";
import { EventManagePanel } from "./event-manage-panel";
import { cn } from "@/lib/utils";

interface SectionDef {
  key: DatasetSection;
  index: number;
  title: string;
  icon: string;
  desc: string;
  feeds: string;
  counts: () => string[];
}

type UploadState = {
  status: "idle" | "loading" | "ok" | "error";
  summary: string[];
  errors: string[];
  fileName?: string;
};

export function DatabaseScreen() {
  const { session, ready } = useSession();
  // bump to force re-read of dataset counts after an upload/reset
  const [version, setVersion] = useState(0);
  const [uploads, setUploads] = useState<Record<DatasetSection, UploadState>>({
    staff: { status: "idle", summary: [], errors: [] },
    commission: { status: "idle", summary: [], errors: [] },
    points: { status: "idle", summary: [], errors: [] },
  });

  if (!ready || !session) return null;

  // เฉพาะผู้ดูแลระบบ (admin) เท่านั้น — ร้านค้าตัวแทนและพนักงานขายถูกบล็อก
  if (!session.isAdmin) {
    return (
      <>
        <SimpleHeader />
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
            <Icon name="lock" className="text-3xl" />
          </div>
          <p className="mt-3 text-[15px] font-bold text-slate-900">
            เฉพาะผู้ดูแลระบบ (Admin)
          </p>
          <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
            หน้าฐานข้อมูลใช้ได้เฉพาะบัญชีผู้ดูแลระบบเท่านั้น
            กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ
          </p>
          <Link
            href="/app/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#d32029]"
          >
            <Icon name="arrow_back" className="text-lg" />
            กลับหน้าภาพรวม
          </Link>
        </div>
        <BottomNav active="database" />
      </>
    );
  }

  const ds = getDataset();
  void version; // read after uploads to refresh counts
  const uploaded = uploadedSections();

  const sections: SectionDef[] = [
    {
      key: "staff",
      index: 1,
      title: "ฐานข้อมูลพนักงานและร้านค้า",
      icon: "groups",
      desc: "รายชื่อร้านค้าตัวแทน พนักงานขาย และรายการสินค้า/บริการ (ชีท: dealers, employees, solutions)",
      feeds: "ใช้ในหน้าภาพรวม และการวิเคราะห์",
      counts: () => [
        `ร้านค้า ${ds.dealers.length}`,
        `พนักงาน ${ds.salesTeam.length}`,
        `สินค้า/บริการ ${ds.solutions.length}`,
      ],
    },
    {
      key: "commission",
      index: 2,
      title: "ฐานข้อมูลค่าคอมมิชชัน",
      icon: "payments",
      desc: "รายการค่าคอมมิชชันจากไฟล์ดิบ แยกเป็น 2 ตาราง: ฝั่งร้านค้า (Commission) และฝั่งพนักงาน (Incentive) เนื่องจากคอลัมน์ผลประโยชน์/ผู้รับเงินต่างกัน",
      feeds: "ใช้ในหน้าภาพรวม และการวิเคราะห์",
      counts: () => [
        `ร้านค้า ${ds.sales.length.toLocaleString("th-TH")} แถว`,
        `พนักงาน ${ds.sales.length.toLocaleString("th-TH")} แถว`,
      ],
    },
    {
      key: "points",
      index: 3,
      title: "ฐานข้อมูลแต้มกิจกรรม",
      icon: "emoji_events",
      desc: "แต้มสะสมของบริษัทและพนักงาน (ชีท: companies, employees)",
      feeds: "ใช้ในหน้าแต้มกิจกรรม",
      counts: () => [
        `บริษัท ${ds.pointCompanies.length}`,
        `พนักงาน ${ds.pointEmployees.length}`,
      ],
    },
  ];

  async function handleFile(section: DatasetSection, file: File) {
    setUploads((u) => ({
      ...u,
      [section]: { status: "loading", summary: [], errors: [], fileName: file.name },
    }));
    try {
      const result = await parseSection(section, file);
      if (result.errors.length && result.summary.length === 0) {
        setUploads((u) => ({
          ...u,
          [section]: {
            status: "error",
            summary: [],
            errors: result.errors,
            fileName: file.name,
          },
        }));
        return;
      }
      applyUpload(section, result.data);
      setVersion((v) => v + 1);
      setUploads((u) => ({
        ...u,
        [section]: {
          status: "ok",
          summary: result.summary,
          errors: result.errors,
          fileName: file.name,
        },
      }));
    } catch (e) {
      setUploads((u) => ({
        ...u,
        [section]: {
          status: "error",
          summary: [],
          errors: ["อ่านไฟล์ไม่สำเร็จ: " + (e as Error).message],
          fileName: file.name,
        },
      }));
    }
  }

  return (
    <>
      <SimpleHeader />

      <div className="flex items-start space-x-2 mt-1 px-1">
        <Icon name="info" className="text-base text-[#d32029] mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          อัปโหลดไฟล์ Excel (.xlsx) เพื่อแทนที่ข้อมูลตัวอย่าง
          ข้อมูลที่เพิ่มจะถูกใช้แสดงในหน้าภาพรวม การวิเคราะห์ และแต้มกิจกรรมทันที
        </p>
      </div>

      <div className="space-y-4 mt-3">
        {sections.map((s) => (
          <UploadCard
            key={s.key}
            def={s}
            state={uploads[s.key]}
            usingUploaded={uploaded[s.key]}
            dataset={ds}
            onFile={(f) => handleFile(s.key, f)}
          />
        ))}
      </div>

      {/* เพิ่มแต้มให้พนักงาน (admin) */}
      <AddPointsPanel />

      {/* จัดการกิจกรรม (เช็คอินรับแต้ม) */}
      <EventManagePanel createdBy={session.me?.name ?? "admin"} />

      {/* Reset */}
      <button
        onClick={() => {
          resetDataset();
          setVersion((v) => v + 1);
          setUploads({
            staff: { status: "idle", summary: [], errors: [] },
            commission: { status: "idle", summary: [], errors: [] },
            points: { status: "idle", summary: [], errors: [] },
          });
        }}
        className="mt-5 w-full py-3 px-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center space-x-2 text-slate-600 font-semibold text-[13px] active:scale-[0.99] hover:border-red-200 transition"
      >
        <Icon name="restart_alt" className="text-lg" />
        <span>คืนค่าข้อมูลตัวอย่างเริ่มต้น</span>
      </button>

      <BottomNav active="database" />
    </>
  );
}

/* ---------- header ---------- */
function SimpleHeader() {
  return (
    <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
      <div className="flex items-center space-x-2.5">
        <Link
          href="/app/dashboard"
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 active:scale-95 transition"
        >
          <Icon name="arrow_back" className="text-xl" />
        </Link>
        <div className="flex flex-col">
          <span className="font-bold text-[15px] text-[#231313] leading-tight">
            ฐานข้อมูล
          </span>
          <span className="text-[11px] font-semibold text-[#b21e1e]">
            เฉพาะผู้ดูแลระบบ (Admin)
          </span>
        </div>
      </div>
      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#d32029]">
        <Icon name="database" className="text-xl" />
      </div>
    </header>
  );
}

/* ---------- table definitions per section ---------- */
function sectionTables(section: DatasetSection, ds: Dataset): TableDef[] {
  if (section === "staff") {
    // รวมร้านค้า + พนักงานเป็นตารางเดียว (1 แถว = พนักงาน 1 คน, ข้อมูลร้านต่อท้าย)
    // ร้านที่ยังไม่มีพนักงานจะแสดง 1 แถวโดยคอลัมน์พนักงานว่าง
    const staffRows: Record<string, unknown>[] = [];
    ds.dealers.forEach((d) => {
      const emps = ds.salesTeam.filter((e) => e.dealerCode === d.code);
      const dealerCells = {
        dealerCode: d.code,
        dealerName: d.name,
        branch: d.branch,
        model: d.model,
        tier: d.tier,
        taxId: d.taxId,
        pointCompanyCode: d.pointCompanyCode,
      };
      if (emps.length === 0) {
        staffRows.push({ ...dealerCells });
      } else {
        emps.forEach((e) => {
          staffRows.push({
            ...dealerCells,
            empId: e.id,
            empName: e.name,
            role: e.role,
            avatar: e.avatar,
            phone: e.phone,
          });
        });
      }
    });
    // พนักงานที่ dealerCode ไม่ตรงกับร้านใด (เผื่อข้อมูลอัปโหลดไม่ครบ)
    ds.salesTeam
      .filter((e) => !ds.dealers.some((d) => d.code === e.dealerCode))
      .forEach((e) => {
        staffRows.push({
          dealerCode: e.dealerCode ?? "",
          empId: e.id,
          empName: e.name,
          role: e.role,
          avatar: e.avatar,
          phone: e.phone,
        });
      });

    return [
      {
        name: "ร้านค้าและพนักงาน (dealers + employees)",
        columns: [
          // ---- ข้อมูลร้านค้า ----
          { key: "dealerCode", label: "รหัสร้าน (code)" },
          { key: "dealerName", label: "ชื่อร้าน" },
          { key: "branch", label: "สาขา" },
          { key: "model", label: "Model" },
          { key: "tier", label: "tier" },
          { key: "taxId", label: "taxId" },
          { key: "pointCompanyCode", label: "pointCompanyCode" },
          // ---- ข้อมูลพนักงาน ----
          { key: "empId", label: "รหัสพนักงาน (empId)" },
          { key: "empName", label: "ชื่อพนักงาน" },
          { key: "role", label: "ตำแหน่ง" },
          { key: "avatar", label: "avatar" },
          { key: "phone", label: "เบอร์โทร" },
        ],
        rows: staffRows,
      },
      {
        name: "สินค้า/บริการ (solutions)",
        columns: [
          { key: "id", label: "id" },
          { key: "group", label: "group" },
          { key: "name", label: "name" },
          { key: "category", label: "category" },
          { key: "rate", label: "rate" },
          { key: "icon", label: "icon" },
        ],
        rows: ds.solutions as unknown as Record<string, unknown>[],
      },
    ];
  }
  if (section === "commission") {
    const hasReal = ds.sales.some((s) => s.src !== undefined || s.commRate !== undefined);

    // ชุดข้อมูลจริง: แยกเป็น 2 ตารางตามไฟล์ดิบต้นฉบับ (ร้านค้า / พนักงาน)
    if (hasReal) {
      return [
        storeTable(ds.sales, ds, "รายการค่าคอมมิชชัน — ร้านค้า (Commission)"),
        empTable(ds.sales, ds, "รายการค่าคอมมิชชัน — พนักงาน (Incentive)"),
      ];
    }

    // ชุดข้อมูล mock/อัปโหลดที่ไม่มีค่าดิบ: ใช้คอลัมน์มาตรฐานเดิม
    const salesTotal = ds.sales.reduce(
      (a, s) => {
        a.amount += s.amount || 0;
        a.comm += (s as { comm?: number }).comm ?? 0;
        a.inc += (s as { inc?: number }).inc ?? 0;
        return a;
      },
      { amount: 0, comm: 0, inc: 0 }
    );
    return [
      {
        name: "รายการขาย (sales)",
        columns: [
          { key: "id", label: "รหัสรายการ (id)" },
          { key: "period", label: "รอบ (period)" },
          { key: "dealerCode", label: "รหัสร้าน (dealerCode)" },
          { key: "empId", label: "รหัสผู้รับเงิน (empId)" },
          { key: "solId", label: "กลุ่มงาน (solId)" },
          { key: "customer", label: "ลูกค้า (customer)" },
          { key: "amount", label: "ยอดขาย (amount)", format: money2 },
          { key: "comm", label: "ค่าคอมฯร้าน (comm)", format: money2 },
          { key: "inc", label: "อินเซนทีฟพนักงาน (inc)", format: money2 },
          { key: "status", label: "สถานะ (status)" },
          { key: "projectId", label: "เลขที่งาน (projectId)" },
          { key: "date", label: "วันที่ปิดขาย (date)" },
        ],
        rows: ds.sales as unknown as Record<string, unknown>[],
        footer: {
          id: "รวมทั้งหมด",
          amount: money2(salesTotal.amount),
          comm: money2(salesTotal.comm),
          inc: money2(salesTotal.inc),
        },
      },
    ];
  }
  // points
  return [
    {
      name: "บริษัท (companies)",
      columns: [
        { key: "code", label: "code" },
        { key: "name", label: "name" },
        { key: "model", label: "model" },
        { key: "region", label: "region" },
        { key: "points", label: "points" },
      ],
      rows: ds.pointCompanies as unknown as Record<string, unknown>[],
    },
    {
      name: "พนักงาน (employees)",
      columns: [
        { key: "empCode", label: "empCode" },
        { key: "name", label: "name" },
        { key: "companyCode", label: "companyCode" },
        { key: "avatar", label: "avatar" },
        { key: "points", label: "points" },
      ],
      rows: ds.pointEmployees as unknown as Record<string, unknown>[],
    },
  ];
}

/* ---------- upload card ---------- */
function UploadCard({
  def,
  state,
  usingUploaded,
  dataset,
  onFile,
}: {
  def: SectionDef;
  state: UploadState;
  usingUploaded: boolean;
  dataset: Dataset;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showData, setShowData] = useState(false);
  const tables = sectionTables(def.key, dataset);

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0 relative">
          <Icon name={def.icon} className="text-xl" />
          <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[#d32029] text-white text-[11px] font-bold flex items-center justify-center">
            {def.index}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-slate-900">{def.title}</h3>
            {usingUploaded && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                อัปโหลดแล้ว
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            {def.desc}
          </p>
          <p className="text-[10px] text-[#b21e1e] font-medium mt-1 flex items-center gap-1">
            <Icon name="link" style={{ fontSize: 13 }} />
            {def.feeds}
          </p>
        </div>
      </div>

      {/* current counts */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {def.counts().map((c, i) => (
          <span
            key={i}
            className="text-[11px] font-semibold text-slate-600 bg-[#faf8f8] border border-slate-200/70 px-2 py-0.5 rounded-md tnum"
          >
            {c}
          </span>
        ))}
      </div>

      {/* actions */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#d32029] to-[#c01f27] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition shadow-sm shadow-[#d32029]/20"
        >
          <Icon name="upload_file" className="text-lg" />
          เพิ่มไฟล์ Excel
        </button>
        <button
          onClick={() => downloadSection(def.key, dataset)}
          className="py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] hover:border-red-200 transition"
        >
          <Icon name="download" className="text-lg" />
          ดาวน์โหลดข้อมูล
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* feedback */}
      {state.status !== "idle" && (
        <div
          className={cn(
            "mt-3 rounded-xl px-3 py-2 text-[11px] border",
            state.status === "loading" && "bg-slate-50 border-slate-200 text-slate-500",
            state.status === "ok" && "bg-emerald-50 border-emerald-200 text-emerald-800",
            state.status === "error" && "bg-red-50 border-red-200 text-[#a11119]"
          )}
        >
          {state.fileName && (
            <p className="font-semibold flex items-center gap-1 truncate">
              <Icon
                name={
                  state.status === "loading"
                    ? "progress_activity"
                    : state.status === "ok"
                      ? "check_circle"
                      : "error"
                }
                style={{ fontSize: 14 }}
                className={state.status === "loading" ? "animate-spin" : ""}
              />
              {state.fileName}
            </p>
          )}
          {state.status === "loading" && <p className="mt-0.5">กำลังประมวลผล…</p>}
          {state.summary.map((s, i) => (
            <p key={i} className="mt-0.5 tnum">
              ✓ {s}
            </p>
          ))}
          {state.errors.map((e, i) => (
            <p key={i} className="mt-0.5">
              ⚠ {e}
            </p>
          ))}
        </div>
      )}

      {/* view data toggle */}
      <button
        onClick={() => setShowData((s) => !s)}
        className="mt-3 w-full py-2.5 px-3 rounded-xl bg-[#faf8f8] border border-slate-200 text-slate-700 text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] hover:border-red-200 transition"
      >
        <Icon name={showData ? "visibility_off" : "table_chart"} className="text-lg text-[#d32029]" />
        {showData ? "ซ่อนข้อมูล" : "ดูข้อมูล (ตาราง)"}
        <Icon
          name="expand_more"
          className={cn("text-lg text-slate-400 transition", showData && "rotate-180")}
        />
      </button>

      {showData && (
        <div className="mt-1">
          {tables.map((t) => (
            <DataTable key={t.name} table={t} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- เพิ่มแต้มให้พนักงาน (admin) ---------- */
function AddPointsPanel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"add" | "deduct">("add");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  // re-render เมื่อ adjustments เปลี่ยน
  const [, tick] = useState(0);
  useEffect(() => subscribeAdjustments(() => tick((n) => n + 1)), []);

  const team = getSalesTeam();
  const q = query.trim().toLowerCase();
  const matches = q
    ? team
        .filter(
          (e) =>
            e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];
  const selected = selectedId ? team.find((e) => e.id === selectedId) : null;
  const dealer = selected?.dealerCode ? dealerByCode(selected.dealerCode) : null;
  const history = selected ? getAdjustments(selected.id) : [];
  const addedTotal = selected ? adjustmentTotal(selected.id) : 0;
  // ยอดสะสมปัจจุบัน (ฐานจาก pointEmployees + ที่ปรับแล้ว) ใช้กันหักเกิน
  const basePoints = selected
    ? getPointEmployees().find((e) => e.empCode === selected.id)?.points ?? 0
    : 0;
  const currentTotal = basePoints + addedTotal;

  function submit() {
    if (!selected) return;
    const n = Math.abs(Number(points));
    const signed = mode === "deduct" ? -n : n;
    const res = addAdjustment({
      empCode: selected.id,
      empName: selected.name,
      points: signed,
      reason,
      byName: "ผู้ดูแลระบบ",
      currentBalance: currentTotal,
    });
    if (res.ok) {
      setMsg(
        `${mode === "deduct" ? "หัก" : "เพิ่ม"} ${n.toLocaleString("th-TH")} แต้ม${
          mode === "deduct" ? "จาก" : "ให้"
        } ${selected.name} แล้ว`
      );
      setPoints("");
      setReason("");
    } else {
      setMsg(res.error ?? "ดำเนินการไม่สำเร็จ");
    }
    setTimeout(() => setMsg(null), 3500);
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-4">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Icon name="add_circle" className="text-xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold text-slate-900">เพิ่ม / หักแต้มพนักงาน</h3>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            ค้นหาพนักงาน แล้วปรับแต้มได้ทันที (รวมเข้ายอดสะสม/อันดับ และคงเหลือของพนักงาน)
          </p>
        </div>
      </div>

      {/* ค้นหาพนักงาน */}
      <div className="relative mt-3">
        <Icon
          name="search"
          style={{ fontSize: 18 }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          placeholder="พิมพ์ชื่อ หรือรหัสพนักงาน (เช่น CR0001)"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-amber-300 focus:bg-white transition"
        />
      </div>

      {/* ผลค้นหา */}
      {q && !selected && (
        <div className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
          {matches.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-3">
              ไม่พบพนักงาน
            </p>
          ) : (
            matches.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-amber-50/40 transition"
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                  {e.avatar}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-700 truncate">
                    {e.name}
                  </span>
                  <span className="block text-[10px] text-slate-400">{e.id}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* panel ของพนักงานที่เลือก */}
      {selected && (
        <div className="mt-3 rounded-2xl border border-slate-100 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                {selected.avatar}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 truncate">
                  {selected.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {selected.id}
                  {dealer ? ` · ${dealer.name}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-slate-400 hover:text-slate-600 shrink-0 ml-2"
            >
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-2">
            แต้มสะสมปัจจุบัน{" "}
            <span className="tnum font-bold text-slate-700">
              {currentTotal.toLocaleString("th-TH")}
            </span>
            {addedTotal !== 0 && (
              <span className={addedTotal > 0 ? "text-emerald-600" : "text-[#dc2626]"}>
                {" "}
                (ปรับแล้ว {addedTotal > 0 ? "+" : "−"}
                {Math.abs(addedTotal).toLocaleString("th-TH")})
              </span>
            )}
          </p>

          {/* สลับโหมด เพิ่ม / หัก */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("add")}
              className={cn(
                "py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1 transition",
                mode === "add"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              <Icon name="add_circle" style={{ fontSize: 16 }} />
              เพิ่มแต้ม
            </button>
            <button
              type="button"
              onClick={() => setMode("deduct")}
              className={cn(
                "py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1 transition",
                mode === "deduct"
                  ? "bg-[#dc2626] text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              <Icon name="remove_circle" style={{ fontSize: 16 }} />
              หักแต้ม
            </button>
          </div>

          {/* ฟอร์มปรับแต้ม */}
          <div className="mt-2 space-y-2">
            <input
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder={mode === "deduct" ? "จำนวนแต้มที่หัก" : "จำนวนแต้มที่เพิ่ม"}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-amber-300 focus:bg-white transition"
            />
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === "deduct"
                  ? "เหตุผล (เช่น ปรับแก้ยอด)"
                  : "เหตุผล (เช่น โบนัสกิจกรรม)"
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-amber-300 focus:bg-white transition"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!(Number(points) > 0)}
              className={cn(
                "w-full py-2.5 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] disabled:opacity-50 transition",
                mode === "deduct" ? "bg-[#dc2626]" : "bg-[#16a34a]"
              )}
            >
              <Icon
                name={mode === "deduct" ? "remove_circle" : "add_circle"}
                style={{ fontSize: 18 }}
              />
              {mode === "deduct" ? "หักแต้ม" : "เพิ่มแต้ม"}
            </button>
          </div>

          {/* ประวัติการเพิ่มแต้ม */}
          {history.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                ประวัติการเพิ่มแต้ม
              </p>
              <ul className="space-y-1.5">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start justify-between text-[11px]">
                    <span className="min-w-0 text-slate-600">
                      <span className="truncate">{h.reason}</span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(h.time).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · โดย {h.byName}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "tnum font-bold shrink-0 ml-2",
                        h.points >= 0 ? "text-emerald-600" : "text-[#dc2626]"
                      )}
                    >
                      {h.points >= 0 ? "+" : "−"}
                      {Math.abs(h.points).toLocaleString("th-TH")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[12px] font-medium text-emerald-700 text-center">
          {msg}
        </div>
      )}
    </section>
  );
}
