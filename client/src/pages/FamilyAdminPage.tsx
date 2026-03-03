import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ProposalList from '../components/ProposalList';
import api from '../utils/api';

interface JoinRequest {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
}

interface Proposal {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  proposer_email: string;
  created_at: string;
  status: string;
}

interface UnknownPerson {
  id: string;
  first_name: string;
  last_name: string;
  dob?: string;
  claimed_by_user_id?: string;
}

interface FamilyMember {
  id: string;
  email: string;
  role: string;
}

export default function FamilyAdminPage() {
  const { id: familyId } = useParams<{ id: string }>();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [unknownPersons, setUnknownPersons] = useState<UnknownPerson[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [tab, setTab] = useState<'proposals' | 'joins' | 'unknown'>('proposals');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [claimSelections, setClaimSelections] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!familyId) return;
    const [pRes, jRes, treeRes, membersRes] = await Promise.all([
      api.get(`/families/${familyId}/proposals`).catch(() => ({ data: { proposals: [] } })),
      api.get(`/families/${familyId}/join-requests`).catch(() => ({ data: { requests: [] } })),
      api.get(`/families/${familyId}/tree`).catch(() => ({ data: { persons: [] } })),
      api.get(`/families/${familyId}/persons/members-list`).catch(() => ({ data: { members: [] } })),
    ]);
    setProposals(pRes.data.proposals ?? []);
    setJoinRequests(jRes.data.requests ?? []);
    const allPersons: UnknownPerson[] = treeRes.data.persons ?? [];
    setUnknownPersons(allPersons.filter((p) => p.is_unknown || !p.claimed_by_user_id));
    setMembers(membersRes.data.members ?? []);
  }, [familyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApproveJoin = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.post(`/families/${familyId}/approve-join/${userId}`);
      await loadData();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectJoin = async (userId: string) => {
    setActionLoading(userId + '-reject');
    try {
      await api.post(`/families/${familyId}/reject-join/${userId}`);
      await loadData();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvite = async () => {
    const email = prompt('Enter email to invite:');
    if (!email) return;
    try {
      await api.post(`/families/${familyId}/invite`, { email });
      alert(`Invite sent to ${email}`);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    }
  };

  const handleClaimUser = async (personId: string) => {
    const userId = claimSelections[personId];
    if (!userId) { alert('Select a member to link this person to.'); return; }
    setActionLoading(personId + '-claim');
    try {
      await api.post(`/families/${familyId}/persons/${personId}/claim-user`, { user_id: userId });
      setClaimSelections((s) => { const c = { ...s }; delete c[personId]; return c; });
      await loadData();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to link');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
        <button onClick={handleInvite}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
          + Send Invite
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {(['proposals', 'joins', 'unknown'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'proposals' ? `Proposals (${proposals.length})`
              : t === 'joins' ? `Join Requests (${joinRequests.length})`
              : `Unknown Persons (${unknownPersons.length})`}
          </button>
        ))}
      </div>

      {tab === 'proposals' && (
        <ProposalList proposals={proposals} onRefresh={loadData} />
      )}

      {tab === 'joins' && (
        <div className="space-y-4">
          {joinRequests.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No pending join requests.</p>
          ) : joinRequests.map((r) => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-200 rounded-xl p-4">
              <div>
                <p className="font-medium text-gray-800">{r.email}</p>
                <p className="text-xs text-gray-400 mt-1">Requested {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleApproveJoin(r.user_id)} disabled={!!actionLoading}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {actionLoading === r.user_id ? '...' : 'Approve'}
                </button>
                <button onClick={() => handleRejectJoin(r.user_id)} disabled={!!actionLoading}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {actionLoading === r.user_id + '-reject' ? '...' : 'Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'unknown' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-2">
            Link unknown/placeholder person nodes to registered family members.
          </p>
          {unknownPersons.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No unknown persons in this family tree.</p>
          ) : unknownPersons.map((p) => (
            <div key={p.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-800">
                    {p.first_name} {p.last_name}
                    {p.is_unknown && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">unknown</span>}
                  </p>
                  {p.dob && <p className="text-xs text-gray-400 mt-0.5">b. {new Date(p.dob).getFullYear()}</p>}
                  {p.claimed_by_user_id && (
                    <p className="text-xs text-green-600 mt-0.5">Already linked to a user</p>
                  )}
                </div>
                {!p.claimed_by_user_id && (
                  <div className="flex gap-2 items-center">
                    <select
                      value={claimSelections[p.id] ?? ''}
                      onChange={(e) => setClaimSelections((s) => ({ ...s, [p.id]: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[160px]"
                    >
                      <option value="">Select member…</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.email}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleClaimUser(p.id)}
                      disabled={!claimSelections[p.id] || actionLoading === p.id + '-claim'}
                      className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
                    >
                      {actionLoading === p.id + '-claim' ? '…' : 'Link'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
