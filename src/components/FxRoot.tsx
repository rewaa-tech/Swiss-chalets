"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { bindAll } from "@/fx";

/** Binds all [data-fx] behaviours; re-binds on navigation and DOM changes. */
export default function FxRoot() {
  const path = usePathname();
  useEffect(() => {
    document.documentElement.classList.add("fx-js");
    bindAll();
    let t = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(t); t = requestAnimationFrame(() => bindAll()); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [path]);
  return null;
}
