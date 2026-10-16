"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { bootChurch, churchSnapshot, serverChurchSnapshot, subscribeChurch } from "@/lib/app-db";

export function useChurch() {
  const snap = useSyncExternalStore(subscribeChurch, churchSnapshot, serverChurchSnapshot);
  useEffect(() => {
    void bootChurch();
  }, []);
  return snap;
}

export function useClientQuery() {
  const [query, setQuery] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const next: Record<string, string> = {};
      params.forEach((value, key) => {
        next[key] = value;
      });
      setQuery(next);
    };
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("church-nav", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("church-nav", read);
    };
  }, []);
  return query;
}
