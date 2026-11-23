"use client";
/* บันทึกขออนุมัติคืนเงินลูกค้า (พิมพ์ / บันทึก PDF แนบไปกับพัสดุ) — ใช้แทนบันทึกภายในแบบเดิม */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../icon";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/commission/session";
import { DOC_META, baht2, dateTh, fetchRefund, fmtTaxId, groupLabel, typeLabel, type RefundDetail } from "@/lib/commission/refund-store";
import { btn } from "../boq/boq-shared";

export function RefundMemoScreen({ id }: { id: number }) {
  const { ready } = useSession();
  const [r, setR] = useState<RefundDetail | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchRefund(id).then((x) => !cancelled && setR(x.item)).catch((e) => !cancelled && setErr(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    return () => { cancelled = true; };
  }, [ready, id]);
  if (!ready) return null;
  const approvedEvent = r ? [...r.events].reverse().find((e) => e.kind === "approved") : null;
  const latestDocs = r ? [...new Set(r.files.filter((f) => f.kind in DOC_META).map((f) => f.kind))] : [];
  return (
    <div className="w-full lg:max-w-3xl lg:mx-auto pb-8">
      <header className="flex items-center gap-2 py-3 print:hidden">
        <Link href={`/app/refund/${id}`} className="w-9 h-9 rounded-full bg-white border border-slate-200 grid place-items-center shrink-0" aria-label="กลับ"><Icon name="arrow_back" style={{ fontSize: 18 }} /></Link>
        <h1 className="font-bold text-[16px] text-[#231313]">บันทึกขออนุมัติคืนเงิน</h1>
      </header>
      {err && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12px] text-red-700">{err}</p>}
      {!r && !err && <p className="text-center text-[12px] text-slate-400 py-8">กำลังโหลด...</p>}
      {r && (
        <>
          <div className="bg-white border border-slate-300 rounded-lg p-6 text-[12.5px] text-slate-800 space-y-3 print:border-0 print:p-0">
            <div className="text-center">
              <p className="text-[15px] font-bold">บันทึกภายใน</p>
              <p className="font-semibold">ขออนุมัติคืนเงินลูกค้า — {typeLabel(r.refund_type)}</p>
              <p className="text-[11px] text-slate-500">เลขที่ {r.req_no} · วันที่ {dateTh(r.created_at)}{r.round > 1 ? ` · รอบที่ ${r.round}` : ""}</p>
            </div>
            <table className="w-full text-[12px]"><tbody>
              {[
                ["ผู้ขออนุมัติ", `${r.requester.name}${r.requester.email ? ` (${r.requester.email})` : ""}`],
                ["สังกัด", r.dealer_name ?? r.requester_unit ?? "-"],
                ["กลุ่มงาน", groupLabel(r.job_group)],
                [r.job_group === "roof" ? "Project / SO" : "Project", r.job_group === "roof" ? `${r.project_no} / ${r.so_no ?? "-"}` : r.project_no],
                ["ใบเสร็จ", r.receipt_no ?? "-"],
                ["โครงการ / หน้างาน", r.project_name ?? "-"],
                ["ลูกค้า", `${r.cust_name} (${fmtTaxId(r.cust_tax_id)})${r.cust_branch ? ` · ${r.cust_branch}` : ""}`],
                ["ยอดที่ลูกค้าชำระ", baht2(r.paid_amount)],
                ...(r.refund_type === "wht" ? [["ยอดก่อน VAT × อัตรา", `${baht2(r.wht_base)} × ${r.wht_rate}%`]] : []),
                ["จำนวนเงินที่ขอคืน", baht2(r.refund_amount)],
                ["สาเหตุการคืนเงิน", `${r.reason ?? "-"}${r.cancel_detail ? ` · ${r.cancel_detail}` : ""}`],
                ["โอนคืนเข้าบัญชี", `${r.bank_name} ${r.bank_account_no} ${r.bank_account_name}`],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100"><td className="py-1.5 pr-3 text-slate-500 w-40 align-top">{k}</td><td className="py-1.5">{v}</td></tr>
              ))}
            </tbody></table>
            <div>
              <p className="font-semibold">เอกสารประกอบ</p>
              <ul className="list-disc pl-5">{latestDocs.map((k) => <li key={k}>{DOC_META[k as keyof typeof DOC_META].label}</li>)}</ul>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 text-center text-[11.5px]">
              <div><p className="text-slate-500">ผู้ขออนุมัติ</p><p className="font-semibold mt-1">{r.requester.name}</p><p className="text-slate-500">{dateTh(r.created_at, true)}</p></div>
              <div><p className="text-slate-500">ผู้อนุมัติ</p>
                {r.approved_at
                  ? <><p className="font-semibold mt-1 text-emerald-700">✓ อนุมัติในระบบ</p><p className="font-semibold">{r.approver?.name ?? approvedEvent?.actor_name ?? "-"}</p><p className="text-slate-500">{dateTh(r.approved_at, true)}</p></>
                  : <p className="mt-1 text-amber-700">รออนุมัติ ({r.approver?.name ?? "-"})</p>}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => window.print()} className={cn(btn, "w-full mt-3 bg-slate-900 text-white print:hidden")}><Icon name="print" className="align-[-5px] mr-1" />พิมพ์ / บันทึก PDF</button>
        </>
      )}
    </div>
  );
}