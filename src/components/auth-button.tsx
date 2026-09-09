import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { getServerConfig } from "@/lib/config";
import { hasEnvVars } from "@/lib/utils";
import { LogoutButton } from "./logout-button";
import { ThemeDropdownSelector } from "./theme-dropdown-selector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { UserCircle } from "lucide-react";

export async function AuthButton() {
  if (!hasEnvVars) {
    return null;
  }

  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;
  const { requireAuth } = getServerConfig();

  if (!user && !requireAuth) {
    return null;
  }

  return user ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <UserCircle className="h-5 w-5" />
          <span className="hidden sm:inline">{user.email?.toLowerCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Account</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email?.toLowerCase()}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeDropdownSelector />
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="p-0">
          <LogoutButton
            variant="ghost"
            className="w-full justify-start rounded-none px-2 py-1.5 text-sm font-normal"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
    </div>
  );
}
