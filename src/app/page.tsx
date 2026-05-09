'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { createPlan } from '@/lib/store';

export default function HomePage() {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [groupSize, setGroupSize] = useState(4);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    setDate(d.toISOString().split('T')[0]);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!date || creating) return;
    setCreating(true);
    setError(null);
    try {
      const plan = await createPlan({
        creatorToken: uuidv4(),
        date,
        createdAt: new Date().toISOString(),
        phase: 'collecting',
        groupSize,
        invitees: [],
      });
      router.push(`/plans/${plan.id}/respond/creator`);
    } catch {
      setError('Could not create plan. Check your connection and try again.');
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">⛳</div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Golf Plans</h1>
          <p className="text-gray-500 mt-2 text-sm">Pick a date, share a link, find the perfect round.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Date of Round</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">👥 Group Size</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGroupSize((n) => Math.max(2, n - 1))}
                  className="w-10 h-10 rounded-xl border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 transition flex items-center justify-center"
                >
                  −
                </button>
                <span className="flex-1 text-center text-2xl font-bold text-gray-800">{groupSize}</span>
                <button
                  type="button"
                  onClick={() => setGroupSize((n) => Math.min(24, n + 1))}
                  className="w-10 h-10 rounded-xl border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 transition flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-1">Voting opens automatically once everyone responds</p>
            </div>
            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-green-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {creating ? 'Creating…' : "Let's Plan →"}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4">Links expire after 24 hours</p>
        </div>
      </div>
    </div>
  );
}
