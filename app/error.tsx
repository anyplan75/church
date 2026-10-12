"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <h1 className="font-serif text-4xl">화면을 불러오지 못했습니다</h1>
      <p className="mt-3 text-muted">잠시 후 다시 시도해 주세요.</p>
      <button type="button" className="btn btn-primary mt-6" onClick={() => reset()}>
        다시 시도
      </button>
    </div>
  );
}
