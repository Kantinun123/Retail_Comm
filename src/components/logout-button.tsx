import { Button } from "@/components/ui/button";
import { ComponentProps } from "react";

export function LogoutButton({
  variant = "default",
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <form action="/auth/logout" method="POST" className="w-full">
      <Button
        variant={variant}
        className={className}
        type="submit"
        {...props}
      >
        Logout
      </Button>
    </form>
  );
}
