'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { useWeezer } from '../context/WeezerContext';
import {
  Song,
  BucketType,
  ALBUMS_BY_ID,
  ALBUM_NAME_TO_ID,
} from '../data/constants';
import { AlbumArtwork } from './SharedUI';

interface FriendProfile {
  id: string;
  username: string;
  display_name: string;
  top_song?: Song;
  triage_map?: Record<string, BucketType>;
  master_list?: Song[];
  matchScore: number;
}

// HELPER: Calculates taste similarity percentage between two users
function calculateTasteMatch(
  myMap: Record<string, BucketType>,
  myMaster: Song[],
  friendMap?: Record<string, BucketType>,
  friendMaster?: Song[]
): number {
  if (!friendMap && (!friendMaster || friendMaster.length === 0)) return 50;

  const points: Record<BucketType, number> = {
    banger: 5,
    slaps: 4,
    mid: 3,
    skip: 2,
    trash: 1,
  };

  let totalDiff = 0;
  let comparedCount = 0;

  // Compare Triage Maps
  Object.keys(myMap).forEach((songId) => {
    if (friendMap && friendMap[songId]) {
      const myScore = points[myMap[songId]];
      const friendScore = points[friendMap[songId]];
      totalDiff += Math.abs(myScore - friendScore);
      comparedCount++;
    }
  });

  if (comparedCount === 0) return 75; // Default baseline

  const maxPossibleDiff = comparedCount * 4;
  const similarityRatio = 1 - totalDiff / maxPossibleDiff;
  return Math.max(12, Math.min(99, Math.round(similarityRatio * 100)));
}

export default function WeezerFriends() {
  const { userId, userProfile, triageMap, masterList } = useWeezer();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsername, setSearchUsername] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // COMPARISON MODAL STATE
  const [activeFriend, setActiveFriend] = useState<FriendProfile | null>(null);

  useEffect(() => {
    if (userId) loadFriends();
  }, [userId]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      // 1. Fetch friend IDs from friendships table
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', session.user.id);

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const friendIds = friendships.map((f) => f.friend_id);

      // 2. Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', friendIds);

      if (!profiles) {
        setLoading(false);
        return;
      }

      // 3. Fetch friend rankings
      const { data: rankings } = await supabase
        .from('weezer_rankings')
        .select('user_id, triage_map, master_list')
        .in('user_id', friendIds);

      const rankDataMap = new Map<
        string,
        { triage?: Record<string, BucketType>; master?: Song[] }
      >();
      if (rankings) {
        rankings.forEach((r) => {
          rankDataMap.set(r.user_id, {
            triage: r.triage_map,
            master: r.master_list,
          });
        });
      }

      const formattedFriends: FriendProfile[] = profiles.map((p) => {
        const friendRanks = rankDataMap.get(p.id);
        const topSong =
          friendRanks?.master && friendRanks.master.length > 0
            ? friendRanks.master[0]
            : undefined;

        const matchScore = calculateTasteMatch(
          triageMap,
          masterList,
          friendRanks?.triage,
          friendRanks?.master
        );

        return {
          id: p.id,
          username: p.username,
          display_name: p.display_name || p.username,
          top_song: topSong,
          triage_map: friendRanks?.triage,
          master_list: friendRanks?.master,
          matchScore,
        };
      });

      // Sort friends by match score descending
      formattedFriends.sort((a, b) => b.matchScore - a.matchScore);
      setFriends(formattedFriends);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!searchUsername.trim() || !userId) return;

    setAddLoading(true);
    const cleanUsername = searchUsername.toLowerCase().trim().replace('@', '');

    try {
      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (profileErr || !targetProfile) {
        setErrorMsg("Couldn't find a user with that handle.");
        setAddLoading(false);
        return;
      }

      if (targetProfile.id === userId) {
        setErrorMsg("You can't add yourself!");
        setAddLoading(false);
        return;
      }

      // Bidirectional insert or simple insert
      const { error: insertErr } = await supabase
        .from('friendships')
        .insert({ user_id: userId, friend_id: targetProfile.id });

      if (insertErr) {
        if (insertErr.code === '23505')
          setErrorMsg('Already in your matchups list.');
        else setErrorMsg('Error adding friend.');
        setAddLoading(false);
        return;
      }

      setSearchUsername('');
      loadFriends();
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleCopyProfileLink = () => {
    if (!userProfile?.username) return;
    const shareUrl = `${window.location.origin}/u/${userProfile.username}`;
    navigator.clipboard.writeText(shareUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // ANALYSIS FOR ACTIVE COMPARISON MODAL
  const comparisonData = useMemo(() => {
    if (!activeFriend) return null;

    const myTop = masterList[0];
    const friendTop = activeFriend.top_song;

    // Shared Bangers
    const sharedBangers: Song[] = [];
    // Biggest War (I say Banger, Friend says Trash/Skip or vice versa)
    const wars: {
      songId: string;
      myBucket: BucketType;
      friendBucket: BucketType;
    }[] = [];

    const myMap = triageMap;
    const friendMap = activeFriend.triage_map || {};

    Object.keys(myMap).forEach((songId) => {
      const mine = myMap[songId];
      const theirs = friendMap[songId];

      if (mine === 'banger' && theirs === 'banger') {
        const found = masterList.find((s) => s.id === songId);
        if (found) sharedBangers.push(found);
      }

      if (
        (mine === 'banger' && (theirs === 'trash' || theirs === 'skip')) ||
        (theirs === 'banger' && (mine === 'trash' || mine === 'skip'))
      ) {
        wars.push({ songId, myBucket: mine, friendBucket: theirs });
      }
    });

    return {
      myTop,
      friendTop,
      sharedBangers,
      warCount: wars.length,
      sampleWar: wars[0],
    };
  }, [activeFriend, masterList, triageMap]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500 px-4">
      {/* HEADER */}
      <div className="text-center pt-2">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
          Canon <span className="text-[#0072CE]">Matchups.</span>
        </h1>
        <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
          Compare rankings head-to-head with friends
        </p>
      </div>

      {/* SHAREABLE HANDLE BANNER */}
      {userProfile?.username && (
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-sm">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block">
              Your Shareable Handle
            </span>
            <p className="text-sm font-black text-slate-900 truncate">
              @{userProfile.username}
            </p>
          </div>

          <button
            onClick={handleCopyProfileLink}
            className="bg-[#0072CE] hover:bg-blue-600 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
          >
            {copySuccess ? 'Copied Link! ✓' : 'Copy Invite Link 🔗'}
          </button>
        </div>
      )}

      {/* ADD FRIEND CARD */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Find A Fan
        </span>

        <form
          onSubmit={handleAddFriend}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
              @
            </span>
            <input
              type="text"
              placeholder="username"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-[#0072CE]"
            />
          </div>

          <button
            type="submit"
            disabled={addLoading || !searchUsername.trim()}
            className="bg-[#0072CE] hover:bg-blue-600 active:scale-95 text-white font-black px-6 py-3 rounded-xl transition-all disabled:opacity-50 cursor-pointer text-sm shrink-0"
          >
            {addLoading ? 'Searching...' : 'Add Matchup'}
          </button>
        </form>

        {errorMsg && (
          <p className="text-xs font-bold text-rose-500 text-center pt-1">
            {errorMsg}
          </p>
        )}
      </div>

      {/* MATCHUPS FRIENDS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Your Friends ({friends.length})
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Taste Alignment
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-6 h-6 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto" />
            <span className="text-xs font-bold text-slate-400">
              Calculating matchup scores...
            </span>
          </div>
        ) : friends.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-10 text-center space-y-2">
            <span className="text-4xl block">🎸</span>
            <h3 className="font-extrabold text-slate-900 text-base">
              No Matchups Added Yet
            </h3>
            <p className="text-xs font-medium text-slate-500 max-w-xs mx-auto leading-relaxed">
              Add a friend by handle above or share your invite link to start
              comparing rankings!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-sm transition-all group"
              >
                {/* FRIEND INFO */}
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className="w-12 h-12 bg-blue-50 text-[#0072CE] border border-blue-200 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                    {friend.display_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-950 truncate leading-snug">
                      {friend.display_name}
                    </h4>
                    <span className="text-xs font-bold text-[#0072CE] block truncate">
                      @{friend.username}
                    </span>
                    {friend.top_song && (
                      <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
                        🥇 {friend.top_song.title}
                      </p>
                    )}
                  </div>
                </div>

                {/* MATCH SCORE & COMPARE BUTTON */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-slate-900">
                      {friend.matchScore}%
                    </span>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                      Match
                    </span>
                  </div>

                  <button
                    onClick={() => setActiveFriend(friend)}
                    className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-black px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Compare ⚔️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HEAD-TO-HEAD COMPARISON MODAL */}
      {activeFriend && comparisonData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE]">
                  Head-to-Head Comparison
                </span>
                <h3 className="text-xl font-black text-slate-950">
                  You vs. @{activeFriend.username}
                </h3>
              </div>

              <button
                onClick={() => setActiveFriend(null)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* MATCH SCORE BADGE */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 text-center shadow-lg space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">
                Taste Alignment Score
              </span>
              <div className="text-4xl font-black">
                {activeFriend.matchScore}%
              </div>
              <p className="text-xs font-medium text-blue-100">
                {activeFriend.matchScore > 80
                  ? 'Soulmates! You both hold the exact same Weezer canon.'
                  : activeFriend.matchScore > 50
                  ? 'Solid agreement, but expect heated arguments on mid-era tracks.'
                  : 'Total opposites! One man’s Banger is another’s Trash.'}
              </p>
            </div>

            {/* #1 SONG SHOWDOWN */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                #1 Anthem Showdown
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Your #1
                  </span>
                  <h4 className="text-sm font-black text-slate-900 truncate">
                    {comparisonData.myTop?.title || 'Not Ranked'}
                  </h4>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                  <span className="text-[9px] font-black text-[#0072CE] uppercase tracking-widest block mb-1">
                    {activeFriend.display_name}'s #1
                  </span>
                  <h4 className="text-sm font-black text-slate-900 truncate">
                    {comparisonData.friendTop?.title || 'Not Ranked'}
                  </h4>
                </div>
              </div>
            </div>

            {/* SHARED BANGERS */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Shared Bangers ({comparisonData.sharedBangers.length})
              </span>

              {comparisonData.sharedBangers.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 italic">
                  No overlapping God-tier Bangers yet!
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {comparisonData.sharedBangers.slice(0, 8).map((song) => (
                    <span
                      key={song.id}
                      className="bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-extrabold px-2.5 py-1 rounded-lg"
                    >
                      🤘 {song.title}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* CLOSE BUTTON */}
            <button
              onClick={() => setActiveFriend(null)}
              className="w-full bg-slate-950 hover:bg-slate-800 text-white font-black text-sm py-3.5 rounded-2xl transition-all cursor-pointer"
            >
              Done Comparing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
