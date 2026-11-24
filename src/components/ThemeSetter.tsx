"use client";
import { useEffect } from "react";
/** Mirrors the server-resolved theme on <html data-theme>. */
export default function ThemeSetter({ theme }: { theme: string }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);
  return null;
}
