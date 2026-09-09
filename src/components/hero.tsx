import { NextLogo } from "./next-logo";
import { SupabaseLogo } from "./supabase-logo";
import { siteConfig } from "@/lib/config";

export function Hero() {
  return (
    <div className="flex flex-col gap-16 items-center">
      <p className="text-3xl lg:text-4xl !leading-tight mx-auto max-w-xl text-center">
        Welcome to {siteConfig.name}
      </p>
    </div>
  );
}
