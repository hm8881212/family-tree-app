import { useState } from 'react';
import api from '../utils/api';

interface Proposal {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  proposer_email: string;
  created_at: string;
  status: string;
}

interface Props {
  proposals: Proposal[];
  onRefresh: () => void;
}

export default function ProposalList({ proposals, onRefresh }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setActionLoading(id + '-approve');
    try {
      await api.post(`/proposals/${id}/approve`);
      onRefresh();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason (optional):');
    setActionLoading(id + '-reject');
    try {
      await api.post(`/proposals/${id}/reject`, { reason });
      onRefresh();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (proposals.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No pending proposals.</p>;
  }

  return (
    <div className="space-y-4">
      {proposals.map((p) => (
        <div key={p.id} className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full mb-2">
                {p.action.replace('_', ' ')}
              </span>
              <p className="text-sm text-gray-700">
                {p.action === 'add_person' && (() => {
                  const data = (p.payload as { data?: { first_name?: string; last_name?: string } }).data;
                  return `Add: ${data?.first_name} ${data?.last_name}`;
                })()}
              </p>
              <p className="text-xs text-gray-400 mt-1">by {p.proposer_email} · {new Date(p.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => handleApprove(p.id)}
                disabled={!!actionLoading}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === p.id + '-approve' ? '...' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(p.id)}
                disabled={!!actionLoading}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === p.id + '-reject' ? '...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
