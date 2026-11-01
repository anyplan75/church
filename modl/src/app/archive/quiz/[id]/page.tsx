import { redirect } from "next/navigation";

export default async function OldQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/quiz/${id}`);
}
