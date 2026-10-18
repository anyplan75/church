/** 코니아 스타일 얇은 선 아이콘 */

type IconProps = { className?: string; active?: boolean };

export function IconPeople({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3.5 19c.8-3.2 2.8-5 5.5-5s4.7 1.8 5.5 5" />
      <path d="M14 14c2.2 0 4 1.4 4.8 4" />
    </svg>
  );
}

export function IconBoard({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

export function IconChurch({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 3v3M12 6l-7 4v11h14V10l-7-4z" />
      <path d="M10 21v-5h4v5" />
      <path d="M12 9v2" />
    </svg>
  );
}

export function IconChat({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function IconMy({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1.2-3.5 3.5-5 7-5s5.8 1.5 7 5" />
    </svg>
  );
}

export function IconBell({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconSearch({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

export function IconPencil({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 20l4.5-1L19 8.5 15.5 5 5 15.5 4 20z" />
      <path d="M13.5 7l3.5 3.5" />
    </svg>
  );
}

export function IconBookmark({ className = "h-5 w-5", filled }: IconProps & { filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M7 4h10v16l-5-3-5 3V4z" />
    </svg>
  );
}

export function IconHeart({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z" />
    </svg>
  );
}

export function IconEye({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function IconMenu({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

export function IconUpload({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 16V5M8 9l4-4 4 4" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function IconShield({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
    </svg>
  );
}

export function IconMegaphone({ className = "h-12 w-12" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M4 10v4l10 3V7L4 10z" />
      <path d="M14 9.5c2 .8 4 2 5.5 3.5M14 14.5c2-.8 4-2 5.5-3.5" />
      <path d="M7 14l1 5h3" />
    </svg>
  );
}

export function IconVerified({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#3b82f6" aria-hidden>
      <path d="M12 2l2.2 2.2L17 3.5l.3 2.8L20 8l-1.7 2.2.7 2.8-2.8.3L15.5 16l-2.2-1.2L11 16l-.7-2.7-2.8-.3.7-2.8L6.5 8l2.7-1.7L9.5 3.5 12 2z" />
      <path d="M10 12l1.5 1.5L14.5 10" stroke="white" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function CategoryGlyph({ icon, className = "h-5 w-5 text-white" }: { icon: string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true as const };
  switch (icon) {
    case "church":
      return (
        <svg {...common}>
          <path d="M12 4v2M8 22V11l4-3 4 3v11" />
          <path d="M10 22v-4h4v4" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M5 5h6a3 3 0 0 1 3 3v11H8a3 3 0 0 0-3 3V5z" />
          <path d="M19 5h-6" />
        </svg>
      );
    case "hands":
      return (
        <svg {...common}>
          <path d="M12 20c-4-3-6-6-6-9a3 3 0 0 1 6 0 3 3 0 0 1 6 0c0 3-2 6-6 9z" />
        </svg>
      );
    case "music":
      return (
        <svg {...common}>
          <path d="M9 18V6l10-2v12" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="16" r="2" />
        </svg>
      );
    case "dumbbell":
      return (
        <svg {...common}>
          <path d="M4 10h3v4H4zM17 10h3v4h-3zM7 12h10M3 11v2M21 11v2" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 19s-6-4-6-9a3.5 3.5 0 0 1 6-2 3.5 3.5 0 0 1 6 2c0 5-6 9-6 9z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="11" rx="2" />
          <path d="M9 8V6h6v2" />
        </svg>
      );
    case "palette":
      return (
        <svg {...common}>
          <path d="M12 4a8 8 0 1 0 0 16h1.5a2 2 0 0 0 0-4H12" />
          <circle cx="8" cy="10" r="1" fill="currentColor" />
          <circle cx="11" cy="7.5" r="1" fill="currentColor" />
          <circle cx="15" cy="8.5" r="1" fill="currentColor" />
        </svg>
      );
    case "grad":
      return (
        <svg {...common}>
          <path d="M3 10l9-4 9 4-9 4-9-4z" />
          <path d="M7 12v4c2 2 8 2 10 0v-4" />
        </svg>
      );
    case "baby":
      return (
        <svg {...common}>
          <circle cx="12" cy="10" r="4" />
          <path d="M7 19c1-2.5 3-3.5 5-3.5s4 1 5 3.5" />
        </svg>
      );
    case "utensils":
      return (
        <svg {...common}>
          <path d="M8 4v7M6 4v4a2 2 0 0 0 4 0V4M8 11v9M16 4v7c0 1.5-1 2-2 2v6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="2.5" />
          <circle cx="15" cy="10" r="2" />
          <path d="M5 18c1-3 3-4.5 5.5-4.5S15 15 16 18" />
        </svg>
      );
  }
}
