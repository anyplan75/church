import type { Person, Service, Song } from "./types";
import { kindLabel, personName } from "./worship";

export type Slide = {
  itemId: string;
  kicker: string;
  heading: string;
  lines: string[];
  footer: string;
  overlay: string;
};

const SONG_KINDS = new Set(["hymn", "praise", "choir"]);

export function slidesFor(service: Service, people: Person[], songs: Song[]): Slide[] {
  return service.items.map((item) => {
    const person = personName(people, item.personId);
    const song = item.songId ? songs.find((entry) => entry.id === item.songId) : undefined;
    const songLabel = song ? (song.hymnNumber ? `${song.hymnNumber}장 ${song.title}` : song.title) : "";
    const permitted = song?.license === "permitted" ? song.permittedLine.trim().slice(0, 80) : "";
    const scriptureBody = item.scriptureLicensed ? item.scriptureText.trim().slice(0, 400) : "";
    let heading = item.title;
    let lines: string[] = [];
    let footer = "";

    if (item.kind === "announcement") {
      heading = item.title || "광고";
      lines = service.announcements.map((announcement) => announcement.text.trim()).filter(Boolean);
    } else if (SONG_KINDS.has(item.kind) && songLabel) {
      heading = songLabel;
      if (permitted) {
        lines = [permitted];
        footer = "사용 허가를 확인한 문구";
      } else {
        footer = "가사 없이 제목만 표시";
      }
    } else if (item.kind === "scripture") {
      heading = item.scripture || item.title;
      if (scriptureBody) lines = [scriptureBody];
      footer = person;
    } else if (item.kind === "sermon") {
      heading = item.note.trim() || item.title;
      if (item.scripture) lines.push(item.scripture);
      if (scriptureBody) lines.push(scriptureBody);
      footer = person;
    } else {
      if (item.scripture) lines.push(item.scripture);
      if (scriptureBody) lines.push(scriptureBody);
      footer = [person, songLabel].filter(Boolean).join(" · ");
    }

    const cue = [item.kind === "sermon" && item.note.trim() ? item.note.trim() : item.title, person, songLabel]
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(" · ");

    return {
      itemId: item.id,
      kicker: kindLabel(item.kind),
      heading,
      lines,
      footer,
      overlay: item.screenCue.trim() || cue,
    };
  });
}
