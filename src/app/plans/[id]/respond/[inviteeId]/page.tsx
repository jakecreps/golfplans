'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plan, Preferences, TimeOfDay, Location } from '@/lib/types';
import { getPlan, savePlan, formatDate } from '@/lib/store';
import AddressSearch from '@/components/AddressSearch';

const TIME_OPTIONS: { value: TimeOfDay; label: string; emoji: string; sub: string }[] = [
  { value: 'morning', label: 'Morning', emoji: '🌅', sub: '7am – 11am' },
  { value: 'afternoon', label: 'Afternoon', emoji: '☀️', sub: '11am – 3pm' },
  { value: 'evening', label: 'Evening', emoji: '🌇', sub: '3pm – 7pm' },
];

const PRICE_OPTIONS = [25, 50, 75, 100, 125, 150, 200, 250, 300];
const DRIVE_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

export default function RespondPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const inviteeId = params.inviteeId as string;
  const isCreator = inviteeId === 'creator';

  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<TimeOfDay[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [maxDrive, setMaxDrive] = useState<number | null>(null);

  useEffect(() => {
    const p = getPlan(planId);
    if (!p) { router.push('/'); return; }
    setPlan(p);

    if (isCreator) {
      if (p.creatorPreferences) {
        setSelectedTimes(p.creatorPreferences.timeOfDay);
        setMaxPrice(p.creatorPreferences.maxPrice);
        setLocation(p.creatorPreferences.location);
        setMaxDrive(p.creatorPreferences.maxDriveDistance);
      }
    } else {
      const invitee = p.invitees.find((i) => i.id === inviteeId);
      if (!invitee) { router.push('/'); return; }
      if (invitee.preferences) {
        setSelectedTimes(invitee.preferences.timeOfDay);
        setMaxPrice(invitee.preferences.maxPrice);
        setLocation(invitee.preferences.location);
        setMaxDrive(invitee.preferences.maxDriveDistance);
      }
    }
  }, [planId, inviteeId, isCreator, router]);

  function toggleTime(t: TimeOfDay) {
    setSelectedTimes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || selectedTimes.length === 0 || !maxPrice || !location || !maxDrive) return;

    const prefs: Preferences = { timeOfDay: selectedTimes, maxPrice, location, maxDriveDistance: maxDrive };

    let updated: Plan;
    if (isCreator) {
      updated = { ...plan, creatorPreferences: prefs };
    } else {
      updated = {
        ...plan,
        invitees: plan.invitees.map((i) =>
          i.id === inviteeId ? { ...i, responded: true, preferences: prefs } : i
        ),
      };
    }
    savePlan(updated);
    if (isCreator) {
      router.push(`/plans/${planId}/manage/${updated.creatorToken}`);
    } else {
      localStorage.setItem(`golfplan_me_${planId}`, inviteeId);
      router.push(`/plans/${planId}/summary`);
    }
  }

  if (!plan) return null;

  const canSubmit = selectedTimes.length > 0 && maxPrice !== null && location !== null && maxDrive !== null;

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
            <h2 className="font-semibold text-gray-800 mb-1">⏰ When do you prefer to tee off?</h2>
            <p className="text-xs text-gray-400 mb-3">Select all that work for you</p>
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
            <h2 className="font-semibold text-gray-800 mb-1">📍 What's your zip code?</h2>
            <p className="text-xs text-gray-400 mb-3">Helps find a course that works for everyone</p>
            <AddressSearch value={location} onChange={setLocation} />
          </div>

          {/* Max Drive */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-1">🚗 How far will you drive?</h2>
            <p className="text-xs text-gray-400 mb-3">One way, in miles</p>
            <div className="grid grid-cols-4 gap-2">
              {DRIVE_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMaxDrive(d)}
                  className={`rounded-xl py-3 text-center font-semibold transition border-2 text-sm ${
                    maxDrive === d
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 active:border-green-300'
                  }`}
                >
                  {d} mi
                </button>
              ))}
            </div>
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <div className="max-w-lg mx-auto">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!canSubmit ? 'Fill out all sections above' : isCreator ? 'Save & Share with Group →' : 'Save My Preferences'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
