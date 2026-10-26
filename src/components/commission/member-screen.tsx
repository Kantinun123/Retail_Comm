"use client";

/* =============================================================
   หน้าสมาชิก / โปรไฟล์ของฉัน
   สรุปรวม: ประวัติ + ผลประโยชน์ (ค่าคอมฯ/อินเซนทีฟ) + แต้มกิจกรรม
   + แก้ไขข้อมูลติดต่อส่วนตัว (เบอร์/อีเมล/ไลน์/รูป) — แนวทาง A
   เก็บแยกจากข้อมูลดิบใน localStorage ของเครื่องนี้
   ============================================================= */
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { BottomNav } from "./bottom-nav";
import {
  formatBaht,
  formatBahtShort,
  lifetimeTotals,
  myPointEmpCode,
  pointsRankCompanies,
  pointsRankEmployees,
  setBenefitView,
} from "@/lib/commission/logic";
import { doLogout, useSession } from "@/lib/commission/session";
import {
  getProfileOverride,
  profileKey,
  setProfileOverride,
  subscribeProfile,
  type ProfileOverride,
} from "@/lib/commission/profile";
import { fileToResizedDataUrl } from "@/lib/commission/image";
import {
  availableBalance,
  deriveLots,
  expiringLots,
  getRedemptions,
  redeem,
  subscribeRedemptions,
  pointsStatement,
  DELIVERY_METHOD_META,
  type StatementEntry,
} from "@/lib/commission/points-store";
import { RedemptionCard } from "./redemption-card";
import { GiftThumb } from "./gift-thumb";
import {
  adjustmentTotal,
  getAdjustments,
  subscribeAdjustments,
} from "@/lib/commission/point-adjustments";
import { GIFTS } from "@/lib/commission/gifts";
import type {
  Redemption,
  DeliveryMethod,
  GiftItem,
} from "@/lib/commission/types";
import { cn } from "@/lib/utils";
import { DiceBearAvatar, DICEBEAR_STYLES, type DiceBearStyle } from "./dicebear-avatar";
import {
  getAvatarStyle,
  subscribeAvatarStyle,
  DEFAULT_STYLE,
  type AvatarStyleConfig,
} from "@/lib/commission/avatar-style";
import {
  fetchCheckinState,
  checkinTotalPoints,
  getCachedState,
  subscribeCheckin,
} from "@/lib/commission/checkin-store";
/* ระบบแต่งตัวเดิม (CharacterAvatar/DressingRoom/character.ts) เก็บโค้ดไว้
   เผื่อเรียกใช้อนาคต — ถอดออกจาก UI ชั่วคราว */

/** แสดงแต้ม: รองรับทศนิยมสูงสุด 2 ตำแหน่ง (เช็คอินให้แต้มทศนิยม 0.1/0.2/0.5)
 *  จำนวนเต็มไม่โชว์ .00 */
function fmtPts(n: number): string {
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export function MemberScreen() {
  const { session, ready } = useSession();
  const router = useRouter();
  const focusId = useSearchParams().get("focus");

  const [editing, setEditing] = useState(false);
  const [override, setOverride] = useState<ProfileOverride>({});
  // ค่าในฟอร์มระหว่างแก้ไข
  const [form, setForm] = useState<ProfileOverride>({});
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // แต้ม: การแลกของรางวัล
  const [showGifts, setShowGifts] = useState(false);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  // ขั้นยืนยัน: เลือกของแล้วเลือกวิธีรับ
  const [picked, setPicked] = useState<GiftItem | null>(null);
  const [method, setMethod] = useState<DeliveryMethod>("self");
  const [address, setAddress] = useState("");
  // รายการเดินแต้ม (statement)
  const [showStatement, setShowStatement] = useState(false);
  // avatar (DiceBear)
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyleConfig | null>(null);

  // พนักงาน = มุมมอง incentive, ร้าน/แอดมิน = commission
  setBenefitView(session?.isSales ? "emp" : null);
  useEffect(() => {
    setBenefitView(session?.isSales ? "emp" : null);
    return () => setBenefitView(null);
  }, [session?.isSales]);

  const isSales = !!session && session.isSales;
  const isAdmin = !!session && session.isAdmin;
  const pKey = session
    ? profileKey({
        isSales,
        empId: session.empId,
        dealerCode: isAdmin ? null : session.dealer.code,
      })
    : null;

  // โหลด override + subscribe
  useEffect(() => {
    if (!pKey) return;
    const refresh = () => setOverride(getProfileOverride(pKey));
    refresh();
    const unsub = subscribeProfile(refresh);
    return unsub;
  }, [pKey]);

  // โหลดประวัติการแลก + subscribe
  useEffect(() => {
    if (!pKey) return;
    const refresh = () => setRedemptions(getRedemptions(pKey));
    refresh();
    const unsub = subscribeRedemptions(refresh);
    return unsub;
  }, [pKey]);

  // โหลด avatar style + subscribe
  useEffect(() => {
    if (!pKey) return;
    const refresh = () => setAvatarStyle(getAvatarStyle(pKey));
    refresh();
    const unsub = subscribeAvatarStyle(refresh);
    return unsub;
  }, [pKey]);

  // re-render เมื่อแอดมินเพิ่มแต้ม (adjustments เปลี่ยน)
  const [, forceTick] = useState(0);
  useEffect(() => subscribeAdjustments(() => forceTick((n) => n + 1)), []);

  // โหลดแต้มเช็คอินสะสม (เฉพาะ sales) + subscribe ให้ยอดคงเหลืออัปเดต
  const checkinEmpId =
    session && session.isSales ? session.empId : null;
  useEffect(() => {
    if (!checkinEmpId) return;
    fetchCheckinState(checkinEmpId).catch(() => {});
    return subscribeCheckin(() => forceTick((n) => n + 1));
  }, [checkinEmpId]);

  if (!ready || !session) return null;

  // seed ประจำตัวสำหรับ DiceBear (empId / dealerCode)
  const avatarSeed =
    (isSales ? session.empId : session.dealer.code) || "guest";

  // ขอบเขตสรุปผลประโยชน์ (ตลอดทุกช่วงเวลา)
  const empScope = isSales ? session.empId : null;
  const dealerScope = isSales
    ? null
    : isAdmin
      ? session.storeFilter
      : session.dealer.code;
  const t = lifetimeTotals(empScope, dealerScope);

  // แต้มกิจกรรม (เฉพาะ sales ที่ map ได้ / dealer ใช้แต้มบริษัท)
  const model =
    isAdmin && !session.storeFilter ? undefined : session.dealer.model;
  let myPoints: { points: number; rank: number; total: number } | null = null;
  if (isSales) {
    const key = myPointEmpCode(session.empId);
    if (key) {
      const rows = pointsRankEmployees(model);
      const me = rows.find((r) => r.empCode === key);
      if (me) myPoints = { points: me.points, rank: me.rank, total: rows.length };
    }
  } else if (!isAdmin) {
    const rows = pointsRankCompanies(model);
    const me = rows.find((r) => r.code === session.dealer.code);
    if (me) myPoints = { points: me.points, rank: me.rank, total: rows.length };
  }

  // ล็อตแต้ม + แต้มคงเหลือ + ล็อตใกล้หมดอายุ
  // totalEarned (จาก leaderboard) รวมแต้มที่แอดมินปรับแล้ว (adjTotal อาจเป็นลบจากการหัก)
  // ล็อตฐาน derive จากยอดฐาน ส่วน adjustment บวก/หักเข้า balance ตรง ๆ + แสดงใน statement
  const empCode = isSales ? session.empId : null;
  const adjTotal = empCode ? adjustmentTotal(empCode) : 0;
  const adjustments = empCode ? getAdjustments(empCode) : [];
  const totalEarned = myPoints?.points ?? 0;
  const baseEarned = Math.max(0, totalEarned - adjTotal);
  const lots = pKey ? deriveLots(pKey, baseEarned) : [];
  // redemptions เป็น dependency โดยปริยาย (re-render เมื่อ state เปลี่ยน)
  void redemptions;
  // แต้มเช็คอินสะสม (server-authoritative; รวมเข้า pool แต้มเดียวกัน) — เฉพาะ sales
  const checkinTotal = empCode ? checkinTotalPoints(empCode) : 0;
  const checkinCached = empCode ? getCachedState(empCode) : null;
  const checkinCachedToday = checkinCached?.checkedToday ?? false;
  const checkinStreak = checkinCached?.currentStreak ?? 0;
  const balance = pKey
    ? Math.max(0, availableBalance(pKey, lots) + adjTotal + checkinTotal)
    : 0;
  const statement = pKey
    ? [
        ...pointsStatement(pKey, lots),
        ...adjustments.map((a) => ({
          id: `adj-${a.id}`,
          kind: (a.points >= 0 ? "earn" : "use") as "earn" | "use",
          label: a.points >= 0 ? `รับแต้มเพิ่ม · ${a.reason}` : `ถูกหักแต้ม · ${a.reason}`,
          amount: a.points,
          time: a.time,
        })),
        // สรุปแต้มเช็คอินเป็นรายการเดียว (รายละเอียดรายวันดูได้ในหน้าเช็คอิน)
        // ใช้เวลาจาก state (today ของ server) เพื่อให้ pure — ไม่เรียก Date.now() ตอน render
        ...(checkinTotal > 0
          ? [
              {
                id: "checkin-total",
                kind: "earn" as const,
                label: "แต้มจากการเช็คอินรายวัน",
                amount: checkinTotal,
                time: checkinCached?.today
                  ? new Date(checkinCached.today + "T23:59:59").getTime()
                  : 0,
              },
            ]
          : []),
      ].sort((x, y) => y.time - x.time)
    : [];
  const soonLots = expiringLots(lots);
  const soonPoints = soonLots.reduce((a, l) => a + l.points, 0);
  const nearestExpire = soonLots
    .map((l) => l.expireDate)
    .sort()[0];
  // แลกของรางวัลได้เฉพาะพนักงาน (sales) — ร้านค้าตัวแทน/แอดมินไม่มีสิทธิ์แลก
  const canRedeem = isSales && !!pKey && !!myPoints;

  const ownerName =
    isSales && session?.me ? session.me.name : session?.dealer.name ?? "สมาชิก";

  function confirmRedeem() {
    if (!picked) return;
    const res = redeem(pKey, picked, lots, { ownerName, method, address });
    if (res.ok) {
      setRedeemMsg(`ส่งคำขอแลก "${picked.name}" แล้ว · รออนุมัติ`);
      setShowGifts(false);
      setPicked(null);
      setAddress("");
      setMethod("self");
    } else {
      setRedeemMsg(res.error ?? "แลกไม่สำเร็จ");
    }
    setTimeout(() => setRedeemMsg(null), 3500);
  }

  const displayName = isSales && session.me
    ? session.me.name
    : isAdmin
      ? "ผู้ดูแลระบบ"
      : session.dealer.name;
  const avatar =
    isSales && session.me?.avatar
      ? session.me.avatar
      : displayName.slice(0, 2);
  const roleLabel = isSales
    ? "พนักงานขาย"
    : isAdmin
      ? "ผู้ดูแลระบบ"
      : "ร้านค้าตัวแทน";
  const benefitTitle = isSales ? "ผลประโยชน์พนักงาน (อินเซนทีฟ)" : "ผลประโยชน์ร้านค้า";

  // ค่าแสดงผล (override ชนะข้อมูลดิบ)
  const basePhone = isSales ? session.me?.phone ?? "" : "";
  const shownPhone = override.phone ?? basePhone;
  const shownEmail = override.email ?? "";
  const shownLine = override.line ?? "";
  const shownPhoto = override.photoUrl ?? "";
  // ค่าในฟอร์ม (ตอนแก้ไข) ใช้รูป preview จาก form ก่อน
  const previewPhoto = editing ? form.photoUrl ?? "" : shownPhoto;

  // แก้ไขได้เฉพาะผู้ที่มี pKey (sales/ dealer) — admin แก้ไม่ได้
  const canEdit = !!pKey;

  function startEdit() {
    setForm({
      phone: override.phone ?? basePhone,
      email: override.email ?? "",
      line: override.line ?? "",
      photoUrl: override.photoUrl ?? "",
    });
    setPhotoErr(null);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setPhotoErr(null);
  }
  function save() {
    if (!pKey) return;
    setProfileOverride(pKey, {
      phone: form.phone?.trim() ?? "",
      email: form.email?.trim() ?? "",
      line: form.line?.trim() ?? "",
      photoUrl: form.photoUrl ?? "",
    });
    setEditing(false);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErr(null);
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setForm((f) => ({ ...f, photoUrl: dataUrl }));
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
          <span className="font-bold text-[16px] text-[#231313]">สมาชิก</span>
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
        {/* การ์ดโปรไฟล์ */}
        <section className="rounded-2xl bg-gradient-to-br from-[#d32029] to-[#8f1114] text-white p-4 shadow-lg shadow-[#d32029]/20">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-[20px] font-bold shrink-0 overflow-hidden">
              {previewPhoto ? (
                <Image
                  src={previewPhoto}
                  alt={displayName}
                  width={64}
                  height={64}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                avatar
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[17px] font-bold leading-tight truncate">
                {displayName}
              </p>
              <p className="text-[12px] text-red-100/90 flex items-center gap-1 mt-0.5">
                <Icon name="badge" style={{ fontSize: 14 }} />
                {roleLabel}
                {isSales && session.me ? ` · ${session.me.id}` : ""}
              </p>
              <p className="text-[12px] text-red-100/80 flex items-center gap-1 mt-0.5">
                <Icon name="storefront" style={{ fontSize: 14 }} />
                <span className="truncate">
                  {isAdmin && !session.storeFilter
                    ? "ทุกร้าน"
                    : session.dealer.name}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Entry: เช็คอินรายวัน — เฉพาะพนักงานขาย (sales) */}
        {isSales && (
          <Link
            href="/app/check-in"
            className="block rounded-2xl bg-white border border-[#d32029]/20 shadow-sm p-4 active:scale-[0.99] transition hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#fff0f0] flex items-center justify-center text-[22px] shrink-0">
                🔥
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-slate-900">
                  เช็คอินรายวัน
                </p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {checkinCachedToday
                    ? `เช็คอินวันนี้แล้ว · ต่อเนื่อง ${checkinStreak} วัน`
                    : "กดรับแต้มวันนี้ สะสม streak 7 วัน"}
                </p>
              </div>
              {!checkinCachedToday ? (
                <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-white bg-[#d32029] px-3 py-1.5 rounded-full">
                  เช็คอิน
                  <Icon name="arrow_forward" style={{ fontSize: 14 }} />
                </span>
              ) : (
                <Icon name="check_circle" className="text-[#16a34a] text-2xl shrink-0" fill />
              )}
            </div>
          </Link>
        )}

        {/* การ์ดตัวละคร (DiceBear) — เฉพาะผู้มี pKey = sales/dealer */}
        {canEdit && (
          <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
                <Icon name="face" className="text-lg text-[#d32029]" />
                <span>ตัวละครของฉัน</span>
              </h3>
              <Link
                href="/app/avatar-preview"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#d32029] hover:bg-[#b91c21] px-3 py-1.5 rounded-full active:scale-95 transition"
              >
                <Icon name="palette" style={{ fontSize: 14 }} />
                เลือกสไตล์
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-2xl bg-slate-50 border border-slate-100 p-1">
                <DiceBearAvatar
                  seed={avatarSeed}
                  styleId={(avatarStyle?.styleId ?? DEFAULT_STYLE) as DiceBearStyle}
                  size={96}
                  className="rounded-xl"
                />
              </div>
              <div className="min-w-0">
                {avatarStyle ? (
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    สไตล์:{" "}
                    <span className="font-bold text-[#a11119]">
                      {DICEBEAR_STYLES.find((s) => s.id === avatarStyle.styleId)?.label ?? avatarStyle.styleId}
                    </span>
                    <br />กด &quot;เลือกสไตล์&quot; เพื่อเปลี่ยน avatar
                  </p>
                ) : (
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    เลือก avatar ประจำตัวของคุณ 🎨 กด{" "}
                    <span className="font-bold text-[#a11119]">เลือกสไตล์</span>{" "}
                    จาก {DICEBEAR_STYLES.length} สไตล์
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* การ์ดข้อมูลติดต่อ (แก้ไขได้) */}
        {canEdit && (
          <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
                <Icon name="contact_page" className="text-lg text-[#d32029]" />
                <span>ข้อมูลติดต่อ</span>
              </h3>
              {!editing ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a11119] hover:underline"
                >
                  <Icon name="edit" style={{ fontSize: 14 }} />
                  แก้ไข
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-[11px] font-semibold text-slate-400 px-2 py-1 rounded-full hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#d32029] hover:bg-[#b91c21] px-3 py-1 rounded-full disabled:opacity-50 transition"
                  >
                    <Icon name="check" style={{ fontSize: 14 }} />
                    บันทึก
                  </button>
                </div>
              )}
            </div>

            {!editing ? (
              <div className="space-y-2">
                <ContactLine icon="call" label="เบอร์โทร" value={shownPhone} />
                <ContactLine icon="mail" label="อีเมล" value={shownEmail} />
                <ContactLine icon="chat" label="ไลน์" value={shownLine} />
                <p className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
                  <Icon name="info" style={{ fontSize: 12 }} />
                  การแก้ไขบันทึกในอุปกรณ์นี้
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* รูปโปรไฟล์ */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">
                    รูปโปรไฟล์
                  </label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {previewPhoto ? (
                        <Image
                          src={previewPhoto}
                          alt="preview"
                          width={56}
                          height={56}
                          unoptimized
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon name="person" className="text-2xl text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a11119] bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-full disabled:opacity-50 transition"
                      >
                        <Icon name="upload" style={{ fontSize: 14 }} />
                        {busy ? "กำลังประมวลผล…" : "อัปโหลดรูป"}
                      </button>
                      {previewPhoto && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, photoUrl: "" }))}
                          className="ml-1.5 text-[11px] font-semibold text-slate-400 hover:text-[#a11119]"
                        >
                          ลบรูป
                        </button>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={onPickFile}
                        className="hidden"
                      />
                    </div>
                  </div>
                  {photoErr && (
                    <p className="text-[10px] text-[#d32029] mt-1">{photoErr}</p>
                  )}
                  <input
                    type="url"
                    value={
                      form.photoUrl?.startsWith("data:") ? "" : form.photoUrl ?? ""
                    }
                    onChange={(e) =>
                      setForm((f) => ({ ...f, photoUrl: e.target.value }))
                    }
                    placeholder="หรือวาง URL รูป (https://…)"
                    className="mt-2 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-300 focus:bg-white transition"
                  />
                </div>

                <EditField
                  icon="call"
                  label="เบอร์โทร"
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="08x-xxx-xxxx"
                />
                <EditField
                  icon="mail"
                  label="อีเมล"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  placeholder="name@example.com"
                />
                <EditField
                  icon="chat"
                  label="ไลน์"
                  type="text"
                  value={form.line ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, line: v }))}
                  placeholder="LINE ID"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Icon name="info" style={{ fontSize: 12 }} />
                  การแก้ไขบันทึกในอุปกรณ์นี้ (ยังไม่ซิงก์ข้ามเครื่อง)
                </p>
              </div>
            )}
          </section>
        )}

        {/* การ์ดผลประโยชน์ */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
              <Icon name="payments" className="text-lg text-[#d32029]" />
              <span>{benefitTitle}</span>
            </h3>
            <Link
              href="/app/dashboard"
              className="text-[11px] font-semibold text-[#a11119] hover:underline"
            >
              ดูทั้งหมด
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">รวมทุกรอบ</p>
          <p className="tnum text-[28px] font-bold text-[#a11119] leading-none mt-0.5">
            {formatBaht(t.totalCommission)}
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
              <p className="flex items-center text-[11px] font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-sm mr-1.5 bg-[#16a34a]" />
                จ่ายแล้ว
              </p>
              <p className="tnum text-[15px] font-bold text-emerald-700 mt-0.5">
                {formatBaht(t.paidCommission)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5">
              <p className="flex items-center text-[11px] font-semibold text-amber-700">
                <span className="w-2 h-2 rounded-sm mr-1.5 bg-[#f59e0b]" />
                รอจ่าย
              </p>
              <p className="tnum text-[15px] font-bold text-amber-700 mt-0.5">
                {formatBaht(t.pendingCommission)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[12px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Icon name="receipt_long" style={{ fontSize: 15 }} className="text-slate-400" />
              จำนวนงาน
            </span>
            <span className="tnum font-bold text-slate-700">
              {t.count.toLocaleString("th-TH")} งาน
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Icon name="trending_up" style={{ fontSize: 15 }} className="text-slate-400" />
              ยอดขายรวม
            </span>
            <span className="tnum font-bold text-slate-700">
              {formatBahtShort(t.totalSales)}
            </span>
          </div>
        </section>

        {/* การ์ดแต้มกิจกรรม */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-slate-900 flex items-center space-x-1.5">
              <Icon name="emoji_events" className="text-lg text-amber-500" />
              <span>แต้มกิจกรรม</span>
            </h3>
            <Link
              href="/app/points"
              className="text-[11px] font-semibold text-[#a11119] hover:underline"
            >
              ดูทั้งหมด
            </Link>
          </div>
          {myPoints ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="tnum text-[28px] font-bold text-amber-500 leading-none">
                    {fmtPts(balance)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    แต้มคงเหลือ · สะสมรวม {fmtPts(totalEarned)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">อันดับ</p>
                  <p className="tnum text-[20px] font-bold text-slate-700">
                    #{myPoints.rank}
                    <span className="text-[12px] font-medium text-slate-400">
                      {" "}/ {myPoints.total}
                    </span>
                  </p>
                </div>
              </div>

              {/* เตือนแต้มใกล้หมดอายุ */}
              {soonPoints > 0 && nearestExpire && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
                  <Icon name="schedule" style={{ fontSize: 16 }} className="text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-700">
                    {fmtPts(soonPoints)} จะหมดอายุ{" "}
                    {new Date(nearestExpire).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}

              {/* ปุ่มแลกของรางวัล */}
              {canRedeem && (
                <button
                  type="button"
                  onClick={() => setShowGifts(true)}
                  className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#d32029] to-[#8f1114] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.99] transition"
                >
                  <Icon name="redeem" style={{ fontSize: 18 }} />
                  แลกของรางวัล
                </button>
              )}

              {/* ประวัติ/สถานะการแลก */}
              {redemptions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold text-slate-500">
                      คำขอแลกของรางวัล
                    </p>
                    <Link
                      href="/app/my-redemptions"
                      className="text-[11px] font-semibold text-[#a11119] hover:underline"
                    >
                      ดูทั้งหมด
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    {(() => {
                      // แสดง 5 รายการล่าสุด + ให้แน่ใจว่ารายการที่ถูกเจาะจงอยู่ในลิสต์
                      const top = redemptions.slice(0, 5);
                      if (focusId && !top.some((r) => r.id === focusId)) {
                        const hit = redemptions.find((r) => r.id === focusId);
                        if (hit) top.unshift(hit);
                      }
                      return top.map((r) => (
                        <RedemptionCard
                          key={r.id}
                          r={r}
                          focus={r.id === focusId}
                        />
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* รายการเดินแต้ม (statement แบบแอปธนาคาร) */}
              {statement.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowStatement((s) => !s)}
                    className="w-full flex items-center justify-between"
                  >
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Icon name="receipt_long" style={{ fontSize: 14 }} className="text-slate-400" />
                      รายการเดินแต้ม
                    </span>
                    <Icon
                      name={showStatement ? "expand_less" : "expand_more"}
                      className="text-slate-400 text-lg"
                    />
                  </button>
                  {showStatement && <PointsStatement entries={statement} />}
                </div>
              )}
            </>
          ) : (
            <div className="py-4 text-center">
              <Icon name="stars" className="text-3xl text-slate-200" />
              <p className="text-[12px] text-slate-400 mt-1">
                {isAdmin
                  ? "ผู้ดูแลระบบไม่มีแต้มส่วนบุคคล"
                  : "ยังไม่มีข้อมูลแต้มสำหรับบัญชีนี้"}
              </p>
            </div>
          )}
        </section>

        {/* ผู้ดูแลระบบ: ทางลัดจัดการคำขอแลกของรางวัล */}
        {isAdmin && (
          <Link
            href="/app/redemptions"
            className="block rounded-2xl bg-white border border-slate-100 shadow-sm p-4 active:scale-[0.99] hover:border-red-200 transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#d32029] flex items-center justify-center">
                  <Icon name="redeem" className="text-xl" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-slate-800">
                    จัดการคำขอแลกของรางวัล
                  </p>
                  <p className="text-[11px] text-slate-400">
                    อนุมัติ / ไม่อนุมัติ / จัดส่ง
                  </p>
                </div>
              </div>
              <Icon name="chevron_right" className="text-xl text-slate-300" />
            </div>
          </Link>
        )}
      </div>

      {/* Modal รายการของรางวัล */}
      {showGifts && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-t-3xl max-h-[80vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <p className="text-[15px] font-bold text-slate-800">แลกของรางวัล</p>
                <p className="text-[11px] text-slate-400">
                  แต้มคงเหลือ{" "}
                  <span className="font-semibold text-amber-600">
                    {fmtPts(balance)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGifts(false);
                  setPicked(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95"
              >
                <Icon name="close" style={{ fontSize: 18 }} />
              </button>
            </div>
            {!picked ? (
              /* ขั้นที่ 1: เลือกของรางวัล */
              <div className="overflow-y-auto p-3 space-y-2">
                {GIFTS.map((g) => {
                  const affordable = g.cost <= balance;
                  return (
                    <div
                      key={g.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"
                    >
                      <GiftThumb
                        imageUrl={g.imageUrl}
                        icon={g.icon}
                        name={g.name}
                        size={44}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">
                          {g.name}
                        </p>
                        <p className="text-[11px] text-slate-400">{g.category}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => setPicked(g)}
                        className={cn(
                          "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold tnum transition active:scale-95",
                          affordable
                            ? "bg-[#d32029] text-white hover:bg-[#b91c21]"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        {fmtPts(g.cost)}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ขั้นที่ 2: เลือกวิธีรับ + ยืนยัน */
              <div className="overflow-y-auto p-3 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl bg-amber-50/60 p-3">
                  <GiftThumb
                    imageUrl={picked.imageUrl}
                    icon={picked.icon}
                    name={picked.name}
                    size={44}
                    className="bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">
                      {picked.name}
                    </p>
                    <p className="text-[11px] text-slate-400">{picked.category}</p>
                  </div>
                  <span className="tnum text-[13px] font-bold text-[#a11119] shrink-0">
                    {fmtPts(picked.cost)}
                  </span>
                </div>

                <div>
                  <p className="text-[12px] font-bold text-slate-600 mb-1.5">
                    วิธีรับของรางวัล
                  </p>
                  <div className="space-y-1.5">
                    {(["self", "team", "parcel"] as DeliveryMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                          method === m
                            ? "border-[#d32029] bg-red-50/50"
                            : "border-slate-200 hover:border-red-200"
                        )}
                      >
                        <Icon
                          name={DELIVERY_METHOD_META[m].icon}
                          className={cn(
                            "text-xl shrink-0",
                            method === m ? "text-[#d32029]" : "text-slate-400"
                          )}
                        />
                        <span className="text-[13px] font-medium text-slate-700 flex-1">
                          {DELIVERY_METHOD_META[m].label}
                        </span>
                        {method === m && (
                          <Icon name="check_circle" className="text-lg text-[#d32029]" fill />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {method === "parcel" && (
                  <div>
                    <label className="text-[12px] font-bold text-slate-600">
                      ที่อยู่จัดส่ง
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      placeholder="บ้านเลขที่ / ถนน / ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์"
                      className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-300 focus:bg-white transition resize-none"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-bold active:scale-[0.99] transition"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    onClick={confirmRedeem}
                    className="flex-1 py-2.5 rounded-xl bg-[#d32029] text-white text-[13px] font-bold active:scale-[0.99] transition"
                  >
                    ยืนยันแลก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Toast ผลการแลก */}
      {redeemMsg && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] w-[90%] max-w-[360px] animate-fade-up">
          <div className="rounded-2xl bg-slate-800 text-white px-4 py-3 text-[13px] font-medium text-center shadow-xl">
            {redeemMsg}
          </div>
        </div>
      )}

      <BottomNav active="member" />
    </>
  );
}

/* ---------- sub-components ---------- */
function ContactLine({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-slate-500 flex items-center gap-1.5">
        <Icon name={icon} style={{ fontSize: 15 }} className="text-slate-400" />
        {label}
      </span>
      <span className={value ? "font-semibold text-slate-700" : "text-slate-300"}>
        {value || "—"}
      </span>
    </div>
  );
}

function EditField({
  icon,
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  icon: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
        <Icon name={icon} style={{ fontSize: 14 }} className="text-slate-400" />
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-red-300 focus:bg-white transition"
      />
    </div>
  );
}

// RedemptionCard ย้ายไปไฟล์ ./redemption-card.tsx (ใช้ร่วมกับหน้าประวัติการแลก)

/** รายการเดินแต้มแบบแอปธนาคาร — จัดกลุ่มตามวันที่ */
function PointsStatement({ entries }: { entries: StatementEntry[] }) {
  // จัดกลุ่มตามวัน (YYYY-MM-DD) คงลำดับใหม่->เก่า
  const groups: { date: string; items: StatementEntry[] }[] = [];
  entries.forEach((e) => {
    const d = new Date(e.time).toISOString().slice(0, 10);
    const g = groups.find((x) => x.date === d);
    if (g) g.items.push(e);
    else groups.push({ date: d, items: [e] });
  });

  const meta: Record<StatementEntry["kind"], { icon: string; color: string }> = {
    earn: { icon: "stars", color: "#16a34a" },
    use: { icon: "redeem", color: "#dc2626" },
    refund: { icon: "undo", color: "#16a34a" },
  };

  return (
    <div className="mt-2 space-y-3">
      {groups.map((g) => (
        <div key={g.date}>
          <p className="text-[10px] font-semibold text-slate-400 mb-1">
            {new Date(g.date + "T00:00:00").toLocaleDateString("th-TH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="space-y-1.5">
            {g.items.map((e) => (
              <div key={e.id} className="flex items-center justify-between">
                <span className="flex items-center gap-2 min-w-0 text-[12px] text-slate-600">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: meta[e.kind].color + "1a",
                      color: meta[e.kind].color,
                    }}
                  >
                    <Icon name={meta[e.kind].icon} style={{ fontSize: 14 }} />
                  </span>
                  <span className="truncate">{e.label}</span>
                </span>
                <span
                  className="tnum text-[13px] font-bold shrink-0 ml-2"
                  style={{ color: e.amount >= 0 ? "#16a34a" : "#dc2626" }}
                >
                  {e.amount >= 0 ? "+" : ""}
                  {e.amount.toLocaleString("th-TH")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
