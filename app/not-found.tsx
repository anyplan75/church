"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BulletinScreen, LiveScreen, OutputScreen, ServiceEditorScreen, SlidesScreen } from "@/components/service-screens";
import { useChurch } from "@/components/church-state";
import { cleanPath } from "@/lib/page-path";
import { homeFor } from "@/lib/roles";

export default function NotFound() {
  const { user } = useChurch();
  const [path, setPath] = useState("");
  useEffect(() => {
    setPath(cleanPath(window.location.pathname));
  }, []);
  if (!path) return null;
  const nested = path.match(/^\/services\/([^/]+)\/(live|output|bulletin|slides)$/);
  if (nested) {
    const id = decodeURIComponent(nested[1]);
    if (nested[2] === "live") return <LiveScreen id={id} />;
    if (nested[2] === "output") return <OutputScreen id={id} />;
    if (nested[2] === "bulletin") return <BulletinScreen id={id} />;
    return <SlidesScreen id={id} />;
  }
  const service = path.match(/^\/services\/([^/]+)$/);
  if (service && service[1] !== "new") return <ServiceEditorScreen id={decodeURIComponent(service[1])} />;
  const home = user ? homeFor(user.roles) : "/login";
  return (
    <div className="page text-center">
      <p className="text-sm text-gold">404</p>
      <h1 className="mt-2 font-serif text-4xl">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-muted">주소를 다시 확인하거나 처음 화면으로 돌아가 주세요.</p>
      <Link href={home} className="btn btn-primary mt-6">
        처음 화면
      </Link>
    </div>
  );
}
