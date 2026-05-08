'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plan } from '@/lib/types';
import { getPlan, savePlan, formatDate, isPlanExpired } from '@/lib/store';

export default function ManagePage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const token = params.token as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [expired, setExpired] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = getPlan(planId);
    if (!p) { setExpired(true); return; }
    if (isPlanExpired(p)) { setExpired(true); return; }
    if (p.creatorToken !== token) { setInvalid(true); return; }
    setPlan(p);
  }, [planId, token]);

  async function shareLink() {
    const url = `${window.location.origin}/${planId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      el.setAttribute('readonly', '');
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleRemoveInvitee(inviteeId: string) {
    const updated = { ...plan!, invitees: plan!.invitees.filter((i) => i.id !== inviteeId) };
    savePlan(updated);
    setPlan(updated);
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Plan Expired</h2>
          <p className="text-gray-500 mb-6">This plan has expired. Plans are only active for 24 hours.</p>
          <button onClick={() => router.push('/')} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition">
            Create New Plan
          </button>
        </div>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Not Found</h2>
          <p className="text-gray-500 mb-6">This organizer link is invalid.</p>
          <button onClick={() => router.push('/')} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${planId}`;
  const creatorResponded = !!plan.creatorPreferences;
  const responded = plan.invitees.filter((i) => i.responded).length + (creatorResponded ? 1 : 0);
  const total = plan.invitees.length + 1; // +1 for organizer

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-8">
      <header className="bg-green-700 text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto">
          <button onClick={() => router.push('/')} className="text-green-200 text-sm mb-2 flex items-center gap-1">
            ← New Plan
          </button>
          <h1 className="text-xl font-bold">⛳ Golf Round</h1>
          <p className="text-green-200 text-sm">📅 {formatDate(plan.date)}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Share */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-200">
          <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2 text-lg">
            <span>📲</span> Share with your group
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Drop this in your group chat. Each person picks their preferred time, budget, and how far they'll drive.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600 font-mono mb-3 break-all">
            {joinUrl}
          </div>
          <button
            onClick={shareLink}
            className={`w-full py-3 rounded-xl font-bold text-base transition ${
              copied ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {copied ? '✓ Copied!' : '📋 Copy Link'}
          </button>
        </div>

        {/* Responses */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-0.5">Responses</p>
              <p className="text-3xl font-bold text-gray-800">
                {responded}
                <span className="text-base font-normal text-gray-400"> / {total}</span>
              </p>
            </div>
            <button
              onClick={() => router.push(`/plans/${planId}/summary?token=${token}`)}
              className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition"
            >
              View Results →
            </button>
          </div>
        </div>

        {/* Your preferences */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Your Preferences</p>
              <p className="text-xs text-gray-400 mt-0.5">{creatorResponded ? '✅ Saved' : '⏳ Not filled out yet'}</p>
            </div>
            <button
              onClick={() => router.push(`/plans/${planId}/respond/creator`)}
              className={`text-sm px-4 py-2 rounded-xl font-semibold transition ${
                creatorResponded ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {creatorResponded ? 'Edit' : 'Fill Out'}
            </button>
          </div>
        </div>

        {/* Respondents list */}
        {plan.invitees.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-700 mb-3">
              🏌️ Group Responses ({plan.invitees.filter((i) => i.responded).length}/{plan.invitees.length})
            </h2>
            <div className="space-y-2">
              {plan.invitees.map((invitee, idx) => (
                <div key={invitee.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-gray-500">{invitee.responded ? '✅ Responded' : '⏳ Pending'}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveInvitee(invitee.id)}
                    className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          This page expires 24 hours after creation. Bookmark it to return.
        </p>
      </main>
    </div>
  );
}
