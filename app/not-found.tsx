import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page text-center">
      <p className="text-sm text-gold">404</p>
      <h1 className="mt-2 font-serif text-4xl">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-muted">주소를 다시 확인하거나 이번 주 예배로 돌아가 주세요.</p>
      <Link href="/" className="btn btn-primary mt-6">
        이번 주로
      </Link>
    </div>
  );
}
