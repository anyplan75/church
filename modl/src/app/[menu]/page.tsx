import { notFound, redirect } from "next/navigation";
import { AccessScreen } from "@/components/access-screen";
import { TermHeading } from "@/components/term-heading";
import { loadShellState } from "@/server/community/service";
import { isMenuKey } from "@/theme/menus";

export default async function MenuPlaceholderPage({
  params,
}: {
  params: Promise<{ menu: string }>;
}) {
  const { menu } = await params;
  if (menu === "prayer_letter") notFound();
  if (!isMenuKey(menu)) notFound();
  const shell = await loadShellState();
  if (menu === "approval") {
    if (!shell.officer) return <AccessScreen />;
    redirect("/account?tab=church");
  }
  if (menu === "newcomer") {
    if (!shell.officer) return <AccessScreen />;
  } else if (!shell.menuHrefs.includes(`/${menu}`)) {
    return <AccessScreen />;
  }

  return (
    <section className="grid gap-4">
      <TermHeading termKey={menu} pageTitle />
      <div className="rounded-3xl border border-dashed border-[#cbbba6] bg-[#fffaf3] p-6 leading-relaxed">
        <p className="text-[clamp(1.1rem,1rem+0.4vw,1.4rem)] font-semibold">곧 열립니다.</p>
        <p className="mt-2 text-[#5c5148]">
          이 메뉴의 실제 일은 아직 열리지 않았습니다. 지금은 이름과 자리만 있습니다.
        </p>
      </div>
    </section>
  );
}
