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

export default function FamilyAdminPage() {
  const { id: familyId } = useParams<{ id: string }>();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [tab, setTab] = useState<'proposals' | 'joins'>('proposals');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!familyId) return;
    const [pRes, jRes] = await Promise.all([
      api.get(`/families/${familyId}/proposals`).catch(() => ({ data: { proposals: [] } })),
      api.get(`/families/${familyId}/join-requests`).catch(() => ({ data: { requests: [] } })),
    ]);
    setProposals(pRes.data.proposals ?? []);
    setJoinRequests(jRes.data.requests ?? []);
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

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
        <button onClick={handleInvite}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
          + Send Invite
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['proposals', 'joins'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'proposals' ? `Proposals (${proposals.length})` : `Join Requests (${joinRequests.length})`}
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
            <div key={r.id} className="flex items-center justify-between border border-gray-200 rounded-xl p-4">
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
    </AppLayout>
  );
}
