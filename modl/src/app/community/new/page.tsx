import { ErrorNote } from "@/components/form-note";
import { LanguageField, PlanField, SubmitButton, TermField } from "@/components/term-field";
import { TermText } from "@/components/term-text";
import { createCommunityAction } from "@/server/community/actions";

export const dynamic = "force-dynamic";

export default async function NewCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <section className="grid gap-4">
      <h1 className="text-[clamp(1.6rem,1.2rem+1vw,2.2rem)] font-semibold leading-tight">
        <TermText termKey="create_community" />
      </h1>
      <p className="leading-relaxed text-[#5c5148]">
        공동체를 만든 사람이 큰 테우리가 됩니다. 용어 덮어쓰기를 비우면 기본 사전을 씁니다.
      </p>
      <ErrorNote message={query.error} />
      <form action={createCommunityAction} id="community-form" className="grid gap-3">
        <TermField termKey="field_community_name" name="name" required />
        <TermField termKey="field_church" name="churchName" required />
        <TermField termKey="field_denomination" name="denomination" required />
        <TermField termKey="field_slug" name="slug" required />
        <TermField termKey="field_phone" name="phone" autoComplete="tel" />
        <PlanField />
        <LanguageField />
        <label className="flex items-start gap-2 leading-snug">
          <input type="checkbox" name="requireApproval" value="yes" className="mt-1" />
          <TermText termKey="require_approval" />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">
            <TermText termKey="field_overrides" />
          </span>
          <textarea
            name="overrides"
            rows={4}
            className="w-full rounded-xl border border-[#e4d8c8] bg-white px-3 py-2 leading-snug"
            placeholder='{"group":{"select":"alt"}}'
          />
        </label>
        <SubmitButton termKey="create_community" />
      </form>
    </section>
  );
}
