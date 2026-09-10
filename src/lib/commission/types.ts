/* Shared domain types for the commission portal */

export type Role = "dealer" | "sales";

export type GroupKey = "solution" | "product";

export type SaleStatus = "paid" | "pending" | "processing";

export type TrackingKey =
  | "contract"
  | "survey"
  | "install"
  | "qc"
  | "delivered";

export interface Dealer {
  code: string;
  name: string;
  branch: string;
  taxId: string;
  tier: string;
  model: string;
  pointCompanyCode: string;
}

export interface Solution {
  id: string;
  group: GroupKey;
  name: string;
  category: string;
  rate: number;
  icon: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  phone: string;
}

export interface Sale {
  id: string;
  period: string; // YYYY-MM
  empId: string;
  solId: string;
  date: string;
  soldDate: string;
  customer: string;
  amount: number;
  status: SaleStatus;
  projectId: string;
  tracking: TrackingKey;
}

export interface PointCompany {
  code: string;
  name: string;
  model: string;
  region: string;
  points: number;
}

export interface PointEmployee {
  empCode: string;
  name: string;
  companyCode: string;
  avatar: string;
  points: number;
}

export interface GroupMeta {
  key: GroupKey;
  label: string;
  icon: string;
}

export interface Totals {
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  count: number;
}

/** Selection state persisted per-session, mirrors the reference sessionStorage keys */
export interface FilterState {
  years: string[];
  /** map of year -> selected months ("all" | ["01", ...]) */
  monthsByYear: Record<string, "all" | string[]>;
  /** "all" | selected group keys */
  groups: "all" | GroupKey[];
}
