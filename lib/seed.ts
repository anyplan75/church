import type { Db, Service, WorshipItem } from "./types";
import { addDays, mondayOf, templateItems, todayISO } from "./worship";

function withIds(prefix: string, items: Array<Omit<WorshipItem, "id">>): WorshipItem[] {
  return items.map((item, index) => ({ ...item, id: `${prefix}-${index + 1}` }));
}

function patch(items: WorshipItem[], index: number, extra: Partial<WorshipItem>): WorshipItem[] {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...extra } : item));
}

export function buildSeed(today = todayISO()): Db {
  const monday = mondayOf(today);
  const lastSunday = addDays(monday, -1);
  const tuesday = addDays(monday, 1);
  const wednesday = addDays(monday, 2);
  const friday = addDays(monday, 4);
  const sunday = addDays(monday, 6);

  const finished = patch(withIds("last-sun", templateItems("sunday-2")), 0, {});
  const doneOrder = patch(
    patch(
      patch(
        patch(
          patch(
            patch(
              patch(
                patch(finished, 1, { songId: "song-1" }),
                3,
                { songId: "song-grace", personId: "person-worship", note: "반주 정하람" },
              ),
              4,
              { personId: "person-elder" },
            ),
            5,
            { personId: "person-reader", scripture: "이사야 40:28-31" },
          ),
          6,
          { personId: "person-choir", note: "주 하나님은 광대하시도다" },
        ),
        7,
        { personId: "person-senior", scripture: "이사야 40:28-31", note: "지치지 않는 사람" },
      ),
      8,
      { personId: "person-elder", songId: "song-501" },
    ),
    9,
    { personId: "person-associate" },
  );
  const doneItems = patch(patch(doneOrder, 10, { songId: "song-405" }), 11, { personId: "person-senior" });

  const readyItems = patch(
    patch(
      patch(
        patch(
          patch(
            patch(
              patch(withIds("sun-1", templateItems("sunday-1")), 1, { songId: "song-28" }),
              3,
              { songId: "song-grace", personId: "person-worship", note: "반주 정하람" },
            ),
            4,
            { personId: "person-elder" },
          ),
          5,
          { personId: "person-reader", scripture: "히브리서 10:23-25" },
        ),
        6,
        { personId: "person-choir" },
      ),
      7,
      { personId: "person-senior", scripture: "히브리서 10:23-25", note: "다시 모인 자리에서" },
    ),
    11,
    { personId: "person-senior" },
  );
  const readyWithClose = patch(patch(readyItems, 8, { songId: "song-40", personId: "person-associate" }), 9, {
    personId: "person-associate",
  });
  const readyFinal = patch(readyWithClose, 10, { songId: "song-405" });

  const planningItems = patch(
    patch(withIds("sun-2", templateItems("sunday-2")), 1, { songId: "song-1" }),
    7,
    { personId: "person-senior", scripture: "히브리서 10:23-25", note: "다시 모인 자리에서" },
  );

  const services: Array<Omit<Service, "checks" | "source">> = [
    {
      id: "service-last-sunday",
      title: "주일 2부 예배",
      date: lastSunday,
      time: "11:00",
      type: "sunday-2",
      place: "본당",
      preacherId: "person-senior",
      status: "done",
      items: doneItems,
      announcements: [
        { id: "ann-last-1", text: "예배 후 1층 로비에서 새가족을 환영합니다." },
      ],
      liveIndex: doneItems.length - 1,
      startedAt: null,
      notes: "",
    },
    {
      id: "service-dawn",
      title: "새벽 기도회",
      date: tuesday,
      time: "05:30",
      type: "dawn",
      place: "본당",
      preacherId: "person-associate",
      status: tuesday < today ? "done" : "planning",
      items: patch(
        patch(withIds("dawn", templateItems("dawn")), 2, { scripture: "시편 5:3" }),
        3,
        { personId: "person-associate", scripture: "시편 5:3", note: "아침의 기도" },
      ),
      announcements: [],
      liveIndex: 0,
      startedAt: null,
      notes: "",
    },
    {
      id: "service-wednesday",
      title: "수요 예배",
      date: wednesday,
      time: "19:30",
      type: "wednesday",
      place: "본당",
      preacherId: "person-associate",
      status: wednesday < today ? "done" : "planning",
      items: patch(
        patch(
          patch(withIds("wed", templateItems("wednesday")), 0, { songId: "song-grace", personId: "person-worship" }),
          2,
          { scripture: "누가복음 11:1-4", personId: "person-reader" },
        ),
        3,
        { personId: "person-associate", scripture: "누가복음 11:1-4", note: "기도의 자리" },
      ),
      announcements: [{ id: "ann-wed-1", text: "예배 전 7시부터 중보기도 모임이 있습니다." }],
      liveIndex: 0,
      startedAt: null,
      notes: "",
    },
    {
      id: "service-friday",
      title: "금요 기도회",
      date: friday,
      time: "21:00",
      type: "friday",
      place: "본당",
      preacherId: "person-senior",
      status: friday < today ? "done" : "planning",
      items: patch(
        patch(withIds("fri", templateItems("friday")), 2, { scripture: "시편 27:1" }),
        3,
        { personId: "person-senior", scripture: "시편 27:1" },
      ),
      announcements: [],
      liveIndex: 0,
      startedAt: null,
      notes: "",
    },
    {
      id: "service-sunday-1",
      title: "주일 1부 예배",
      date: sunday,
      time: "09:00",
      type: "sunday-1",
      place: "본당",
      preacherId: "person-senior",
      status: sunday < today ? "done" : "ready",
      items: readyFinal,
      announcements: [
        { id: "ann-sun-1", text: "예배 후 교육관에서 새가족 환영회가 있습니다." },
        { id: "ann-sun-2", text: "다음 주일 2부 예배에 성찬식이 있습니다." },
      ],
      liveIndex: 0,
      startedAt: null,
      notes: "새가족은 안내위원에게 문의해 주세요.",
    },
    {
      id: "service-sunday-2",
      title: "주일 2부 예배",
      date: sunday,
      time: "11:00",
      type: "sunday-2",
      place: "본당",
      preacherId: "person-senior",
      status: sunday < today ? "done" : "planning",
      items: planningItems,
      announcements: [
        { id: "ann-sun2-1", text: "예배 후 교육관에서 새가족 환영회가 있습니다." },
        { id: "ann-sun2-2", text: "중보기도 제목을 사무실에 제출해 주세요." },
      ],
      liveIndex: 0,
      startedAt: null,
      notes: "",
    },
  ];

  return {
    settings: {
      churchName: "은혜교회",
      backgroundColor: "#1b3a32",
      backgroundFile: null,
      overlay: "bottom",
    },
    reminders: [],
    departments: [
      { id: "dept-worship", name: "예배부" },
      { id: "dept-edu", name: "교육부" },
      { id: "dept-fellowship", name: "친교부" },
      { id: "dept-service", name: "봉사부" },
    ],
    attendance: [],
    supplies: [],
    activity: [],
    visits: [],
    people: [
      { id: "person-senior", name: "김은혜", roles: ["담임목사"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-associate", name: "박요한", roles: ["부목사"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-elder", name: "이성실", roles: ["장로"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-worship", name: "최찬미", roles: ["찬양인도"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-piano", name: "정하람", roles: ["반주"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-choir", name: "한소망", roles: ["성가대 지휘"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-reader", name: "오은총", roles: ["집사"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-usher", name: "서섬김", roles: ["안내"], phone: "", active: true, membership: "member" as const, attendanceConsent: false },
      { id: "person-visitor", name: "윤나그네", roles: ["방문"], phone: "", active: true, membership: "visitor" as const, attendanceConsent: false },
      { id: "person-newcomer", name: "한새빛", roles: ["새신자"], phone: "", active: true, membership: "newcomer" as const, attendanceConsent: false },
    ],
    songs: [
      { id: "song-1", title: "만복의 근원 하나님", hymnNumber: "1", key: "G" },
      { id: "song-28", title: "복의 근원 강림하사", hymnNumber: "28", key: "F" },
      { id: "song-40", title: "주의 친절한 팔에 안기세", hymnNumber: "40", key: "Ab" },
      { id: "song-405", title: "나 같은 죄인 살리신", hymnNumber: "405", key: "G" },
      { id: "song-501", title: "날 구원하신 주 감사", hymnNumber: "501", key: "Eb" },
      { id: "song-grace", title: "은혜", hymnNumber: "", key: "A" },
    ].map((song) => ({ ...song, license: "title-only" as const, permittedLine: "" })),
    services: services.map((service) => ({ ...service, checks: {}, source: "manual" as const })),
  };
}
