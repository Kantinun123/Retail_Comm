/* โมเดลร้านค้า + ผลประโยชน์ที่แต่ละโมเดลได้ — แก้ที่ไฟล์นี้ที่เดียวเมื่อเงื่อนไขเปลี่ยน
   (ใช้ได้ทั้งฝั่ง client และ server) */

export const STORE_MODELS = ["Housing Expert", "SCG Home", "GT", "XP"] as const;
export type StoreModel = (typeof STORE_MODELS)[number];

export interface ModelFeatures {
  /** ผลประโยชน์ร้าน */
  backMargin: boolean;
  profitShareBa: boolean;
  lhsDiscount: boolean;
  /** ผลประโยชน์พนักงานในร้าน */
  productCommission: boolean;
  baCommission: boolean;
  lhsCommission: boolean;
  /** ร้านใหม่ของโมเดลนี้ต้องตรวจประเมินรายเดือนหรือไม่ (ค่าเริ่มต้นตอนเพิ่มร้าน) */
  evalRequired: boolean;
}

const ALL_STAFF = { productCommission: true, baCommission: true, lhsCommission: true };

export const MODEL_FEATURES: Record<StoreModel, ModelFeatures> = {
  "Housing Expert": { backMargin: true, profitShareBa: true, lhsDiscount: true, ...ALL_STAFF, evalRequired: true },
  "SCG Home": { backMargin: false, profitShareBa: true, lhsDiscount: false, ...ALL_STAFF, evalRequired: true },
  // GT / XP (พ.ย. 69): มีแค่ LHS Channel Discount ; ยังไม่มีการตรวจประเมิน — อนาคตอาจปรับ
  GT: { backMargin: false, profitShareBa: false, lhsDiscount: true, productCommission: false, baCommission: false, lhsCommission: false, evalRequired: false },
  XP: { backMargin: false, profitShareBa: false, lhsDiscount: true, productCommission: false, baCommission: false, lhsCommission: false, evalRequired: false },
};

/** โมเดลที่ไม่รู้จัก (หรือว่าง) -> เหมือนพฤติกรรมเดิมของร้านที่ไม่ใช่ HE */
const DEFAULT_FEATURES: ModelFeatures = { backMargin: false, profitShareBa: true, lhsDiscount: false, ...ALL_STAFF, evalRequired: true };

export function modelFeatures(model: string | null | undefined): ModelFeatures {
  return (model && MODEL_FEATURES[model as StoreModel]) || DEFAULT_FEATURES;
}

export function isStoreModel(v: string): v is StoreModel {
  return (STORE_MODELS as readonly string[]).includes(v);
}

/** สีป้ายโมเดล */
export function modelBadgeClass(model: string | null | undefined): string {
  switch (model) {
    case "Housing Expert":
      return "bg-red-50 text-[#d32029]";
    case "SCG Home":
      return "bg-amber-50 text-amber-700";
    case "GT":
      return "bg-emerald-50 text-emerald-700";
    case "XP":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
