export type BucketType = 'banger' | 'slaps' | 'mid' | 'skip' | 'trash';

export interface Song {
  id: string;
  title: string;
  album: string;
  year: number;
  isBSide?: boolean;
  albumId?: string; // Added for strict local artwork registry support
}

export const BUCKET_CONFIG: Record<
  BucketType,
  { label: string; emoji: string; color: string; badgeBg: string }
> = {
  banger: {
    label: 'Banger',
    emoji: '🤘',
    color: 'border-emerald-600 text-emerald-800',
    badgeBg:
      'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200',
  },
  slaps: {
    label: 'Lowkey Slaps',
    emoji: '👌',
    color: 'border-blue-600 text-blue-800',
    badgeBg: 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200',
  },
  mid: {
    label: 'Mid',
    emoji: '🫤',
    color: 'border-amber-500 text-amber-900',
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200',
  },
  skip: {
    label: 'Skip',
    emoji: '⏭️',
    color: 'border-orange-500 text-orange-900',
    badgeBg:
      'bg-orange-100 text-orange-900 border-orange-300 hover:bg-orange-200',
  },
  trash: {
    label: 'Trash',
    emoji: '🗑️',
    color: 'border-rose-600 text-rose-900',
    badgeBg: 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200',
  },
};

export const BUCKET_TRANSITIONS: Record<
  BucketType,
  { above: BucketType | null; below: BucketType | null }
> = {
  banger: { above: null, below: 'slaps' },
  slaps: { above: 'banger', below: 'mid' },
  mid: { above: 'slaps', below: 'skip' },
  skip: { above: 'mid', below: 'trash' },
  trash: { above: 'skip', below: null },
};

export const B_SIDES_CANON: Song[] = [
  {
    id: 'bs_1',
    title: 'Tragic Girl',
    album: 'B-Sides & Rarities',
    year: 1996,
    isBSide: true,
  },
  {
    id: 'bs_2',
    title: 'I Just Threw Out the Love of My Dreams',
    album: 'B-Sides & Rarities',
    year: 1996,
    isBSide: true,
  },
  {
    id: 'bs_3',
    title: 'You Gave Your Love to Me Softly',
    album: 'B-Sides & Rarities',
    year: 1996,
    isBSide: true,
  },
  {
    id: 'bs_4',
    title: 'Mykel and Carli',
    album: 'B-Sides & Rarities',
    year: 1994,
    isBSide: true,
  },
  {
    id: 'bs_5',
    title: 'Susanne',
    album: 'B-Sides & Rarities',
    year: 1994,
    isBSide: true,
  },
  {
    id: 'bs_6',
    title: 'Waiting on You',
    album: 'B-Sides & Rarities',
    year: 1996,
    isBSide: true,
  },
  {
    id: 'bs_7',
    title: 'Miss Sweeney',
    album: 'B-Sides & Rarities',
    year: 2008,
    isBSide: true,
  },
  {
    id: 'bs_8',
    title: 'Long Time Sunshine',
    album: 'B-Sides & Rarities',
    year: 1996,
    isBSide: true,
  },
  {
    id: 'bs_9',
    title: 'Devotion',
    album: 'B-Sides & Rarities',
    year: 1996,
    isBSide: true,
  },
  {
    id: 'bs_10',
    title: 'Pig',
    album: 'B-Sides & Rarities',
    year: 2008,
    isBSide: true,
  },
  {
    id: 'bs_11',
    title: 'The Spider',
    album: 'B-Sides & Rarities',
    year: 2008,
    isBSide: true,
  },
  {
    id: 'bs_12',
    title: 'Jamie',
    album: 'B-Sides & Rarities',
    year: 1994,
    isBSide: true,
  },
  {
    id: 'bs_13',
    title: 'Paperface',
    album: 'B-Sides & Rarities',
    year: 1992,
    isBSide: true,
  },
  {
    id: 'bs_14',
    title: 'King',
    album: 'B-Sides & Rarities',
    year: 2008,
    isBSide: true,
  },
  {
    id: 'bs_15',
    title: 'Lullabye for Wayne',
    album: 'B-Sides & Rarities',
    year: 1994,
    isBSide: true,
  },
  {
    id: 'bs_16',
    title: "I Swear It's True",
    album: 'B-Sides & Rarities',
    year: 1996,
    isBSide: true,
  },
  {
    id: 'bs_17',
    title: 'The Prettiest Girl in the Whole Wide World',
    album: 'B-Sides & Rarities',
    year: 2009,
    isBSide: true,
  },
  {
    id: 'bs_18',
    title: 'Fake Smiles and Nervous Laughter',
    album: 'B-Sides & Rarities',
    year: 2016,
    isBSide: true,
  },
];

export const WEEZER_CANON: Song[] = [
  // The Blue Album (1994)
  {
    id: 'blue_1',
    title: 'My Name Is Jonas',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_2',
    title: 'No One Else',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_3',
    title: 'The World Has Turned and Left Me Here',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_4',
    title: 'Buddy Holly',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_5',
    title: 'Undone – The Sweater Song',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_6',
    title: 'Surf Wax America',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_7',
    title: "Say It Ain't So",
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_8',
    title: 'In the Garage',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_9',
    title: 'Holiday',
    album: 'The Blue Album',
    year: 1994,
  },
  {
    id: 'blue_10',
    title: 'Only in Dreams',
    album: 'The Blue Album',
    year: 1994,
  },

  // Pinkerton (1996)
  {
    id: 'pink_1',
    title: 'Tired of Sex',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_2',
    title: 'Getchoo',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_3',
    title: 'No Other One',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_4',
    title: 'Why Bother?',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_5',
    title: 'Across the Sea',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_6',
    title: 'The Good Life',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_7',
    title: 'El Scorcho',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_8',
    title: 'Pink Triangle',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_9',
    title: 'Falling for You',
    album: 'Pinkerton',
    year: 1996,
  },
  {
    id: 'pink_10',
    title: 'Butterfly',
    album: 'Pinkerton',
    year: 1996,
  },

  // Green Album (2001)
  {
    id: 'green_1',
    title: "Don't Let Go",
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_2',
    title: 'Photograph',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_3',
    title: 'Hash Pipe',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_4',
    title: 'Island in the Sun',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_5',
    title: 'Crab',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_6',
    title: 'Knock-down Drag-out',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_7',
    title: 'Smile',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_8',
    title: 'Simple Pages',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_9',
    title: 'Glorious Day',
    album: 'Green Album',
    year: 2001,
  },
  {
    id: 'green_10',
    title: 'O Girlfriend',
    album: 'Green Album',
    year: 2001,
  },

  // Maladroit (2002)
  {
    id: 'mal_1',
    title: 'American Gigolo',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_2',
    title: 'Dope Nose',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_3',
    title: "Keep Fishin'",
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_4',
    title: 'Take Control',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_5',
    title: 'Death and Destruction',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_6',
    title: 'Slob',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_7',
    title: 'Burndt Jamb',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_8',
    title: 'Space Rock',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_9',
    title: 'Possibilities',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_10',
    title: 'Love Explosion',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_11',
    title: 'Fall Together',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_12',
    title: 'December',
    album: 'Maladroit',
    year: 2002,
  },
  {
    id: 'mal_13',
    title: 'Slave',
    album: 'Maladroit',
    year: 2002,
  },

  // Make Believe (2005)
  {
    id: 'mb_1',
    title: 'Beverly Hills',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_2',
    title: 'Perfect Situation',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_3',
    title: 'This Is Such a Pity',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_4',
    title: 'Hold Me',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_5',
    title: 'Peace',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_6',
    title: 'We Are All on Drugs',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_7',
    title: 'The Damage in Your Heart',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_8',
    title: 'Pardon Me',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_9',
    title: 'My Best Friend',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_10',
    title: 'The Other Way',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_11',
    title: 'Freak Me Out',
    album: 'Make Believe',
    year: 2005,
  },
  {
    id: 'mb_12',
    title: 'Haunt You Every Day',
    album: 'Make Believe',
    year: 2005,
  },

  // Red Album (2008)
  {
    id: 'red_1',
    title: 'Troublemaker',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_2',
    title: 'The Greatest Man That Ever Lived',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_3',
    title: 'Pork and Beans',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_4',
    title: 'Heart Songs',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_5',
    title: 'Everybody Get Dangerous',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_6',
    title: "Dreamin'",
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_7',
    title: 'Thought I Knew',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_8',
    title: 'Cold Dark World',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_9',
    title: 'Automatic',
    album: 'Red Album',
    year: 2008,
  },
  {
    id: 'red_10',
    title: 'The Angel and the One',
    album: 'Red Album',
    year: 2008,
  },

  // Raditude (2009)
  {
    id: 'rad_1',
    title: "(If You're Wondering If I Want You To) I Want You To",
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_2',
    title: "I'm Your Daddy",
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_3',
    title: 'The Girl Got Hot',
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_4',
    title: "Can't Stop Partying",
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_5',
    title: 'Put Me Back Together',
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_6',
    title: "Trippin' Down the Freeway",
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_7',
    title: 'Love Is the Answer',
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_8',
    title: 'Let It All Hang Out',
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_9',
    title: 'In the Mall',
    album: 'Raditude',
    year: 2009,
  },
  {
    id: 'rad_10',
    title: "I Don't Want to Let You Go",
    album: 'Raditude',
    year: 2009,
  },

  // Hurley (2010)
  {
    id: 'hur_1',
    title: 'Memories',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_2',
    title: 'Ruling Me',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_3',
    title: 'Trainwrecks',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_4',
    title: 'Unspoken',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_5',
    title: "Where's My Sex?",
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_6',
    title: 'Run Away',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_7',
    title: 'Hang On',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_8',
    title: 'Smart Girls',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_9',
    title: 'Brave New World',
    album: 'Hurley',
    year: 2010,
  },
  {
    id: 'hur_10',
    title: 'Time Flies',
    album: 'Hurley',
    year: 2010,
  },

  // Everything Will Be Alright in the End (2014)
  {
    id: 'ew_1',
    title: "Ain't Got Nobody",
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_2',
    title: 'Back to the Shack',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_3',
    title: 'Eulogy for a Rock Band',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_4',
    title: 'Lonely Girl',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_5',
    title: "I've Had It Up to Here",
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_6',
    title: 'The British Are Coming',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_7',
    title: 'Da Vinci',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_8',
    title: 'Go Away',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_9',
    title: 'Cleopatra',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_10',
    title: 'Foolish Father',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_11',
    title: 'I. The Waste Land',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_12',
    title: 'II. Anonymous',
    album: 'EWBAITE',
    year: 2014,
  },
  {
    id: 'ew_13',
    title: 'III. Return to Ithaka',
    album: 'EWBAITE',
    year: 2014,
  },

  // White Album (2016)
  {
    id: 'wh_1',
    title: 'California Kids',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_2',
    title: 'Wind in Our Sail',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_3',
    title: 'Thank God for Girls',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_4',
    title: '(Girl We Got A) Good Thing',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_5',
    title: 'Do You Wanna Get High?',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_6',
    title: 'King of the World',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_7',
    title: 'Summer Elaine and Drunk Dori',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_8',
    title: 'L.A. Girlz',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_9',
    title: 'Jacked Up',
    album: 'White Album',
    year: 2016,
  },
  {
    id: 'wh_10',
    title: 'Endless Bummer',
    album: 'White Album',
    year: 2016,
  },

  // Pacific Daydream (2017)
  {
    id: 'pd_1',
    title: 'Mexican Fender',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_2',
    title: 'Beach Boys',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_3',
    title: 'Feels Like Summer',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_4',
    title: 'Happy Hour',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_5',
    title: 'Weekend Woman',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_6',
    title: 'QB Blitz',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_7',
    title: 'Sweet Mary',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_8',
    title: 'Get Right',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_9',
    title: 'La Mancha Screwjob',
    album: 'Pacific Daydream',
    year: 2017,
  },
  {
    id: 'pd_10',
    title: "Any Friend of Diane's",
    album: 'Pacific Daydream',
    year: 2017,
  },

  // Black Album (2019)
  {
    id: 'blk_1',
    title: "Can't Knock the Hustle",
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_2',
    title: 'Zombie Bastards',
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_3',
    title: 'High as a Kite',
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_4',
    title: 'Living in L.A.',
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_5',
    title: 'Piece of Cake',
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_6',
    title: "I'm Just Being Honest",
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_7',
    title: 'Too Many Thoughts in My Head',
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_8',
    title: 'The Prince Who Wanted Everything',
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_9',
    title: 'Byzantine',
    album: 'Black Album',
    year: 2019,
  },
  {
    id: 'blk_10',
    title: 'California Snow',
    album: 'Black Album',
    year: 2019,
  },

  // OK Human (2021)
  {
    id: 'okh_1',
    title: 'All My Favorite Songs',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_2',
    title: 'Aloo Gobi',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_3',
    title: 'Grapes of Wrath',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_4',
    title: 'Numbers',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_5',
    title: 'Playing My Piano',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_6',
    title: 'Mirror Image',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_7',
    title: 'Screens',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_8',
    title: 'Bird with a Broken Wing',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_9',
    title: 'Dead Roses',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_10',
    title: 'Everything Happens for a Reason',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_11',
    title: 'Here Comes the Rain',
    album: 'OK Human',
    year: 2021,
  },
  {
    id: 'okh_12',
    title: 'La Brea Tar Pits',
    album: 'OK Human',
    year: 2021,
  },

  // Van Weezer (2021)
  {
    id: 'vw_1',
    title: 'Hero',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_2',
    title: 'All the Good Ones',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_3',
    title: 'The End of the Game',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_4',
    title: 'I Need Some of That',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_5',
    title: 'Beginning of the End',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_6',
    title: 'Blue Dream',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_7',
    title: '1 More Hit',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_8',
    title: 'Sheila Can Do It',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_9',
    title: 'She Needs Me',
    album: 'Van Weezer',
    year: 2021,
  },
  {
    id: 'vw_10',
    title: 'Precious Metal Girl',
    album: 'Van Weezer',
    year: 2021,
  },

  // SZNZ: Spring EP (2022)
  {
    id: 'sz_sp1',
    title: 'Opening Night',
    album: 'SZNZ: Spring',
    year: 2022,
  },
  {
    id: 'sz_sp2',
    title: 'Angels on Vacation',
    album: 'SZNZ: Spring',
    year: 2022,
  },
  {
    id: 'sz_sp3',
    title: 'A Little Bit of Love',
    album: 'SZNZ: Spring',
    year: 2022,
  },
  {
    id: 'sz_sp4',
    title: 'The Garden of Eden',
    album: 'SZNZ: Spring',
    year: 2022,
  },
  {
    id: 'sz_sp5',
    title: 'The Sound of Drums',
    album: 'SZNZ: Spring',
    year: 2022,
  },
  {
    id: 'sz_sp6',
    title: 'All This Love',
    album: 'SZNZ: Spring',
    year: 2022,
  },
  {
    id: 'sz_sp7',
    title: 'Wild At Heart',
    album: 'SZNZ: Spring',
    year: 2022,
  },

  // SZNZ: Summer EP (2022)
  {
    id: 'sz_su1',
    title: 'Lawn Chair',
    album: 'SZNZ: Summer',
    year: 2022,
  },
  {
    id: 'sz_su2',
    title: 'Records',
    album: 'SZNZ: Summer',
    year: 2022,
  },
  {
    id: 'sz_su3',
    title: 'Blue Like Jazz',
    album: 'SZNZ: Summer',
    year: 2022,
  },
  {
    id: 'sz_su4',
    title: 'The Opposite of Me',
    album: 'SZNZ: Summer',
    year: 2022,
  },
  {
    id: 'sz_su5',
    title: "What's the Good of Being Good",
    album: 'SZNZ: Summer',
    year: 2022,
  },
  {
    id: 'sz_su6',
    title: 'Cuomoville',
    album: 'SZNZ: Summer',
    year: 2022,
  },
  {
    id: 'sz_su7',
    title: 'Thank You and Good Night',
    album: 'SZNZ: Summer',
    year: 2022,
  },

  // SZNZ: Autumn EP (2022)
  {
    id: 'sz_au1',
    title: "Can't Dance, Don't Ask",
    album: 'SZNZ: Autumn',
    year: 2022,
  },
  {
    id: 'sz_au2',
    title: 'Get Off on the Pain',
    album: 'SZNZ: Autumn',
    year: 2022,
  },
  {
    id: 'sz_au3',
    title: 'What Happens After You?',
    album: 'SZNZ: Autumn',
    year: 2022,
  },
  {
    id: 'sz_au4',
    title: 'Francesca',
    album: 'SZNZ: Autumn',
    year: 2022,
  },
  {
    id: 'sz_au5',
    title: 'Should She Stay or Should She Go',
    album: 'SZNZ: Autumn',
    year: 2022,
  },
  {
    id: 'sz_au6',
    title: 'Tastes Like Pain',
    album: 'SZNZ: Autumn',
    year: 2022,
  },
  {
    id: 'sz_au7',
    title: 'Run, Raven, Run',
    album: 'SZNZ: Autumn',
    year: 2022,
  },

  // SZNZ: Winter EP (2022)
  {
    id: 'sz_wi1',
    title: 'I Want a Dog',
    album: 'SZNZ: Winter',
    year: 2022,
  },
  {
    id: 'sz_wi2',
    title: 'Iambic Pentameter',
    album: 'SZNZ: Winter',
    year: 2022,
  },
  {
    id: 'sz_wi3',
    title: 'Basketball',
    album: 'SZNZ: Winter',
    year: 2022,
  },
  {
    id: 'sz_wi4',
    title: 'Sheraton Commander',
    album: 'SZNZ: Winter',
    year: 2022,
  },
  {
    id: 'sz_wi5',
    title: 'Dark Enough to See the Stars',
    album: 'SZNZ: Winter',
    year: 2022,
  },
  {
    id: 'sz_wi6',
    title: 'The One That Got Away',
    album: 'SZNZ: Winter',
    year: 2022,
  },
  {
    id: 'sz_wi7',
    title: 'The Deep and Dreamless Sleep',
    album: 'SZNZ: Winter',
    year: 2022,
  },

  // Gold Album (2026)
  {
    id: 'gold_1',
    title: 'Say Yes',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_2',
    title: 'Shine Again',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_3',
    title: "Don't Make It Weird",
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_4',
    title: 'We Might As Well Be Strangers',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_5',
    title: 'C.E.O.',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_6',
    title: 'Hoops',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_7',
    title: 'Nowhere',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_8',
    title: 'The Show Must Go On',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_9',
    title: 'Up In The Clouds',
    album: 'Gold Album',
    year: 2026,
  },
  {
    id: 'gold_10',
    title: 'The LA Sound',
    album: 'Gold Album',
    year: 2026,
  },
];

export const FULL_SONG_POOL = [...WEEZER_CANON, ...B_SIDES_CANON];

/**
 * Canonical singles from the post-Pinkerton catalog, in catalog-title
 * spelling. Triage surfaces these right after Blue and Pinkerton so a
 * casual fan meets the songs they recognize first (recognition-first
 * order). Blue/Pinkerton singles are not listed — those albums already
 * lead the triage order in full.
 *
 * Owner's list had 27 titles; 26 matched this catalog. 'Africa' is not
 * in the catalog (the Teal Album covers aren't part of the pool), and
 * "(If You're Wondering If I Want You To) I Want You" is stored under
 * its full catalog title, "...I Want You To".
 */
export const SINGLES_TITLES: string[] = [
  'Hash Pipe',
  'Island in the Sun',
  'Dope Nose',
  "Keep Fishin'",
  'Beverly Hills',
  'Perfect Situation',
  'We Are All on Drugs',
  'Pork and Beans',
  'Troublemaker',
  "(If You're Wondering If I Want You To) I Want You To",
  "I'm Your Daddy",
  'Memories',
  'Back to the Shack',
  'Cleopatra',
  'Thank God for Girls',
  'Do You Wanna Get High?',
  'King of the World',
  'Feels Like Summer',
  'Happy Hour',
  "Can't Knock the Hustle",
  'High as a Kite',
  'Living in L.A.',
  'Hero',
  'All My Favorite Songs',
  'I Need Some of That',
  'Records',
];

/** Ids of catalog songs that are singles (see SINGLES_TITLES). */
export const SINGLE_SONG_IDS: ReadonlySet<string> = new Set(
  FULL_SONG_POOL.filter((s) =>
    SINGLES_TITLES.some((t) => t.toLowerCase() === s.title.toLowerCase())
  ).map((s) => s.id)
);

// --------------------------------------------------------
// ASSET ARCHITECTURE: LOCAL DETERMINISTIC ALBUM REGISTRY
// --------------------------------------------------------
export const ALBUMS_BY_ID: Record<
  string,
  { id: string; name: string; year: number; cover: string }
> = {
  blue: {
    id: 'blue',
    name: 'The Blue Album',
    year: 1994,
    cover: '/albums/blue.jpg',
  },
  pinkerton: {
    id: 'pinkerton',
    name: 'Pinkerton',
    year: 1996,
    cover: '/albums/pinkerton.jpg',
  },
  green: {
    id: 'green',
    name: 'The Green Album',
    year: 2001,
    cover: '/albums/green.jpg',
  },
  maladroit: {
    id: 'maladroit',
    name: 'Maladroit',
    year: 2002,
    cover: '/albums/maladroit.jpg',
  },
  'make-believe': {
    id: 'make-believe',
    name: 'Make Believe',
    year: 2005,
    cover: '/albums/make-believe.jpg',
  },
  red: {
    id: 'red',
    name: 'The Red Album',
    year: 2008,
    cover: '/albums/red.jpg',
  },
  raditude: {
    id: 'raditude',
    name: 'Raditude',
    year: 2009,
    cover: '/albums/raditude.jpg',
  },
  hurley: {
    id: 'hurley',
    name: 'Hurley',
    year: 2010,
    cover: '/albums/hurley.jpg',
  },
  dtfm: {
    id: 'dtfm',
    name: 'Death to False Metal',
    year: 2010,
    cover: '/albums/dtfm.jpg',
  },
  ewbaite: {
    id: 'ewbaite',
    name: 'Everything Will Be Alright in the End',
    year: 2014,
    cover: '/albums/ewbaite.jpg',
  },
  white: {
    id: 'white',
    name: 'The White Album',
    year: 2016,
    cover: '/albums/white.jpg',
  },
  'pacific-daydream': {
    id: 'pacific-daydream',
    name: 'Pacific Daydream',
    year: 2017,
    cover: '/albums/pacific-daydream.png',
  },
  teal: {
    id: 'teal',
    name: 'The Teal Album',
    year: 2019,
    cover: '/albums/teal.jpg',
  },
  black: {
    id: 'black',
    name: 'The Black Album',
    year: 2019,
    cover: '/albums/black.png',
  },
  'ok-human': {
    id: 'ok-human',
    name: 'OK Human',
    year: 2021,
    cover: '/albums/ok-human.jpg',
  },
  'van-weezer': {
    id: 'van-weezer',
    name: 'Van Weezer',
    year: 2021,
    cover: '/albums/van-weezer.png',
  },
  'sznz-spring': {
    id: 'sznz-spring',
    name: 'SZNZ: Spring',
    year: 2022,
    cover: '/albums/sznz-spring.jpg',
  },
  'sznz-summer': {
    id: 'sznz-summer',
    name: 'SZNZ: Summer',
    year: 2022,
    cover: '/albums/sznz-summer.jpeg',
  },
  'sznz-autumn': {
    id: 'sznz-autumn',
    name: 'SZNZ: Autumn',
    year: 2022,
    cover: '/albums/sznz-autumn.jpg',
  },
  'sznz-winter': {
    id: 'sznz-winter',
    name: 'SZNZ: Winter',
    year: 2022,
    cover: '/albums/sznz-winter.jpg',
  },
  gold: {
    id: 'gold',
    name: 'The Gold Album',
    year: 2026,
    cover: '/albums/gold.jpg',
  },
  'b-sides': {
    id: 'b-sides',
    name: 'B-Sides & Rarities',
    year: 1994,
    cover: '/albums/b-sides.jpg',
  },
};

/**
 * THE album palette (Nov 7, 2026 — Build 7, implementing the
 * owner-approved album-color proposal of Oct 22, 2026). One
 * album, one color, everywhere: each background is derived
 * from the album's own cover art, and each text color is the
 * luminance winner (black or white, WCAG) for that background —
 * every pairing clears 4.5:1. This record replaces BOTH former
 * palettes (the per-song albumColor field, deleted with this
 * change, and TierListChart's private map) — there is no second
 * source. Judgment calls the owner approved with the proposal:
 * Pinkerton is indigo (its night-sky artwork), Maladroit takes
 * the deep antique gold while the Gold Album keeps the bright
 * metallic (two golds, told apart by lightness), SZNZ: Summer
 * is its cover's wine (not amber), the Blue Album takes black
 * text, and the Green Album is its cover's lime.
 *
 * B-Sides & Rarities' entry is the ALBUM-LEVEL color (sampled
 * olive) used wherever the collection shows as one album; its
 * SONGS never resolve here — getAlbumTheme routes them to
 * their origin albums via BSIDE_ORIGIN_ALBUM below.
 * Death to False Metal and the Teal Album hold no songs in the
 * catalog and are deliberately absent (the proposal's call);
 * unmapped names fall back to DEFAULT_ALBUM_THEME.
 */
export const ALBUM_COLORS: Record<string, { bg: string; text: string }> = {
  'The Blue Album': { bg: '#0081C8', text: '#000' },
  'Pinkerton': { bg: '#26356B', text: '#fff' },
  'Green Album': { bg: '#8CBC2A', text: '#000' },
  'Maladroit': { bg: '#A37E22', text: '#000' },
  'Make Believe': { bg: '#3D3D40', text: '#fff' },
  'Red Album': { bg: '#D92338', text: '#fff' },
  'Raditude': { bg: '#6E4218', text: '#fff' },
  'Hurley': { bg: '#A05E33', text: '#fff' },
  'EWBAITE': { bg: '#D18D60', text: '#000' },
  'Everything Will Be Alright in the End': { bg: '#D18D60', text: '#000' },
  'White Album': { bg: '#F2F2EF', text: '#000' },
  'Pacific Daydream': { bg: '#476B67', text: '#fff' },
  'Black Album': { bg: '#0C0C0C', text: '#fff' },
  'OK Human': { bg: '#AFA57F', text: '#000' },
  'Van Weezer': { bg: '#822B96', text: '#fff' },
  'SZNZ: Spring': { bg: '#407A29', text: '#fff' },
  'SZNZ: Summer': { bg: '#8E3542', text: '#fff' },
  'SZNZ: Autumn': { bg: '#59607E', text: '#fff' },
  'SZNZ: Winter': { bg: '#B7C3D6', text: '#000' },
  'Gold Album': { bg: '#D9B23C', text: '#000' },
  'B-Sides & Rarities': { bg: '#62604C', text: '#fff' },
};

/** Fallback for an album name the palette doesn't know. */
export const DEFAULT_ALBUM_THEME = { bg: '#1E293B', text: '#fff' };

/**
 * Each B-side's ORIGIN album (song id → album name) — the
 * explicit form of what the old per-song albumColor hexes
 * encoded implicitly: a 1996 B-side IS Pinkerton-family and
 * wears its colors. Extracted from those hexes at migration
 * (Blue 5 · Pinkerton 7 · Red 4 · Raditude 1 · White 1).
 */
export const BSIDE_ORIGIN_ALBUM: Record<string, string> = {
  bs_1: 'Pinkerton',
  bs_2: 'Pinkerton',
  bs_3: 'Pinkerton',
  bs_4: 'The Blue Album',
  bs_5: 'The Blue Album',
  bs_6: 'Pinkerton',
  bs_7: 'Red Album',
  bs_8: 'Pinkerton',
  bs_9: 'Pinkerton',
  bs_10: 'Red Album',
  bs_11: 'Red Album',
  bs_12: 'The Blue Album',
  bs_13: 'The Blue Album',
  bs_14: 'Red Album',
  bs_15: 'The Blue Album',
  bs_16: 'Pinkerton',
  bs_17: 'Raditude',
  bs_18: 'White Album',
};

/** Album-level theme: one album name → its palette entry. */
export function getAlbumThemeByName(
  album: string
): { bg: string; text: string } {
  return ALBUM_COLORS[album] ?? DEFAULT_ALBUM_THEME;
}

/**
 * Song-level theme: a B-side resolves to its ORIGIN album's
 * theme; every other song to its own album's. This is the one
 * resolver every song-colored surface uses.
 */
export function getAlbumTheme(song: {
  id: string;
  album: string;
}): { bg: string; text: string } {
  return getAlbumThemeByName(BSIDE_ORIGIN_ALBUM[song.id] ?? song.album);
}

// BRIDGE: Maps your existing text strings perfectly to the strict album IDs
export const ALBUM_NAME_TO_ID: Record<string, string> = {
  'The Blue Album': 'blue',
  Pinkerton: 'pinkerton',
  'Green Album': 'green',
  Maladroit: 'maladroit',
  'Make Believe': 'make-believe',
  'Red Album': 'red',
  Raditude: 'raditude',
  Hurley: 'hurley',
  'Death to False Metal': 'dtfm',
  EWBAITE: 'ewbaite',
  'White Album': 'white',
  'Pacific Daydream': 'pacific-daydream',
  'The Teal Album': 'teal',
  'Black Album': 'black',
  'OK Human': 'ok-human',
  'Van Weezer': 'van-weezer',
  'SZNZ: Spring': 'sznz-spring',
  'SZNZ: Summer': 'sznz-summer',
  'SZNZ: Autumn': 'sznz-autumn',
  'SZNZ: Winter': 'sznz-winter',
  'Gold Album': 'gold',
  'B-Sides & Rarities': 'b-sides',
};
