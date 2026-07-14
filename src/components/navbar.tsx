"use client";

import { useTheme } from "@/components/theme-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTranslations } from "next-intl";
import { Sun, Moon, MessageCircle, FileText, Wrench, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const { theme, toggle } = useTheme();
  const t = useTranslations("nav");
  const pathname = usePathname();

  const links = [
    { href: "/chat", label: t("chat"), icon: MessageCircle },
    { href: "/video", label: t("video"), icon: Video },
    { href: "/prompts", label: t("templates"), icon: FileText },
    { href: "/debug", label: t("debug"), icon: Wrench },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/chat" className="flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-white text-xs font-bold">
            AI
          </div>
          <span className="text-sm">Artisan</span>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher className="flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />

          <button
            type="button"
            onClick={toggle}
            aria-label={t("toggleTheme")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
