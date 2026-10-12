"use client";

import { useState } from "react";

export function NotifyButton() {
  const [label, setLabel] = useState("이 브라우저에서 알림 받기");

  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={() => {
        if (typeof Notification === "undefined") {
          setLabel("이 브라우저는 알림을 지원하지 않습니다");
          return;
        }
        void Notification.requestPermission().then((result) => {
          setLabel(result === "granted" ? "알림을 받습니다" : "알림이 허용되지 않았습니다");
        });
      }}
    >
      {label}
    </button>
  );
}
