/** 권한 없는 주소에서는 내용 없이 이 안내만 보여 줍니다. */
export function BlockedScreen() {
  return (
    <section className="grid gap-4">
      <h1 className="page-title text-[clamp(1.45rem,1.1rem+1.2vw,2.15rem)] leading-snug">화면</h1>
      <p role="alert" className="rounded-2xl bg-[#fde8e2] px-4 py-3 leading-relaxed">
        이 화면은 열 수 없습니다.
      </p>
    </section>
  );
}
