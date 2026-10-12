"use client";

import { acceptReadyChecks, checkItems, type CheckContext } from "@/lib/checklist";
import type { Service } from "@/lib/types";

export function ChecklistPanel({
  service,
  context,
  onChange,
}: {
  service: Service;
  context: CheckContext;
  onChange: (checks: Record<string, boolean>) => void;
}) {
  const items = checkItems(service, context);
  const groups = [...new Set(items.map((item) => item.group))];
  const required = items.filter((item) => item.required);
  const done = required.filter((item) => item.checked).length;

  return (
    <section className="card mt-8 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">예배 전 점검</h2>
          <p className="mt-1 text-sm text-muted">
            필수 {done}/{required.length}. 준비된 항목을 한 번에 체크한 뒤, 현장에서 직접 보는 항목은 사람이 확인합니다.
          </p>
        </div>
        <button type="button" className="btn btn-quiet" onClick={() => onChange(acceptReadyChecks(service, context))}>
          준비된 항목 체크
        </button>
      </div>
      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-gold">{group}</h3>
            <ul>
              {items
                .filter((item) => item.group === group)
                .map((item) => (
                  <li key={item.id} className="check-row">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={item.checked}
                      onChange={(event) => onChange({ ...service.checks, [item.id]: event.target.checked })}
                    />
                    <div className="min-w-0">
                      <p>
                        {item.label}
                        {item.required ? "" : " · 선택"}
                        <span className={item.ready ? "ml-2 text-sm text-pine" : "ml-2 text-sm text-muted"}>
                          {item.auto ? (item.ready ? "준비됨" : "아직 아님") : "직접 확인"}
                        </span>
                      </p>
                      <p className="text-sm text-muted">{item.detail}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
