"use client";

/* =============================================================
   DiceBear avatar — สร้าง avatar จาก seed + สไตล์ (ครบทั้ง 61 สไตล์)
   รายการสไตล์มาจาก dicebear-styles.ts (generate อัตโนมัติ)
   ============================================================= */
import { useMemo } from "react";
import { Style, Avatar } from "@dicebear/core";
import {
  DICEBEAR_STYLE_DEFS,
  DICEBEAR_STYLES,
  type DiceBearStyle,
  type DiceBearStyleInfo,
} from "./dicebear-styles";

export { DICEBEAR_STYLES };
export type { DiceBearStyle, DiceBearStyleInfo };

export function DiceBearAvatar({
  seed,
  styleId = "adventurer",
  size = 128,
  className,
}: {
  seed: string;
  styleId?: DiceBearStyle;
  size?: number;
  className?: string;
}) {
  const dataUri = useMemo(() => {
    const def = DICEBEAR_STYLE_DEFS[styleId] ?? DICEBEAR_STYLE_DEFS.adventurer;
    const style = new Style(def);
    const avatar = new Avatar(style, {
      seed: seed || "guest",
      size,
      borderRadius: 50,
      backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"],
    });
    return avatar.toDataUri();
  }, [seed, styleId, size]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUri} alt={`avatar-${seed}`} width={size} height={size} className={className} />
  );
}
