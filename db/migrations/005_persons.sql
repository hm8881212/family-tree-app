-- Persons table (no direct family_id, uses person_families)
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  dob DATE,
  dod DATE,
  photo_url TEXT,
  is_unknown BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Person <-> Family (many-to-many)
CREATE TABLE person_families (
  person_id UUID NOT NULL REFERENCES persons(id),
  family_id UUID NOT NULL REFERENCES families(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, family_id)
);

CREATE INDEX ON person_families(person_id);
CREATE INDEX ON person_families(family_id);
