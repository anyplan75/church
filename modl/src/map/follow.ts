/**
 * 따라가기 카메라가 경로 속도에 맞춰 얼마나 넓게 볼지 정합니다.
 * 속도가 응답에 없으면 중간 간격만 씁니다.
 */

/** 빠를수록 넓게, 느릴수록 그 구간에 가깝게 봅니다. 단위는 미터입니다. */
export function followWindowMeters(speedMps: number | null): number {
  if (speedMps === null || !Number.isFinite(speedMps) || speedMps < 0) return 450;
  if (speedMps >= 12) return 1600;
  if (speedMps <= 3) return 160;
  return 600;
}
