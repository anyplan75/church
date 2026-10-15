"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ReplacePage({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return <p className="page text-muted">옮기는 중</p>;
}
