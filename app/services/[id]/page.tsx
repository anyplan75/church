import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceEditor } from "@/components/service-editor";
import { readDb } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const service = readDb().services.find((item) => item.id === id);
  return { title: service ? `${service.title} · 예배 운영` : "예배 운영" };
}

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = readDb();
  const service = db.services.find((item) => item.id === id);
  if (!service) notFound();
  return <ServiceEditor key={service.id} service={service} people={db.people} songs={db.songs} />;
}
