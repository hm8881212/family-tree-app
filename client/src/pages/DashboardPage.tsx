import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import FamilyCard from '../components/FamilyCard';
import FamilySearch from '../components/FamilySearch';
import api from '../utils/api';

interface Family {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  role: string;
  member_count?: number;
}

export default function DashboardPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFamilies = () => {
    api.get('/families/mine').then((res) => setFamilies(res.data.families ?? [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadFamilies(); }, []);

  const handleJoinRequest = async (familyId: string, familyName: string) => {
    try {
      await api.post(`/families/${familyId}/join-request`);
      alert(`Join request sent for ${familyName}!`);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to send request');
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">My Families</h1>
        <Link to="/families/new"
          className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors">
          + Create Family
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : families.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🌳</div>
          <p className="text-gray-600 mb-4">You are not a member of any family yet.</p>
          <p className="text-gray-400 text-sm">Create a family or search for one to join.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {families.map((f) => <FamilyCard key={f.id} family={f} />)}
        </div>
      )}

      <div className="mt-8">
        <FamilySearch onJoinRequest={handleJoinRequest} />
      </div>
    </AppLayout>
  );
}
