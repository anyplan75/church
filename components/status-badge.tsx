import type { ServiceStatus } from "@/lib/types";
import { statusLabel } from "@/lib/worship";

const CLASS_NAME: Record<ServiceStatus, string> = {
  planning: "badge badge-gold",
  ready: "badge badge-pine",
  live: "badge badge-wine",
  done: "badge badge-muted",
};

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span className={CLASS_NAME[status]}>
      {status === "live" ? <span className="live-dot" aria-hidden="true" /> : null}
      {statusLabel(status)}
    </span>
  );
}
