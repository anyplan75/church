#!/bin/bash
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=""
for candidate in \
  "$HERE/은혜로운 예배.app" \
  "$HERE/../은혜로운 예배.app" \
  "/Applications/은혜로운 예배.app"
do
  if [ -d "$candidate" ]; then APP="$candidate"; break; fi
done
if [ -z "$APP" ]; then
  osascript -e 'display dialog "은혜로운 예배.app 을 찾지 못했습니다. Applications에 설치한 뒤 다시 실행해 주세요." buttons {"확인"} default button 1'
  exit 1
fi
open -n -a "$APP" --args --mode=operator
