"use client";

import { useEffect } from "react";

type DueReminder = { id: string; message: string };

export function ReminderWatcher() {
  useEffect(() => {
    let stop = false;
    const seen = new Set<string>();

    async function tick() {
      try {
        const response = await fetch("/api/reminders", { cache: "no-store" });
        if (!response.ok || stop) return;
        const data = (await response.json()) as { due?: DueReminder[] };
        const fresh = (data.due ?? []).filter((reminder) => !seen.has(reminder.id));
        if (fresh.length === 0 || typeof Notification === "undefined" || Notification.permission !== "granted") return;
        for (const reminder of fresh) {
          new Notification("예배 일정", { body: reminder.message });
          seen.add(reminder.id);
        }
        await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: fresh.map((reminder) => reminder.id) }),
        });
      } catch {
        // 알림 확인이 실패해도 예배 화면은 그대로 둡니다.
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 30000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
