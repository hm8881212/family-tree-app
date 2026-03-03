import { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface FamilyRow {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  member_count: number;
  person_count: number;
  created_at: string;
}

interface AuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_email: string;
  created_at: string;
  new_value?: string;
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [tab, setTab] = useState<'families' | 'audit'>('families');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'superadmin') { navigate('/dashboard'); return; }
    Promise.all([
      api.get('/superadmin/families'),
      api.get('/superadmin/audit-log'),
    ]).then(([fRes, aRes]) => {
      setFamilies(fRes.data.families ?? []);
      setLogs(aRes.data.logs ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user, navigate]);

  const deleteFamily = async (id: string, name: string) => {
    if (!confirm(`Soft-delete "${name}"? Members will lose access.`)) return;
    await api.post(`/superadmin/families/${id}/delete`);
    setFamilies((f) => f.filter((x) => x.id !== id));
  };

  if (loading) return <AppLayout><div className="text-center py-12 text-gray-400">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Super Admin</h1>
          <p className="text-sm text-gray-400 mt-1">Global oversight across all families</p>
        </div>
        <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">SUPERADMIN</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-gray-800">{families.length}</p>
          <p className="text-sm text-gray-500 mt-1">Families</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-gray-800">{families.reduce((s, f) => s + Number(f.member_count), 0)}</p>
          <p className="text-sm text-gray-500 mt-1">Total Members</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-gray-800">{logs.length}</p>
          <p className="text-sm text-gray-500 mt-1">Audit Events</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['families', 'audit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'families' ? `Families (${families.length})` : `Audit Log (${logs.length})`}
          </button>
        ))}
      </div>

      {tab === 'families' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Family</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Owner</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Members</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">People</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {families.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{f.name}</p>
                    <p className="text-xs text-gray-400">/{f.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.owner_email}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{f.member_count}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{f.person_count}</td>
                  <td className="px-4 py-3 text-center text-gray-400 text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteFamily(f.id, f.name)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {families.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No families yet.</p>}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Entity</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Actor</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{l.action}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    <span className="font-medium text-gray-700">{l.entity_type}</span>
                    {l.entity_id && <span className="ml-1 text-gray-400">{l.entity_id.slice(0, 8)}…</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.actor_email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No audit events yet.</p>}
        </div>
      )}
    </AppLayout>
  );
}
