import { redirect } from "next/navigation";
import { loadChurchSettings } from "@/server/map/board";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; count?: string; missed?: string }>;
}) {
  const query = await searchParams;
  const page = await loadChurchSettings();
  if (page.ok) {
    const params = new URLSearchParams();
    if (query.error) params.set("error", query.error);
    if (query.ok) params.set("ok", query.ok);
    if (query.count) params.set("count", query.count);
    if (query.missed) params.set("missed", query.missed);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    redirect(`/account${suffix}`);
  }

  return (
    <section className="grid gap-4">
      <h1 className="page-title text-[clamp(1.45rem,1.1rem+1.2vw,2.15rem)] leading-snug">설정</h1>
      <p role="alert" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">
        이 설정은 열 수 없습니다.
      </p>
    </section>
  );
}
