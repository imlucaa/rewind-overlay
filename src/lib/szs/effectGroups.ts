// Mario Kart Wii's race effects (Effect/RKRace.breff in common.szs), grouped by what they are in the game. Matched by
// effect name; many names are Japanese: seikou "success", koukasen "speed lines", kaminari gumo "thundercloud",
// gesso "blooper", hane koura "winged (blue) shell", kyodai "giant", killer "Bullet Bill", nise box "fake item box".

export interface EffectGroup {
  id: string;
  label: string;
  /** Where you see it in the game, in plain words. */
  about: string;
  section: 'Drifting and boosts' | 'Racing' | 'Items' | 'Track';
  match: RegExp;
}

export const EFFECT_GROUPS: readonly EffectGroup[] = [
  { id: 'mt', label: 'Mini-Turbo Sparks', about: "Blue sparks under your wheels while drifting", section: 'Drifting and boosts', match: /^rk_(blue(Chip|Spark)|driftSpark1)/ },
  { id: 'smt', label: 'Super Mini-Turbo Sparks', about: "Orange sparks when you drift longer (karts only)", section: 'Drifting and boosts', match: /^rk_(orange(Chip|Spark)|driftSpark2)/ },
  { id: 'mtBoost', label: 'Mini-Turbo Flame', about: "Flame from the exhaust when you let go of a drift", section: 'Drifting and boosts', match: /^rk_miniTurbo/ },
  { id: 'trick', label: 'Trick Boost', about: "Flash and ring when you do a trick off a ramp", section: 'Drifting and boosts', match: /^rk_jumpSeikou/ },
  { id: 'star', label: 'Star', about: "Glow while a Star makes you invincible", section: 'Drifting and boosts', match: /^rk_star(?!t)/ },
  { id: 'rocket', label: 'Rocket Start', about: "Burst when you boost at the start (and smoke if you mistime it)", section: 'Racing', match: /^rk_start/ },
  { id: 'speedLines', label: 'Boost Speed Lines', about: "Streaks around you while you boost", section: 'Racing', match: /^rk_koukasen/ },
  { id: 'slipstream', label: 'Slipstream', about: "Air lines when you drive right behind someone", section: 'Racing', match: /^rk_slipStream/ },
  { id: 'exhaust', label: 'Exhaust Smoke', about: "Smoke puffing out of the exhaust", section: 'Racing', match: /^rk_gasSmoke/ },
  { id: 'bikeLean', label: 'Bike Lean & Wheelie', about: "Sparks and trails when a bike leans or does a wheelie", section: 'Racing', match: /^rk_(hangOn|wheelie|jumpTail)/ },
  { id: 'smoke', label: 'Drift, Brake & Wheelspin Smoke', about: "Smoke from drifting, braking and spinning wheels", section: 'Racing', match: /^rk_(driftSmoke|brakeSmk|wheelSpin|autoDrift)/ },
  { id: 'landing', label: 'Landing Dust', about: "Dust puff when you land after a jump", section: 'Racing', match: /^rk_jumpSmoke/ },
  { id: 'hit', label: 'Hit Stars', about: "Stars and flashes when something hits you", section: 'Racing', match: /^rk_(hitA|ac_)/ },
  { id: 'crash', label: 'Spin-Outs & Crashes', about: "Smoke and fire when you spin out or get thrown", section: 'Racing', match: /^rk_(crash(?!Water)|spin(?!Water)|kurokoge|uchiage)/ },
  { id: 'itemBox', label: 'Item Boxes', about: "Item boxes breaking as you drive through them", section: 'Items', match: /^rk_itemBox|^rk_itemVan/ },
  { id: 'fakeBox', label: 'Fake Item Boxes', about: "Fake Item Boxes breaking and flashing", section: 'Items', match: /^rk_niseBox/ },
  { id: 'shells', label: 'Shells', about: "Green and Red Shell trails and breaking", section: 'Items', match: /^rk_koura/ },
  { id: 'blueShell', label: 'Spiny Shell (Blue Shell)', about: "Blue Shell trail and its explosion", section: 'Items', match: /^rk_haneKoura/ },
  { id: 'bomb', label: 'Bob-omb', about: "Bob-omb fuse and explosion", section: 'Items', match: /^rk_bomb/ },
  { id: 'bullet', label: 'Bullet Bill', about: "Bullet Bill fire and smoke", section: 'Items', match: /^rk_killer/ },
  { id: 'mega', label: 'Mega Mushroom', about: "Glow when you grow and shrink", section: 'Items', match: /^rk_kyodai/ },
  { id: 'pow', label: 'POW Block', about: "POW Block shockwave", section: 'Items', match: /^rk_pow(?!.*_R)/ },
  { id: 'powTeam', label: 'POW Block (red team)', about: "POW Block shockwave, second version (probably for team races)", section: 'Items', match: /^rk_pow.*_R/ },
  { id: 'blooper', label: 'Blooper Ink', about: "Ink on the screen", section: 'Items', match: /^rk_gesso/ },
  { id: 'cloud', label: 'Thunder Cloud', about: "Thunder Cloud sparks and its zap", section: 'Items', match: /^rk_kaminariGumo/ },
  { id: 'lightning', label: 'Lightning', about: "Lightning bolt and the sparks when you shrink", section: 'Items', match: /^rk_thunder(?!.*_[RB]$)/ },
  { id: 'teamLightning', label: 'Lightning (team colors)', about: "Lightning in red and blue, for team races", section: 'Items', match: /^rk_thunder.*_[RB]$/ },
  { id: 'banana', label: 'Banana', about: "Smoke when you slip on a banana", section: 'Items', match: /^rk_banana/ },
  { id: 'balloons', label: 'Battle Balloons', about: "Balloons popping in Battle", section: 'Items', match: /^rk_baloon/ },
  { id: 'water', label: 'Water Splashes', about: "Splashes and ripples in water", section: 'Track', match: /^rk_([pP]ochaWater|water|wave|awa|crashWater|spinWater|jugemWater)/ },
  { id: 'snow', label: 'Snow & Ice', about: "Snow and ice thrown up by your wheels", section: 'Track', match: /^rk_(snow|deepSnow|ice)/ },
  { id: 'dirt', label: 'Dirt, Sand, Mud & Oil', about: "Dust and dirt off-road and on sand, and oil slicks", section: 'Track', match: /^rk_(dirt|mud|stone|oil)/ },
  { id: 'grass', label: 'Grass & Flowers', about: "Bits of grass and petals when you drive on grass", section: 'Track', match: /^rk_(weed|flower)/ },
  { id: 'scenery', label: 'Track Scenery', about: "Clouds, spores and haze on some tracks", section: 'Track', match: /^rk_(wanSmk|moya|housi|kinokoCloud)/ },
];

export const groupOf = (name: string): EffectGroup | undefined => EFFECT_GROUPS.find(g => g.match.test(name));
