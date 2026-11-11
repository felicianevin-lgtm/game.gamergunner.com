// MUD VALLEY RP: the map plan. Where the town, roads, trails, river, mud pits, jumps, houses and racetracks are.
// x goes east, z goes south (on the map, up = -z). The town is in the middle at (0, 0). The world is 800 x 800 meters.

export const HALF = 400; // the world goes from -400 to 400
export const WATER_Y = -1.2; // the river's water level

// a curvy river from the top of the map to the bottom
export const riverX = (z) => 175 + 16 * Math.sin(z / 60) + 7 * Math.sin(z / 23 + 1);
export const RIVER_W = 11; // half the river's width
export const FORD_Z = 205; // the shallow place where trails cross the river

// the big mountain (Ranger Station on top) and the mansion hill
export const MOUNTAIN = { x: -200, z: 230, h: 75, s: 85 };
export const MANSION_HILL = { x: -215, z: -128, h: 18, s: 50 };

// flat areas (town, speedway, farm...). y: null means "flatten at whatever height the hill has there"
export const FLATS = [
  { x: 0, z: 0, hx: 116, hz: 106, y: 1, b: 30 }, // town
  { x: -20, z: -262, hx: 168, hz: 74, y: 2, b: 30 }, // speedway
  { x: 300, z: -8, hx: 60, hz: 60, y: 4, b: 26 }, // motocross park
  { x: 40, z: 245, hx: 58, hz: 42, y: 2.5, b: 26 }, // farm
  { x: -300, z: -10, hx: 38, hz: 32, y: 3, b: 20 }, // lumber yard
  { x: 95, z: -175, hx: 32, hz: 28, y: 2, b: 20 }, // construction site
  { x: -215, z: -125, hx: 26, hz: 22, y: null, b: 16 }, // mansion hilltop
  { x: -200, z: 230, hx: 13, hz: 13, y: null, b: 12 }, // mountain top (Ranger Station)
  { x: 147, z: 128, hx: 16, hz: 14, y: null, b: 14 }, // camper spot
  { x: -150, z: 60, hx: 45, hz: 36, y: 1.2, b: 22 }, // Pine Street (houses)
  { x: 300, z: 150, hx: 12, hz: 10, y: null, b: 12 }, // campground
];

// ---------------------------------------------------------------- roads (paved) and trails (dirt)
// each has control points; they get smoothed into nice curves
const spiral = (() => {
  // the mountain trail winds round and round up to the top
  const pts = [[-112, 100], [-124, 117]];
  const C = MOUNTAIN, a0 = Math.atan2(-100, 67), turns = 1.3, n = 26; // a0 = start angle (towards town)
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = a0 - k * turns * Math.PI * 2, r = 118 - 106 * k;
    pts.push([C.x + Math.cos(a) * r, C.z + Math.sin(a) * r]);
  }
  pts.push([C.x, C.z]);
  return pts;
})();
export const MOUNTAIN_TRAIL = spiral;

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
  // highways out of town
  { pts: [[0, -100], [0, -150], [-4, -180], [-12, -205]], w: 10 }, // north to the speedway
  { pts: [[112, 0], [140, 2], [160, 0], [205, 0], [222, -6], [236, -8]], w: 10 }, // east over the bridge to the motocross park
  { pts: [[0, 100], [6, 140], [24, 180], [38, 210], [40, 222]], w: 10 }, // south to the farm
  { pts: [[-112, 0], [-150, -8], [-182, -30], [-198, -60], [-205, -92], [-210, -106]], w: 9 }, // west up to the mansion
  { pts: [[-112, 60], [-150, 60], [-192, 60]], w: 9 }, // Pine Street
  { pts: [[70, -100], [78, -135], [90, -158]], w: 9 }, // to the construction site
];
export const TRAILS = [
  { pts: spiral, w: 7, name: "mountain" },
  { pts: [[60, 238], [110, 228], [145, 212], [167, 205], [192, 200], [222, 192], [252, 168]], w: 7, ford: true }, // farm to the off-road park (through the river!)
  { pts: [[148, 2], [156, 40], [152, 80], [148, 112]], w: 6 }, // camper driveway
  { pts: [[-182, -30], [-225, -24], [-268, -12]], w: 7 }, // lumber yard
  { pts: [[252, 168], [262, 120], [300, 96], [334, 140], [338, 200], [318, 250], [270, 290], [226, 262], [214, 220], [222, 192]], w: 8, loop: true }, // off-road park loop
  { pts: [[300, 96], [302, 70], [300, 54]], w: 7 }, // off-road park to the motocross
  { pts: [[300, 140], [300, 150]], w: 6 }, // campground
  { pts: [[-165, 60], [-166, 74]], w: 5 }, // cabin driveway
  { pts: [[-138, 60], [-136, 50]], w: 5 }, // family house driveway
  { pts: [[40, 222], [40, 236], [52, 240]], w: 6 }, // farm yard
];

// mud pits {x, z, r}
export const MUDS = [
  { x: 262, z: 132, r: 9 }, { x: 330, z: 178, r: 10 }, { x: 242, z: 278, r: 8 }, { x: 196, z: 200, r: 6 },
  { x: 92, z: 232, r: 7 }, { x: 290, z: 236, r: 17 }, // the big Mud Bowl
  { x: -150, z: 132, r: 7 }, { x: 318, z: 42, r: 8 }, { x: 214, z: 236, r: 7 },
];

// jumps {x, z, yaw, len, w, h}. yaw = the way you drive up it
export const RAMPS = [
  { x: 280, z: 210, yaw: 0.6, len: 9, w: 6, h: 2.4 }, { x: 305, z: 260, yaw: -2.2, len: 9, w: 6, h: 2.4 },
  { x: 268, z: 245, yaw: 2.4, len: 7, w: 5, h: 1.8 }, { x: 322, z: 116, yaw: 0.9, len: 9, w: 7, h: 2.8 },
  { x: 236, z: 156, yaw: -0.4, len: 8, w: 6, h: 2.2 },
  { x: -45, z: -122, yaw: Math.PI, len: 9, w: 7, h: 2.6 }, { x: -45, z: -172, yaw: Math.PI, len: 9, w: 7, h: 3.0 }, // stunt field north of town
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
  dealer: { name: "Valley Motors", x: -36, z: -10, icon: "🚗", color: "#3aa0ff", r: 7 },
  customs: { name: "Mud & Chrome Customs", x: 36, z: -14, icon: "🔧", color: "#ff8a1a", r: 6 },
  jobs: { name: "Job Center", x: -36, z: 14, icon: "💼", color: "#ffd23a", r: 7 },
  post: { name: "Post Office", x: 22, z: 14, icon: "📦", color: "#c08a50" },
  pizza: { name: "Pizza Pete's", x: 51, z: 14, icon: "🍕", color: "#ff5a3a" },
  wash: { name: "Car Wash", x: 91, z: -19, icon: "🫧", color: "#6ad8ff", r: 6 },
  lot: { name: "Town Parking", x: -90, z: 14, icon: "🅿️", color: "#7a8aa0" },
  diner: { name: "Mud Valley Diner", x: 92, z: 14, icon: "🍔", color: "#ff6a8a" },
  townhall: { name: "Town Hall", x: -90, z: -14, icon: "🏛️", color: "#c0c0c0" },
  moto: { name: "Motocross Park", x: 238, z: -14, icon: "🏁", color: "#c87a3a", r: 7 },
  speedway: { name: "Valley Speedway", x: -14, z: -198, icon: "🏎️", color: "#ff3a5a", r: 7 },
  summit: { name: "Summit Sprint", x: -118, z: 106, icon: "⛰️", color: "#5ad87a", r: 7 },
  ranger: { name: "Ranger Station", x: -192, z: 236, icon: "🌲", color: "#4aa860" },
  farm: { name: "Sunny Farm", x: 54, z: 236, icon: "🌾", color: "#e0c040" },
  lumber: { name: "Lumber Yard", x: -284, z: -10, icon: "🪵", color: "#a8703a" },
  build: { name: "Construction Site", x: 92, z: -160, icon: "🏗️", color: "#ffb020" },
  camp: { name: "Campground", x: 300, z: 142, icon: "⛺", color: "#5aa0ff" },
  dock: { name: "Fishing Dock", x: 150, z: -40, icon: "🎣", color: "#4ac0e0" },
  mudbowl: { name: "Mud Bowl", x: 270, z: 228, icon: "🟤", color: "#7a5030" },
};

// houses for sale. slots = how many vehicles you can own while you have it. yaw = which way the front door faces
export const HOUSES = [
  { id: "lot", name: "Town Parking Spot", price: 0, slots: 3, x: -96, z: 38, yaw: Math.PI, garage: { x: -90, z: 22 }, desc: "A free parking spot in town. It's a start!" },
  { id: "camper", name: "Rusty Camper", price: 2500, slots: 4, x: 146, z: 132, yaw: Math.PI, garage: { x: 152, z: 118 }, desc: "An old camper by the river. It's a bit rusty... but it's YOURS." },
  { id: "cabin", name: "Log Cabin", price: 12000, slots: 6, x: -166, z: 86, yaw: Math.PI, garage: { x: -156, z: 72 }, desc: "A cozy log cabin on Pine Street with a little garage." },
  { id: "family", name: "Family House", price: 35000, slots: 8, x: -138, z: 38, yaw: 0, garage: { x: -126, z: 52 }, desc: "A nice two-story house with a 2-car garage and a pool." },
  { id: "farm", name: "Big Red Farmhouse", price: 60000, slots: 10, x: 28, z: 256, yaw: Math.PI, garage: { x: 62, z: 240 }, desc: "A big farm with a red barn. Lots of room for trucks and trailers!" },
  { id: "mansion", name: "Hilltop Mansion", price: 100000, slots: 14, x: -206, z: -132, yaw: 0, garage: { x: -226, z: -117 }, desc: "The best house in Mud Valley! Glass walls, a pool, a giant garage and the best view." },
];
// little houses in town where packages and pizzas go
export const ADDRESSES = [
  { name: "12 Maple Lane", x: -40, z: 70 }, { name: "18 Maple Lane", x: -18, z: 70 }, { name: "5 Oak Street", x: 40, z: 70 },
  { name: "9 Oak Street", x: 18, z: 70 }, { name: "3 Birch Road", x: 90, z: 70 }, { name: "7 Cedar Court", x: -90, z: 70 },
  { name: "22 Elm Street", x: -40, z: -70 }, { name: "30 Elm Street", x: 40, z: -70 },
];
