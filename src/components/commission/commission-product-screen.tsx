"use client";

/* =============================================================
   หน้า Commission Product (ค่าคอมฯ สินค้า — ฝั่งพนักงาน/vendor)
   - เฉพาะร้านค้าตัวแทน (dealer) + ผู้ดูแลระบบ (admin ดูรวม/เจาะร้าน)
   - hero สรุป net (หัก 3%) + gross, รายเดือน, drill-down ราย vendor/สินค้า
   - server-authoritative ผ่าน /api/commission-product
   ============================================================= */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import { doLogout, useSession } from "@/lib/commission/session";
import { ProfileCard } from "./profile-card";
import { YearFilter, computeYearFilter } from "./year-filter";
import {
  fetchCommissionSummary,
  fetchCommissionMonthLines,
  type CommissionSummary,
  type CommissionMonth,
  type CommissionLine,
} from "@/lib/commission/commission-product-store";
import { downloadCommissionProduct, type CpExportRow } from "@/lib/commission/excel";

function baht(n: number): string {
  return "฿" + Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

const MONTH_TH = [
  "", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_TH[Number(m)] ?? m} ${Number(y) + 543}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ---------------- จัดกลุ่มช่วย (vendor -> sale) ---------------- */
interface Group {
  key: string;
  name: string;
  gross: number;
  net: number;
  count: number;
  lines: CommissionLine[];
}
function groupBy(
  lines: CommissionLine[],
  keyFn: (l: CommissionLine) => string,
  nameFn: (l: CommissionLine) => string
): Group[] {
  const map = new Map<string, Group>();
  for (const l of lines) {
    const key = keyFn(l) || "-";
    const g = map.get(key) ?? { key, name: nameFn(l) || "-", gross: 0, net: 0, count: 0, lines: [] };
    g.gross += l.gross;
    g.net += l.net;
    g.count++;
    g.lines.push(l);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

/* ---------------- modal drill-down 3 ชั้น: ผู้รับเงิน -> พนักงานขาย -> รายการ ---------------- */
function MonthDetailModal({
  dealerCode,
  month,
  onClose,
}: {
  dealerCode: string | null;
  month: CommissionMonth;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<CommissionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorKey, setVendorKey] = useState<string | null>(null);
  const [saleKey, setSaleKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCommissionMonthLines(dealerCode, month.period)
      .then((l) => {
        if (!cancelled) setLines(l);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealerCode, month.period]);

  const vendors = groupBy(lines, (l) => l.vendorCode ?? "", (l) => l.vendorName ?? "ไม่ระบุผู้รับเงิน");
  const curVendor = vendorKey ? vendors.find((v) => v.key === vendorKey) ?? null : null;
  const sales = curVendor
    ? groupBy(curVendor.lines, (l) => l.saleName ?? "", (l) => l.saleName ?? "ไม่ระบุพนักงานขาย")
    : [];
  const curSale = saleKey ? sales.find((s) => s.key === saleKey) ?? null : null;

  const level = curSale ? 4 : curVendor ? 3 : 2;
  const title = level === 2 ? "ผู้รับเงิน" : level === 3 ? "พนักงานขาย" : "รายการ";
  function back() {
    if (saleKey) setSaleKey(null);
    else if (vendorKey) setVendorKey(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header + breadcrumb */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {level > 2 && (
                <button
                  type="button"
                  onClick={back}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 shrink-0"
                >
                  <Icon name="arrow_back" style={{ fontSize: 16 }} />
                </button>
              )}
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 truncate">
                  {periodLabel(month.period)} · {title}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {level === 2 && `ผู้รับเงิน ${vendors.length} ราย · รวม ${baht(month.net)}`}
                  {level === 3 && curVendor && `${curVendor.name} · พนักงานขาย ${sales.length} คน`}
                  {level === 4 && curSale && `${curSale.name} · ${curSale.count} รายการ`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95 shrink-0"
            >
              <Icon name="close" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="p-3">
          {loading ? (
            <p className="text-[12px] text-slate-400 text-center py-6">กำลังโหลด...</p>
          ) : lines.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-6">ไม่มีรายการ</p>
          ) : level === 2 ? (
            /* ชั้น 2: ผู้รับเงิน (vendor) */
            <div className="space-y-2">
              {vendors.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setVendorKey(v.key)}
                  className="w-full text-left rounded-xl border border-slate-100 p-3 flex items-center justify-between active:scale-[0.99] hover:border-red-200 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                      <Icon name="account_balance_wallet" style={{ fontSize: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{v.name}</p>
                      <p className="text-[10px] text-slate-400">ผู้รับเงิน · {v.count} รายการ</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tnum text-[14px] font-bold text-[#a11119]">{baht(v.net)}</p>
                    <p className="text-[10px] text-slate-400">ก่อนหัก {baht(v.gross)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : level === 3 ? (
            /* ชั้น 3: พนักงานขาย (sale_name) */
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 px-1">ยอดที่ต้องกระจายให้พนักงานขาย</p>
              {sales.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSaleKey(s.key)}
                  className="w-full text-left rounded-xl border border-slate-100 p-3 flex items-center justify-between active:scale-[0.99] hover:border-red-200 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Icon name="person" style={{ fontSize: 18 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400">พนักงานขาย · {s.count} รายการ</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="tnum text-[14px] font-bold text-[#a11119]">{baht(s.net)}</p>
                    <p className="text-[10px] text-slate-400">ก่อนหัก {baht(s.gross)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* ชั้น 4: รายละเอียดรายการของพนักงานขายคนนั้น */
            <div className="space-y-2">
              {(curSale?.lines ?? []).map((l, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-slate-800 flex-1 min-w-0">
                      {l.itemName ?? "-"}
                    </p>
                    <span className="tnum text-[12px] font-bold text-[#a11119] shrink-0">
                      {baht(l.net)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                    <span>{l.docNo ?? "-"} · ยอดขาย {baht(l.netAmount)} · {l.qty ?? 0} หน่วย</span>
                    <span>{fmtDate(l.salesDate)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">ก่อนหัก 3% {baht(l.gross)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommissionProductScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CommissionMonth | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // dealer -> ร้านตัวเอง; admin -> storeFilter (null = ทุกร้าน); sales ไม่เกี่ยว
  const dealerCode = session
    ? session.isAdmin
      ? session.storeFilter
      : session.isSales
        ? null
        : session.dealer.code
    : null;

  async function handleDownload(monthsToExport: CommissionMonth[]) {
    if (downloading || monthsToExport.length === 0) return;
    setDownloading(true);
    try {
      const all = await Promise.all(
        monthsToExport.map((m) =>
          fetchCommissionMonthLines(dealerCode, m.period).then((lines) =>
            lines.map((l) => ({ ...l, period: m.period }) as CpExportRow)
          )
        )
      );
      downloadCommissionProduct(all.flat());
    } catch {
      /* เงียบไว้ */
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    if (ready && session && session.isSales) {
      router.replace("/app/member");
    }
  }, [ready, session, router]);

  useEffect(() => {
    let cancelled = false;
    fetchCommissionSummary(dealerCode)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealerCode]);

  if (!ready || !session) return null;
  if (session.isSales) return null;

  const allMonths = summary?.months ?? [];
  const totalNet = summary?.totalNet ?? 0;
  const totalGross = summary?.totalGross ?? 0;
  const paidMonths = allMonths.filter((m) => m.paidDate != null).length;
  // กรองปี (auto-show เมื่อ >1 ปี)
  const yf = computeYearFilter(allMonths, selectedYear);
  const months = yf.filtered;

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between py-3 sticky top-0 bg-[#f7f4f4]/90 backdrop-blur z-20">
        <div className="flex items-center space-x-2.5">
          <Link
            href="/app/dashboard"
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#a11119] active:scale-95 transition"
          >
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-bold text-[16px] text-[#231313]">ค่าคอมฯ สินค้า (พนักงาน)</span>
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

      <div className="space-y-4 pb-4">
        {/* การ์ดโปรไฟล์สมาชิก */}
        <ProfileCard />

        {/* Hero สรุปรวม */}
        <section className="rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-5 text-white shadow-lg shadow-[#d32029]/25 relative overflow-hidden animate-fade-up">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] text-red-100/90 flex items-center gap-1.5">
                <Icon name="payments" style={{ fontSize: 16 }} />
                ค่าคอมฯ สินค้าสะสม (จ่ายจริง หลังหัก 3%)
                {session.isAdmin && !session.storeFilter ? " · ทุกร้าน" : ""}
              </p>
              <button
                type="button"
                onClick={() => handleDownload(months)}
                disabled={downloading || months.length === 0}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 hover:bg-white/25 text-white px-2.5 py-1 rounded-full border border-white/25 active:scale-95 transition disabled:opacity-50"
              >
                <Icon
                  name={downloading ? "progress_activity" : "download"}
                  className={downloading ? "animate-spin" : ""}
                  style={{ fontSize: 14 }}
                />
                {downloading ? "กำลังเตรียม..." : "ดาวน์โหลดข้อมูล"}
              </button>
            </div>
            <p className="tnum text-[36px] font-bold leading-none mt-1">{baht(totalNet)}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">ก่อนหัก 3%</p>
                <p className="tnum text-[15px] font-bold">{baht(totalGross)}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur-md px-3 py-2">
                <p className="text-[11px] text-red-100/80">จ่ายแล้ว</p>
                <p className="tnum text-[15px] font-bold">{paidMonths} เดือน</p>
              </div>
            </div>
          </div>
        </section>

        {/* ตัวกรองปี (โผล่เมื่อมี >1 ปี) */}
        <YearFilter years={yf.years} activeYear={yf.activeYear} onSelect={setSelectedYear} />

        {/* รายเดือน */}
        <section>
          <h3 className="text-[15px] font-bold text-slate-900 mb-2.5 flex items-center gap-1.5">
            <Icon name="calendar_month" className="text-lg text-[#d32029]" />
            ค่าคอมฯ สินค้า สำหรับพนักงาน รายเดือน
            {yf.multiYear && yf.activeYear && (
              <span className="text-[12px] font-semibold text-slate-400">
                · ปี {Number(yf.activeYear) + 543}
              </span>
            )}
          </h3>

          {loading ? (
            <div className="py-8 text-center text-slate-300">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : months.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-[#d32029] flex items-center justify-center">
                <Icon name="payments" className="text-2xl" />
              </div>
              <p className="mt-2 text-[13px] text-slate-500">ยังไม่มีข้อมูลค่าคอมฯ สินค้าสำหรับร้านนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {months.map((m) => {
                const paid = m.paidDate != null;
                return (
                  <button
                    key={m.period}
                    type="button"
                    onClick={() => setDetail(m)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 active:scale-[0.99] hover:border-red-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
                          <Icon name="payments" className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-slate-900">
                            {periodLabel(m.period)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {m.lineCount.toLocaleString()} รายการ · พนักงาน {m.vendorCount} คน
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="tnum text-[16px] font-bold text-[#a11119] leading-none">
                          {baht(m.net)}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          ก่อนหัก {baht(m.gross)}
                        </p>
                        <p className="text-[10px] mt-0.5">
                          {paid ? (
                            <span className="text-emerald-600 font-semibold">
                              จ่ายแล้ว {fmtDate(m.paidDate)}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold">รอจ่าย</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-1.5 text-[10px] text-slate-400 gap-1">
                      ดูผู้รับเงิน › พนักงานขาย › รายการ
                      <Icon name="chevron_right" style={{ fontSize: 14 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">
          ค่าคอมฯ สินค้าจ่ายให้พนักงาน (หัก ณ ที่จ่าย 3%) · อิงข้อมูลที่อนุมัติทำจ่ายแล้ว
        </p>
      </div>

      {detail && (
        <MonthDetailModal dealerCode={dealerCode} month={detail} onClose={() => setDetail(null)} />
      )}

      <BottomNav active="commissionProduct" />
    </>
  );
}
