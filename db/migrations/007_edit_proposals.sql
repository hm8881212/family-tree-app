-- Edit Proposals
CREATE TABLE edit_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id),
  proposed_by UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('add_person', 'edit_person', 'add_relationship', 'edit_relationship', 'delete_person')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON edit_proposals(family_id, status);
CREATE INDEX ON edit_proposals(proposed_by);
