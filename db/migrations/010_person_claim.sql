-- Allow linking an unknown person node to a registered user
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_persons_claimed_by ON persons(claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;
