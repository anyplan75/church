"use client";

import { useEffect, useState } from "react";
import { isPrivateIpv4 } from "@/lib/output-host";
import { outputLinks } from "@/lib/roles";

export function OutputLinks({ id, className = "btn btn-quiet" }: { id: string; className?: string }) {
  const [localOrigin, setLocalOrigin] = useState("");
  useEffect(() => {
    const host = window.location.hostname;
    if (host === "localhost" || host.endsWith(".local") || isPrivateIpv4(host)) setLocalOrigin(window.location.origin);
  }, []);
  return (
    <div className="flex flex-wrap gap-2">
      {outputLinks(id, localOrigin).map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className={className}>
          {link.label}
        </a>
      ))}
    </div>
  );
}
