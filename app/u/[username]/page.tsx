'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Song, BucketType, ALBUM_NAME_TO_ID } from '@/app/data/constants';
import { AlbumArtwork } from '@/app/components/SharedUI';
import AppShell from '@/app/components/AppShell';

interface FriendProfile {
  id: string;
  username: string;
  display_name: string;
}

// WEEZER COMPATIBILITY QUIP HELPER
function getWeezerCompatibilityQuip(score: number) {
  if (score >= 90) {
    return {
      title: 'Soulmates in Blue 💙',
      phrase: '"In the Garage together forever." Your taste canons are virtually identical!',
      color: 'text-emerald-400',
    };
  }
  if (score >= 75) {
    return {
      title: 'Island in the Sun ☀️️',
      phrase: '"On an island in the sun..." Harmonizing on almost every single album cut.',
      color: 'text-emerald-400',
    };
  }
  if (score >= 50) {
    return {
      title: 'The Good Life 🎸',
      phrase: '"Shaking booty, making sweet love..." Solid agreement with a few fun B-Side debates.',
      color: 'text-blue-400',
    };
  }
  if (score >= 35) {
    return {
      title: 'Hash Pipe ⚡️',
      phrase: 'A little chaotic and loud, but you can definitely rock out together.',
      color: 'text-amber-400',
    };
  }
  if (score >= 20) {
    return {
      title: "Say It Ain't So 🥀",
      phrase: 'Major structural disagreements on album quality. Tread carefully!',
      color: 'text-rose-400',
    };
  }
  return {
    title: 'Pink Triangle 📐',
    phrase: '"If anyone’s gonna be the one, it’s not you." Complete taste incompatibility!',
    color: 'text-rose-500',
  };
}

// STATISTICAL HELPER: Kendall's Tau (Rank Agreement)
function calculateKendallTau(
  userRankMap: Map<string, number>,
  targetRankMap: Map<string, number>
): { tau: number; sampleSize: number } {
  const comparableIds = Array.from(userRankMap.keys()).filter((id) =>
    targetRankMap.has(id)
  );
  const n = comparableIds.length;
  if (n < 2) return { tau: 0, sampleSize: n };

  let concordant = 0;
  let discordant = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const userI = userRankMap.get(comparableIds[i])!;
      const userJ = userRankMap.get(comparableIds[j])!;
      const targetI = targetRankMap.get(comparableIds[i])!;
      const targetJ = targetRankMap.get(comparableIds[j])!;

      const userOrder = userI < userJ ? -1 : 1;
      const targetOrder = targetI < targetJ ? -1 : 1;

      if (userOrder === targetOrder) concordant++;
      else discordant++;
    }
  }

  const totalPairs = concordant + discordant;
  return {
    tau: totalPairs > 0 ? (concordant - discordant) / totalPairs : 0,
    sampleSize: n,
  };
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rawUsername = params?.username as string;
  const username = rawUsername ? rawUsername.toLowerCase() : '';

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Target User (Profile Owner)
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [targetMaster, setTargetMaster] = useState<Song[]>([]);
  const [targetTriage, setTargetTriage] = useState<Record<string, BucketType>>({});

  // Visitor User (Logged-in Viewer)
  const [visitorProfile, setVisitorProfile] = useState<any>(null);
  const [visitorMaster, setVisitorMaster] = useState<Song[]>([]);
  const [visitorTriage, setVisitorTriage] = useState<Record<string, BucketType>>({});

  // Friends list for quick switching
  const [allFriends, setAllFriends] = useState<FriendProfile[]>([]);

  useEffect(() => {
    if (username) fetchProfilesAndRankings();
  }, [username]);

  const fetchProfilesAndRankings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Target Fan via the get_public_fan() SECURITY DEFINER
      // function instead of selecting another user's profile and ranking
      // rows directly (blocked by RLS). Returns
      // { id, username, display_name, master_list, triage_map }.
      const { data: fan, error: fanErr } = await supabase.rpc(
        'get_public_fan',
        { p_username: username }
      );

      if (fanErr || !fan) {
        setErrorMsg("We couldn't find a Weezer fan with that username.");
        setLoading(false);
        return;
      }
      const tProfile = {
        id: fan.id,
        username: fan.username,
        display_name: fan.display_name,
      };
      setTargetProfile(tProfile);

      // 2. Target rankings arrive inside the same get_public_fan() payload.
      if (fan.master_list) {
        setTargetMaster(fan.master_list);
        setTargetTriage(fan.triage_map || {});
      }

      // 3. Fetch Visitor (Current Logged-In User)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const vId = session.user.id;
        if (vId !== tProfile.id) {
          const { data: vProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', vId)
            .maybeSingle();

          if (vProfile) setVisitorProfile(vProfile);

          const { data: vRanks } = await supabase
            .from('weezer_rankings')
            .select('master_list, triage_map')
            .eq('user_id', vId)
            .maybeSingle();

          if (vRanks?.master_list) {
            setVisitorMaster(vRanks.master_list);
            setVisitorTriage(vRanks.triage_map || {});
          }
        }

        // 4. Fetch Visitor's connected friends for Carousel Switcher.
        // Pre-launch security: friend cards come from the
        // get_my_friend_cards() SECURITY DEFINER function instead of
        // selecting other users' profile rows directly (blocked by RLS).
        const { data: cards } = await supabase.rpc('get_my_friend_cards');

        if (cards && cards.length > 0) {
          setAllFriends(
            cards.map((c: any) => ({
              id: c.id,
              username: c.username,
              display_name: c.display_name || c.username,
            }))
          );
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred loading this profile.');
    } finally {
      setLoading(false);
    }
  };

  // Switcher Navigation Helpers
  const currentFriendIdx = useMemo(() => {
    return allFriends.findIndex((f) => f.username.toLowerCase() === username);
  }, [allFriends, username]);

  const handlePrevFriend = () => {
    if (allFriends.length === 0) return;
    const prevIdx = (currentFriendIdx - 1 + allFriends.length) % allFriends.length;
    router.push(`/u/${allFriends[prevIdx].username}`);
  };

  const handleNextFriend = () => {
    if (allFriends.length === 0) return;
    const nextIdx = (currentFriendIdx + 1) % allFriends.length;
    router.push(`/u/${allFriends[nextIdx].username}`);
  };

  // --------------------------------------------------------
  // COMPARISON MATH
  // --------------------------------------------------------
  const stats = useMemo(() => {
    if (!targetMaster.length) return null;

    const tExplicit = targetMaster.filter(
      (s) => targetTriage[s.id] === 'banger' || targetTriage[s.id] === 'slaps'
    );
    const vExplicit = visitorMaster.filter(
      (s) => visitorTriage[s.id] === 'banger' || visitorTriage[s.id] === 'slaps'
    );

    const tRankMap = new Map<string, number>();
    tExplicit.forEach((s, i) => tRankMap.set(s.id, i + 1));

    const vRankMap = new Map<string, number>();
    vExplicit.forEach((s, i) => vRankMap.set(s.id, i + 1));

    // Head-to-Head Comparison Math
    let compatibilityScore = 0;
    let sharedSample = 0;
    let biggestFight = null;
    let sharedFavorites: Song[] = [];

    if (vExplicit.length > 0) {
      const { tau, sampleSize } = calculateKendallTau(vRankMap, tRankMap);
      compatibilityScore = sampleSize >= 2 ? Math.round(((tau + 1) / 2) * 100) : 0;
      sharedSample = sampleSize;

      const comparisons: any[] = [];
      const vCount = vExplicit.length;
      const tCount = tExplicit.length;

      vExplicit.forEach((song) => {
        const vRank = vRankMap.get(song.id);
        const tRank = tRankMap.get(song.id);

        if (vRank !== undefined && tRank !== undefined) {
          const vPct = vCount > 1 ? (vRank - 1) / (vCount - 1) : 0;
          const tPct = tCount > 1 ? (tRank - 1) / (tCount - 1) : 0;
          comparisons.push({ song, vRank, tRank, diff: Math.abs(vPct - tPct) });

          if (vRank <= 20 && tRank <= 20) sharedFavorites.push(song);
        }
      });

      if (comparisons.length > 0) {
        biggestFight = comparisons.reduce(
          (max, curr) => (curr.diff > max.diff ? curr : max),
          comparisons[0]
        );
        if (biggestFight.diff < 0.20) biggestFight = null;
      }
    }

    return {
      targetTop10: tExplicit.slice(0, 10),
      visitorTop10: vExplicit.slice(0, 10),
      compatibilityScore,
      sharedSample,
      biggestFight,
      sharedFavorites: sharedFavorites.slice(0, 3),
      quip: getWeezerCompatibilityQuip(compatibilityScore),
    };
  }, [targetMaster, targetTriage, visitorMaster, visitorTriage]);

  const tName = targetProfile?.display_name || targetProfile?.username;
  const vName = visitorProfile?.display_name || visitorProfile?.username || 'You';
  const hasVisitorData = visitorMaster.length > 0;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-24 font-sans space-y-5">
        
        {/* TOP BAR: BREADCRUMB TO FAN FRIENDS */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => router.push('/?step=friends')}
            className="inline-flex items-center gap-1.5 text-xs font-black text-[#0072CE] hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-full transition-colors cursor-pointer border border-blue-200/60"
          >
            ← Back to Fan Friends
          </button>
        </div>

        {/* LIGHT FRIENDS CAROUSEL SWITCHER */}
        {allFriends.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between shadow-xs">
            <button
              onClick={handlePrevFriend}
              className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 font-black text-xs cursor-pointer flex items-center gap-1 shrink-0"
            >
              ← Prev
            </button>

            {/* AVATAR CHIPS */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-2 max-w-[280px] sm:max-w-md no-scrollbar">
              {allFriends.map((f) => {
                const isActive = f.username.toLowerCase() === username;
                return (
                  <button
                    key={f.id}
                    onClick={() => router.push(`/u/${f.username}`)}
                    className={`px-3 py-1 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0072CE] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    @{f.username}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNextFriend}
              className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 font-black text-xs cursor-pointer flex items-center gap-1 shrink-0"
            >
              Next →
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400 animate-pulse">
              Calculating compatibility...
            </p>
          </div>
        ) : errorMsg || !targetProfile ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-4 shadow-sm">
            <div className="text-5xl">🔍</div>
            <h2 className="text-2xl font-black text-slate-900">Profile Not Found</h2>
            <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto">{errorMsg}</p>
            <button
              onClick={() => router.push('/?step=friends')}
              className="bg-[#0072CE] text-white px-6 py-3 rounded-xl font-black text-xs shadow-md cursor-pointer"
            >
              Back to Fan Friends
            </button>
          </div>
        ) : (
          <main className="space-y-6 animate-in fade-in duration-300">
            
            {/* HERO HEADER */}
            <div className="text-center pt-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">
                {hasVisitorData ? 'Head-to-Head Matchup' : 'Fan Profile'}
              </span>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
                {hasVisitorData ? 'Clash of Canons' : `${tName}'s Master List`}
              </h1>
            </div>

            {/* ENHANCED MATCH SCORECARD */}
            {hasVisitorData && stats?.sharedSample ? (
              <div className="bg-slate-950 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-800 text-white space-y-6">
                
                {/* SCORES AND NAMES ROW */}
                <div className="flex justify-between items-center relative z-10">
                  
                  {/* VISITOR NAME */}
                  <div className="flex flex-col items-start w-2/5 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      You
                    </span>
                    <h2 className="text-lg sm:text-2xl font-black text-white truncate leading-tight w-full">
                      {vName}
                    </h2>
                  </div>

                  {/* SCORE BADGE */}
                  <div className="flex flex-col items-center justify-center shrink-0 px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      Match
                    </span>
                    <span className={`text-4xl sm:text-5xl font-black ${stats.quip.color} drop-shadow-md`}>
                      {stats.compatibilityScore}%
                    </span>
                  </div>

                  {/* TARGET NAME */}
                  <div className="flex flex-col items-end w-2/5 min-w-0 text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Friend
                    </span>
                    <h2 className="text-lg sm:text-2xl font-black text-white truncate leading-tight w-full">
                      {tName}
                    </h2>
                  </div>

                </div>

                {/* WEEZER THEMED QUIP & VERDICT BANNER */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-center space-y-1">
                  <span className={`text-xs font-black uppercase tracking-wider block ${stats.quip.color}`}>
                    {stats.quip.title}
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-slate-300 leading-snug italic">
                    {stats.quip.phrase}
                  </p>
                </div>

              </div>
            ) : !hasVisitorData ? (
              /* GUEST BANNER */
              <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6 text-center shadow-sm">
                <div className="text-3xl mb-2">👀</div>
                <h3 className="text-lg font-black text-slate-900 mb-1">
                  Want to see how you match up?
                </h3>
                <p className="text-xs font-semibold text-slate-500 mb-4 max-w-sm mx-auto">
                  Create your own Weezer ranking to unlock your compatibility score and see where you and {tName} disagree.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="bg-[#0072CE] text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-md hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  Start Your Ranking
                </button>
              </div>
            ) : null}

            {/* THE BIGGEST FIGHT */}
            {hasVisitorData && stats?.biggestFight && (
              <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 sm:p-8 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 block mb-1 text-center">
                  🥊 The Biggest War
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-center text-rose-950 mb-5 tracking-tight">
                  You two completely disagree on this track.
                </h3>

                <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                  <span className="text-lg font-black text-slate-900 mb-5 px-2 relative z-10">
                    {stats.biggestFight.song.title}
                  </span>

                  <div className="flex items-center w-full justify-around relative z-10">
                    <div className="flex flex-col items-center w-2/5">
                      <span className="text-[9px] font-black uppercase text-slate-400 mb-1">
                        {vName}
                      </span>
                      <span className="text-2xl font-black text-rose-500">
                        #{stats.biggestFight.vRank}
                      </span>
                    </div>
                    <div className="w-px h-10 bg-rose-100" />
                    <div className="flex flex-col items-center w-2/5">
                      <span className="text-[9px] font-black uppercase text-slate-400 mb-1">
                        {tName}
                      </span>
                      <span className="text-2xl font-black text-rose-500">
                        #{stats.biggestFight.tRank}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COMMON GROUND */}
            {hasVisitorData && stats?.sharedFavorites && stats.sharedFavorites.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-8 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-1 text-center">
                  🤝 Common Ground
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-center text-emerald-950 mb-5 tracking-tight">
                  Tracks you both put in your Top 20.
                </h3>
                <div className="space-y-2.5">
                  {stats.sharedFavorites.map((song) => {
                    const resolvedId = song.albumId || ALBUM_NAME_TO_ID[song.album];
                    return (
                      <div
                        key={song.id}
                        className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-emerald-100 shadow-sm"
                      >
                        <AlbumArtwork
                          albumId={resolvedId}
                          className="w-10 h-10 rounded-xl shadow-sm object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                            {song.title}
                          </h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                            {song.album}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SIDE-BY-SIDE TOP 10 */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="text-center mb-6 border-b border-slate-100 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">
                  The Canons
                </span>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
                  Top 10 Comparison
                </h3>
              </div>

              <div className="flex gap-4 sm:gap-8">
                {/* VISITOR COLUMN */}
                {hasVisitorData && (
                  <div className="flex-1 w-1/2">
                    <div className="text-center mb-3">
                      <span className="text-xs font-black uppercase text-slate-900 block truncate px-2">
                        {vName}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {stats?.visitorTop10.map((song, i) => (
                        <div
                          key={song.id}
                          className="flex flex-col items-center sm:flex-row sm:items-start text-center sm:text-left gap-2 group"
                        >
                          <span className="text-[10px] font-black text-slate-400 w-4 hidden sm:block pt-1">
                            {i + 1}.
                          </span>
                          <AlbumArtwork
                            albumId={song.albumId || ALBUM_NAME_TO_ID[song.album]}
                            className="w-9 h-9 rounded-xl shadow-sm object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-extrabold text-slate-800 leading-tight truncate">
                              {song.title}
                            </h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DIVIDER */}
                {hasVisitorData && <div className="w-px bg-slate-100 hidden sm:block" />}

                {/* TARGET COLUMN */}
                <div className={`flex-1 ${!hasVisitorData ? 'w-full max-w-sm mx-auto' : 'w-1/2'}`}>
                  <div className="text-center mb-3">
                    <span className="text-xs font-black uppercase text-slate-900 block truncate px-2">
                      {tName}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {stats?.targetTop10.map((song, i) => (
                      <div
                        key={song.id}
                        className="flex flex-col items-center sm:flex-row sm:items-start text-center sm:text-left gap-2"
                      >
                        <span className="text-[10px] font-black text-slate-400 w-4 hidden sm:block pt-1">
                          {i + 1}.
                        </span>
                        <AlbumArtwork
                          albumId={song.albumId || ALBUM_NAME_TO_ID[song.album]}
                          className="w-9 h-9 rounded-xl shadow-sm object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-extrabold text-slate-800 leading-tight truncate">
                            {song.title}
                          </h4>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </main>
        )}
      </div>
    </AppShell>
  );
}


