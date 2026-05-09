'use client';

import { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Plan, Preferences, TimeOfDay } from '@/lib/types';
import { getPlan, savePlan, formatDate, isPlanExpired } from '@/lib/store';
import PhaseSteps from '@/components/PhaseSteps';

const PlanMap = dynamic(() => import('@/components/PlanMap'), { ssr: false });

interface GolfCourse {
  id: number;
  name: string;
  city: string;
  state: string;
  website: string;
  lat: number | null;
  lng: number | null;
  holes: number | null;
}

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: '🌅 Morning (7am–11am)',
  afternoon: '☀️ Afternoon (11am–3pm)',
  evening: '🌇 Evening (3pm–7pm)',
};

function SummaryContent() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [voterId, setVoterId] = useState<string | null>(null);
  const [courses, setCourses] = useState<GolfCourse[] | null>(null);
  const [sortedCourses, setSortedCourses] = useState<GolfCourse[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [concluding, setConcluding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPlan(planId).then((p) => {
      if (!p || isPlanExpired(p)) { router.push('/'); return; }
      setPlan(p);
      setLoading(false);

      // Voter identity — organizer token takes priority
      let vid: string;
      if (token) {
        localStorage.setItem(`golfplan_voter_${planId}`, token);
        vid = token;
      } else {
        const stored = localStorage.getItem(`golfplan_voter_${planId}`);
        const myId = localStorage.getItem(`golfplan_me_${planId}`);
        if (stored) {
          vid = stored;
        } else if (myId) {
          vid = myId;
        } else {
          vid = crypto.randomUUID();
          localStorage.setItem(`golfplan_voter_${planId}`, vid);
        }
      }
      setVoterId(vid);
    });
  }, [planId, router, token]);

  // Stable key that only changes when respondent location data changes (not votes)
  const respondentsKey = plan
    ? [
        plan.creatorPreferences?.location
          ? `c:${plan.creatorPreferences.location.lat},${plan.creatorPreferences.location.lng},${plan.creatorPreferences.maxDriveDistance}`
          : '',
        ...plan.invitees
          .filter((i) => i.responded && i.preferences?.location?.lat)
          .map((i) => `${i.id}:${i.preferences!.location.lat},${i.preferences!.location.lng},${i.preferences!.maxDriveDistance}`),
      ].join('|')
    : '';

  useEffect(() => {
    if (!plan) return;
    const withLoc = [
      ...(plan.creatorPreferences?.location ? [{ prefs: plan.creatorPreferences }] : []),
      ...plan.invitees
        .filter((i) => i.responded && i.preferences?.location?.lat)
        .map((i) => ({ prefs: i.preferences! })),
    ];
    if (withLoc.length < 1) return;

    const cacheKey = `golfplan_courses_${respondentsKey}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const list: GolfCourse[] = JSON.parse(cached);
        setCourses(list);
        setSortedCourses([...list].sort((a, b) =>
          (plan.votes?.[String(b.id)]?.length ?? 0) - (plan.votes?.[String(a.id)]?.length ?? 0)
        ));
        return;
      }
    } catch { /* fall through */ }

    setCoursesLoading(true);
    setCourses(null);
    setCoursesError(null);

    function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 3958.8;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const centLat = withLoc.reduce((s, r) => s + r.prefs.location.lat, 0) / withLoc.length;
    const centLng = withLoc.reduce((s, r) => s + r.prefs.location.lng, 0) / withLoc.length;
    const maxRadius = Math.max(...withLoc.map((r) => r.prefs.maxDriveDistance));
    const radiusMeters = Math.round(maxRadius * 1609.34);

    const query = `[out:json][timeout:25];(way["leisure"="golf_course"](around:${radiusMeters},${centLat.toFixed(5)},${centLng.toFixed(5)});relation["leisure"="golf_course"](around:${radiusMeters},${centLat.toFixed(5)},${centLng.toFixed(5)}););out tags center 50;`;
    const OVERPASS_ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    async function fetchOverpass(): Promise<any> {
      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`);
          const text = await res.text();
          if (!text.trimStart().startsWith('{')) continue;
          return JSON.parse(text);
        } catch { continue; }
      }
      throw new Error('Golf course data is temporarily unavailable. Try again in a moment.');
    }

    fetchOverpass()
      .then((data) => {
        const list: GolfCourse[] = (data.elements as any[])
          .filter((e) => e.tags?.name)
          .map((e) => {
            const t = e.tags;
            const name = t.name as string;
            const city = (t['addr:city'] || t['addr:town'] || t['addr:village'] || t['addr:suburb'] || t['addr:hamlet'] || t['addr:county'] || '') as string;
            const state = (t['addr:state'] || t['is_in:state_code'] || t['is_in:state'] || '') as string;
            const rawWebsite = (t.website || t['contact:website'] || t.url || '') as string;
            const lat: number | null = e.center?.lat ?? e.lat ?? null;
            const lng: number | null = e.center?.lon ?? e.lon ?? null;
            const mapsQuery = encodeURIComponent(`${name}${city ? ' ' + city : ''}${state ? ' ' + state : ''} golf course`);
            const website = rawWebsite || `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
            return { id: e.id as number, name, city, state, website, lat, lng, holes: t.holes ? parseInt(t.holes) : null };
          })
          .filter((course) => {
            if (course.lat === null || course.lng === null) return false;
            return withLoc.every((r) =>
              haversineMiles(r.prefs.location.lat, r.prefs.location.lng, course.lat!, course.lng!) <= r.prefs.maxDriveDistance
            );
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setCourses(list);
        setSortedCourses([...list].sort((a, b) =>
          (plan.votes?.[String(b.id)]?.length ?? 0) - (plan.votes?.[String(a.id)]?.length ?? 0)
        ));
        try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch { /* quota */ }
      })
      .catch((e) => setCoursesError(e.message))
      .finally(() => setCoursesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respondentsKey]);

  async function toggleVote(courseId: number) {
    if (!voterId) return;
    const key = String(courseId);
    const current = await getPlan(planId);
    if (!current) return;
    const votes = { ...(current.votes ?? {}) };
    const courseVoters = votes[key] ?? [];
    if (courseVoters.includes(voterId)) {
      votes[key] = courseVoters.filter((v) => v !== voterId);
    } else {
      const myTotal = Object.values(votes).filter((v) => v.includes(voterId)).length;
      if (myTotal >= 3) return;
      votes[key] = [...courseVoters, voterId];
    }
    const updated = { ...current, votes };
    await savePlan(updated);
    setPlan(updated);
  }

  async function shareResults() {
    const url = window.location.href;
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

  async function concludeVoting() {
    if (!plan || concluding) return;
    setConcluding(true);
    const latest = await getPlan(planId);
    if (!latest) { setConcluding(false); return; }
    const updated = { ...latest, phase: 'results' as const };
    await savePlan(updated);
    setPlan(updated);
    setConcluding(false);
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

  if (!plan) return null;

  const isOrganizer = token !== null || (voterId !== null && voterId === plan.creatorToken);
  const phase = plan.phase;

  const respondents: { label: string; prefs: Preferences; isMe: boolean }[] = [];
  let playerNum = 1;
  if (plan.creatorPreferences) {
    const isMe = isOrganizer;
    respondents.push({ label: isMe ? 'You' : `Player ${playerNum}`, prefs: plan.creatorPreferences, isMe });
    playerNum++;
  }
  plan.invitees.forEach((i) => {
    if (i.responded && i.preferences) {
      const myId = typeof window !== 'undefined' ? localStorage.getItem(`golfplan_me_${planId}`) : null;
      const isMe = i.id === myId;
      respondents.push({ label: isMe ? 'You' : `Player ${playerNum}`, prefs: i.preferences, isMe });
      playerNum++;
    }
  });

  const total = respondents.length;
  const timeOptions: TimeOfDay[] = ['morning', 'afternoon', 'evening'];
  const timeResults = timeOptions.map((t) => {
    const labels = respondents.filter((r) => r.prefs.timeOfDay.includes(t)).map((r) => r.label);
    return { time: t, count: labels.length, labels };
  }).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);

  const prices = respondents.map((r) => r.prefs.maxPrice);
  const drives = respondents.map((r) => r.prefs.maxDriveDistance);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const minDrive = drives.length ? Math.min(...drives) : null;
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const bestTimes = timeResults.filter((t) => t.count === total && total > 0);
  const partialTimes = timeResults.filter((t) => t.count < total && t.count > 0);

  const activeVoterIds = new Set<string>([
    ...(plan.creatorPreferences ? [plan.creatorToken] : []),
    ...plan.invitees.filter((i) => i.responded).map((i) => i.id),
  ]);
  const myTotalVotes = Object.values(plan.votes ?? {}).filter((v) => voterId && v.includes(voterId)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-10">
      <header className="bg-green-700 text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold mb-0.5">⛳ Golf Round</h1>
          <p className="text-green-200 text-sm mb-3">📅 {formatDate(plan.date)}</p>
          <PhaseSteps currentPhase={phase} planId={planId} token={token} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-28">

        {/* ── VOTING PHASE ── */}
        {phase === 'voting' && (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-200 text-center">
              <div className="text-3xl mb-2">🗳️</div>
              <h2 className="font-bold text-gray-800 mb-1">Vote for your top courses</h2>
              <p className="text-sm text-gray-500">Up to 3 votes. Results are hidden until the organizer closes voting.</p>
            </div>

            {/* Map — above course list */}
            {respondents.some((r) => r.prefs.location?.lat) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-700 mb-3">🗺️ Drive radius overlap</h2>
                <div className="overflow-hidden rounded-2xl">
                  <PlanMap
                    pins={respondents
                      .filter((r) => r.prefs.location?.lat)
                      .map((r) => ({
                        label: r.label,
                        lat: r.prefs.location.lat,
                        lng: r.prefs.location.lng,
                        radiusMiles: r.prefs.maxDriveDistance,
                      }))}
                  />
                </div>
              </div>
            )}

            {(coursesLoading || courses !== null || coursesError) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-700 mb-1">⛳ Courses in the overlap zone</h2>
                <p className="text-xs text-gray-400 mb-3">Within everyone&apos;s max drive from their location</p>
                {coursesLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                    <svg className="animate-spin h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Searching for courses…
                  </div>
                )}
                {coursesError && (
                  <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{coursesError}</div>
                )}
                {courses && courses.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No courses found in the overlap area.</p>
                )}
                {sortedCourses && sortedCourses.length > 0 && (
                  <div className="space-y-2">
                    {myTotalVotes < 3 ? (
                      <p className="text-xs text-gray-400 pb-1">{3 - myTotalVotes} vote{3 - myTotalVotes !== 1 ? 's' : ''} left</p>
                    ) : (
                      <p className="text-xs text-green-600 pb-1 font-medium">All 3 votes cast — tap a star to remove one</p>
                    )}
                    {sortedCourses.slice(0, 15).map((c) => {
                      const courseVoters = plan.votes?.[String(c.id)] ?? [];
                      const voteCount = courseVoters.filter((v) => activeVoterIds.has(v)).length;
                      const iVoted = voterId ? courseVoters.includes(voterId) : false;
                      const canVote = !iVoted && myTotalVotes < 3;
                      return (
                        <div key={c.id} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${iVoted ? 'bg-green-50 rounded-xl -mx-2 px-2' : ''}`}>
                          <div className="w-8 h-8 rounded-xl bg-green-50 flex-shrink-0 flex items-center justify-center text-lg">⛳</div>
                          <div className="min-w-0 flex-1">
                            <a href={c.website} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-semibold text-green-700 hover:underline truncate block">
                              {c.name}
                            </a>
                            <p className="text-xs text-gray-400">
                              {[c.city, c.state].filter(Boolean).join(', ')}
                              {c.holes ? ` · ${c.holes} holes` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleVote(c.id)}
                            disabled={!iVoted && !canVote}
                            className={`flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-xl border-2 font-bold text-sm transition ${
                              iVoted
                                ? 'bg-green-600 border-green-600 text-white'
                                : canVote
                                  ? 'bg-gray-50 border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-600'
                                  : 'bg-gray-50 border-gray-100 text-gray-200 cursor-not-allowed'
                            }`}
                          >
                            <span className="text-base leading-none">{iVoted ? '★' : '☆'}</span>
                            {/* organizer sees live counts even during voting */}
                            {isOrganizer && voteCount > 0 && <span className="text-xs leading-none mt-0.5">{voteCount}</span>}
                          </button>
                        </div>
                      );
                    })}
                    {sortedCourses.length > 15 && (
                      <p className="text-xs text-gray-400 text-center pt-1">+{sortedCourses.length - 15} more courses</p>
                    )}
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {/* ── RESULTS PHASE ── */}
        {phase === 'results' && (() => {
          // Compute ranked courses fresh from current votes — only include voted courses
          const rankedCourses = courses
            ? [...courses]
                .map((c) => ({
                  ...c,
                  voteCount: (plan.votes?.[String(c.id)] ?? []).filter((v) => activeVoterIds.has(v)).length,
                  iVoted: voterId ? (plan.votes?.[String(c.id)] ?? []).includes(voterId) : false,
                }))
                .filter((c) => c.voteCount > 0)
                .sort((a, b) => b.voteCount - a.voteCount)
            : [];

          return (
          <>
            {/* Budget & Drive */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-2xl mb-1">💵</div>
                <p className="text-xs text-gray-400 mb-1">Max everyone can spend</p>
                <p className="text-3xl font-bold text-green-700">{minPrice !== null ? `$${minPrice}` : '—'}</p>
                <p className="text-xs text-gray-400 mt-1">avg ${avgPrice}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-2xl mb-1">🚗</div>
                <p className="text-xs text-gray-400 mb-1">Max everyone will drive</p>
                <p className="text-3xl font-bold text-green-700">{minDrive !== null ? `${minDrive} mi` : '—'}</p>
                <p className="text-xs text-gray-400 mt-1">one way</p>
              </div>
            </div>

            {/* Best Times */}
            {bestTimes.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-200">
                <h2 className="font-bold text-green-700 mb-3 flex items-center gap-2">
                  <span>🎯</span> Works for everyone
                </h2>
                <div className="space-y-2">
                  {bestTimes.map((t) => (
                    <div key={t.time} className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
                      <p className="font-semibold text-gray-800">{TIME_LABELS[t.time]}</p>
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {t.count}/{total} ✓
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {partialTimes.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-700 mb-3">📅 Works for some</h2>
                <div className="space-y-3">
                  {partialTimes.map((t) => {
                    const pct = Math.round((t.count / total) * 100);
                    return (
                      <div key={t.time}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-800">{TIME_LABELS[t.time]}</p>
                          <span className="text-xs font-semibold text-gray-500">{t.count}/{total}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ranked courses — only voted, sorted by vote count */}
            {rankedCourses.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-700 mb-1">🏆 Course Rankings</h2>
                <p className="text-xs text-gray-400 mb-3">Sorted by votes from the group</p>
                <div className="space-y-2">
                  {rankedCourses.map((c, rank) => (
                    <div key={c.id} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${rank === 0 ? 'bg-yellow-50 rounded-xl -mx-2 px-2' : ''}`}>
                      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm bg-gray-50 text-gray-500">
                        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <a href={c.website} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-semibold text-green-700 hover:underline truncate block">
                          {c.name}
                        </a>
                        <p className="text-xs text-gray-400">
                          {[c.city, c.state].filter(Boolean).join(', ')}
                          {c.holes ? ` · ${c.holes} holes` : ''}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-center w-10">
                        {c.iVoted && <span className="text-green-600 text-base">★</span>}
                        <span className="text-sm font-bold text-gray-700">{c.voteCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
          );
        })()}

        {/* Organizer-only preview during collecting phase */}
        {phase === 'collecting' && isOrganizer && total === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-4xl mb-3">📋</div>
            <h2 className="font-semibold text-gray-700 mb-2">No preferences yet</h2>
            <p className="text-gray-400 text-sm">Results will appear here once your group responds.</p>
          </div>
        )}

        {phase === 'collecting' && isOrganizer && total > 0 && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800 font-medium">
              Preview only — group cannot see this until you open voting.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-2xl mb-1">💵</div>
                <p className="text-xs text-gray-400 mb-1">Max everyone can spend</p>
                <p className="text-3xl font-bold text-green-700">{minPrice !== null ? `$${minPrice}` : '—'}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <div className="text-2xl mb-1">🚗</div>
                <p className="text-xs text-gray-400 mb-1">Max everyone will drive</p>
                <p className="text-3xl font-bold text-green-700">{minDrive !== null ? `${minDrive} mi` : '—'}</p>
              </div>
            </div>
            {bestTimes.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-200">
                <h2 className="font-bold text-green-700 mb-3">🎯 Works for everyone</h2>
                <div className="space-y-2">
                  {bestTimes.map((t) => (
                    <div key={t.time} className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
                      <p className="font-semibold text-gray-800">{TIME_LABELS[t.time]}</p>
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">{t.count}/{total} ✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {respondents.some((r) => r.prefs.location?.lat) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-700 mb-3">🗺️ Drive radius overlap</h2>
                <div className="overflow-hidden rounded-2xl">
                  <PlanMap
                    pins={respondents
                      .filter((r) => r.prefs.location?.lat)
                      .map((r) => ({
                        label: r.label,
                        lat: r.prefs.location.lat,
                        lng: r.prefs.location.lng,
                        radiusMiles: r.prefs.maxDriveDistance,
                      }))}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Non-organizer hitting summary before results */}
        {(phase === 'collecting' || phase === 'voting') && !isOrganizer && phase !== 'voting' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-4xl mb-3">⏳</div>
            <h2 className="font-semibold text-gray-700 mb-2">Waiting for results</h2>
            <p className="text-gray-400 text-sm">The organizer will share results once voting closes.</p>
          </div>
        )}
      </main>

      {/* Sticky footer: share results */}
      {phase === 'results' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <div className="max-w-lg mx-auto">
            <button
              onClick={shareResults}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition ${
                copied ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {copied ? '✓ Link Copied!' : '📋 Share Results'}
            </button>
          </div>
        </div>
      )}

      {/* Sticky footer: organizer close-voting button */}
      {phase === 'voting' && isOrganizer && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <div className="max-w-lg mx-auto">
            <button
              onClick={concludeVoting}
              disabled={concluding}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                myTotalVotes >= 3
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {concluding ? 'Closing…' : myTotalVotes >= 3 ? '🏆 Close Voting & Show Results' : 'Close Voting & Show Results'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default function SummaryPage() {
  return (
    <Suspense fallback={null}>
      <SummaryContent />
    </Suspense>
  );
}
