import { ROLES, type Role } from "@/lib/roles";

export function RoleFields({ selected }: { selected: readonly Role[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-muted">역할</legend>
      <p className="text-sm text-muted">한 이메일이 역할을 여러 개 가질 수 있습니다.</p>
      <div className="grid gap-2">
        {ROLES.map((role) => (
          <label key={role.id} className="flex items-start gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
            <input className="mt-1" type="checkbox" name="roles" value={role.id} defaultChecked={selected.includes(role.id)} />
            <span>
              <span className="font-semibold">{role.label}</span>
              <span className="mt-0.5 block text-muted">{role.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
