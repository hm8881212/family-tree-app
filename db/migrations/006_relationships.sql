-- Relationships (canonical direction only)
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_person_id UUID NOT NULL REFERENCES persons(id),
  to_person_id UUID NOT NULL REFERENCES persons(id),
  type TEXT NOT NULL CHECK (type IN ('parent_of', 'spouse_of', 'sibling_of', 'adopted_by')),
  subtype TEXT CHECK (subtype IN ('biological', 'step', 'adoptive', 'full', 'half', 'current', 'former')),
  started_at DATE,
  ended_at DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  family_id UUID NOT NULL REFERENCES families(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON relationships(from_person_id);
CREATE INDEX ON relationships(to_person_id);
CREATE INDEX ON relationships(family_id);
