import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** 모임 편성은 모들 관리자 탭 한곳에 둡니다. */
export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const query = await searchParams;
  const year = query.year && /^\d{4}$/.test(query.year) ? `&year=${query.year}` : "";
  redirect(`/account?tab=gathering${year}`);
}
