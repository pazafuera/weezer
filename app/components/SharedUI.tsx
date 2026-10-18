'use client';
import React, { useState, useRef, useEffect } from 'react';
import { ALBUMS_BY_ID } from '../data/constants';

// OFFICIAL WEEZER FLYING-W LOGO
export function FlyingWIcon({ className = "w-8 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 550" className={className} fill="currentColor">
      <path d="M 0,0 L 240,0 L 330,260 L 500,150 L 670,260 L 760,0 L 1000,0 L 1000,65 L 870,65 L 870,125 L 960,125 L 960,190 L 760,190 L 630,540 L 500,310 L 370,540 L 240,190 L 40,190 L 40,125 L 130,125 L 130,65 L 0,65 Z" />
    </svg>
  );
}

// HELP BUTTON — the "?" affordance for the triage step's chrome
// (deck progress row + list progress bar; both modes carry one,
// styled and wired identically from this single component). The
// help sheet itself lives in AppShell; clicking dispatches the
// 'weezer:open-help' window event AppShell listens for — the same
// window-event pattern as the deck tutorial replay
// ('weezer:replay-tutorial'), so no props need plumbing through
// page.tsx.
export function HelpButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('weezer:open-help'))}
      aria-label="Help"
      title="Help"
      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-[#0072CE] hover:bg-blue-600 text-white font-black text-sm leading-none shadow-xs transition-colors cursor-pointer"
    >
      ?
    </button>
  );
}

// BULLETPROOF ARTWORK COMPONENT
export function AlbumArtwork({ albumId, className = "" }: { albumId: string; className?: string }) {
  const album = ALBUMS_BY_ID[albumId];
  const src = album ? album.cover : "/albums/fallback.jpg";
  const alt = album ? album.name : "Unknown Album";
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={className} 
      onError={(e) => {
        // Prevent infinite loops if the fallback image itself is missing
        if (!e.currentTarget.src.endsWith("/albums/fallback.jpg")) {
          e.currentTarget.src = "/albums/fallback.jpg";
        }
      }}
    />
  );
}

export function AudioPreviewButton({ title, compact = false, large = false }: { title: string; compact?: boolean; large?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clear cached audio when title changes (prevents playing previous song in Gauntlet)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, [title]);

  // Listen for global kill switch
  useEffect(() => {
    const handleKillAudio = () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    window.addEventListener('kill-all-audio', handleKillAudio);
    return () => window.removeEventListener('kill-all-audio', handleKillAudio);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    window.dispatchEvent(new Event('kill-all-audio'));

    try {
      setIsLoading(true);
      
      if (!audioRef.current) {
        const res = await fetch(`https://itunes.apple.com/search?term=Weezer+${encodeURIComponent(title)}&entity=song&limit=1`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
          audioRef.current = new Audio(data.results[0].previewUrl);
          audioRef.current.onended = () => setIsPlaying(false);
        } else {
          console.warn("No audio preview found for this song.");
          setIsLoading(false);
          return;
        }
      }

      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={togglePlay}
      className={`flex items-center justify-center rounded-full transition-all duration-200 shrink-0 cursor-pointer ${
        compact 
          ? 'w-7 h-7 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs' 
          : large
          ? 'w-16 h-16 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0072CE]'
          : 'w-10 h-10 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0072CE]'
      } ${
        isPlaying 
          ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 border-amber-500 shadow-sm ring-2 ring-amber-200' 
          : 'text-slate-600'
      }`}
      title="Play 30s Preview"
    >
      {isLoading ? (
        <span className={`block ${large ? 'w-5 h-5' : 'w-3 h-3'} border-2 border-current border-t-transparent rounded-full animate-spin`} />
      ) : isPlaying ? (
        <span className={`font-black leading-none tracking-tighter ${compact ? 'text-[9px]' : large ? 'text-lg' : 'text-xs'}`}>||</span>
      ) : (
        <span className={`font-black leading-none ml-0.5 ${compact ? 'text-[10px]' : large ? 'text-xl' : 'text-sm'}`}>▶</span>
      )}
    </button>
  );
}