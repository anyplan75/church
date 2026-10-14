import { COPYRIGHT_LINES } from "@/lib/copyright";

export function CopyrightNotice() {
  return (
    <aside className="card space-y-2 p-4 text-sm leading-relaxed text-ink">
      {COPYRIGHT_LINES.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </aside>
  );
}
