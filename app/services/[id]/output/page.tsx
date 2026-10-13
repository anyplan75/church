import { notFound } from "next/navigation";
import { Projector } from "@/components/projector";
import { requireScreen } from "@/lib/guard";
import { liveView } from "@/lib/live-view";
import { readDb } from "@/lib/store";

export const metadata = { title: "송출 · 예배 운영" };

export default async function OutputPage({ params }: { params: Promise<{ id: string }> }) {
  await requireScreen("screen.output");
  const { id } = await params;
  const view = liveView(readDb(), id);
  if (!view) notFound();
  return <Projector initial={view} />;
}
