"use client";

/* Client-side session store built on sessionStorage, mirroring the
   reference app's keys. React components read/write via useSession(). */
import { useCallback, useSyncExternalStore } from "react";
import {
  DEALERS,
  defaultFilterState,
  dealerByCode,
  employeeById,
} from "./logic";
import type { Dealer, FilterState, Role, TeamMember } from "./types";

const KEYS = {
  loggedIn: "loggedIn",
  dealerCode: "dealerCode",
  role: "role",
  empId: "empId",
  filter: "cmFilter",
  panelOpen: "filterPanelOpen",
} as const;

export interface SessionData {
  loggedIn: boolean;
  role: Role;
  dealerCode: string | null;
  empId: string | null;
  dealer: Dealer;
  me: TeamMember | null;
  isSales: boolean;
  filter: FilterState;
}

function readFilter(): FilterState {
  try {
    const raw = sessionStorage.getItem(KEYS.filter);
    if (raw) {
      const parsed = JSON.parse(raw) as FilterState;
      if (parsed && Array.isArray(parsed.years)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return defaultFilterState();
}

function readSession(): SessionData {
  const dealerCode =
    (typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(KEYS.dealerCode)) ||
    null;
  const dealer = dealerByCode(dealerCode || "") || DEALERS[0];
  const role = (sessionStorage.getItem(KEYS.role) as Role) || "dealer";
  const empId = sessionStorage.getItem(KEYS.empId);
  const me = empId ? employeeById(empId) ?? null : null;
  return {
    loggedIn: sessionStorage.getItem(KEYS.loggedIn) === "true",
    role,
    dealerCode,
    empId,
    dealer,
    me,
    isSales: role === "sales" && !!empId,
    filter: readFilter(),
  };
}

export interface LoginInput {
  dealerCode: string;
  role: Role;
  empId?: string;
}

export function doLogin({ dealerCode, role, empId }: LoginInput) {
  sessionStorage.setItem(KEYS.loggedIn, "true");
  sessionStorage.setItem(KEYS.dealerCode, dealerCode);
  sessionStorage.setItem(KEYS.role, role);
  if (role === "sales" && empId) sessionStorage.setItem(KEYS.empId, empId);
  else sessionStorage.removeItem(KEYS.empId);
  sessionStorage.setItem(KEYS.filter, JSON.stringify(defaultFilterState()));
  sessionStorage.setItem(KEYS.panelOpen, "0");
}

export function doLogout() {
  sessionStorage.removeItem(KEYS.loggedIn);
  sessionStorage.removeItem(KEYS.dealerCode);
  sessionStorage.removeItem(KEYS.role);
  sessionStorage.removeItem(KEYS.empId);
}

/* ----- tiny external store over sessionStorage ----- */
const listeners = new Set<() => void>();
let cachedSnapshot: SessionData | null = null;
let cacheDirty = true;

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit() {
  cacheDirty = true;
  listeners.forEach((l) => l());
}
function getSnapshot(): SessionData {
  if (cacheDirty || cachedSnapshot === null) {
    cachedSnapshot = readSession();
    cacheDirty = false;
  }
  return cachedSnapshot;
}
function getServerSnapshot(): null {
  return null;
}

/** Reads the session from sessionStorage. `ready` is false during SSR. */
export function useSession(): {
  session: SessionData | null;
  ready: boolean;
  setFilter: (next: FilterState) => void;
} {
  const session = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setFilter = useCallback((next: FilterState) => {
    sessionStorage.setItem(KEYS.filter, JSON.stringify(next));
    emit();
  }, []);

  return { session, ready: session !== null, setFilter };
}

export function getPanelOpen(): boolean {
  try {
    return sessionStorage.getItem(KEYS.panelOpen) === "1";
  } catch {
    return false;
  }
}
export function setPanelOpen(open: boolean) {
  try {
    sessionStorage.setItem(KEYS.panelOpen, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}
