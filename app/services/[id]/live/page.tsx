import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveConsole } from "@/components/live-console";
import { requireScreen } from "@/lib/guard";
import { can } from "@/lib/roles";
import { readDb } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireScreen("screen.live");
  const { id } = await params;
  const service = readDb().services.find((item) => item.id === id);
  return { title: service ? `${service.title} 진행 · 예배 운영` : "예배 진행" };
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireScreen("screen.live");
  const { id } = await params;
  const db = readDb();
  const service = db.services.find((item) => item.id === id);
  if (!service) notFound();
  return (
    <LiveConsole
      service={service}
      people={db.people}
      songs={db.songs}
      churchName={db.settings.churchName}
      access={{
        output: can(user.roles, "screen.output"),
        bulletin: can(user.roles, "screen.bulletin"),
        editor: can(user.roles, "screen.editor"),
      }}
    />
  );
}
