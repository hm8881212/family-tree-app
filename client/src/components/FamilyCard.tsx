import { Link } from 'react-router-dom';

interface Family {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count?: number;
  role?: string;
}

export default function FamilyCard({ family }: { family: Family }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{family.name}</h3>
          <p className="text-sm text-gray-500 mt-1">/{family.slug}</p>
          {family.member_count !== undefined && (
            <p className="text-sm text-gray-500 mt-1">{family.member_count} members</p>
          )}
        </div>
        {family.role && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            family.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {family.role}
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <Link to={`/families/${family.id}`} className="flex-1 text-center py-2 px-4 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
          View Tree
        </Link>
        {family.role === 'admin' && (
          <Link to={`/families/${family.id}/admin`} className="py-2 px-4 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors">
            Admin
          </Link>
        )}
      </div>
    </div>
  );
}
