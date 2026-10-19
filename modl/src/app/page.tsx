"use client";

import Link from "next/link";
import { TermButton } from "@/components/term-button";
import { TermHeading } from "@/components/term-heading";
import { useCommunityTerm } from "@/components/use-community-term";
import { useCommunityTermState } from "@/components/community-term-provider";
import { ACTION_BUTTON_KEYS, type MenuKey, type RoleLabelKey, type TermKey } from "@/theme/dictionary";
import { MENU_ITEMS } from "@/theme/menus";
import type { LanguageMode } from "@/theme/types";

const MODES: Array<{ id: LanguageMode; label: string; help: string }> = [
  {
    id: "JEJU_DUAL",
    label: "제주어와 표준어 함께",
    help: "큰 제목은 제주어, 작은 글씨는 표준어",
  },
  {
    id: "JEJU_ONLY",
    label: "제주어만",
    help: "제주어 제목만 보여 줍니다",
  },
  {
    id: "STANDARD",
    label: "표준어만",
    help: "표준어만 보여 줍니다",
  },
];

const WORK_LINKS: Array<{ href: string; termKey: TermKey }> = [
  { href: "/account", termKey: "account" },
  { href: "/community/new", termKey: "create_community" },
  { href: "/join", termKey: "apply_join" },
  { href: "/roster", termKey: "roster" },
  { href: "/invite", termKey: "invite" },
  { href: "/approvals", termKey: "approval" },
  { href: "/group", termKey: "group" },
  { href: "/bulletin", termKey: "bulletin" },
];

const PREVIEW_MENUS: MenuKey[] = ["group", "bulletin", "prayer", "website"];
const ROLE_KEYS: RoleLabelKey[] = ["PASTOR", "EXECUTIVE", "CELL_LEADER", "MEMBER", "NEWCOMER", "UNREGISTERED", "GUEST"];

function ShortcutRow({ menuKey, shortcut }: { menuKey: MenuKey; shortcut: string }) {
  const term = useCommunityTerm(menuKey);
  return (
    <li className="leading-snug">
      <span className="font-semibold">g {shortcut}</span>
      <span className="text-[#5c5148]"> — {term.primary}</span>
    </li>
  );
}

function WorkLink({ href, termKey }: { href: string; termKey: TermKey }) {
  const term = useCommunityTerm(termKey);
  return (
    <Link href={href} className="block rounded-2xl bg-[#fffaf3] px-4 py-3 font-semibold leading-snug">
      {term.primary}
    </Link>
  );
}

export default function HomePage() {
  const { languageMode, setLanguageMode, languageLocked } = useCommunityTermState();

  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <p className="font-semibold text-[#1d6b45]">모들</p>
        <h1 className="text-[clamp(1.8rem,1.2rem+2vw,3rem)] font-semibold leading-tight text-balance">
          우리 공동체 말투
        </h1>
        <p className="max-w-2xl leading-relaxed text-[#5c5148]">
          화면 이름은 공동체가 고른 말투로만 바뀝니다. 아래 세 가지 중 하나를 누르면 메뉴 이름이 바로 달라집니다.
        </p>
      </header>

      <section aria-label="말투 고르기" className="grid gap-3">
        {MODES.map((mode) => {
          const selected = languageMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={selected}
              disabled={languageLocked}
              className={`rounded-2xl border px-4 py-3 text-left leading-snug ${
                selected ? "border-[#1d6b45] bg-[#e7f3ec]" : "border-[#e4d8c8] bg-[#fffaf3]"
              }`}
              onClick={() => setLanguageMode(mode.id)}
            >
              <span className="block font-semibold">{mode.label}</span>
              <span className="mt-1 block text-[0.92em] text-[#5c5148]">{mode.help}</span>
            </button>
          );
        })}
      </section>

      <section className="grid gap-3">
        <h2 className="text-[clamp(1.2rem,1rem+0.5vw,1.5rem)] font-semibold">이번 단계에서 여는 일</h2>
        <div className="grid gap-2">
          {WORK_LINKS.map((item) => (
            <WorkLink key={item.href} href={item.href} termKey={item.termKey} />
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-[clamp(1.2rem,1rem+0.5vw,1.5rem)] font-semibold">이 말투로 보이는 이름</h2>
        {PREVIEW_MENUS.map((key) => (
          <TermHeading key={key} termKey={key} level={2} />
        ))}
        <TermHeading termKey="long_term_absentee" level={3} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-[clamp(1.2rem,1rem+0.5vw,1.5rem)] font-semibold">버튼 말 미리보기</h2>
        <p className="leading-relaxed text-[#5c5148]">
          지금은 말을 보여 주는 자리입니다. 출석, 기도, 묵상은 아직 저장하지 않습니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ACTION_BUTTON_KEYS.map((key) => (
            <TermButton key={key} termKey={key} />
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-[clamp(1.2rem,1rem+0.5vw,1.5rem)] font-semibold">호칭</h2>
        {ROLE_KEYS.map((key) => (
          <TermHeading key={key} termKey={key} level={3} />
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="text-[clamp(1.2rem,1rem+0.5vw,1.5rem)] font-semibold">키보드로 이동</h2>
        <p className="leading-relaxed text-[#5c5148]">
          글자 키 g 를 누른 뒤 1초 안에 다음 글자를 누르면 그 메뉴로 갑니다. 글을 쓰는 칸에서는 움직이지 않습니다.
        </p>
        <ul className="grid gap-1">
          <li className="leading-snug">
            <span className="font-semibold">g h</span>
            <span className="text-[#5c5148]"> — 첫 화면</span>
          </li>
          {MENU_ITEMS.map((item) => (
            <ShortcutRow key={item.key} menuKey={item.key} shortcut={item.shortcut} />
          ))}
        </ul>
      </section>
    </div>
  );
}
