import { useState } from 'react';
import api from '../utils/api';

interface Family {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface Props {
  onJoinRequest: (familyId: string, familyName: string) => void;
}

export default function FamilySearch({ onJoinRequest }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.get('/families/search', { params: { q } });
      setResults(res.data.families);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Find a Family</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by family name..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
              <div>
                <span className="font-medium text-gray-800">{f.name}</span>
                <span className="text-gray-400 text-sm ml-2">/{f.slug}</span>
              </div>
              <button
                onClick={() => onJoinRequest(f.id, f.name)}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Request to Join
              </button>
            </div>
          ))}
        </div>
      )}
      {results.length === 0 && q && !loading && (
        <p className="text-sm text-gray-500 mt-4">No families found.</p>
      )}
    </div>
  );
}
