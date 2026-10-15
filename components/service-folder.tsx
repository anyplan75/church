"use client";

import { useEffect, useState } from "react";
import { readFolderFill } from "@/lib/local-files";
import { libraryMatchText, libraryQuery, LIBRARY_STEPS, searchedLabel, type LibraryQuery } from "@/lib/local-library";
import type { Service, Song } from "@/lib/types";

export type ServiceFill = { searched: string; fileName: string | null; slides: string[] };

export function useServiceFolder(service: Service | null, songs: Song[]) {
  const items = service?.items ?? [];
  const signature = items
    .map((item) => {
      const song = item.songId ? songs.find((entry) => entry.id === item.songId) : undefined;
      const query = libraryQuery(item, song);
      return query ? `${item.id}:${searchedLabel(query)}` : "";
    })
    .join("|");
  const [loaded, setLoaded] = useState(false);
  const [fills, setFills] = useState<Record<string, ServiceFill>>({});
  useEffect(() => {
    let cancel = false;
    const targets = items.flatMap((item) => {
      const song = item.songId ? songs.find((entry) => entry.id === item.songId) : undefined;
      const query = libraryQuery(item, song);
      return query ? [{ id: item.id, query, searched: searchedLabel(query) }] : [];
    });
    setLoaded(targets.length === 0);
    if (targets.length === 0) {
      setFills({});
      return;
    }
    void Promise.all(
      targets.map(async (target) => {
        const fill = await readFolderFill(target.query as LibraryQuery).catch(() => ({ fileName: null, slides: [] as string[] }));
        return [target.id, { searched: target.searched, fileName: fill.fileName, slides: fill.slides }] as const;
      }),
    ).then((entries) => {
      if (cancel) return;
      setFills(Object.fromEntries(entries));
      setLoaded(true);
    });
    return () => {
      cancel = true;
    };
  }, [signature]);
  return { loaded, fills };
}

export function FolderMatchLine({ fill, loaded, light = false }: { fill: ServiceFill | undefined; loaded: boolean; light?: boolean }) {
  if (!fill) return null;
  const text = loaded ? libraryMatchText(fill.fileName, fill.searched) : "파일 확인 중";
  return (
    <p className={light ? "text-xs text-[#f3e6cf]" : "text-sm text-pine"} data-folder-ready={loaded ? (fill.fileName ? "ready" : "miss") : "wait"}>
      {text}
    </p>
  );
}

export function LibraryUseSteps({ light = false }: { light?: boolean }) {
  return (
    <ol className={light ? "mt-3 list-decimal space-y-1 pl-5 text-sm text-[#f6f1e6]" : "mt-3 list-decimal space-y-1 pl-5 text-sm text-ink"} data-library-steps>
      {LIBRARY_STEPS.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}
