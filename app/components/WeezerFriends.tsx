'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useWeezer } from '../context/WeezerContext';

interface FriendProfile {
  id: string;
  username: string;
  display_name: string;
  top_song?: string;
  status: 'pending_incoming' | 'pending_outgoing' | 'accepted';
  friendshipId?: string;
}

export default function WeezerFriends() {
  const router = useRouter();
  const { userId, refreshPendingRequests } = useWeezer();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsername, setSearchUsername] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userId) loadFriendsAndRequests();
  }, [userId]);

  const loadFriendsAndRequests = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const currentId = session.user.id;

      // FETCH BOTH DIRECTIONS (Where user is sender OR recipient)
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${currentId},friend_id.eq.${currentId}`);

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setIncomingRequests([]);
        setLoading(false);
        return;
      }

      const relatedUserIds = friendships.map((f) =>
        f.user_id === currentId ? f.friend_id : f.user_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', relatedUserIds);

      if (!profiles) {
        setLoading(false);
        return;
      }

      const { data: rankings } = await supabase
        .from('weezer_rankings')
        .select('user_id, master_list')
        .in('user_id', relatedUserIds);

      const rankMap = new Map();
      if (rankings) {
        rankings.forEach((r) => {
          if (r.master_list && r.master_list.length > 0) {
            rankMap.set(r.user_id, r.master_list[0].title);
          }
        });
      }

      const acceptedList: FriendProfile[] = [];
      const incomingList: FriendProfile[] = [];

      friendships.forEach((f) => {
        const otherId = f.user_id === currentId ? f.friend_id : f.user_id;
        const profile = profiles.find((p) => p.id === otherId);

        if (profile) {
          const formatted: FriendProfile = {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name || profile.username,
            top_song: rankMap.get(profile.id) || 'Not ranked yet',
            status: f.status || 'accepted',
            friendshipId: f.id,
          };

          if (f.status === 'accepted' || !f.status) {
            acceptedList.push(formatted);
          } else if (f.status === 'pending') {
            if (f.friend_id === currentId) {
              // FRIEND SOUGHT YOU (INCOMING)
              formatted.status = 'pending_incoming';
              incomingList.push(formatted);
            } else {
              // YOU SOUGHT FRIEND (OUTGOING)
              formatted.status = 'pending_outgoing';
              acceptedList.push(formatted);
            }
          }
        }
      });

      setFriends(acceptedList);
      setIncomingRequests(incomingList);
    } catch (err) {
      console.error('Error loading friendships:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
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
        setErrorMsg("Couldn&apos;t find a user with that handle.");
        setAddLoading(false);
        return;
      }

      if (targetProfile.id === userId) {
        setErrorMsg("You can&apos;t send a request to yourself!");
        setAddLoading(false);
        return;
      }

      const { error: insertErr } = await supabase
        .from('friendships')
        .insert({ user_id: userId, friend_id: targetProfile.id, status: 'pending' });

      if (insertErr) {
        if (insertErr.code === '23505') {
          setErrorMsg('A request or friendship already exists with this user.');
        } else {
          setErrorMsg('Error sending friend request.');
        }
        setAddLoading(false);
        return;
      }

      setSuccessMsg(`Friend request sent to @${cleanUsername}!`);
      setSearchUsername('');
      loadFriendsAndRequests();
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleAcceptRequest = async (friendshipId?: string) => {
    if (!friendshipId) return;
    try {
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      refreshPendingRequests();
      loadFriendsAndRequests();
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleDeclineRequest = async (friendshipId?: string) => {
    if (!friendshipId) return;
    try {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      refreshPendingRequests();
      loadFriendsAndRequests();
    } catch (err) {
      console.error('Error declining request:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      <div className="text-center px-4 pt-4">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
          Your Matchups
        </h2>
        <p className="text-sm font-bold text-slate-500 mt-2">
          Connect with friends to compare your Weezer canon.
        </p>
      </div>

      {/* SEND FRIEND REQUEST CARD */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Send A Friend Request
        </span>

        <form onSubmit={handleSendRequest} className="flex flex-col sm:flex-row gap-3">
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
            className="bg-[#0072CE] hover:bg-blue-600 text-white font-black px-6 py-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {addLoading ? 'Sending...' : 'Send Request'}
          </button>
        </form>

        {errorMsg && <p className="text-xs font-bold text-rose-500 mt-2 text-center">{errorMsg}</p>}
        {successMsg && <p className="text-xs font-bold text-emerald-600 mt-2 text-center">{successMsg}</p>}
      </div>

      {/* INCOMING REQUESTS INBOX */}
      {incomingRequests.length > 0 && (
        <div className="bg-amber-50/80 border-2 border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-950">
                Incoming Friend Requests ({incomingRequests.length})
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className="w-10 h-10 bg-amber-400 text-amber-950 rounded-xl flex items-center justify-center font-black text-base shrink-0">
                    {req.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {req.display_name}
                    </h4>
                    <span className="text-xs font-bold text-[#0072CE] block truncate">
                      @{req.username}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAcceptRequest(req.friendshipId)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Accept ✓
                  </button>
                  <button
                    onClick={() => handleDeclineRequest(req.friendshipId)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              No friends connected yet.
              <br />
              Send a request above to start comparing!
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

                {friend.status === 'pending_outgoing' ? (
                  <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl">
                    Pending...
                  </span>
                ) : (
                  <button
                    onClick={() => router.push(`/u/${friend.username}`)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Compare
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}