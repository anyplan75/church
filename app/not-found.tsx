import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { homeFor } from "@/lib/roles";

export default async function NotFound() {
  const user = await getCurrentUser();
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
