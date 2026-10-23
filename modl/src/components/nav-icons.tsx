/** 분류 메뉴용 선 아이콘입니다. 바깥 서비스의 그림을 쓰지 않습니다. */

type IconSpec = {
  lines: string[];
  circles?: Array<[number, number, number]>;
};

const ICONS: Record<string, IconSpec> = {
  "/roster": { lines: ["M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"], circles: [[12, 7, 4]] },
  "/group": {
    lines: ["M17 21v-2a3 3 0 0 0-3-3h-2", "M8 21v-2a4 4 0 0 1 4-4"],
    circles: [
      [9, 7, 3.2],
      [17, 8, 2.4],
    ],
  },
  "/invite": { lines: ["M4 6h16v12H4z", "M4 7l8 6 8-6"] },
  "/newcomer": { lines: ["M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2", "M19 8v6", "M16 11h6"], circles: [[9, 7, 3.2]] },
  "/attendance": { lines: ["M5 4h14v16H5z", "M8 12l3 3 5-6"] },
  "/bulletin": { lines: ["M7 3h8l5 5v13H7z", "M15 3v5h5", "M9 13h6", "M9 17h4"] },
  "/qt": { lines: ["M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z", "M5 4a3 3 0 0 0-3 3v13"] },
  "/prayer": { lines: ["M12 20s-6-3.6-6-8a3.5 3.5 0 0 1 6-2 3.5 3.5 0 0 1 6 2c0 4.4-6 8-6 8z"] },
  "/prayer_letter": { lines: ["M4 5h16v14H4z", "M4 6l8 6 8-6"] },
  "/calendar": { lines: ["M5 5h14v15H5z", "M5 9h14", "M8 3v4", "M16 3v4"] },
  "/finance": { lines: ["M12 3v18", "M8 8c0-1.5 1.8-2.5 4-2.5S16 6.5 16 8s-1.8 2.5-4 2.5S8 12 8 13.5 9.8 16 12 16s4-1 4-2.5"] },
  "/approvals": { lines: ["M8 12l2.5 2.5L16 9"], circles: [[12, 12, 9]] },
  "/survey": { lines: ["M8 6h12", "M8 12h12", "M8 18h12", "M4 6h.01", "M4 12h.01", "M4 18h.01"] },
  "/minutes": { lines: ["M8 3h8v18l-4-2-4 2z", "M10 8h4", "M10 12h4"] },
  "/archive": { lines: ["M3 7h18v4H3z", "M5 11v8h14v-8", "M10 15h4"] },
  "/discussion": { lines: ["M4 5h16v9H8l-4 3z", "M7 9h10", "M7 12h6"] },
  "/leader": { lines: ["M12 3l2.4 4.8 5.3.8-3.8 3.7.9 5.2L12 15.8 7.2 17.5l.9-5.2L4.3 8.6l5.3-.8z"] },
  "/website": { lines: ["M3 12h18", "M12 3c2 2.5 3 5.6 3 9s-1 6.5-3 9c-2-2.5-3-5.6-3-9s1-6.5 3-9z"], circles: [[12, 12, 9]] },
  "/map": { lines: ["M12 21s6-5 6-10a6 6 0 1 0-12 0c0 5 6 10 6 10z"], circles: [[12, 10, 2]] },
  account: { lines: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"], circles: [[12, 7, 4]] },
};

export function NavIcon({ name }: { name: string }) {
  const icon = ICONS[name] ?? ICONS.account;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="shrink-0 overflow-hidden">
      {icon.circles?.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.7" />
      ))}
      {icon.lines.map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
