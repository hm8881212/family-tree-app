import { ReactNode } from 'react';

export default function AuthLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-700">🌳 Family Tree</h1>
          <h2 className="text-xl font-semibold text-gray-700 mt-2">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
