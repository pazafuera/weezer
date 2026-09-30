'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface FriendProfile {
  id: string;
  username: string;
  display_name: string;
  top_song?: string;
}

export default function WeezerFriends() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsername, setSearchUsername] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      setCurrentUserId(session.user.id);

      // 1. Fetch friend IDs
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

      // 2. Fetch friend profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', friendIds);

      if (!profiles) return;

      // 3. Fetch friend rankings to grab their #1 song
      const { data: rankings } = await supabase
        .from('weezer_rankings')
        .select('user_id, master_list')
        .in('user_id', friendIds);

      const rankMap = new Map();
      if (rankings) {
        rankings.forEach((r) => {
          if (r.master_list && r.master_list.length > 0) {
            rankMap.set(r.user_id, r.master_list[0].title);
          }
        });
      }

      const formattedFriends = profiles.map((p) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name || p.username,
        top_song: rankMap.get(p.id) || 'Unknown',
      }));

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
    if (!searchUsername.trim() || !currentUserId) return;

    setAddLoading(true);
    const cleanUsername = searchUsername.toLowerCase().trim().replace('@', '');

    try {
      // Find the user by username
      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (profileErr || !targetProfile) {
        setErrorMsg("Couldn&apos;t find a user with that username.");
        setAddLoading(false);
        return;
      }

      if (targetProfile.id === currentUserId) {
        setErrorMsg("You can&apos;t add yourself as a friend!");
        setAddLoading(false);
        return;
      }

      // Add to friendships
      const { error: insertErr } = await supabase
        .from('friendships')
        .insert({ user_id: currentUserId, friend_id: targetProfile.id });

      if (insertErr) {
        if (insertErr.code === '23505') {
          setErrorMsg('They are already on your friend list.');
        } else {
          setErrorMsg('Error adding friend.');
        }
        setAddLoading(false);
        return;
      }

      setSearchUsername('');
      loadFriends(); // Refresh the list
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred.');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="text-center px-4 pt-4">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
          Your Matchups
        </h2>
        <p className="text-sm font-bold text-slate-500 mt-2">
          Add friends to compare your Weezer Wrapped.
        </p>
      </div>

      {/* ADD FRIEND CARD */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <form
          onSubmit={handleAddFriend}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">
              @
            </span>
            <input
              type="text"
              placeholder="username"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-[#0072CE]"
            />
          </div>
          <button
            type="submit"
            disabled={addLoading || !searchUsername.trim()}
            className="bg-[#0072CE] hover:bg-blue-600 text-white font-black px-6 py-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {addLoading ? 'Adding...' : 'Add Friend'}
          </button>
        </form>
        {errorMsg && (
          <p className="text-xs font-bold text-rose-500 mt-3 text-center">
            {errorMsg}
          </p>
        )}
      </div>

      {/* FRIENDS LIST */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 px-2 mb-4">
          Friend List
        </h3>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-4 border-[#0072CE] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold text-slate-400">
              Loading matchups...
            </span>
          </div>
        ) : friends.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-10 text-center">
            <span className="text-4xl mb-3 block">🎸</span>
            <p className="text-sm font-bold text-slate-500">
              No friends added yet.
              <br />
              Type a username above to start comparing!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-[#0072CE] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-400 text-amber-950 rounded-full flex items-center justify-center font-black text-xl shadow-sm shrink-0">
                    {friend.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 pr-4">
                    <h4 className="text-base font-black text-slate-900 truncate">
                      {friend.display_name}
                    </h4>
                    <p className="text-xs font-bold text-[#0072CE] truncate">
                      @{friend.username}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                      🥇 {friend.top_song}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/u/${friend.username}`)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Compare
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}