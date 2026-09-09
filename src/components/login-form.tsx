"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAzureLogin = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: "email profile",
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="text-center">
        <CardHeader>
          <img src="/favicon.png" alt="Logo" className="mx-auto h-12 w-12" />
          <CardTitle className="text-2xl">{siteConfig.name}</CardTitle>
          <CardDescription>
            Access restricted to authorized users.<br />
            Unauthorized use is prohibited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              className="w-full h-12"
              disabled={isLoading}
              onClick={handleAzureLogin}
            >
              {isLoading ? "Redirecting..." : "Login with SCG"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
