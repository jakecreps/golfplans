'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plan } from '@/lib/types';
import { getPlan, savePlan, formatDate, isPlanExpired } from '@/lib/store';
import { ManagePhaseSteps } from '@/components/PhaseSteps';


export default function ManagePage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const token = params.token as string;

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [autoAdvanced, setAutoAdvanced] = useState(false);

  useEffect(() => {
    getPlan(planId).then((p) => {
      if (!p) { setExpired(true); setLoading(false); return; }
      if (isPlanExpired(p)) { setExpired(true); setLoading(false); return; }
      if (p.creatorToken !== token) { setInvalid(true); setLoading(false); return; }
      setPlan(p);
      setLoading(false);
    });
  }, [planId, token]);

  useEffect(() => {
    if (!plan || plan.phase !== 'collecting' || autoAdvanced || advancing) return;
    if (!plan.groupSize) return;
    const creatorResponded = !!plan.creatorPreferences;
    const respondedCount = plan.invitees.filter((i) => i.responded).length + (creatorResponded ? 1 : 0);
    if (respondedCount >= plan.groupSize) {
      setAutoAdvanced(true);
      advancePhase();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

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

  async function handleRemoveInvitee(inviteeId: string) {
    if (!plan) return;
    const latest = await getPlan(planId);
    if (!latest) return;
    const updated = { ...latest, invitees: latest.invitees.filter((i) => i.id !== inviteeId) };
    await savePlan(updated);
    setPlan(updated);
  }

  async function advancePhase() {
    if (!plan || advancing) return;
    setAdvancing(true);
    const nextPhase = plan.phase === 'collecting' ? 'voting' : 'results';
    const latest = await getPlan(planId);
    if (!latest) { setAdvancing(false); return; }
    const updated = { ...latest, phase: nextPhase } as Plan;
    try {
      await savePlan(updated);
      setPlan(updated);
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
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
  const respondedCount = plan.invitees.filter((i) => i.responded).length + (creatorResponded ? 1 : 0);
  const totalCount = plan.groupSize ?? plan.invitees.length + 1;
  const allResponded = plan.groupSize ? respondedCount >= plan.groupSize : false;

  const activeVoterIds = new Set([
    ...(plan.creatorPreferences ? [plan.creatorToken] : []),
    ...plan.invitees.filter((i) => i.responded).map((i) => i.id),
  ]);
  const votedCount = new Set(
    Object.values(plan.votes ?? {}).flat().filter((v) => activeVoterIds.has(v))
  ).size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-8">
      <header className="bg-green-700 text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold mb-0.5">⛳ Golf Round</h1>
          <p className="text-green-200 text-sm mb-3">📅 {formatDate(plan.date)}</p>
          <ManagePhaseSteps currentPhase={plan.phase} planId={planId} token={token} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Share link — collecting phase only */}
        {plan.phase === 'collecting' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-200">
            <h2 className="font-bold text-gray-800 mb-1 flex items-center gap-2 text-lg">
              <span>📲</span> Share with your group
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Everyone picks their preferred time, budget, and how far they&apos;ll drive — anonymously.
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
        )}

        {/* Status card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          {plan.phase === 'collecting' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-0.5">Responses</p>
                <p className="text-3xl font-bold text-gray-800">
                  {respondedCount}<span className="text-base font-normal text-gray-400"> / {totalCount}</span>
                </p>
              </div>
              <button
                onClick={() => router.push(`/plans/${planId}/summary?token=${token}`)}
                className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
              >
                Preview →
              </button>
            </div>
          )}
          {plan.phase === 'voting' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-0.5">Votes cast</p>
                <p className="text-3xl font-bold text-gray-800">
                  {votedCount}<span className="text-base font-normal text-gray-400"> / {respondedCount} responded</span>
                </p>
              </div>
              <button
                onClick={() => router.push(`/plans/${planId}/summary?token=${token}`)}
                className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition"
              >
                See Votes →
              </button>
            </div>
          )}
          {plan.phase === 'results' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-0.5">Results are live</p>
                <p className="text-sm font-semibold text-green-700">Everyone can see the final rankings</p>
              </div>
              <button
                onClick={() => router.push(`/plans/${planId}/summary?token=${token}`)}
                className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition"
              >
                View →
              </button>
            </div>
          )}
        </div>

        {/* Your preferences */}
        {plan.phase === 'collecting' && (
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
        )}

        {/* Invitee list — collecting phase */}
        {plan.phase === 'collecting' && plan.invitees.length > 0 && (
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

        {/* Phase advancement */}
        {plan.phase !== 'results' && (
          <div className={`bg-white rounded-2xl p-5 shadow-sm border ${plan.phase === 'collecting' ? 'border-yellow-200' : 'border-green-200'}`}>
            {plan.phase === 'collecting' && (
              <>
                <h2 className="font-bold text-gray-800 mb-1">Ready to pick a course?</h2>
                <p className="text-sm text-gray-500 mb-4">
                  {allResponded
                    ? 'Everyone has responded! Opening voting…'
                    : plan.groupSize
                    ? `Waiting for ${plan.groupSize - respondedCount} more response${plan.groupSize - respondedCount === 1 ? '' : 's'}. Voting opens automatically when the group is complete.`
                    : 'Once you lock responses, the group will vote on courses. Preferences can no longer be submitted after this.'}
                </p>
                <button
                  onClick={advancePhase}
                  disabled={respondedCount < 1 || advancing}
                  className="w-full bg-yellow-500 text-white py-3 rounded-xl font-bold hover:bg-yellow-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {advancing ? 'Opening voting…' : '🗳️ Lock Responses & Open Voting'}
                </button>
                {respondedCount < 1 && (
                  <p className="text-xs text-gray-400 text-center mt-2">Waiting for at least one response</p>
                )}
              </>
            )}
            {plan.phase === 'voting' && (
              <>
                <h2 className="font-bold text-gray-800 mb-1">Voting is open</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Share the same link with your group. Once everyone has voted, close voting to reveal the final rankings.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600 font-mono mb-3 break-all">
                  {joinUrl}
                </div>
                <button
                  onClick={shareLink}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition mb-3 ${
                    copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Link'}
                </button>
                <button
                  onClick={advancePhase}
                  disabled={advancing}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-40"
                >
                  {advancing ? 'Closing voting…' : '🏆 Close Voting & Show Results'}
                </button>
              </>
            )}
          </div>
        )}

        {plan.phase === 'results' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-200">
            <h2 className="font-bold text-green-700 mb-1">🏆 Results are live!</h2>
            <p className="text-sm text-gray-500 mb-3">
              Share the link below — everyone can now see the ranked course list and group preferences.
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
              {copied ? '✓ Copied!' : '📋 Copy Results Link'}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          This page expires 24 hours after creation. Bookmark it to return.
        </p>
      </main>
    </div>
  );
}
