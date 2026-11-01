-- 은혜 반응은 한 묵상에 한 사람당 한 줄만 둡니다.
CREATE TABLE qt_grace_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id uuid NOT NULL REFERENCES qt_reflections (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qt_grace_reactions_reflection_member_uidx UNIQUE (reflection_id, member_id)
);

CREATE INDEX qt_grace_reactions_member_id_idx ON qt_grace_reactions (member_id);

-- 같은 말씀에 한 사람의 묵상은 한 줄입니다. 다시 저장해도 처음 시각은 그대로 둡니다.
CREATE UNIQUE INDEX qt_reflections_qt_member_uidx ON qt_reflections (qt_id, member_id);
