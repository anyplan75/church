"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveConsole } from "@/components/live-console";
import { useChurch } from "@/components/church-state";
import { readOperatorService } from "@/lib/output-link";
import { can } from "@/lib/roles";
import { settingsReady } from "@/lib/simple";
import { operatorService, todayISO } from "@/lib/worship";

export default function OperatorPage() {
  const { ready, user, db } = useChurch();
  const [storedId, setStoredId] = useState("");
  useEffect(() => {
    setStoredId(readOperatorService());
  }, []);
  if (!ready || !user || !db) return null;
  const service = operatorService(db.services, todayISO(), storedId);
  if (!service) {
    return (
      <div className="page">
        <h1 className="font-serif text-4xl">조작</h1>
        <Link href="/services" className="btn mt-6">
          예배 목록
        </Link>
      </div>
    );
  }
  return (
    <LiveConsole
      service={service}
      people={db.people}
      songs={db.songs}
      churchName={db.settings.churchName}
      canStart={settingsReady(db.settings)}
      access={{
        output: can(user.roles, "screen.output"),
        bulletin: can(user.roles, "screen.bulletin"),
        editor: can(user.roles, "screen.editor"),
      }}
    />
  );
}
