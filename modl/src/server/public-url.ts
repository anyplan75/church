/**
 * 임시 공개 통로에서 받은 요청을 그 주소로 되돌립니다.
 * 개발 서버 안의 localhost 로 브라우저를 보내지 않습니다.
 */

export function sameOriginPath(request: Request, path: string): URL {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host && proto && host !== "localhost" && !host.startsWith("localhost:")) {
    return new URL(path, `${proto}://${host}`);
  }
  return new URL(path, request.url);
}
