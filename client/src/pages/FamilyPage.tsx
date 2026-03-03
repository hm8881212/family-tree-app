import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import PersonForm from '../components/PersonForm';
import FamilyTree, { TreePerson, TreeRelationship, FamilyTreeHandle } from '../components/Tree/FamilyTree';
import AddRelationshipForm from '../components/AddRelationshipForm';
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
  const navigate = useNavigate();
  const [family, setFamily] = useState<Family | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [membership, setMembership] = useState<FamilyMember | null>(null);
  const [relationships, setRelationships] = useState<TreeRelationship[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<TreePerson | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showRelForm, setShowRelForm] = useState(false);
  const [relMode, setRelMode] = useState<'indian' | 'international'>('international');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const treeRef = useRef<FamilyTreeHandle>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      const [famRes, treeRes] = await Promise.all([
        api.get(`/families/${id}`),
        api.get(`/families/${id}/tree`),
      ]);
      setFamily(famRes.data.family);
      setPersons(treeRes.data.persons ?? []);
      setRelationships(treeRes.data.relationships ?? []);
      setMembership(famRes.data.membership ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const isAdmin = membership?.role === 'admin' || user?.role === 'superadmin';

  const filteredPersons = search.trim()
    ? persons.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
        );
      })
    : persons;

  if (loading) return <AppLayout><div className="text-center py-12 text-gray-400">Loading...</div></AppLayout>;
  if (!family) return <AppLayout><div className="text-center py-12 text-red-500">Family not found.</div></AppLayout>;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{family.name}</h1>
          <p className="text-gray-400 text-sm">/{family.slug}</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          {isAdmin && (
            <Link to={`/families/${id}/admin`}
              className="px-3 sm:px-4 py-2 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors">
              Admin Panel
            </Link>
          )}
          <button onClick={() => setShowForm((s) => !s)}
            className="px-3 sm:px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
            {showForm ? 'Cancel' : '+ Add Person'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Propose New Person</h2>
          <PersonForm
            familyId={id!}
            existingPersons={persons}
            onSuccess={() => { setShowForm(false); loadData(); }}
          />
        </div>
      )}

      {/* Tree visualization */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 sm:mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Family Tree</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setRelMode(relMode === 'indian' ? 'international' : 'indian')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                relMode === 'indian' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {relMode === 'indian' ? '🇮🇳 Indian' : '🌍 International'}
            </button>
            {persons.length > 0 && (
              <button
                onClick={() => treeRef.current?.exportPng()}
                className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Export PNG
              </button>
            )}
          </div>
        </div>
        <div style={{ height: 'clamp(260px, 40vw, 400px)', position: 'relative' }}>
          {persons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-5xl mb-3">🌳</div>
              <p className="font-medium">No people yet</p>
              <p className="text-sm mt-1">Add the first person to start your family tree</p>
            </div>
          ) : (
            <FamilyTree
              ref={treeRef}
              persons={persons}
              relationships={relationships}
              onPersonClick={(p) => navigate(`/families/${id}/persons/${p.id}`)}
            />
          )}
        </div>
      </div>

      {/* Selected person details + actions */}
      {selectedPerson && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">
              {selectedPerson.is_unknown ? 'Unknown Person' : `${selectedPerson.first_name} ${selectedPerson.last_name}`}
            </h3>
            <button onClick={() => { setSelectedPerson(null); setShowRelForm(false); }} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
          {selectedPerson.dob && <p className="text-sm text-gray-500 mb-1">Born: {new Date(selectedPerson.dob).toLocaleDateString()}</p>}
          {selectedPerson.dod && <p className="text-sm text-gray-500 mb-1">Died: {new Date(selectedPerson.dod).toLocaleDateString()}</p>}
          {!showRelForm ? (
            <button onClick={() => setShowRelForm(true)}
              className="mt-3 px-3 py-1.5 border border-brand-500 text-brand-600 text-sm rounded-lg hover:bg-brand-50">
              + Add Relationship
            </button>
          ) : (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add Relationship from this person</h4>
              <AddRelationshipForm
                familyId={id!}
                fromPerson={selectedPerson}
                allPersons={persons}
                onSuccess={() => { setShowRelForm(false); loadData(); }}
                onCancel={() => setShowRelForm(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Person list with search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">People ({persons.length})</h2>
          {persons.length > 0 && (
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}
        </div>
        {persons.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No people added yet.</p>
        ) : filteredPersons.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No people match "{search}".</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredPersons.map((p) => (
              <Link
                key={p.id}
                to={`/families/${id}/persons/${p.id}`}
                className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                  {p.is_unknown ? '?' : `${p.first_name[0]}${p.last_name[0]}`}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">
                    {p.first_name} {p.last_name}
                    {p.is_unknown && <span className="ml-1 text-xs text-gray-400">(unknown)</span>}
                  </p>
                  {p.gender && <p className="text-xs text-gray-400 capitalize">{p.gender}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
