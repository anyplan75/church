import Link from "next/link";

const TASKS = [
  { href: "/roster", label: "교인" },
  { href: "/attendance", label: "출석" },
  { href: "/bulletin", label: "주보" },
  { href: "/finance", label: "재정" },
  { href: "/approvals", label: "승인" },
] as const;

export default function HomePage() {
  return (
    <section className="grid gap-8">
      <h1 className="text-[clamp(1.8rem,1.2rem+1.5vw,2.4rem)] font-semibold leading-tight">운영</h1>
      <ul className="grid list-none gap-3 sm:grid-cols-2">
        {TASKS.map((task) => (
          <li key={task.href}>
            <Link
              href={task.href}
              data-testid={`home-${task.label}`}
              className="block rounded-3xl bg-[#fffaf3] px-5 py-8 text-[clamp(1.35rem,1.1rem+0.8vw,1.8rem)] font-semibold leading-snug"
            >
              {task.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
