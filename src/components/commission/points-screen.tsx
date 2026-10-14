"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import {
  getPointEmployees,
  pointsRankCompanies,
  pointsRankEmployees,
  myPointEmpCode,
} from "@/lib/commission/logic";
import { useSession } from "@/lib/commission/session";
import { cn } from "@/lib/utils";

function fmtPts(n: number): string {
  return Number(n).toLocaleString("th-TH") + " แต้ม";
}

interface RankRow {
  key: string;
  name: string;
  sub: string;
  avatar: string;
  points: number;
  rank: number;
  companyName?: string;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PODIUM_META: Record<
  number,
  { h: string; medal: string; mColor: string; ring: string }
> = {
  1: { h: "h-24", medal: "🥇", mColor: "#fbbf24", ring: "ring-amber-300" },
  2: { h: "h-16", medal: "🥈", mColor: "#cbd5e1", ring: "ring-slate-300" },
  3: { h: "h-12", medal: "🥉", mColor: "#d97706", ring: "ring-orange-300" },
};

export function PointsScreen() {
  const { session, ready } = useSession();
  if (!ready || !session) return null;

  const isSales = session.isSales;
  // ผู้ดูแลระบบที่ดูทุกร้าน = ไม่กรองตาม Model (เห็นทุก Model); ถ้าเจาะร้าน = ตาม Model ร้านนั้น
  const model =
    session.isAdmin && !session.storeFilter ? undefined : session.dealer.model;

  let ranked: RankRow[];
  let myKey: string | null;

  if (isSales) {
    const rows = pointsRankEmployees(model);
    myKey = myPointEmpCode(session.empId);
    ranked = rows.map((r) => ({
      key: r.empCode,
      name: r.name,
      sub: (r.companyName ? "🏪 " + r.companyName + " · " : "") + r.empCode,
      avatar: r.avatar,
      points: r.points,
      rank: r.rank,
      companyName: r.companyName,
    }));
  } else {
    const rows = pointsRankCompanies(model);
    myKey = session.dealer.code;
    ranked = rows.map((r) => ({
      key: r.code,
      name: r.name,
      sub: r.model + " · " + r.region,
      avatar: r.name.replace("บจก.", ""),
      points: r.points,
      rank: r.rank,
    }));
  }

  const top3 = ranked.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const mine = ranked.find((r) => myKey && r.key === myKey);

  return (
    <>
      {/* Header */}
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
              แต้มกิจกรรม
            </span>
            <span className="text-[11px] font-semibold text-[#b21e1e]">
              {(isSales ? "จัดอันดับพนักงานขาย" : "จัดอันดับร้านค้า") +
                " · " +
                (model ? "Model " + model : "ทุก Model")}
            </span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#d32029]">
          <Icon name="emoji_events" className="text-xl" />
        </div>
      </header>

      {/* สรุป "อันดับของฉัน" — เห็นชัดโดยไม่ต้องเลื่อนหา */}
      {mine && (
        <section className="rounded-2xl bg-white border border-red-100 shadow-sm p-3.5 mt-1 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center font-bold text-[13px]">
                {mine.avatar}
              </div>
              {mine.rank <= 3 && (
                <span className="absolute -top-1.5 -right-1.5 text-[15px]">
                  {MEDAL[mine.rank]}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400">
                อันดับของฉัน
              </p>
              <p className="text-[14px] font-bold text-slate-800 truncate">
                {mine.name}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="tnum text-[22px] font-bold text-[#a11119] leading-none">
              #{mine.rank}
              <span className="text-[12px] font-medium text-slate-400">
                {" "}/ {ranked.length}
              </span>
            </p>
            <p className="tnum text-[12px] font-semibold text-amber-600 mt-0.5">
              {fmtPts(mine.points)}
            </p>
          </div>
        </section>
      )}

      {/* Podium */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8f1114] to-[#d32029] p-4 pt-5 text-white shadow-lg shadow-[#d32029]/25 mt-3">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <h3 className="text-[14px] font-bold flex items-center space-x-1.5 relative z-10">
          <Icon name="workspace_premium" className="text-lg text-amber-300" fill />
          <span>ผลรวมแต้มกิจกรรม · Top 3</span>
        </h3>
        <div className="relative z-10 mt-4">
          <div className="flex items-end gap-2">
            {order.map((r) => {
              const m = PODIUM_META[r.rank];
              const isMe = !!myKey && r.key === myKey;
              return (
                <div
                  key={r.key}
                  className="flex flex-col items-center justify-end flex-1 min-w-0"
                >
                  {isSales ? (
                    <>
                      <div className="relative mb-1.5">
                        <div
                          className={cn(
                            "w-14 h-14 rounded-full bg-white text-[#a11119] flex items-center justify-center font-bold text-[16px] ring-4 shadow-lg",
                            m.ring
                          )}
                        >
                          {r.avatar}
                        </div>
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[20px] drop-shadow">
                          {m.medal}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-white text-center truncate max-w-[100px] mt-1.5">
                        {r.name}
                      </p>
                      <p className="text-[9px] text-white/80 text-center truncate max-w-[100px]">
                        🏪 {r.companyName || ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <Icon
                        name="emoji_events"
                        className="text-[26px] mb-0.5"
                        fill
                        style={{ color: m.mColor }}
                      />
                      <div className="relative">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full bg-white/90 flex items-center justify-center ring-4 shadow-lg",
                            m.ring
                          )}
                        >
                          <Icon
                            name="person"
                            className="text-[26px] text-[#8f1114]"
                            fill
                          />
                        </div>
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[16px]">
                          {m.medal}
                        </span>
                      </div>
                      <div className="mt-2 px-2 py-0.5 rounded-md bg-white text-[#a11119] text-[11px] font-bold shadow max-w-[92px] truncate text-center border border-amber-200">
                        {r.name}
                      </div>
                    </>
                  )}
                  {isMe && (
                    <span className="text-[9px] font-bold text-amber-200 bg-amber-900/30 px-1.5 rounded-full mt-0.5">
                      {isSales ? "คุณ" : "ร้านของคุณ"}
                    </span>
                  )}
                  <p className="tnum text-[11px] font-bold text-amber-200 mt-0.5">
                    {fmtPts(r.points)}
                  </p>
                  <div
                    className={cn(
                      "w-full bg-white/15 backdrop-blur rounded-t-xl mt-1.5 flex items-start justify-center pt-1.5 border-t-2",
                      m.h
                    )}
                    style={{ borderColor: m.mColor }}
                  >
                    <span className="text-[13px] font-black text-white/90">
                      {r.rank}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full rank list */}
      <section className="mt-5">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center space-x-1.5">
            <Icon name="leaderboard" className="text-lg text-[#d32029]" />
            <span>Top Rank ทั้งหมด</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            ทั้งหมด {ranked.length} อันดับ
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
          {ranked.map((r) => (
            <RankRowItem
              key={r.key}
              row={r}
              isSales={isSales}
              isMe={!!myKey && r.key === myKey}
              myCompanyCode={session.dealer.pointCompanyCode}
            />
          ))}
        </div>
        {mine && (
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            {isSales ? "อันดับของคุณ: " : "อันดับร้านของคุณ: "}
            <span className="font-bold text-[#a11119]">#{mine.rank}</span> จาก{" "}
            {ranked.length} · {fmtPts(mine.points)}
          </p>
        )}
      </section>

      <BottomNav active="points" />
    </>
  );
}

function RankRowItem({
  row,
  isSales,
  isMe,
  myCompanyCode,
}: {
  row: RankRow;
  isSales: boolean;
  isMe: boolean;
  myCompanyCode: string;
}) {
  const [open, setOpen] = useState(true);
  const expandable = isMe && !isSales;
  const rowCls = isMe ? "bg-red-50" : "hover:bg-slate-50/60";

  const inner = (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2.5 transition",
        rowCls
      )}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="w-7 text-center shrink-0 text-[15px]">
          {MEDAL[row.rank] ?? (
            <span className="tnum text-[13px] font-bold text-slate-400">
              {row.rank}
            </span>
          )}
        </div>
        {isSales ? (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center font-bold text-[12px] shrink-0">
            {row.avatar}
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center shrink-0">
            <Icon name="storefront" className="text-lg" />
          </div>
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "text-[13px] font-semibold truncate",
              isMe ? "text-[#a11119]" : "text-slate-900"
            )}
          >
            {row.name}
            {isMe && (
              <span className="text-[10px] font-bold text-white bg-[#d32029] px-1.5 py-0.5 rounded-full ml-1">
                {isSales ? "คุณ" : "ร้านของคุณ"}
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-400 truncate">{row.sub}</p>
        </div>
      </div>
      <div className="flex items-center shrink-0 ml-2">
        <p
          className={cn(
            "tnum text-[13px] font-bold",
            isMe ? "text-[#a11119]" : "text-slate-700"
          )}
        >
          {fmtPts(row.points)}
        </p>
        {expandable && (
          <Icon
            name="expand_more"
            className={cn(
              "text-[#d32029] text-lg ml-0.5 transition",
              open && "rotate-180"
            )}
          />
        )}
      </div>
    </div>
  );

  if (!expandable) return inner;

  const staff = getPointEmployees().filter((e) => e.companyCode === myCompanyCode)
    .slice()
    .sort((a, b) => b.points - a.points);

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left">
        {inner}
      </button>
      {open && (
        <div className="border-t border-slate-100">
          <p className="text-[10px] font-semibold text-slate-500 pl-11 pt-2 pb-1">
            แต้มพนักงานในร้าน ({staff.length} คน)
          </p>
          {staff.length === 0 ? (
            <p className="text-[11px] text-slate-400 pl-11 py-2.5">
              ไม่มีข้อมูลพนักงาน
            </p>
          ) : (
            staff.map((e, i) => (
              <div
                key={e.empCode}
                className="flex items-center justify-between pl-11 pr-3 py-2 bg-slate-50/60"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="tnum text-[11px] font-bold text-slate-400 w-4 text-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    {e.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-700 truncate">
                      {e.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {e.empCode}
                    </p>
                  </div>
                </div>
                <p className="tnum text-[12px] font-bold text-[#a11119] shrink-0 ml-2">
                  {fmtPts(e.points)}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
