import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { homeFor } from "@/lib/roles";

export const metadata = { title: "권한 없음 · 예배 운영" };

export default async function DeniedPage() {
  const user = await requireUser();
  const home = homeFor(user.roles);

  return (
    <div className="page max-w-xl">
      <p className="text-sm font-semibold text-gold">권한</p>
      <h1 className="mt-1 font-serif text-4xl">이 화면을 열 수 없습니다</h1>
      <p className="mt-3 text-muted">가진 역할에 없는 화면이거나, 수정이 막혀 있습니다. 설정·계정 역할이 있는 사람에게 역할을 요청해 주세요.</p>
      <Link href={home} className="btn btn-primary mt-6">
        내 화면으로
      </Link>
    </div>
  );
}
