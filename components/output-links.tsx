import Link from "next/link";
import { outputLinks } from "@/lib/roles";

export function OutputLinks({ id, className = "btn btn-quiet" }: { id: string; className?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {outputLinks(id).map((link) => (
        <Link key={link.href} href={link.href} target="_blank" className={className}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
