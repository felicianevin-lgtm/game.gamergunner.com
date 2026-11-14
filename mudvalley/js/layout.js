// MUD VALLEY RP: the map plan. Where the towns, roads, trails, river, pond, mud pits, jumps, houses and racetracks are.
// x goes east, z goes south (on the map, up = -z). Mud Valley town is in the middle at (0, 0). The world is 1200 x 1200 meters
// (you can drive inside the fence at EDGE; past it the land climbs up into big border hills).
// The map is 10x bigger now: the old valley is the middle, and all around it are the Red Rock Desert (east),
// the Frostpine Mountains (north), the Big Woods (west) and the south plains with Big Bass Lake + Bayou Bog,
// joined by the Big Loop highway (a huge circle) and 4 long roads out of the valley.

export const HALF = 1920; // the world goes from -1920 to 1920
export const EDGE = 1835; // the fence around the whole map (invisible wall: you can't go past it)
export const RING_R = 1300; // the Big Loop highway (a circle around everything)
// the 4 long roads from the valley out to the Big Loop (straight, so the hills can make room for them)
export const SPOKES = [[[40, -424], [40, -1300]], [[498, -220], [1282, -220]], [[80, 380], [80, 1297]], [[-440, -150], [-1291, -150]]];
export const LAKE = { x: -600, z: 900, r: 150 }; // Big Bass Lake (south-west)
export const FROST = { x: -350, z: -1560, h: 230, s: 140 }; // Frostpine Peak (the tallest mountain)
export const WATER_Y = -1.2; // the river's (and the pond's) water level

// a curvy river from the top of the map to the bottom
export const riverX = (z) => 175 + 16 * Math.sin(z / 60) + 7 * Math.sin(z / 23 + 1);
export const RIVER_W = 11; // half the river's width
export const FORD_Z = 205; // the shallow place where trails cross the river

// Thunder Peak (the big mountain, a lookout + the Ranger Station on top) and the mansion hill
export const MOUNTAIN = { x: -290, z: 300, h: 165, s: 100 };
export const MANSION_HILL = { x: -215, z: -128, h: 18, s: 50 };
// Lily Pond (fishing!)
export const POND = { x: 452, z: 140, r: 34 };

// flat areas (towns, speedway, farm...). y: null means "flatten at whatever height the hill has there"
export const FLATS = [
  { x: 0, z: 0, hx: 116, hz: 106, y: 1, b: 30 }, // Mud Valley town
  { x: -20, z: -262, hx: 168, hz: 74, y: 2, b: 30 }, // speedway
  { x: 300, z: -8, hx: 60, hz: 60, y: 4, b: 26 }, // motocross park
  { x: 40, z: 245, hx: 58, hz: 42, y: 2.5, b: 26 }, // farm
  { x: -300, z: -10, hx: 38, hz: 32, y: 3, b: 20 }, // lumber yard
  { x: 95, z: -175, hx: 32, hz: 28, y: 2, b: 20 }, // construction site
  { x: -215, z: -125, hx: 26, hz: 22, y: null, b: 16 }, // mansion hilltop
  { x: -290, z: 300, hx: 15, hz: 15, y: null, b: 14 }, // Thunder Peak summit (lookout + Ranger Station)
  { x: 147, z: 128, hx: 16, hz: 14, y: null, b: 14 }, // camper spot
  { x: -150, z: 60, hx: 45, hz: 36, y: 1.2, b: 22 }, // Pine Street (houses)
  { x: 300, z: 150, hx: 12, hz: 10, y: null, b: 12 }, // campground
  { x: 400, z: -318, hx: 108, hz: 52, y: 3, b: 30 }, // Copper Creek (the second town)
  { x: 452, z: 140, hx: 52, hz: 50, y: 2, b: 24 }, // Lily Pond
  { x: -458, z: -262, hx: 16, hz: 14, y: null, b: 14 }, // robber hideout in the woods
  { x: 330, z: 725, hx: 115, hz: 82, y: null, b: 30 }, // Valley Drift Park
  // the new houses
  { x: 246, z: -138, hx: 16, hz: 26, y: null, b: 12 }, { x: 210, z: 58, hx: 14, hz: 14, y: null, b: 12 }, { x: -428, z: 138, hx: 18, hz: 16, y: null, b: 12 },
  { x: 474, z: 84, hx: 18, hz: 16, y: null, b: 12 }, { x: 234, z: 342, hx: 34, hz: 24, y: null, b: 14 }, { x: -318, z: -200, hx: 34, hz: 24, y: null, b: 14 },
];

// ---------------------------------------------------------------- roads (paved) and trails (dirt)
// each has control points; they get smoothed into nice curves
const M = MOUNTAIN;
const polar = (a, r) => [M.x + Math.cos(a) * r, M.z + Math.sin(a) * r];
// the Summit Sprint trail winds round and round up Thunder Peak
const spiral = (() => {
  const pts = [[-112, 100], [-131, 122]];
  const a0 = Math.atan2(100 - M.z, -112 - M.x), turns = 1.6, n = 34; // a0 = start angle (towards town)
  for (let i = 0; i <= n; i++) { const k = i / n; pts.push(polar(a0 - k * turns * Math.PI * 2, 210 - 196 * k)); }
  pts.push([M.x, M.z]);
  return pts;
})();
// the Goat Trail: steep switchbacks straight up the north-west face (4x4s, ATVs and dirt bikes only!)
const goat = (() => {
  const ac = -2.25, R = [205, 168, 132, 98, 68, 42], L = R.length - 1, pts = [[-318, 26], [-360, 64], [-398, 104]];
  for (let k = 0; k < L; k++) {
    const d = k % 2 ? -1 : 1, ra = R[k], rb = R[k + 1], span = Math.min(1.5, 120 / ((ra + rb) / 2)) / 2;
    pts.push(polar(ac + d * span, ra - (k ? 9 : 0))); pts.push(polar(ac, (ra + rb) / 2)); pts.push(polar(ac - d * span, rb + (k < L - 1 ? 9 : 0)));
    // a wide hairpin turn (so the trail doesn't fold over itself)
    if (k < L - 1) pts.push(polar(ac - d * (span + 13 / rb), rb));
  }
  pts.push(polar(ac + 0.5, 26), polar(ac + 1.2, 16));
  return pts;
})();
export const MOUNTAIN_TRAIL = spiral;
// the Big Loop: a circle of points
const ring = Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return [Math.cos(a) * RING_R, Math.sin(a) * RING_R]; });
// the Frostpine Climb: winds round and round up Frostpine Peak
const frostClimb = (() => {
  const F = FROST, pts = [[40, -1300], [-60, -1400]], a0 = Math.atan2(-1400 - F.z, -60 - F.x), n = 30;
  for (let i = 0; i <= n; i++) { const k = i / n, a = a0 + k * 1.4 * Math.PI * 2, r = 220 - 205 * k; pts.push([F.x + Math.cos(a) * r, F.z + Math.sin(a) * r]); }
  return pts;
})();
const loopAround = (cx, cz, rx, rz, n, wob = 0.15, seed = 1) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = 1 + wob * Math.sin(i * 2.3 + seed); return [cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]; });

export const ROADS = [
  // town grid
  { pts: [[-116, 0], [116, 0]], w: 11, town: true, main: true },
  { pts: [[-116, -60], [116, -60]], w: 9, town: true },
  { pts: [[-116, 60], [116, 60]], w: 9, town: true },
  { pts: [[-70, -104], [-70, 104]], w: 9, town: true },
  { pts: [[0, -104], [0, 104]], w: 11, town: true, main: true },
  { pts: [[70, -104], [70, 104]], w: 9, town: true },
  { pts: [[-112, -100], [112, -100]], w: 8, town: true },
  { pts: [[-112, 100], [112, 100]], w: 8, town: true },
  { pts: [[-112, -100], [-112, 100]], w: 8, town: true },
  { pts: [[112, -100], [112, 100]], w: 8, town: true },
  // Copper Creek: Main Street + a cross street
  { pts: [[296, -318], [496, -318]], w: 12, town: true, main: true, cc: true },
  { pts: [[400, -366], [400, -270]], w: 9, town: true, cc: true },
  // highways out of town
  { pts: [[0, -100], [0, -150], [-4, -180], [-12, -205]], w: 10 }, // north to the speedway
  { pts: [[112, 0], [140, 2], [160, 0], [205, 0], [222, -6], [236, -8]], w: 10 }, // east over the bridge to the motocross park
  { pts: [[0, 100], [6, 140], [24, 180], [38, 210], [40, 222]], w: 10 }, // south to the farm
  { pts: [[-112, 0], [-150, -8], [-182, -30], [-198, -60], [-205, -92], [-210, -106]], w: 9 }, // west up to the mansion
  { pts: [[-112, 60], [-150, 60], [-192, 60]], w: 9 }, // Pine Street
  { pts: [[70, -100], [78, -135], [90, -158]], w: 9 }, // to the construction site
  // Route 9: from the motocross park up north to Copper Creek
  { pts: [[214, -4], [216, -60], [226, -120], [254, -190], [282, -262], [296, -318]], w: 10 },
  // the Valley Loop: a long highway all the way around (north + west, and east + south)
  { pts: [[296, -318], [240, -352], [160, -404], [40, -424], [-100, -426], [-240, -404], [-350, -346], [-418, -262], [-440, -150], [-412, -52], [-338, -12]], w: 10, name: "loopN" },
  { pts: [[496, -318], [498, -220], [486, -100], [474, 0], [446, 60], [396, 112], [388, 200], [410, 280], [380, 352], [280, 384], [170, 398], [80, 380], [50, 330], [48, 290]], w: 10, name: "loopS" },
  // the BIG LOOP + the 4 long roads out to it
  { pts: ring, w: 12, loop: true, name: "bigloop" },
  { pts: [[80, 700], [160, 690], [228, 680]], w: 10 }, // to the drift park
  ...SPOKES.map((s, i) => ({ pts: s, w: 11, name: "spoke" + i })),
  { pts: [[1282, -220], [1420, -120], [1500, 60], [1560, 260]], w: 9, name: "desertrd" }, // into the Red Rock Desert
];
export const TRAILS = [
  { pts: spiral, w: 7, name: "mountain" },
  { pts: goat, w: 6.5, name: "goat" },
  { pts: [[60, 238], [110, 228], [145, 212], [167, 205], [192, 200], [222, 192], [252, 168]], w: 7, ford: true }, // farm to the off-road park (through the river!)
  { pts: [[148, 2], [156, 40], [152, 80], [148, 112]], w: 6 }, // camper driveway
  { pts: [[-182, -30], [-225, -24], [-268, -12]], w: 7 }, // lumber yard
  { pts: [[252, 168], [262, 120], [300, 96], [334, 140], [338, 200], [318, 250], [270, 290], [226, 262], [214, 220], [222, 192]], w: 8, loop: true }, // off-road park loop
  { pts: [[300, 96], [302, 70], [300, 54]], w: 7 }, // off-road park to the motocross
  { pts: [[300, 140], [300, 150]], w: 6 }, // campground
  { pts: [[-165, 60], [-166, 74]], w: 5 }, // cabin driveway
  { pts: [[-138, 60], [-136, 50]], w: 5 }, // family house driveway
  { pts: [[40, 222], [40, 236], [52, 240]], w: 6 }, // farm yard
  { pts: [[338, 200], [380, 196], [420, 170]], w: 7 }, // off-road park to Lily Pond
  // Timber Ridge trails (north-west woods), past the robber hideout
  { pts: [[-350, -346], [-372, -400], [-430, -440], [-492, -420], [-498, -350], [-470, -300], [-432, -276]], w: 7, name: "timber" },
  { pts: [[-470, -300], [-430, -340], [-390, -330], [-350, -346]], w: 6 },
  // Canyon Run (south-east): a bumpy loop full of mud and jumps
  { pts: [[380, 352], [400, 394], [440, 420], [470, 460], [440, 498], [380, 500], [336, 470], [330, 420], [352, 384]], w: 8, loop: true, name: "canyon" },
  // ---- the new lands
  { pts: frostClimb, w: 8, name: "frost" }, // up Frostpine Peak
  { pts: loopAround(1150, 330, 210, 160, 14, 0.2, 1), w: 9, loop: true, name: "dunes" }, // Red Rock Desert dune loop
  { pts: [[1282, -220], [1220, -40], [1150, 170]], w: 8 }, // desert road to the dunes
  { pts: [[1560, 260], [1600, 500], [1500, 760], [1300, 900], [1150, 760], [1200, 490]], w: 8, name: "redrock" }, // Red Rock canyon trail
  { pts: loopAround(-1500, -450, 190, 230, 14, 0.18, 4), w: 7, loop: true, name: "woods" }, // Big Woods trails
  { pts: [[-1291, -150], [-1330, -240], [-1340, -300]], w: 7 },
  { pts: [[-1291, -150], [-1500, 60], [-1560, 300], [-1440, 520], [-1240, 640], [-1050, 700]], w: 7, name: "woods2" },
  { pts: [[80, 880], [-120, 900], [-300, 880], [-430, 880]], w: 8, name: "lake" }, // to Big Bass Lake
  { pts: loopAround(700, 1080, 200, 150, 14, 0.2, 7), w: 8, loop: true, name: "bayou" }, // Bayou Bog (mud everywhere!)
  { pts: [[80, 1000], [300, 1040], [500, 1080]], w: 8 },
  // Big Woods Single Track: a skinny, twisty dirt bike trail right through the trees
  { pts: [[-900, -128], [-905, -95], [-880, -60], [-850, -25], [-868, 12], [-910, 32], [-940, 70], [-915, 110], [-870, 130], [-832, 170], [-846, 215], [-890, 240], [-935, 266], [-960, 310], [-930, 350], [-880, 370], [-852, 410], [-892, 442], [-952, 432], [-1000, 400], [-1030, 352], [-1010, 302], [-1042, 252], [-1090, 232], [-1112, 182], [-1080, 132], [-1040, 100], [-1062, 50], [-1102, 20], [-1092, -30], [-1050, -70], [-1072, -105], [-1080, -128]], w: 3.2, name: "single" },
];
// Valley Drift Park: a wide paved course full of hairpins (south of the valley)
export const DRIFT_TRACK = [[240, 662], [330, 656], [418, 666], [432, 700], [402, 721], [352, 713], [322, 737], [362, 760], [424, 770], [420, 796], [330, 797], [250, 791], [228, 752], [270, 731], [262, 700], [234, 690]];

// mud pits {x, z, r}
export const MUDS = [
  { x: 262, z: 132, r: 9 }, { x: 330, z: 178, r: 10 }, { x: 242, z: 278, r: 8 }, { x: 196, z: 200, r: 6 },
  { x: 92, z: 232, r: 7 }, { x: 290, z: 236, r: 17 }, // the big Mud Bowl
  { x: -150, z: 132, r: 7 }, { x: 318, z: 42, r: 8 }, { x: 214, z: 236, r: 7 },
  { x: -470, z: -430, r: 9 }, { x: -496, z: -380, r: 7 }, { x: -380, z: -380, r: 8 }, // Timber Ridge
  { x: 470, z: 458, r: 11 }, { x: 384, z: 500, r: 8 }, { x: 330, z: 444, r: 9 }, { x: 410, z: 440, r: 14 }, // Canyon Run
  // Bayou Bog: the muddiest place in the world
  { x: 700, z: 1080, r: 26 }, { x: 560, z: 1000, r: 12 }, { x: 840, z: 1010, r: 13 }, { x: 880, z: 1140, r: 11 }, { x: 610, z: 1190, r: 14 }, { x: 760, z: 1200, r: 10 }, { x: 520, z: 1100, r: 9 },
  // Big Woods
  { x: -1500, z: -450, r: 15 }, { x: -1680, z: -420, r: 9 }, { x: -1420, z: -660, r: 10 }, { x: -1330, z: -300, r: 8 }, { x: -1520, z: 140, r: 9 },
];

// jumps {x, z, yaw, len, w, h}. yaw = the way you drive up it (every jump has a clear landing!)
export const RAMPS = [
  { x: 280, z: 210, yaw: 0.6, len: 9, w: 6, h: 2.4 }, { x: 305, z: 260, yaw: -2.2, len: 9, w: 6, h: 2.4 },
  { x: 268, z: 245, yaw: 2.4, len: 7, w: 5, h: 1.8 }, { x: 322, z: 116, yaw: 0.9, len: 9, w: 7, h: 2.8 },
  { x: 236, z: 156, yaw: -0.4, len: 8, w: 6, h: 2.2 },
  { x: -45, z: -122, yaw: Math.PI, len: 9, w: 7, h: 2.6 }, { x: -45, z: -172, yaw: Math.PI, len: 9, w: 7, h: 3.0 }, // stunt field north of town
  { x: 352, z: 440, yaw: 0.2, len: 9, w: 7, h: 2.6 }, { x: 452, z: 400, yaw: 2.6, len: 8, w: 6, h: 2.2 }, // Canyon Run
  { x: -440, z: -380, yaw: -0.4, len: 8, w: 6, h: 2.2 }, // Timber Ridge
  // Red Rock Desert: big sand jumps
  { x: 1000, z: 330, yaw: 0, len: 10, w: 8, h: 3.4 }, { x: 1150, z: 330, yaw: Math.PI / 2, len: 11, w: 8, h: 4.0 }, { x: 1250, z: 420, yaw: 2.2, len: 9, w: 7, h: 3.0 },
  { x: 1100, z: 230, yaw: -0.8, len: 9, w: 7, h: 2.8 }, { x: 1300, z: 300, yaw: -2.0, len: 12, w: 9, h: 4.6 },
  // Bayou Bog
  { x: 640, z: 1060, yaw: 1.2, len: 8, w: 6, h: 2.2 }, { x: 780, z: 1120, yaw: -2.0, len: 8, w: 6, h: 2.4 },
];

// ---------------------------------------------------------------- racetracks (closed loops / a point-to-point)
export const MOTO_TRACK = [
  [255, -50], [300, -57], [340, -52], [352, -28], [350, 10], [342, 34], [318, 42], [314, 10], [306, -14], [292, -20], [278, -12], [272, 14], [264, 40], [250, 30], [246, -5], [250, -35],
];
export const SPEEDWAY = [
  [-150, -262], [-140, -300], [-100, -318], [-20, -320], [40, -306], [100, -318], [135, -290], [130, -240], [90, -215], [30, -228], [-20, -212], [-80, -208], [-130, -224],
];

// ---------------------------------------------------------------- places you can go (spots to press E, map icons, job stops)
export const PLACES = {
  dealer: { name: "Valley Motors", x: -36, z: 29, icon: "🚗", color: "#3aa0ff" },
  customs: { name: "Mud & Chrome Customs", x: 36, z: -40, icon: "🔧", color: "#ff8a1a", r: 4 },
  parts: { name: "Valley Parts", x: 21.5, z: -27.5, icon: "🔩", color: "#2a9ad0", r: 3 },
  jobs: { name: "Job Center", x: -36, z: -30, icon: "💼", color: "#ffd23a" },
  post: { name: "Post Office", x: 22, z: 14, icon: "📦", color: "#c08a50" },
  pizza: { name: "Pizza Pete’s", x: 51, z: 14, icon: "🍕", color: "#ff5a3a" },
  wash: { name: "Car Wash", x: 91, z: -19, icon: "🫧", color: "#6ad8ff", r: 6 },
  lot: { name: "Town Parking", x: -90, z: 14, icon: "🅿️", color: "#7a8aa0" },
  diner: { name: "Mud Valley Diner", x: 92, z: 14, icon: "🍔", color: "#ff6a8a" },
  townhall: { name: "Town Hall", x: -90, z: -14, icon: "🏛️", color: "#c0c0c0" },
  moto: { name: "Motocross Park", x: 238, z: -14, icon: "🏁", color: "#c87a3a", r: 7 },
  speedway: { name: "Valley Speedway", x: -14, z: -198, icon: "🏎️", color: "#ff3a5a", r: 7 },
  summit: { name: "Summit Sprint", x: -122, z: 114, icon: "⛰️", color: "#5ad87a", r: 7 },
  ranger: { name: "Ranger Station", x: -290, z: 300, icon: "🌲", color: "#4aa860" },
  lookout: { name: "Thunder Peak Lookout", x: -280, z: 312, icon: "🔭", color: "#a0e0ff" },
  farm: { name: "Sunny Farm", x: 54, z: 236, icon: "🌾", color: "#e0c040" },
  lumber: { name: "Lumber Yard", x: -284, z: -10, icon: "🪵", color: "#a8703a" },
  build: { name: "Construction Site", x: 92, z: -160, icon: "🏗️", color: "#ffb020" },
  camp: { name: "Campground", x: 300, z: 142, icon: "⛺", color: "#5aa0ff" },
  dock: { name: "River Fishing Dock", x: 150, z: -40, icon: "🎣", color: "#4ac0e0" },
  mudbowl: { name: "Mud Bowl", x: 270, z: 228, icon: "🟤", color: "#7a5030" },
  // Copper Creek
  copper: { name: "Copper Creek", x: 452, z: -318, icon: "🏙️", color: "#e08a4a" },
  police: { name: "Police Station", x: 440, z: -332, icon: "👮", color: "#3a6aff", r: 6 },
  gear: { name: "Tool Barn (Gear Shop)", x: 330, z: -308, icon: "🧰", color: "#e0a030" },
  blasters: { name: "Gun Shop", x: 366, z: -308, icon: "🔫", color: "#d04030" },
  bank: { name: "Copper Creek Bank", x: 330, z: -332, icon: "🏦", color: "#4ad08a" },
  jewelry: { name: "Sparkle Jewelry", x: 366, z: -331, icon: "💎", color: "#6af0ff" },
  hospital: { name: "Hospital", x: 484, z: -331, icon: "🏥", color: "#ff6a6a" },
  // fishing + hideout + trails
  bait: { name: "Bait & Tackle", x: 408, z: 132, icon: "🪱", color: "#4ac0e0" },
  pond: { name: "Lily Pond", x: 452, z: 140, icon: "🎣", color: "#4ac0e0" },
  hideout: { name: "Robber Hideout", x: -458, z: -262, icon: "🎭", color: "#9a6aff" },
  timber: { name: "Timber Ridge Trails", x: -470, z: -420, icon: "🌲", color: "#3a8a4a" },
  canyon: { name: "Canyon Run", x: 400, z: 470, icon: "🏜️", color: "#d08a4a" },
  // the new lands
  desert: { name: "Red Rock Desert", x: 1150, z: 330, icon: "🌵", color: "#e07a3a" },
  frost: { name: "Frostpine Peak", x: -350, z: -1560, icon: "🏔️", color: "#cfe8ff" },
  woods: { name: "Big Woods Trails", x: -1500, z: -450, icon: "🌲", color: "#2a7a3a" },
  lake: { name: "Big Bass Lake", x: -450, z: 880, icon: "🎣", color: "#4ac0e0" },
  bayou: { name: "Bayou Bog", x: 700, z: 1080, icon: "🐊", color: "#6a5030" },
  bigloop: { name: "Big Loop Highway", x: 0, z: -1300, icon: "🛣️", color: "#8a8a8a" },
  single: { name: "Big Woods Single Track", x: -900, z: -128, icon: "🌲", color: "#5ad87a", r: 6 },
  drift: { name: "Valley Drift Park", x: 240, z: 662, icon: "💨", color: "#ff5ad8", r: 7 },
  goat: { name: "Goat Trail (4x4)", x: -360, z: 64, icon: "🐐", color: "#b0b0b0" },
  // pawn shops all around the map (sell the stuff in your backpack: npcs.js)
  pawn0: { name: "Pawn Shop (North of Town)", x: -31, z: -106, icon: "💰", color: "#d0a030" },
  pawn1: { name: "Pawn Shop (South Road)", x: 96, z: 396, icon: "💰", color: "#d0a030" },
  pawn2: { name: "Pawn Shop (East Road)", x: 445, z: 50, icon: "💰", color: "#d0a030" },
  pawn3: { name: "Pawn Shop (West Road)", x: -430, z: -64, icon: "💰", color: "#d0a030" },
  pawn4: { name: "Pawn Shop (Timber Ridge Road)", x: -246, z: -411, icon: "💰", color: "#d0a030" },
  pawn5: { name: "Pawn Shop (North Road)", x: 23, z: -434, icon: "💰", color: "#d0a030" },
};
// where the pawn shops stand (building middle; the front faces yaw, towards the road)
export const PAWNS = [{ x: -31, z: -115, yaw: 0, area: "North of Town" }, { x: 93, z: 405, yaw: 2.827, area: "South Road" }, { x: 438, z: 45, yaw: 0.982, area: "East Road" }, { x: -438, z: -60, yaw: 2.032, area: "West Road" }, { x: -249, z: -420, yaw: 0.323, area: "Timber Ridge Road" }, { x: 24, z: -443, yaw: -0.068, area: "North Road" }];

// houses for sale. slots = how many vehicles you can own while you have it. yaw = which way the front door faces.
// build = which model (camper, cabin, family, farm, mansion, small). You can walk in and take a tour before you buy!
export const HOUSES = [
  { id: "lot", name: "Town Parking Spot", price: 0, slots: 3, x: -96, z: 38, yaw: Math.PI, garage: { x: -90, z: 22 }, desc: "A free parking spot in town. It’s a start!" },
  { id: "trailer3", name: "Trailer #3, Sunny Trailer Park", build: "camper", price: 1500, slots: 4, x: 252, z: -150, yaw: -Math.PI / 2, garage: { x: 238, z: -142 }, desc: "A tiny trailer next to Route 9. Cheap and cheerful!" },
  { id: "trailer7", name: "Trailer #7, Sunny Trailer Park", build: "camper", price: 1800, slots: 4, x: 252, z: -126, yaw: -Math.PI / 2, garage: { x: 238, z: -118 }, desc: "The trailer with the pink flamingo. The neighbors are friendly." },
  { id: "camper", name: "Rusty Camper", build: "camper", price: 2500, slots: 4, x: 146, z: 132, yaw: Math.PI, garage: { x: 152, z: 118 }, desc: "An old camper by the river. It’s a bit rusty... but it’s YOURS." },
  { id: "cottage", name: "Riverside Cottage", build: "small", look: 1, price: 8000, slots: 5, x: 214, z: 52, yaw: -Math.PI / 2, garage: { x: 205, z: 66 }, desc: "A sweet little cottage on the east side of the river." },
  { id: "cabin", name: "Log Cabin", build: "cabin", price: 12000, slots: 6, x: -166, z: 86, yaw: Math.PI, garage: { x: -156, z: 72 }, desc: "A cozy log cabin on Pine Street with a little garage." },
  { id: "mtncabin", name: "Mountain Cabin", build: "cabin", price: 16000, slots: 6, x: -436, z: 132, yaw: 0.9, garage: { x: -418, z: 146 }, desc: "A log cabin at the bottom of the Goat Trail, right under Thunder Peak." },
  { id: "copper4", name: "4 Copper Lane", build: "small", look: 2, price: 18000, slots: 6, x: 470, z: -290, yaw: Math.PI, garage: { x: 466, z: -276 }, desc: "A starter home in the suburbs of Copper Creek." },
  { id: "copper11", name: "11 Copper Lane", build: "small", look: 5, price: 22000, slots: 7, x: 486, z: -290, yaw: Math.PI, garage: { x: 490, z: -276 }, desc: "A bigger house in Copper Creek, close to all the shops." },
  { id: "family", name: "Family House", build: "family", price: 35000, slots: 8, x: -138, z: 38, yaw: 0, garage: { x: -126, z: 52 }, desc: "A nice two-story house with a 2-car garage and a pool." },
  { id: "lake", name: "Lily Pond Lake House", build: "family", price: 45000, slots: 9, x: 468, z: 92, yaw: Math.PI * 0.85, garage: { x: 486, z: 74 }, desc: "Wake up next to the pond. Fishing from your back yard!" },
  { id: "farm", name: "Big Red Farmhouse", build: "farm", price: 60000, slots: 10, x: 28, z: 256, yaw: Math.PI, garage: { x: 62, z: 240 }, desc: "A big farm with a red barn. Lots of room for trucks and trailers!" },
  { id: "ranch", name: "Big Sky Ranch", build: "farm", price: 75000, slots: 12, x: 226, z: 336, yaw: 0, garage: { x: 246, z: 350 }, desc: "A huge ranch way out south, next to Canyon Run. Room for a whole fleet!" },
  { id: "mansion", name: "Hilltop Mansion", build: "mansion", price: 100000, slots: 14, x: -206, z: -132, yaw: 0, garage: { x: -226, z: -117 }, desc: "The best house in Mud Valley! Glass walls, a pool, a giant garage and the best view." },
  { id: "peak", name: "Timber Ridge Mega Mansion", build: "mansion", price: 150000, slots: 18, x: -310, z: -206, yaw: 0, garage: { x: -330, z: -191 }, desc: "The biggest house of all, hidden in the woods. The ultimate garage!" },
];
// little houses in town where packages and pizzas go
export const ADDRESSES = [
  { name: "12 Maple Lane", x: -40, z: 70 }, { name: "18 Maple Lane", x: -18, z: 70 }, { name: "5 Oak Street", x: 40, z: 70 },
  { name: "9 Oak Street", x: 18, z: 70 }, { name: "3 Birch Road", x: 90, z: 70 }, { name: "7 Cedar Court", x: -90, z: 70 },
  { name: "22 Elm Street", x: -40, z: -70 }, { name: "30 Elm Street", x: 40, z: -70 },
  { name: "4 Copper Lane", x: 470, z: -296 }, { name: "11 Copper Lane", x: 484, z: -296 },
];
// cash machines (robbers can pry them open with a crowbar)
export const ATMS = [
  { x: 10, z: 9, yaw: Math.PI }, { x: 346, z: -331, yaw: 0 }, { x: 108, z: 9, yaw: -Math.PI / 2 }, { x: 292, z: 158, yaw: Math.PI },
];
