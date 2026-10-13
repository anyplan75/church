"use client";

import { useEffect } from "react";
import { dueReminders, markRemindersSent } from "@/lib/app-db";

export function ReminderWatcher() {
  useEffect(() => {
    let stop = false;
    const seen = new Set<string>();

    function tick() {
      try {
        if (stop) return;
        const fresh = dueReminders().filter((reminder) => !seen.has(reminder.id));
        if (fresh.length === 0 || typeof Notification === "undefined" || Notification.permission !== "granted") return;
        for (const reminder of fresh) {
          new Notification("예배 일정", { body: reminder.message });
          seen.add(reminder.id);
        }
        markRemindersSent(fresh.map((reminder) => reminder.id));
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
