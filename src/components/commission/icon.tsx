import { cn } from "@/lib/utils";

interface IconProps {
  name: string;
  className?: string;
  fill?: boolean;
  style?: React.CSSProperties;
}

/** Material Symbols Outlined glyph. `fill` toggles the filled variant. */
export function Icon({ name, className, fill, style }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined", fill && "fill", className)}
      style={style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
