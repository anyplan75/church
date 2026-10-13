export function spawn() {
  throw new Error("이 브라우저에서는 실행할 수 없습니다.");
}

export function spawnSync() {
  return { status: 1, stdout: "", stderr: "" };
}
