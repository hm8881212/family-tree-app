export interface User {
  id: string;
  email: string;
  password_hash: string;
  verified: boolean;
  role: 'user' | 'superadmin';
  verification_token?: string;
  verification_token_expires_at?: Date;
  password_reset_token?: string;
  password_reset_token_expires_at?: Date;
  created_at: Date;
  deleted_at?: Date;
}

export interface Family {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: Date;
  deleted_at?: Date;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'member' | 'admin';
  status: 'pending' | 'active';
  joined_at?: Date;
  created_at: Date;
}

export interface Invitation {
  id: string;
  email: string;
  invited_by: string;
  family_id: string;
  token_hash: string;
  expires_at: Date;
  used_at?: Date;
  status: 'pending' | 'accepted' | 'expired';
  created_at: Date;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  dob?: Date;
  dod?: Date;
  photo_url?: string;
  is_unknown: boolean;
  created_by?: string;
  created_at: Date;
  deleted_at?: Date;
}

export interface EditProposal {
  id: string;
  family_id: string;
  proposed_by: string;
  action: 'add_person' | 'edit_person' | 'add_relationship' | 'edit_relationship' | 'delete_person';
  payload: ProposalPayload;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: Date;
  rejection_reason?: string;
  created_at: Date;
}

export type ProposalPayload =
  | { type: 'add_person'; data: Omit<Person, 'id' | 'created_at' | 'deleted_at'> }
  | { type: 'edit_person'; person_id: string; changes: Partial<Person> }
  | { type: 'add_relationship'; from_person_id: string; to_person_id: string; rel_type: string; subtype?: string }
  | { type: 'edit_relationship'; relationship_id: string; changes: Record<string, unknown> }
  | { type: 'delete_person'; person_id: string };

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read_at?: Date;
  entity_id?: string;
  entity_type?: string;
  created_at: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
