'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plan, Preferences, TimeOfDay, Location } from '@/lib/types';
import AddressSearch from '@/components/AddressSearch';
import { getPlan, savePlan, formatDate, isPlanExpired } from '@/lib/store';

const TIME_OPTIONS: { value: TimeOfDay; label: string; emoji: string; sub: string }[] = [
  { value: 'morning', label: 'Morning', emoji: '🌅', sub: '7am – 11am' },
  { value: 'afternoon', label: 'Afternoon', emoji: '☀️', sub: '11am – 3pm' },
  { value: 'evening', label: 'Evening', emoji: '🌇', sub: '3pm – 7pm' },
];

const PRICE_OPTIONS = [25, 50, 75, 100, 125, 150, 200, 250, 300];
const DRIVE_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<TimeOfDay[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [maxDrive, setMaxDrive] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const p = getPlan(planId);
    if (!p) { setExpired(true); return; }
    if (isPlanExpired(p)) { setExpired(true); return; }
    setPlan(p);
  }, [planId, router]);

  function toggleTime(t: TimeOfDay) {
    setSelectedTimes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || selectedTimes.length === 0 || !maxPrice || !location || !maxDrive) return;

    const prefs: Preferences = {
      timeOfDay: selectedTimes,
      maxPrice,
      location,
      maxDriveDistance: maxDrive,
    };

    const updated: Plan = {
      ...plan,
      invitees: [
        ...plan.invitees,
        { id: crypto.randomUUID(), responded: true, preferences: prefs },
      ],
    };
    savePlan(updated);
    setSubmitted(true);
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Expired</h2>
          <p className="text-gray-500 mb-6">This plan link has expired. Links are only valid for 24 hours.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🏌️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">You&apos;re in!</h2>
          <p className="text-gray-500 mb-2">
            Your availability has been submitted anonymously.
          </p>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const canSubmit = selectedTimes.length > 0 && maxPrice !== null && location !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-28">
      <header className="bg-green-700 text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold">⛳ Golf Round</h1>
          <p className="text-green-200 text-sm">📅 {formatDate(plan.date)}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <main className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {/* Time of Day */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-1">⏰ What time works for you?</h2>
            <p className="text-xs text-gray-400 mb-3">Select all that work</p>
            <div className="grid grid-cols-3 gap-3">
              {TIME_OPTIONS.map((t) => {
                const sel = selectedTimes.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTime(t.value)}
                    className={`rounded-2xl py-4 px-2 text-center transition border-2 ${
                      sel
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-600 active:border-green-300'
                    }`}
                  >
                    <div className="text-2xl">{t.emoji}</div>
                    <div className="text-sm font-semibold mt-1">{t.label}</div>
                    <div className="text-xs opacity-75 mt-0.5">{t.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Max Price */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-1">💵 Max budget per person</h2>
            <p className="text-xs text-gray-400 mb-3">Green fees + cart included</p>
            <div className="grid grid-cols-3 gap-2">
              {PRICE_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMaxPrice(p)}
                  className={`rounded-xl py-3 text-center font-semibold transition border-2 text-sm ${
                    maxPrice === p
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 active:border-green-300'
                  }`}
                >
                  ${p}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-1">📍 Where are you coming from?</h2>
            <p className="text-xs text-gray-400 mb-3">City or address — helps find a course that works for everyone</p>
            <AddressSearch value={location} onChange={setLocation} />
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <div className="max-w-lg mx-auto">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!canSubmit ? 'Fill out all sections above' : "Submit My Availability"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
