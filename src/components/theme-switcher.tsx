"use client";

import { Button } from "@/components/ui/button";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

const ThemeSwitcher = () => {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const { theme, setTheme } = useTheme();

  if (!mounted) {
    return null;
  }

  const ICON_SIZE = 16;

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  return (
    <Button variant="ghost" size={"sm"} onClick={toggleTheme}>
      {theme === "light" ? (
        <Sun
          key="light"
          size={ICON_SIZE}
          className={"text-muted-foreground"}
        />
      ) : theme === "dark" ? (
        <Moon
          key="dark"
          size={ICON_SIZE}
          className={"text-muted-foreground"}
        />
      ) : (
        <Laptop
          key="system"
          size={ICON_SIZE}
          className={"text-muted-foreground"}
        />
      )}
    </Button>
  );
};

export { ThemeSwitcher };
