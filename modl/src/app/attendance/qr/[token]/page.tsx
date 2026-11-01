import { CheckInToast } from "@/components/check-in-toast";
import { ErrorNote } from "@/components/form-note";
import { TermButton } from "@/components/term-button";
import { TermHeading } from "@/components/term-heading";
import { selfCheckInAction } from "@/server/attendance/actions";
import { loadCheckIn } from "@/server/attendance/service";

export const dynamic = "force-dynamic";

export default async function QrCheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const page = await loadCheckIn(token);
  const path = `/attendance/qr/${token}`;

  return (
    <section className="grid min-w-0 gap-4">
      <TermHeading termKey="attendance" level={1} />
      <ErrorNote message={query.error} />
      {query.ok === "checked" ? <CheckInToast /> : null}
      {query.ok === "kept" ? (
        <p role="status" className="rounded-2xl bg-[#fffaf3] px-4 py-3 leading-relaxed">
          이 모임에는 이미 출석이 남아 있어 다시 적지 않았습니다.
        </p>
      ) : null}
      {!page.ok ? (
        <p className="leading-relaxed">{page.message}</p>
      ) : (
        <>
          <p className="break-words text-[clamp(1.15rem,1rem+0.4vw,1.4rem)] font-semibold leading-snug">{page.title}</p>
          <p className="leading-relaxed text-[#5c5148]">{page.sessionDate}</p>
          <p className="break-all leading-relaxed" data-testid="qr-path">
            {path}
          </p>
          {page.canCheck ? (
            <>
              <form id="check-in-form" action={selfCheckInAction}>
                <input type="hidden" name="token" value={token} />
              </form>
              <TermButton termKey="check_in_btn" testId="check-in-btn" toastOnPress={false} submitFormId="check-in-form" />
            </>
          ) : (
            <p className="leading-relaxed">{page.blocked}</p>
          )}
        </>
      )}
    </section>
  );
}
