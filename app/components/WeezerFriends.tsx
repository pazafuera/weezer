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
  const { userId, refreshPendingRequests, navigateTo } = useWeezer();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsername, setSearchUsername] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    loadFriendsAndRequests();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadFriendsAndRequests();
    }, 10000);

    // Supabase Real-time Subscription for instant updates
    const channel = supabase
      .channel('friendships_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => {
          loadFriendsAndRequests();
          refreshPendingRequests();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadFriendsAndRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Pre-launch security: friend cards come from the get_my_friend_cards()
      // SECURITY DEFINER function instead of selecting other users' profile
      // and ranking rows directly (blocked by RLS). Returns one row per
      // friendship the caller participates in:
      // { friendship_id, id, username, display_name, status, direction, master_list }
      const { data: cards, error: cardsErr } = await supabase.rpc(
        'get_my_friend_cards'
      );

      if (cardsErr) {
        console.error('Error fetching friend cards:', cardsErr);
        setLoading(false);
        return;
      }

      if (!cards || cards.length === 0) {
        setFriends([]);
        setIncomingRequests([]);
        setLoading(false);
        return;
      }

      const acceptedList: FriendProfile[] = [];
      const incomingList: FriendProfile[] = [];

      cards.forEach((c: any) => {
        const topSong =
          c.master_list && c.master_list.length > 0 && c.master_list[0].title
            ? c.master_list[0].title
            : 'Not ranked yet';

        if (c.status === 'accepted') {
          acceptedList.push({
            id: c.id,
            username: c.username,
            display_name: c.display_name || c.username,
            top_song: topSong,
            status: 'accepted',
            friendshipId: c.friendship_id,
          });
        } else if (c.status === 'pending') {
          if (c.direction === 'incoming') {
            incomingList.push({
              id: c.id,
              username: c.username,
              display_name: c.display_name || c.username,
              top_song: topSong,
              status: 'pending_incoming',
              friendshipId: c.friendship_id,
            });
          } else {
            acceptedList.push({
              id: c.id,
              username: c.username,
              display_name: c.display_name || c.username,
              top_song: topSong,
              status: 'pending_outgoing',
              friendshipId: c.friendship_id,
            });
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
      // Pre-launch security: profile lookup by username goes through the
      // find_profile_by_username() SECURITY DEFINER function instead of
      // selecting other users' profile rows directly (blocked by RLS).
      const { data: targetProfile, error: profileErr } = await supabase.rpc(
        'find_profile_by_username',
        { p_username: cleanUsername }
      );

      if (profileErr || !targetProfile) {
        setErrorMsg("Couldn't find a user with that handle.");
        setAddLoading(false);
        return;
      }

      if (targetProfile.id === userId) {
        setErrorMsg("You can't send a request to yourself!");
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
      // Supabase reports write failures in the returned error, not
      // by throwing — check it, or a failed accept looks identical
      // to a successful one until the card quietly comes back.
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) {
        console.error('Error accepting request:', error);
        setErrorMsg("Couldn't accept that request — please try again.");
        return;
      }

      refreshPendingRequests();
      loadFriendsAndRequests();
    } catch (err) {
      console.error('Error accepting request:', err);
      setErrorMsg("Couldn't accept that request — please try again.");
    }
  };

  const handleDeclineRequest = async (friendshipId?: string) => {
    if (!friendshipId) return;
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) {
        console.error('Error declining request:', error);
        setErrorMsg("Couldn't decline that request — please try again.");
        return;
      }

      refreshPendingRequests();
      loadFriendsAndRequests();
    } catch (err) {
      console.error('Error declining request:', err);
      setErrorMsg("Couldn't decline that request — please try again.");
    }
  };

  // Cancel an OUTGOING request (UAT P-13): the row's "Pending..."
  // pill used to be static forever — no way to take a request
  // back. Same delete and same error treatment as Decline: the
  // friendships row goes away, and the other side's inbox count
  // settles on their next load.
  const handleCancelRequest = async (friendshipId?: string) => {
    if (!friendshipId) return;
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) {
        console.error('Error cancelling request:', error);
        setErrorMsg("Couldn't cancel that request — please try again.");
        return;
      }

      refreshPendingRequests();
      loadFriendsAndRequests();
    } catch (err) {
      console.error('Error cancelling request:', err);
      setErrorMsg("Couldn't cancel that request — please try again.");
    }
  };

  // Unfriend (UAT P-13): removing an accepted friend deletes the
  // same friendships row. One tap, like Decline — there is no
  // confirm pattern on this page to extend, and inventing a
  // modal system for it was explicitly out of scope. The
  // friendship is symmetric (one row serves both sides), so the
  // removal lands for both users at once.
  const handleUnfriend = async (friendshipId?: string) => {
    if (!friendshipId) return;
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) {
        console.error('Error removing friend:', error);
        setErrorMsg("Couldn't remove that friend — please try again.");
        return;
      }

      refreshPendingRequests();
      loadFriendsAndRequests();
    } catch (err) {
      console.error('Error removing friend:', err);
      setErrorMsg("Couldn't remove that friend — please try again.");
    }
  };

  // Signed-out (reachable via a ?step=friends deep link — the step
  // is not auth-guarded): say so plainly and offer the sign-in,
  // instead of the old behaviour where the list span "Loading
  // matchups..." forever (loadFriendsAndRequests never runs
  // without a user) and the Send form silently ate submissions.
  // page.tsx gates the app behind its own loading spinner, so by
  // the time this renders, a null userId is a settled signed-out.
  if (!userId) {
    return (
      <div className="pb-32 animate-in fade-in duration-500">
        <div className="-mt-4 sm:-mt-6 lg:-mt-8 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 border-b border-slate-200 overflow-hidden bg-slate-900 shadow-xs">
          <img
            src="/img/rideordie.png"
            alt="Weezer Ride or Die Friends"
            className="w-full h-40 sm:h-56 md:h-64 object-cover object-center block"
          />
        </div>
        <div className="max-w-2xl mx-auto px-4 space-y-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3 text-center">
            <h2 className="text-xl font-black text-slate-950 tracking-tight">
              Fan Friends needs an account
            </h2>
            <p className="text-sm font-bold text-slate-500 max-w-md mx-auto">
              Comparing your rankings with friends only works when you&apos;re
              signed in.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('login')}
              className="bg-[#0072CE] hover:bg-blue-600 text-white font-black px-6 py-3 rounded-xl transition-colors cursor-pointer"
            >
              Sign In / Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 animate-in fade-in duration-500">

      {/* FULL-BLEED HERO IMAGE (FLUSH TO HEADER & SIDE EDGES) */}
      <div className="-mt-4 sm:-mt-6 lg:-mt-8 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 border-b border-slate-200 overflow-hidden bg-slate-900 shadow-xs">
        <img
          src="/img/rideordie.png"
          alt="Weezer Ride or Die Friends"
          className="w-full h-40 sm:h-56 md:h-64 object-cover object-center block"
        />
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="max-w-2xl mx-auto px-4 space-y-8">

        {/* No in-page exit pill: the "← Dashboard" pill that
            sat here was removed app-wide at the owner's call
            (Oct 19) — the app menu is the way to the dashboard. */}

        {/* HEADER TEXT */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Fan Friends
          </h2>
          <p className="text-sm font-bold text-slate-500 mt-2 max-w-md mx-auto">
            Connect with friends to compare how compatible your Weezer taste is.
          </p>
        </div>

        {/* SEND FRIEND REQUEST CARD */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0072CE] block">
              Add Fan Friends
            </span>
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Enter your friend&apos;s username to send an invite:
            </h3>
          </div>

          <form onSubmit={handleSendRequest} className="flex flex-col sm:flex-row gap-3 pt-1">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">
                @
              </span>
              <input
                type="search"
                name="search_friend_username_query"
                id="search_friend_username_query"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="friend's username"
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
                  <div className="min-w-0 pr-2">
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {req.display_name}
                    </h4>
                    <span className="text-xs font-bold text-[#0072CE] block truncate">
                      @{req.username}
                    </span>
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
                  <div className="min-w-0 pr-3">
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

                  {friend.status === 'pending_outgoing' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl">
                        Pending...
                      </span>
                      <button
                        onClick={() => handleCancelRequest(friend.friendshipId)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black px-3 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        onClick={() => router.push(`/u/${friend.username}`)}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                      >
                        Compare
                      </button>
                      <button
                        onClick={() => handleUnfriend(friend.friendshipId)}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer px-1 py-0.5"
                      >
                        Unfriend
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

