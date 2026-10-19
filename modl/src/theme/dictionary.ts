/**
 * 모들 말투 사전.
 * 화면 문구는 이 사전을 거쳐서만 나갑니다.
 * 제주 가옥과 공동체 말만 씁니다.
 */

export const TERM_DICTIONARY = {
  menus: {
    bulletin: {
      standard: "모바일 주보",
      jeju_primary: "주일 기별",
      jeju_alt: "하영 기별",
    },
    attendance: {
      standard: "출석 확인",
      jeju_primary: "완수광?",
      jeju_alt: "얼굴 보게 마씸",
    },
    group: {
      standard: "소그룹·모임",
      jeju_primary: "모들",
      jeju_alt: "구들",
    },
    leader: {
      standard: "리더·사역자",
      jeju_primary: "테우리",
      jeju_alt: "길잡이",
    },
    qt: {
      standard: "매일 묵상",
      jeju_primary: "말씀 트멍",
      jeju_alt: "모심 묵상",
    },
    prayer: {
      standard: "기도제목 나눔",
      jeju_primary: "기도 수눌음",
      jeju_alt: "모심 나눔",
    },
    prayer_letter: {
      standard: "기도 편지",
      jeju_primary: "다정한 기별",
      jeju_alt: "모심 쪽지",
    },
    calendar: {
      standard: "공동체 일정",
      jeju_primary: "혼디 날짜",
      jeju_alt: "모이는 날",
    },
    archive: {
      standard: "행사 기록·사진첩",
      jeju_primary: "혼디 걸은 길",
      jeju_alt: "추억 고팡",
    },
    newcomer: {
      standard: "새가족 안내",
      jeju_primary: "새 괸당 마중",
      jeju_alt: "마중 올레",
    },
    finance: {
      standard: "재정·회계 관리",
      jeju_primary: "공동체 살림",
      jeju_alt: "고팡 지킴",
    },
    website: {
      standard: "외부 소개 홈페이지",
      jeju_primary: "열린 안뜨레",
      jeju_alt: "마중 상방",
    },
  },
  actions: {
    check_in_btn: {
      standard: "출석하기",
      jeju: "예, 왔수다!",
      toast: "반갑수다! 오늘 출석이 기록됐수다.",
      standardToast: "오늘 출석을 기록했습니다.",
    },
    pray_together_btn: {
      standard: "함께 기도하기",
      jeju: "혼디 기도햄수다",
      toast: "지체의 기도 짐을 혼디 나누어 졌수다.",
      standardToast: "함께 기도하는 마음을 남겼습니다.",
    },
    submit_qt_btn: {
      standard: "묵상 작성 완료",
      jeju: "말씀 담았수다",
      toast: "오늘 모심에 귀한 말씀을 담았수다.",
      standardToast: "오늘 묵상을 남겼습니다.",
    },
    grace_reaction_btn: {
      standard: "은혜 나눔·아멘",
      jeju: "은혜 쏨빡!",
      toast: "성령의 은혜가 쏨빡(충만히) 전해졌수다.",
      standardToast: "은혜가 전해졌습니다.",
    },
    long_term_absentee: {
      standard: "장기 결석자 알림",
      jeju: "보고픈 괸당",
      hint: "오랫동안 얼굴을 보지 못해 안부가 궁금한 식구 목록",
    },
  },
  roles: {
    PASTOR: {
      standard: "사역자",
      jeju_primary: "큰 테우리",
      jeju_alt: "길잡이",
    },
    EXECUTIVE: {
      standard: "임원",
      jeju_primary: "살림꾼",
    },
    CELL_LEADER: {
      standard: "소그룹 리더",
      jeju_primary: "모들 테우리",
      jeju_alt: "구들 테우리",
    },
    MEMBER: {
      standard: "구성원",
      jeju_primary: "괸당",
    },
    NEWCOMER: {
      standard: "새가족",
      jeju_primary: "새 괸당",
    },
    UNREGISTERED: {
      standard: "미가입 명부",
      jeju_primary: "기다리는 괸당",
    },
    GUEST: {
      standard: "외부 방문자",
      jeju_primary: "마중 손님",
    },
  },
} as const;

export type MenuKey = keyof typeof TERM_DICTIONARY.menus;
export type ActionKey = keyof typeof TERM_DICTIONARY.actions;
export type RoleLabelKey = keyof typeof TERM_DICTIONARY.roles;
export type TermKey = MenuKey | ActionKey | RoleLabelKey;

export const ACTION_BUTTON_KEYS = [
  "check_in_btn",
  "pray_together_btn",
  "submit_qt_btn",
  "grace_reaction_btn",
] as const;

export type ActionButtonKey = (typeof ACTION_BUTTON_KEYS)[number];
