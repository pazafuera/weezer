'use client';

import React from 'react';
import { useWeezer } from '../context/WeezerContext';
import { ShareablesGallery } from './shareables';

/**
 * The Shareables asset library as a first-class app step (dashboard card,
 * menu item, and the end of the Sweater Thread all lead here / embed it).
 */
export default function StepShareables() {
  const { masterList, triageMap, friendsList, userProfile } = useWeezer();
  const ranked = masterList.filter((s) => triageMap[s.id]);
  const subtitle = userProfile?.username ? `@${userProfile.username}` : undefined;

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="pt-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Shareables
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Your asset library — view, save, and share your cards
          </p>
        </div>

        <ShareablesGallery
          songs={ranked}
          triageMap={triageMap}
          friends={friendsList ?? []}
          subtitle={subtitle}
        />
      </div>
    </div>
  );
}
