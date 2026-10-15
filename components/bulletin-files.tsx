"use client";

import { useEffect, useState } from "react";
import { peekLocalMatch } from "@/lib/local-files";
import { libraryQuery, searchedLabel, type LibraryQuery } from "@/lib/local-library";
import { orderLine } from "@/lib/simple";
import type { Person, Service, Song } from "@/lib/types";
import { personName } from "@/lib/worship";

type Row = { key: string; line: string; query: LibraryQuery | null };
type Match = { fileName: string; preview: string } | null;

export function BulletinServiceBody({ service, songs, people }: { service: Service; songs: Song[]; people: Person[] }) {
  const rows = rowsOf(service, songs, people);
  const signature = rows.map((row) => `${row.key}:${row.query ? searchedLabel(row.query) : ""}`).join("|");
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancel = false;
    const targets = rows.filter((row) => row.query);
    setReady(false);
    if (targets.length === 0) {
      setMatches({});
      setReady(true);
      return;
    }
    void Promise.all(
      targets.map(async (row) => {
        const hit = await peekLocalMatch(row.query as LibraryQuery).catch(() => null);
        return [row.key, hit] as const;
      }),
    ).then((entries) => {
      if (cancel) return;
      setMatches(Object.fromEntries(entries));
      setReady(true);
    });
    return () => {
      cancel = true;
    };
  }, [signature]);
  if (rows.length === 0) return <p className="mt-3 text-sm text-muted">예배 순서가 없습니다.</p>;
  return (
    <div className="mt-3 space-y-2 text-sm leading-6">
      {rows.map((row) => (
        <div key={row.key}>
          <p className="whitespace-pre-wrap text-ink">{row.line}</p>
          {row.query ? <MatchLine query={row.query} match={ready ? (matches[row.key] ?? null) : undefined} /> : null}
        </div>
      ))}
    </div>
  );
}

function MatchLine({ query, match }: { query: LibraryQuery; match: Match | undefined }) {
  if (match === undefined) return <p className="text-xs text-muted">파일 확인 중</p>;
  if (!match) {
    return (
      <p className="text-xs text-wine" data-library-match="miss">
        파일 없음 · {searchedLabel(query)}
      </p>
    );
  }
  return (
    <p className="text-xs text-pine" data-library-match="hit">
      {match.fileName}
      {match.preview ? ` · ${match.preview}` : ""}
    </p>
  );
}

function rowsOf(service: Service, songs: Song[], people: Person[]): Row[] {
  const rows: Row[] = [];
  if (!service.items.some((item) => item.title.replace(/\s+/g, "") === "인도")) {
    const leader = personName(people, service.preacherId);
    if (leader) rows.push({ key: `${service.id}-leader`, line: `인도 ${leader}`, query: null });
  }
  service.items.forEach((item, index) => {
    const song = item.songId ? songs.find((entry) => entry.id === item.songId) : undefined;
    const line = orderLine(item, songs, people);
    if (!line) return;
    rows.push({ key: item.id || `${service.id}-${index}`, line, query: libraryQuery(item, song) });
  });
  const ads = service.announcements.map((item) => item.text.trim()).filter(Boolean);
  if (ads.length === 0) return rows;
  const hasAd = rows.some((row) => row.line === "광고" || row.line.startsWith("광고 "));
  if (!hasAd) rows.push({ key: `${service.id}-ads`, line: "광고", query: null });
  ads.forEach((text, index) => rows.push({ key: `${service.id}-ad-${index}`, line: text, query: null }));
  return rows;
}
