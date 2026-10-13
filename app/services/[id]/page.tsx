import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceEditor } from "@/components/service-editor";
import { requireScreen } from "@/lib/guard";
import { can } from "@/lib/roles";
import { syncReminders } from "@/lib/reminders";
import { updateDb } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await requireScreen("screen.editor");
  const { id } = await params;
  const service = updateDb((current) => syncReminders(current)).services.find((item) => item.id === id);
  return { title: service ? `${service.title} · 예배 운영` : "예배 운영" };
}

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireScreen("screen.editor");
  const { id } = await params;
  const db = updateDb((current) => syncReminders(current));
  const service = db.services.find((item) => item.id === id);
  if (!service) notFound();
  return (
    <ServiceEditor
      key={service.id}
      service={service}
      people={db.people}
      songs={db.songs}
      settings={db.settings}
      reminders={db.reminders}
      access={{
        live: can(user.roles, "screen.live"),
        output: can(user.roles, "screen.output"),
        bulletin: can(user.roles, "screen.bulletin"),
      }}
    />
  );
}
