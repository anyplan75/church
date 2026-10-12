import { syncReminders } from "@/lib/reminders";
import { updateDb } from "@/lib/store";

export async function GET() {
  const db = updateDb((current) => {
    syncReminders(current);
  });
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  return Response.json({
    due: db.reminders.filter((reminder) => reminder.status === "due"),
    upcoming: db.reminders.filter((reminder) => reminder.status === "scheduled" && Date.parse(reminder.dueAt) - now < week),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = new Set(Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : []);
  updateDb((db) => {
    for (const reminder of db.reminders) {
      if (ids.has(reminder.id) && reminder.status === "due") reminder.status = "sent";
    }
  });
  return Response.json({ ok: true });
}
