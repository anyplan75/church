-- 주보에서 만든 교회 일정과, 모들에만 보이는 일정을 구분합니다.
-- 십일조와 헌금 일정은 넣지 않습니다.

BEGIN;

ALTER TABLE calendar_events
  ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE,
  ADD COLUMN bulletin_id uuid REFERENCES bulletins (id) ON DELETE CASCADE,
  ADD COLUMN source_key text;

CREATE INDEX calendar_events_group_id_idx ON calendar_events (group_id);

CREATE UNIQUE INDEX calendar_events_bulletin_source_uidx
  ON calendar_events (bulletin_id, source_key);

COMMENT ON COLUMN calendar_events.group_id IS '비어 있으면 교회 일정. 있으면 그 모들 식구만 봅니다.';
COMMENT ON COLUMN calendar_events.bulletin_id IS '주보를 읽어 만든 일정. 주보를 지우면 함께 지워집니다.';

COMMIT;
