'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Song, BucketType, ALBUM_NAME_TO_ID, BUCKET_CONFIG } from '@/app/data/constants';
import { AlbumArtwork } from '@/app/components/SharedUI';
import AppShell from '@/app/components/AppShell';
import { displayFont, handFont } from '@/app/components/shareables/fonts';
import { computeTribe, TRIBE_INK } from '@/app/components/shareables/TribeBadgeCard';
import {
  PROFILE_BUCKET_COLORS,
  PROFILE_BUCKET_ORDER,
  bucketCounts,
  catalogTotal,
  dominantTopAlbum,
  eraShares,
  listGroups,
  rankedCount,
  topEraTop10Note,
  topTierSongs,
} from '@/app/lib/profileStats';

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
      color: 'text-emerald-600',
    };
  }
  if (score >= 75) {
    return {
      title: 'Island in the Sun ☀️️',
      phrase: '"On an island in the sun..." Harmonizing on almost every single album cut.',
      color: 'text-emerald-600',
    };
  }
  if (score >= 50) {
    return {
      title: 'The Good Life 🎸',
      phrase: '"Shaking booty, making sweet love..." Solid agreement with a few fun B-Side debates.',
      color: 'text-[#0072CE]',
    };
  }
  if (score >= 35) {
    return {
      title: 'Hash Pipe ⚡️',
      phrase: 'A little chaotic and loud, but you can definitely rock out together.',
      color: 'text-amber-600',
    };
  }
  if (score >= 20) {
    return {
      title: "Say It Ain't So 🥀",
      phrase: 'Major structural disagreements on album quality. Tread carefully!',
      color: 'text-rose-600',
    };
  }
  return {
    title: 'Pink Triangle 📐',
    phrase: '"If anyone’s gonna be the one, it’s not you." Complete taste incompatibility!',
    color: 'text-rose-600',
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

  // Whether the visitor is signed in at all (regardless of whether
  // they have rankings). The Back to Fan Friends pill only renders
  // for them — a signed-out sharee has no Fan Friends to go back to.
  const [signedIn, setSignedIn] = useState(false);

  // Full-list expandable groups: the first two groups start open
  // (the mock's drawn state); an entry here overrides that default.
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({});

  // One-touch profile sharing: the native share sheet where
  // the browser offers one, else copy the link and say so.
  const [linkCopied, setLinkCopied] = useState(false);
  const handleShareProfile = async () => {
    if (!targetProfile?.username) return;
    const url = `${window.location.origin}/u/${targetProfile.username}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      /* clipboard unavailable — nothing more to do */
    }
  };

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
      if (session?.user) setSignedIn(true);
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
            cards
              // Accepted friends only — the RPC also returns
              // pending contacts, who don't belong in a "your
              // friends" switcher.
              .filter((c: any) => c.status === 'accepted')
              .map((c: any) => ({
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

  // --------------------------------------------------------
  // PROFILE SECTIONS (the strengthened page): everything below is
  // derived from the target fan's own payload — the master list
  // and triage map this page already downloads. See
  // app/lib/profileStats.ts for the derivations and their sources.
  // --------------------------------------------------------
  const profile = useMemo(() => {
    if (!targetMaster.length) return null;
    const topTier = topTierSongs(targetMaster, targetTriage);
    const shares = eraShares(topTier);
    const top10 = stats?.targetTop10 ?? topTier.slice(0, 10);
    return {
      topTier,
      ranked: rankedCount(targetMaster, targetTriage),
      total: catalogTotal(),
      counts: bucketCounts(targetMaster, targetTriage),
      shares,
      topAlbum: dominantTopAlbum(topTier),
      groups: listGroups(targetMaster, targetTriage),
      eraNote: topEraTop10Note(top10, shares),
      // The site's own tribe classification, verbatim (its fact
      // and diagnosis lines are first-person by design — the
      // tribe card speaks as the fan, and so does this band).
      tribe: computeTribe(targetMaster, targetTriage),
    };
  }, [targetMaster, targetTriage, stats]);

  const tName = targetProfile?.display_name || targetProfile?.username;
  const vName = visitorProfile?.display_name || visitorProfile?.username || 'You';
  // Owner's rule (Nov 10): this page speaks about the fan by
  // first name only — never the full display name, never "my".
  const firstNameOf = (n?: string | null) =>
    (n || '').trim().split(/\s+/)[0] || '';
  const tFirst = firstNameOf(targetProfile?.display_name) || targetProfile?.username || '';
  const vFirst = firstNameOf(visitorProfile?.display_name) || visitorProfile?.username || 'You';
  // The tribe lines are authored first-person for the fan's
  // own card; on this public page they are re-voiced to the
  // fan's first name so the page speaks one way throughout.
  const revoiceFact = (fact: string) =>
    fact
      .replace(/^My /, `${tFirst}'s `)
      .replace(/ of my /g, ` of ${tFirst}'s `)
      .replace(/^I ranked /, `${tFirst} ranked `);
  const revoiceDiagnosis = (line: string) => {
    const map: Record<string, string> = {
      "I haven't emotionally left 1997.": `${tFirst} hasn't emotionally left 1997.`,
      "The deep cuts aren't deep to me. They're home.":
        `The deep cuts aren't deep to ${tFirst}. They're home.`,
      'I refuse to leave a single era behind.': `${tFirst} refuses to leave a single era behind.`,
      'I like the new albums. Loudly, and in public.': `${tFirst} likes the new albums. Loudly, and in public.`,
      "The 2000s weren't a comeback. They were my era.":
        `The 2000s weren't a comeback. They were ${tFirst}'s era.`,
      "I don't overthink it. If it slaps, it slaps.": `${tFirst} doesn't overthink it. If it slaps, it slaps.`,
    };
    return map[line] ?? line;
  };
  const hasVisitorData = visitorMaster.length > 0;

  // Poster-hero facts (guest view). Coverage is the fan's real
  // bucket coverage against the catalog — a partial ranker shows
  // partial numbers, never a borrowed 206/206.
  const heroRanked = profile?.ranked ?? 0;
  const heroTotal = catalogTotal();
  const heroTopSong = stats?.targetTop10?.[0] ?? null;

  const tribeBand = profile?.tribe ? (
    <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-5 sm:p-6">
      <span className="text-[10px] font-black uppercase tracking-[2.2px] text-[#0072CE] block">
        Fandom Archetype
      </span>
      <div className={`${displayFont.className} mt-2 text-[31px] leading-[1.05] text-[#0C1220]`}>
        {profile.tribe.displayName}
      </div>
      <div
        className="my-[10px] h-[7px] rounded-[4px]"
        style={{ backgroundColor: TRIBE_INK[profile.tribe.name] || '#0C1220' }}
      />
      <p className="text-[14.5px] font-bold leading-[1.45] text-[#0C1220]">
        {revoiceFact(profile.tribe.fact)}
      </p>
      <p className={`${handFont.className} mt-[2px] text-[22px] font-bold leading-tight text-[#3D4A63]`}>
        {revoiceDiagnosis(profile.tribe.diagnosis)}
      </p>
    </div>
  ) : null;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-24 font-sans space-y-5">
        
        {/* TOP BAR: BREADCRUMB TO FAN FRIENDS — signed-in visitors
            only. A signed-out sharee (now this page's main
            audience, arriving from the share page) has no Fan
            Friends step to go back to. */}
        {signedIn && (
          <div className="flex items-center justify-between pt-1">
            {/* A plain anchor (full load) on purpose: router.push
                changes the URL but the app provider only parses
                ?step= once, at ITS mount — a client-side push home
                landed on splash/dashboard while the URL said
                friends. A fresh load parses it for real. */}
            <a
              href="/?step=friends"
              className="inline-flex items-center gap-1.5 text-xs font-black text-[#0C1220] bg-white hover:bg-sky-50 px-3.5 py-2 rounded-full transition-colors cursor-pointer border-[2.5px] border-[#0C1220] shadow-[2px_2px_0_rgba(11,30,63,0.85)]"
            >
              ← Back to Fan Friends
            </a>
          </div>
        )}

        {/* LIGHT FRIENDS CAROUSEL SWITCHER */}
        {allFriends.length > 1 && (
          <div className="bg-white border-[2.5px] border-[#0C1220] rounded-2xl p-2.5 flex items-center justify-between shadow-[2px_2px_0_rgba(11,30,63,0.85)]">
            {/* Prev/Next only make sense when the profile being
                viewed IS in the list — at index −1 (a non-friend's
                public profile) the modulo math jumped to
                arbitrary friends. The chips stay: those taps are
                explicit. */}
            {currentFriendIdx !== -1 && (
              <button
                onClick={handlePrevFriend}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-[#3D4A63] font-black text-xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                ← Prev
              </button>
            )}

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
                        ? 'bg-[#0072CE] border-2 border-[#0C1220] text-white'
                        : 'bg-white border-2 border-[#0C1220] text-[#0C1220] hover:bg-slate-50'
                    }`}
                  >
                    @{f.username}
                  </button>
                );
              })}
            </div>

            {currentFriendIdx !== -1 && (
              <button
                onClick={handleNextFriend}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-[#3D4A63] font-black text-xs cursor-pointer flex items-center gap-1 shrink-0"
              >
                Next →
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#3D4A63] animate-pulse">
              Calculating compatibility...
            </p>
          </div>
        ) : errorMsg || !targetProfile ? (
          <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-10 text-center space-y-4">
            <div className="text-5xl">🔍</div>
            <h2 className="text-2xl font-black text-[#0C1220]">Profile Not Found</h2>
            <p className="text-xs font-bold text-[#3D4A63] max-w-sm mx-auto">{errorMsg}</p>
            <a
              href="/?step=friends"
              className="inline-block bg-[#0072CE] text-white px-6 py-3 rounded-xl font-black text-xs shadow-md cursor-pointer"
            >
              Back to Fan Friends
            </a>
          </div>
        ) : (
          <main className="space-y-6 animate-in fade-in duration-300">
            
            {/* HERO HEADER */}
            {hasVisitorData ? (
              /* Signed-in head-to-head header — as before, except
                 the display font now actually applies: its class
                 was a literal "${displayFont.className}" string,
                 so this headline (and the Top 10 one below) has
                 been rendering in plain sans all along. */
              <div className="text-center pt-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block mb-1">
                  Head-to-Head Matchup
                </span>
                <h1 className={`${displayFont.className} text-3xl sm:text-5xl text-[#0C1220]`}>
                  Clash of Canons
                </h1>
              </div>
            ) : (
              /* POSTER HERO (guest view) — the share page's design
                 language, since the share page now sends its
                 visitors here: tape naming the fan, ink pill,
                 stroked display name, and three fact boxes derived
                 from the fan's own ranking. No gendered pronouns
                 anywhere: profiles carry no gender data, so every
                 line uses the display name or neutral phrasing
                 (the same rule the share page follows). */
              <div className="relative mt-5">
                <div className="absolute -top-[20px] left-1/2 z-10 -translate-x-1/2 -rotate-2 whitespace-nowrap bg-[#FFE066] px-[18px] pb-2 pt-[7px] text-center text-[#0C1220] shadow-[2px_2px_0_rgba(12,18,32,0.35)]">
                  <div className="text-[8.5px] font-black uppercase tracking-[2.4px]">
                    Fan Profile
                  </div>
                  <div className={`${displayFont.className} mt-[3px] text-[19px] uppercase leading-none tracking-[1px]`}>
                    @{targetProfile.username}
                  </div>
                </div>
                <div
                  className="relative rounded-[18px] border-[3px] border-[#0C1220] bg-[#039AD1] px-[18px] pb-5 pt-[42px] text-center shadow-[6px_6px_0_#0C1220]"
                  style={{
                    backgroundImage:
                      'radial-gradient(rgba(255,255,255,0.16) 1.6px, transparent 1.7px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  <span
                    className={`${displayFont.className} inline-block rounded-full bg-[#0C1220] px-[14px] pb-[4px] pt-[6px] text-[13px] tracking-[3px] text-white`}
                  >
                    THE FULL RANKING
                  </span>
                  <h1
                    className={`${displayFont.className} mt-3 text-[clamp(36px,10vw,56px)] uppercase leading-[1.02] text-white [-webkit-text-stroke:1.5px_#0C1220] [text-shadow:4px_4px_0_#0C1220]`}
                  >
                    {tFirst}
                  </h1>
                  <p
                    className={`${handFont.className} mt-[6px] text-[23px] font-bold leading-tight text-white [text-shadow:1px_1px_0_rgba(12,18,32,0.45)]`}
                  >
                    {heroRanked >= heroTotal && heroTotal > 0
                      ? `Ranked all ${heroTotal} Weezer songs.`
                      : `Ranked ${heroRanked} of ${heroTotal} Weezer songs.`}
                  </p>

                  <div className="mt-[15px] space-y-[13px] text-left">
                    {heroTopSong && (
                      <div className="flex items-center gap-3 rounded-[14px] border-[3px] border-[#0C1220] bg-white px-[14px] pb-[10px] pt-3 shadow-[4px_4px_0_#0C1220]">
                        <AlbumArtwork
                          albumId={heroTopSong.albumId || ALBUM_NAME_TO_ID[heroTopSong.album]}
                          className="h-[46px] w-[46px] shrink-0 rounded-[10px] border-2 border-[#0C1220] object-cover"
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-[2.4px] text-[#0072CE]">
                            #1 Song
                          </div>
                          <div className={`${displayFont.className} text-[26px] leading-[1.08] text-[#0C1220]`}>
                            {heroTopSong.title}
                          </div>
                          <div className="mt-[1px] text-[11px] font-bold text-[#3D4A63]">
                            {heroTopSong.album} · {heroTopSong.year}
                          </div>
                        </div>
                      </div>
                    )}
                    {profile?.topAlbum && (
                      <div className="flex items-center gap-3 rounded-[14px] border-[3px] border-[#0C1220] bg-white px-[14px] pb-[10px] pt-3 shadow-[4px_4px_0_#0C1220]">
                        <AlbumArtwork
                          albumId={profile.topAlbum.albumId}
                          className="h-[46px] w-[46px] shrink-0 rounded-[10px] border-2 border-[#0C1220] object-cover"
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-[2.4px] text-[#0072CE]">
                            Top Album
                          </div>
                          <div className={`${displayFont.className} text-[26px] leading-[1.08] text-[#0C1220]`}>
                            {profile.topAlbum.name}
                          </div>
                          <div className="mt-[1px] text-[11px] font-bold text-[#3D4A63]">
                            {profile.topAlbum.count} of {tFirst}&apos;s top {profile.topAlbum.topCount} songs
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleShareProfile}
                    className="mt-[13px] w-full rounded-full border-[3px] border-[#0C1220] bg-[#FFC72C] px-6 py-3 text-sm font-black text-[#0C1220] shadow-[3px_3px_0_#0C1220] transition hover:brightness-105 active:translate-y-[1px]"
                  >
                    {linkCopied ? '✓ Link copied!' : 'Share this profile'}
                  </button>
                </div>
              </div>
            )}

            {/* TRIBE BAND — in the guest flow it sits right under
                the hero (the mock's order); for signed-in visitors
                it renders after the Top 10 panel instead, so the
                matchup panels keep their places. */}
            {!hasVisitorData && tribeBand}

            {/* ENHANCED MATCH SCORECARD */}
            {hasVisitorData && stats && stats.sharedSample >= 2 ? (
              <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 sm:p-8 relative overflow-hidden text-[#0C1220] space-y-6">
                
                {/* SCORES AND NAMES ROW */}
                <div className="flex justify-between items-center relative z-10">
                  
                  {/* VISITOR NAME */}
                  <div className="flex flex-col items-start w-2/5 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#3D4A63]">
                      You
                    </span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#0C1220] truncate leading-tight w-full">
                      {vFirst}
                    </h2>
                  </div>

                  {/* SCORE BADGE */}
                  <div className="flex flex-col items-center justify-center shrink-0 px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#3D4A63] mb-0.5">
                      Match
                    </span>
                    <span className={`text-4xl sm:text-5xl font-black ${stats.quip.color}`}>
                      {stats.compatibilityScore}%
                    </span>
                  </div>

                  {/* TARGET NAME */}
                  <div className="flex flex-col items-end w-2/5 min-w-0 text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#3D4A63]">
                      Friend
                    </span>
                    <h2 className="text-lg sm:text-2xl font-black text-[#0C1220] truncate leading-tight w-full">
                      {tFirst}
                    </h2>
                  </div>

                </div>

                {/* WEEZER THEMED QUIP & VERDICT BANNER */}
                <div className="bg-white border-2 border-[#0C1220] rounded-2xl p-4 text-center space-y-1">
                  <span className={`text-xs font-black uppercase tracking-wider block ${stats.quip.color}`}>
                    {stats.quip.title}
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-[#3D4A63] leading-snug italic">
                    {stats.quip.phrase}
                  </p>
                </div>

              </div>
            ) : !hasVisitorData ? (
              /* GUEST BANNER — copy byte-identical to before; the
                 panel and button take the poster treatment and
                 the banner now sits under the tribe band. It
                 stays the page's only CTA for signed-out
                 visitors. */
              <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 text-center">
                <div className="text-3xl mb-2">👀</div>
                <h3 className="text-lg font-black text-[#0C1220] mb-1">
                  Want to see how you match up?
                </h3>
                <p className="text-xs font-semibold text-[#3D4A63] mb-4 max-w-sm mx-auto">
                  Create your own Weezer ranking to unlock your compatibility score and see where you and {tFirst} disagree.
                </p>
                {/* Full-load anchor, same reason as the Back
                    link above: a client-side push home doesn't
                    re-run the provider's entry logic. */}
                <a
                  href="/"
                  className="inline-block bg-[#0072CE] border-[3px] border-[#0C1220] text-white px-[22px] py-[11px] rounded-full font-black text-[13px] shadow-[3px_3px_0_#0C1220] hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  Start Your Ranking
                </a>
              </div>
            ) : (
              /* Signed in WITH rankings, but fewer than 2 shared
                 top songs: the chain used to render null here —
                 no scorecard, no word of explanation. */
              <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 text-center">
                <h3 className="text-lg font-black text-[#0C1220] mb-1">
                  Not enough overlap to score — yet
                </h3>
                <p className="text-xs font-semibold text-[#3D4A63] max-w-sm mx-auto">
                  A match score needs at least 2 songs you&apos;ve both put
                  in your top buckets. As your rankings grow, this fills in.
                </p>
              </div>
            )}

            {/* THE BIGGEST FIGHT */}
            {hasVisitorData && stats?.biggestFight && (
              <div className="bg-rose-50 border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 sm:p-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 block mb-1 text-center">
                  🥊 The Biggest War
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-center text-rose-950 mb-5 tracking-tight">
                  You two completely disagree on this track.
                </h3>

                <div className="bg-white p-5 rounded-2xl border-2 border-[#0C1220] flex flex-col items-center text-center relative overflow-hidden">
                  <span className="text-lg font-black text-[#0C1220] mb-5 px-2 relative z-10">
                    {stats.biggestFight.song.title}
                  </span>

                  <div className="flex items-center w-full justify-around relative z-10">
                    <div className="flex flex-col items-center w-2/5">
                      <span className="text-[9px] font-black uppercase text-[#3D4A63] mb-1">
                        {vFirst}
                      </span>
                      <span className="text-2xl font-black text-rose-500">
                        #{stats.biggestFight.vRank}
                      </span>
                    </div>
                    <div className="w-px h-10 bg-rose-100" />
                    <div className="flex flex-col items-center w-2/5">
                      <span className="text-[9px] font-black uppercase text-[#3D4A63] mb-1">
                        {tFirst}
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
              <div className="bg-emerald-50 border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-6 sm:p-8">
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
                        className="flex items-center gap-3 bg-white p-3 rounded-2xl border-2 border-[#0C1220]"
                      >
                        <AlbumArtwork
                          albumId={resolvedId}
                          className="w-10 h-10 rounded-xl border-2 border-[#0C1220] object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-extrabold text-[#0C1220] truncate">
                            {song.title}
                          </h4>
                          <p className="text-[9px] font-bold text-[#3D4A63] uppercase tracking-widest truncate">
                            {song.album}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TRIBE BAND — signed-in placement (guests got it
                under the hero, above). */}
            {hasVisitorData && tribeBand}

            {/* ERA BARS — the Thread's rank-weighted "Weezer Era"
                computation (profileStats.eraShares). The Era DNA
                card runs the same function since Nov 6. */}
            {profile && profile.topTier.length > 0 && (
              <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-5 sm:p-6">
                <div className="mb-[14px]">
                  <span className="text-[10px] font-black uppercase tracking-[2.2px] text-[#0072CE] block">
                    Weezer Era
                  </span>
                  <h3 className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}>
                    Where {tFirst}&apos;s Top Songs Live
                  </h3>
                </div>
                <div>
                  {profile.shares.map((era) => (
                    <div key={era.key} className="mb-[11px] flex items-center gap-[10px] last:mb-0">
                      <div className="w-[118px] shrink-0">
                        <div className={`${displayFont.className} text-[15.5px] leading-[1.1] text-[#0C1220]`}>
                          {era.name}
                        </div>
                        <div className="text-[9.5px] font-extrabold tracking-[1.4px] text-[#3D4A63]">
                          {era.label}
                        </div>
                      </div>
                      <div className="h-5 flex-1">
                        <div
                          className="h-5 rounded-[6px] border-[2.5px] border-[#0C1220]"
                          style={{
                            width: `${profile.shares[0].pct > 0 ? Math.round((era.pct / profile.shares[0].pct) * 100) : 0}%`,
                            backgroundColor: era.color,
                          }}
                        />
                      </div>
                      <div className={`${displayFont.className} w-10 shrink-0 text-base text-[#0C1220]`}>
                        {era.pct}%
                      </div>
                    </div>
                  ))}
                </div>
                {profile.eraNote && (
                  <p className={`${handFont.className} mt-[6px] text-xl font-bold leading-tight text-[#3D4A63]`}>
                    {profile.eraNote.countWord} of {tFirst}&apos;s Top 10 are {profile.eraNote.eraAdjective} songs.
                  </p>
                )}
              </div>
            )}

            {/* BUCKET BREAKDOWN — straight triage counts under the
                app's own bucket labels. */}
            {profile && profile.ranked > 0 && (
              <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-5 sm:p-6">
                <div className="mb-[14px]">
                  <span className="text-[10px] font-black uppercase tracking-[2.2px] text-[#0072CE] block">
                    The Breakdown
                  </span>
                  <h3 className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}>
                    How They Shake Out
                  </h3>
                </div>
                <div className="flex h-[26px] overflow-hidden rounded-lg border-[3px] border-[#0C1220]">
                  {PROFILE_BUCKET_ORDER.map((b) =>
                    profile.counts[b] > 0 ? (
                      <div
                        key={b}
                        style={{
                          width: `${(profile.counts[b] / profile.ranked) * 100}%`,
                          minWidth: 4,
                          backgroundColor: PROFILE_BUCKET_COLORS[b],
                        }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-[6px]">
                  {PROFILE_BUCKET_ORDER.map((b) =>
                    profile.counts[b] > 0 ? (
                      <div key={b} className="flex items-center gap-2 text-[13px] font-extrabold text-[#0C1220]">
                        <span
                          className="h-3 w-3 shrink-0 rounded-[4px] border-2 border-[#0C1220]"
                          style={{ backgroundColor: PROFILE_BUCKET_COLORS[b] }}
                        />
                        {BUCKET_CONFIG[b].label}
                        <span className={`${displayFont.className} ml-auto text-[15px]`}>
                          {profile.counts[b]}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
                {/* The mock's footnote, in the only condition it
                    drew: a complete ranking with exactly one Skip. */}
                {profile.ranked >= profile.total && profile.counts.skip === 1 && (
                  <p className={`${handFont.className} mt-[10px] text-xl font-bold leading-tight text-[#3D4A63]`}>
                    One single Skip in the whole catalog.
                  </p>
                )}
              </div>
            )}

            {/* THE FULL LIST — every bucket block, expandable; the
                first two groups start open, as drawn. */}
            {profile && profile.groups.length > 0 && (
              <div className="bg-white border-[3px] border-[#0C1220] rounded-[18px] shadow-[4px_4px_0_rgba(11,30,63,0.85)] p-5 sm:p-6">
                <div className="mb-[6px]">
                  <span className="text-[10px] font-black uppercase tracking-[2.2px] text-[#0072CE] block">
                    The Full List
                  </span>
                  <h3 className={`${displayFont.className} mt-[2px] text-2xl tracking-[0.4px] text-[#0C1220]`}>
                    In {tFirst}&apos;s Order
                  </h3>
                </div>
                {profile.groups.map((group, gi) => {
                  const isOpen = groupOverrides[group.key] ?? gi < 2;
                  const firstRank = group.songs[0].rank;
                  const lastRank = group.songs[group.songs.length - 1].rank;
                  return (
                    <div key={group.key}>
                      <button
                        onClick={() =>
                          setGroupOverrides((prev) => ({
                            ...prev,
                            [group.key]: !isOpen,
                          }))
                        }
                        className="mt-[14px] flex w-full cursor-pointer items-baseline gap-2 rounded-[10px] border-[2.5px] border-[#0C1220] px-3 py-[9px] text-left"
                        aria-expanded={isOpen}
                      >
                        <span className={`${displayFont.className} text-[16.5px] tracking-[0.4px] text-[#0C1220]`}>
                          {group.key === 'banger' ? 'BANGERS' : group.label}
                        </span>
                        <span className="text-[24px] font-black leading-[0.6] text-[#0C1220]">{isOpen ? '▾' : '▸'}</span>
                        <span className="ml-auto text-[10.5px] font-black tracking-[1px] text-[#3D4A63]">
                          #{firstRank}–{lastRank} · {group.songs.length} SONGS
                        </span>
                      </button>
                      {isOpen && (
                        <div className="mt-[6px]">
                          {group.songs.map(({ song, rank }) => (
                            <div
                              key={song.id}
                              className="flex items-baseline gap-[9px] border-b border-[#0C1220]/10 px-[2px] py-[3.5px]"
                            >
                              <span className="w-6 shrink-0 text-right text-[11px] font-extrabold text-[#3D4A63]">
                                {rank}
                              </span>
                              <span className="text-[12.5px] font-bold leading-[1.3] text-[#0C1220]">
                                {song.title}
                              </span>
                              <span className="ml-auto shrink-0 pl-2 text-right text-[10px] font-bold text-[#3D4A63]">
                                {song.album}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </main>
        )}
      </div>
    </AppShell>
  );
}


