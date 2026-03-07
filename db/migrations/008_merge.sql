-- Merge Requests
CREATE TABLE merge_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_a_id UUID NOT NULL REFERENCES families(id),
  family_b_id UUID NOT NULL REFERENCES families(id),
  link_relationship_id UUID REFERENCES relationships(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Merge Approvals
CREATE TABLE merge_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merge_request_id UUID NOT NULL REFERENCES merge_requests(id),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  UNIQUE(merge_request_id, admin_user_id)
);
