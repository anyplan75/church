import { denyApi } from "@/lib/guard";
import { liveView } from "@/lib/live-view";
import { readDb } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await denyApi(["screen.live", "screen.output"]);
  if (denied) return denied;
  const { id } = await context.params;
  const view = liveView(readDb(), id);
  if (!view) return Response.json({ error: "없는 예배입니다." }, { status: 404 });
  return Response.json(view);
}
