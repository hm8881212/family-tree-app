import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import PersonForm from '../components/PersonForm';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  gender?: string;
  dob?: string;
  is_unknown: boolean;
}

interface Family {
  id: string;
  name: string;
  slug: string;
}

interface FamilyMember {
  role: string;
}

export default function FamilyPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [membership, setMembership] = useState<FamilyMember | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    try {
      const [famRes, personsRes] = await Promise.all([
        api.get(`/families/${id}`),
        api.get(`/families/${id}/persons`),
      ]);
      setFamily(famRes.data.family);
      setPersons(personsRes.data.persons ?? []);
      setMembership(famRes.data.membership ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const isAdmin = membership?.role === 'admin' || user?.role === 'superadmin';

  if (loading) return <AppLayout><div className="text-center py-12 text-gray-400">Loading...</div></AppLayout>;
  if (!family) return <AppLayout><div className="text-center py-12 text-red-500">Family not found.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{family.name}</h1>
          <p className="text-gray-400 text-sm">/{family.slug}</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <Link to={`/families/${id}/admin`}
              className="px-4 py-2 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors">
              Admin Panel
            </Link>
          )}
          <button onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
            {showForm ? 'Cancel' : '+ Add Person'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Propose New Person</h2>
          <PersonForm familyId={id!} onSuccess={() => { setShowForm(false); loadData(); }} />
        </div>
      )}

      {/* Tree placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8 text-center text-gray-400">
        <div className="text-5xl mb-4">🌳</div>
        <p className="font-medium">Interactive Tree View</p>
        <p className="text-sm mt-1">Coming in Phase 2 — Canvas-based tree visualization</p>
      </div>

      {/* Person list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">People ({persons.length})</h2>
        {persons.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No people added yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {persons.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm">
                  {p.is_unknown ? '?' : `${p.first_name[0]}${p.last_name[0]}`}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    {p.first_name} {p.last_name}
                    {p.is_unknown && <span className="ml-1 text-xs text-gray-400">(unknown)</span>}
                  </p>
                  {p.gender && <p className="text-xs text-gray-400 capitalize">{p.gender}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
