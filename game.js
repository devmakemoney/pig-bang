// ============================================================
// PIG BANG - Recoil-based barn shooter
// ============================================================

// --- Scene setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1a0a);
scene.fog = new THREE.FogExp2(0x2a1a0a, 0.015);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 28, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const dirLight = new THREE.DirectionalLight(0xffd890, 0.8);
dirLight.position.set(5, 15, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 40;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);
scene.add(new THREE.PointLight(0xff8800, 0.5, 30).translateY(8));

// --- Constants ---
let arenaW = 22, arenaD = 22;
const WALL_H = 6;
const FARMER_BASE_SPEED = 2.5;
const FARMER_DAMAGE = 10;
let arenaGroup = new THREE.Group();
scene.add(arenaGroup);
let ambientLight = new THREE.AmbientLight(0xffa54f, 0.4);
scene.add(ambientLight);

// ============================================================
// ZONE SYSTEM
// ============================================================
const ZONES = [
  {
    id: 'barn', name: 'THE BARN', waves: [1, 5],
    arenaW: 22, arenaD: 22,
    bg: 0x2a1a0a, fogColor: 0x2a1a0a, fogDensity: 0.015,
    ambientColor: 0xffa54f, ambientIntensity: 0.4,
    sunColor: 0xffd890, sunIntensity: 0.8,
    cameraY: 28, cameraZ: 8,
    entityScale: 1.0,
    enemyTypes: ['farmer'],
    bossName: 'BUTCHER BOSS',
  },
  {
    id: 'forest', name: 'THE DARK FOREST', waves: [6, 10],
    arenaW: 28, arenaD: 28,
    bg: 0x0a1a0a, fogColor: 0x0a2a0a, fogDensity: 0.012,
    ambientColor: 0x66aa55, ambientIntensity: 0.35,
    sunColor: 0xaaccaa, sunIntensity: 0.6,
    cameraY: 28, cameraZ: 8,
    entityScale: 1.25, // Scale up characters so they look same size on bigger map
    enemyTypes: ['hunter', 'dog', 'bear'],
    bossName: 'GRIZZLY KING',
  },
];

function getZone() {
  for (const z of ZONES) {
    if (state.wave >= z.waves[0] && state.wave <= z.waves[1]) return z;
  }
  return ZONES[ZONES.length - 1];
}

function getZoneIndex() {
  for (let i = 0; i < ZONES.length; i++) {
    if (state.wave >= ZONES[i].waves[0] && state.wave <= ZONES[i].waves[1]) return i;
  }
  return ZONES.length - 1;
}

function applyZoneLighting(zone) {
  scene.background = new THREE.Color(zone.bg);
  scene.fog = new THREE.FogExp2(zone.fogColor, zone.fogDensity);
  ambientLight.color.setHex(zone.ambientColor);
  ambientLight.intensity = zone.ambientIntensity;
  dirLight.color.setHex(zone.sunColor);
  dirLight.intensity = zone.sunIntensity;
  cameraBasePos.set(0, zone.cameraY, zone.cameraZ);
}
const BASE_HEALTH = 100;
const BOOSTED_HEALTH = 130; // After wave 5
let MAX_HEALTH = BASE_HEALTH;

// ============================================================
// WEAPONS DEFINITION - 10 weapons, one per wave
// ============================================================
const WEAPONS = [
  { // Wave 1 - SHOTGUN
    name: 'SHOTGUN',
    desc: 'Spread shot - classic barnyard chaos',
    color: '#ff8800',
    bulletColor: 0xFFFF00,
    recoil: 16,
    cooldown: 0.35,
    bulletSpeed: 35,
    bulletSize: 0.1,
    knockback: 8,
    damage: 1,
    spread: 5,        // number of pellets
    spreadAngle: 0.25, // radian spread
    pierce: false,
    bounce: 0,
    explosive: 0,
    bulletLife: 0.8,
    gunColor: 0x333333,
    gunLength: 1.4,
    gunRadius: 0.06,
    shake: 0.4,
    sound: 'shotgun',
  },
  { // Wave 2 - BAZOOKA
    name: 'BAZOOKA',
    desc: 'Massive explosion - INSANE recoil',
    color: '#ff2200',
    bulletColor: 0xFF4400,
    recoil: 35,       // HUGE
    cooldown: 1.0,
    bulletSpeed: 18,
    bulletSize: 0.25,
    knockback: 15,
    damage: 3,
    spread: 1,
    spreadAngle: 0,
    pierce: false,
    bounce: 0,
    explosive: 4.5,   // explosion radius
    bulletLife: 2.0,
    gunColor: 0x556B2F,
    gunLength: 1.8,
    gunRadius: 0.12,
    shake: 1.0,
    sound: 'boom',
  },
  { // Wave 3 - RICOCHET PISTOL
    name: 'RICOCHET PISTOL',
    desc: 'Bullets bounce off walls 4 times!',
    color: '#00ccff',
    bulletColor: 0x00FFFF,
    recoil: 8,
    cooldown: 0.2,
    bulletSpeed: 30,
    bulletSize: 0.08,
    knockback: 5,
    damage: 1,
    spread: 1,
    spreadAngle: 0,
    pierce: false,
    bounce: 4,
    explosive: 0,
    bulletLife: 3.0,
    gunColor: 0x4488AA,
    gunLength: 1.0,
    gunRadius: 0.04,
    shake: 0.2,
    sound: 'pew',
  },
  { // Wave 4 - RAIL GUN
    name: 'RAIL GUN',
    desc: 'Pierces through ALL enemies in a line',
    color: '#ff00ff',
    bulletColor: 0xFF00FF,
    recoil: 22,
    cooldown: 0.6,
    bulletSpeed: 60,
    bulletSize: 0.06,
    knockback: 12,
    damage: 2,
    spread: 1,
    spreadAngle: 0,
    pierce: true,
    bounce: 0,
    explosive: 0,
    bulletLife: 1.0,
    gunColor: 0x8800AA,
    gunLength: 2.0,
    gunRadius: 0.04,
    shake: 0.6,
    sound: 'zap',
    trail: true,
  },
  { // Wave 5 - GRENADE LAUNCHER
    name: 'GRENADE LAUNCHER',
    desc: 'Bouncing grenades - delayed boom',
    color: '#88cc00',
    bulletColor: 0x88CC00,
    recoil: 24,
    cooldown: 0.55,
    bulletSpeed: 18,
    bulletSize: 0.2,
    knockback: 12,
    damage: 3,
    spread: 1,
    spreadAngle: 0,
    pierce: false,
    bounce: 3,
    explosive: 4.0,
    bulletLife: 2.5,
    gunColor: 0x556B2F,
    gunLength: 1.2,
    gunRadius: 0.08,
    shake: 0.5,
    sound: 'thump',
    grenade: true,
  },
  { // Wave 6 - BLUNDERBUSS
    name: 'BLUNDERBUSS',
    desc: '3 heavy slugs that plow through brush',
    color: '#cc6633',
    bulletColor: 0x886644,
    recoil: 20,
    cooldown: 0.5,
    bulletSpeed: 25,
    bulletSize: 0.18,
    knockback: 10,
    damage: 2,
    spread: 3,
    spreadAngle: 0.18,
    pierce: true,
    bounce: 0,
    explosive: 0,
    bulletLife: 1.2,
    gunColor: 0x5C3317,
    gunLength: 1.6,
    gunRadius: 0.08,
    shake: 0.6,
    sound: 'shotgun',
  },
  { // Wave 7 - DYNAMITE
    name: 'DYNAMITE',
    desc: 'Sticks to first enemy - BOOM after 1.5s',
    color: '#ff3300',
    bulletColor: 0xFF4400,
    recoil: 30,
    cooldown: 0.9,
    bulletSpeed: 22,
    bulletSize: 0.2,
    knockback: 14,
    damage: 4,
    spread: 1,
    spreadAngle: 0,
    pierce: false,
    bounce: 0,
    explosive: 4.5,
    bulletLife: 3.0,
    gunColor: 0x8B4513,
    gunLength: 1.0,
    gunRadius: 0.07,
    shake: 0.7,
    sound: 'thump',
    sticky: true,     // sticks to first enemy, explodes after delay
    stickyDelay: 1.5,
  },
  { // Wave 8 - SLINGSHOT
    name: 'SLINGSHOT',
    desc: 'Rocks ricochet between enemies!',
    color: '#aa8855',
    bulletColor: 0x888888,
    recoil: 6,
    cooldown: 0.2,
    bulletSpeed: 35,
    bulletSize: 0.1,
    knockback: 5,
    damage: 1,
    spread: 1,
    spreadAngle: 0.08,
    pierce: false,
    bounce: 0,
    explosive: 0,
    bulletLife: 2.0,
    gunColor: 0x5C3317,
    gunLength: 0.6,
    gunRadius: 0.03,
    shake: 0.15,
    sound: 'pew',
    enemyBounce: 4,  // bounces between enemies
  },
  { // Wave 9 - CROSSBOW
    name: 'CROSSBOW',
    desc: 'Slow bolt that pulls enemies to impact!',
    color: '#8B4513',
    bulletColor: 0x8B6914,
    recoil: 18,
    cooldown: 1.0,
    bulletSpeed: 18,
    bulletSize: 0.08,
    knockback: 0,
    damage: 2,
    spread: 1,
    spreadAngle: 0,
    pierce: false,
    bounce: 0,
    explosive: 0,
    bulletLife: 2.0,
    gunColor: 0x5C3317,
    gunLength: 1.4,
    gunRadius: 0.04,
    shake: 0.5,
    sound: 'zap',
    trail: true,
    vortex: true,        // creates pull-in vortex on impact
    vortexRadius: 5,
    vortexDuration: 2.0,
  },
  { // Wave 10 - BEAR TRAP LAUNCHER (BOSS)
    name: 'BEAR TRAP',
    desc: 'Lay traps - enemies step on them = stuck + damage',
    color: '#666666',
    bulletColor: 0x888888,
    recoil: 10,
    cooldown: 0.4,
    bulletSpeed: 20,
    bulletSize: 0.15,
    knockback: 0,
    damage: 2,
    spread: 1,
    spreadAngle: 0.1,
    pierce: false,
    bounce: 0,
    explosive: 0,
    bulletLife: 0.6,
    gunColor: 0x444444,
    gunLength: 1.2,
    gunRadius: 0.06,
    shake: 0.3,
    sound: 'thump',
    trap: true,          // bullet becomes a floor trap
    trapDuration: 12,
    trapDamage: 3,
  },
];

function getWeapon() {
  const idx = Math.min(state.wave - 1, WEAPONS.length - 1);
  return WEAPONS[idx];
}

// ============================================================
// SPECIAL POWERS - Unlocked by beating bosses
// ============================================================
const POWERS = [
  {
    id: 'pigfart', name: 'PIG FART', emoji: '\u{1F4A8}',
    desc: 'Blast all enemies to the edges!',
    color: '#88cc00', unlockedAtWave: 6,
  },
  {
    id: 'warcry', name: 'WAR CRY', emoji: '\u{1F4E2}',
    desc: 'Petrify all enemies for 3s!',
    color: '#ff8800', unlockedAtWave: 11,
  },
];

function getActivePower() {
  // Return the latest unlocked power
  for (let i = POWERS.length - 1; i >= 0; i--) {
    if (state.powers.includes(POWERS[i].id)) return POWERS[i];
  }
  return null;
}

function activatePower() {
  if (state.powerCharge < 100 || !state.alive) return;
  const power = getActivePower();
  if (!power) return;

  state.powerCharge = 0;
  state.powerReady = false;
  state.powerCooldown = 3; // 3s before recharge starts

  if (power.id === 'pigfart') {
    // PUSH all enemies to edges + small damage + funny cloud
    playSound('boom');
    shakeAmount = 0.8;

    // Green stink cloud particles
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const speed = 8 + Math.random() * 4;
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 6, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.25 + Math.random() * 0.1, 0.8, 0.4), transparent: true, opacity: 0.7 })
      );
      p.position.copy(pig.position);
      p.position.y += 0.8;
      p.userData = {
        vel: new THREE.Vector3(Math.cos(angle) * speed, 1 + Math.random() * 2, Math.sin(angle) * speed),
        life: 1.2 + Math.random() * 0.5,
      };
      scene.add(p);
      particles.push(p);
    }

    // Push all farmers to edges
    farmers.forEach(f => {
      const dir = new THREE.Vector3().subVectors(f.position, pig.position).setY(0);
      const dist = dir.length();
      if (dist < 0.1) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      dir.normalize();
      // Strong push to edges
      const pushForce = 30;
      f.userData.knockback.add(dir.multiplyScalar(pushForce));
      // Small damage
      f.userData.health -= 1;
      if (f.userData.health <= 0) {
        spawnFarmerDeath(f.position);
        playSound('death');
        const wasBoss = f.userData.isBoss;
        if (wasBoss) { boss = null; bossBarContainer.style.display = 'none'; state.score += 100 * state.wave; }
        else { state.score += 10 * state.wave; }
        scene.remove(f);
        farmers.splice(farmers.indexOf(f), 1);
        scoreEl.textContent = `Score: ${state.score}`;
      }
    });

    // Show power name
    waveAnnounce.innerHTML = `<div class="wave-num" style="font-size:40px;color:#88cc00">PIG FART!</div>`;
    waveAnnounce.style.display = 'block';
    setTimeout(() => { waveAnnounce.style.display = 'none'; }, 1000);
  }
  else if (power.id === 'warcry') {
    // Freeze all enemies for 3 seconds
    playSound('zap');
    shakeAmount = 0.5;
    farmers.forEach(f => {
      f.userData.frozen = 3.0;
      f.userData.frozenSlow = 0;
      f.children.forEach(c => {
        if (c.material && c.material.emissive) {
          c.material.emissive.setHex(0xff8800);
          c.material.emissiveIntensity = 0.6;
        }
      });
    });
    waveAnnounce.innerHTML = `<div class="wave-num" style="font-size:40px;color:#ff8800">WAR CRY!</div>`;
    waveAnnounce.style.display = 'block';
    setTimeout(() => { waveAnnounce.style.display = 'none'; }, 1000);
  }

  updatePowerUI();
}

// --- Game state ---
const MAX_LIVES = 3;

let state = {
  score: 0,
  wave: 1,
  lives: MAX_LIVES,
  health: MAX_HEALTH,
  alive: true,
  shootTimer: 0,
  waveTimer: 0,
  waveFarmerCount: 4,
  farmersSpawned: 0,
  spawnTimer: 0,
  spawnInterval: 2,
  waveActive: false,
  mouseDown: false,
  checkpoint: 1,
  // Special powers
  powers: [],          // list of unlocked power ids
  powerCharge: 0,      // 0-100
  powerChargeRate: 4,  // charge per second
  powerReady: false,
  powerCooldown: 0,    // time after use before recharge starts
};

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let farmers = [];
let bullets = [];
let particles = [];
let feathers = [];
let blackholes = [];
let lightningBolts = []; // visual only
let damageFlashTimer = 0;

// --- UI refs ---
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const healthFill = document.getElementById('health-fill');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = gameOverEl.querySelector('.final-score');
const waveAnnounce = document.getElementById('wave-announce');
const damageFlash = document.getElementById('damage-flash');
const livesEl = document.getElementById('lives');
const bonusSegment = document.getElementById('bonus-segment');
const bossBarContainer = document.getElementById('boss-bar-container');
const bossFill = document.getElementById('boss-fill');
const bossNameEl = document.getElementById('boss-name');
const weaponNameEl = document.getElementById('weapon-name');
const weaponDescEl = document.getElementById('weapon-desc');
const powerContainer = document.getElementById('power-container');
const powerFill = document.getElementById('power-fill');
const powerKeyEl = document.getElementById('power-key');
const powerNameEl = document.getElementById('power-name');

function updatePowerUI() {
  const power = getActivePower();
  if (!power) {
    powerContainer.style.display = 'none';
    return;
  }
  powerContainer.style.display = 'flex';
  powerFill.style.width = state.powerCharge + '%';
  powerFill.style.background = power.color;
  powerNameEl.textContent = power.name;
  if (state.powerCharge >= 100) {
    powerKeyEl.classList.add('ready');
    powerKeyEl.textContent = 'E';
  } else {
    powerKeyEl.classList.remove('ready');
    powerKeyEl.textContent = 'E';
  }
}

// ============================================================
// ZONE BUILDERS
// ============================================================
function clearZoneGeometry() {
  scene.remove(arenaGroup);
  // Dispose all geometries/materials
  arenaGroup.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  arenaGroup = new THREE.Group();
  scene.add(arenaGroup);
}

let entityScale = 1.0;

function buildZone(zoneId) {
  clearZoneGeometry();
  const zone = ZONES.find(z => z.id === zoneId) || ZONES[0];
  arenaW = zone.arenaW;
  arenaD = zone.arenaD;
  entityScale = zone.entityScale || 1.0;
  applyZoneLighting(zone);

  if (zoneId === 'barn') buildBarn();
  else if (zoneId === 'forest') buildForest();

  // Scale pig for this zone
  if (pig) pig.scale.setScalar(entityScale);
}

function buildBarn() {
  const W = arenaW, D = arenaD;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshLambertMaterial({ color: 0x8B7355 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  arenaGroup.add(floor);

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x6B3A2A });

  // Back wall (negative Z) - with door opening in the middle
  const doorWidth = 3.5;
  const sideW = (W - doorWidth) / 2;
  // Left section
  const wallBackL = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_H, 0.5), wallMat);
  wallBackL.position.set(-(doorWidth / 2 + sideW / 2), WALL_H / 2, -D / 2);
  wallBackL.castShadow = true; wallBackL.receiveShadow = true;
  arenaGroup.add(wallBackL);
  // Right section
  const wallBackR = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_H, 0.5), wallMat);
  wallBackR.position.set((doorWidth / 2 + sideW / 2), WALL_H / 2, -D / 2);
  wallBackR.castShadow = true; wallBackR.receiveShadow = true;
  arenaGroup.add(wallBackR);
  // Door frame top
  const doorTop = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.4, 0.4, 0.5), wallMat);
  doorTop.position.set(0, WALL_H - 0.2, -D / 2);
  arenaGroup.add(doorTop);

  // Double barn doors (can be opened during cinematic)
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(doorWidth / 2, WALL_H - 0.5, 0.2), doorMat);
  doorL.position.set(-doorWidth / 4, (WALL_H - 0.5) / 2, -D / 2);
  doorL.userData.isDoor = true;
  doorL.userData.side = -1;
  arenaGroup.add(doorL);
  const doorR = new THREE.Mesh(new THREE.BoxGeometry(doorWidth / 2, WALL_H - 0.5, 0.2), doorMat);
  doorR.position.set(doorWidth / 4, (WALL_H - 0.5) / 2, -D / 2);
  doorR.userData.isDoor = true;
  doorR.userData.side = 1;
  arenaGroup.add(doorR);

  // Door handles
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  [-1, 1].forEach(side => {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.1), handleMat);
    handle.position.set(side * doorWidth / 4 + side * -0.6, WALL_H / 2 - 0.5, -D / 2 + 0.15);
    arenaGroup.add(handle);
  });

  // Other 3 walls (solid)
  [
    { w: W, pos: [0, WALL_H / 2, D / 2], rot: 0 },
    { w: D, pos: [-W / 2, WALL_H / 2, 0], rot: Math.PI / 2 },
    { w: D, pos: [W / 2, WALL_H / 2, 0], rot: Math.PI / 2 },
  ].forEach(cfg => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, WALL_H, 0.5), wallMat);
    wall.position.set(...cfg.pos);
    wall.rotation.y = cfg.rot;
    wall.castShadow = true;
    wall.receiveShadow = true;
    arenaGroup.add(wall);
  });

  const hayMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
  [[-7,0.75,-7],[8,0.75,-8],[-6,0.75,6],[7,0.75,5],[0,0.75,-8],[-9,0.75,0],[9,0.75,-3]].forEach(p => {
    const hay = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 1.5), hayMat);
    hay.position.set(...p);
    hay.rotation.y = Math.random() * Math.PI;
    hay.castShadow = true;
    hay.receiveShadow = true;
    arenaGroup.add(hay);
  });

  const beamMat = new THREE.MeshLambertMaterial({ color: 0x5C3317 });
  for (let i = -2; i <= 2; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(arenaW, 0.4, 0.4), beamMat);
    beam.position.set(0, WALL_H - 0.5, i * 5);
    arenaGroup.add(beam);
  }
}

function buildForest() {
  const W = arenaW, D = arenaD;

  // Ground - grassy
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 20, D + 20),
    new THREE.MeshLambertMaterial({ color: 0x2d5a1e })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  arenaGroup.add(ground);

  // Dirt path in center
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.7, D * 0.7),
    new THREE.MeshLambertMaterial({ color: 0x4a3520 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0;
  path.receiveShadow = true;
  arenaGroup.add(path);

  // Trees as boundary (ring of trees instead of walls)
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
  const leavesMats = [
    new THREE.MeshLambertMaterial({ color: 0x1a6b1a }),
    new THREE.MeshLambertMaterial({ color: 0x228822 }),
    new THREE.MeshLambertMaterial({ color: 0x0a5a0a }),
  ];
  // Border trees
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const r = Math.max(W, D) / 2 + 1 + Math.random() * 2;
    const tx = Math.cos(angle) * r;
    const tz = Math.sin(angle) * r;
    const h = 3 + Math.random() * 4;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 6), trunkMat);
    trunk.position.set(tx, h / 2, tz);
    trunk.castShadow = true;
    arenaGroup.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 + Math.random(), 6, 6),
      leavesMats[i % 3]
    );
    leaves.position.set(tx, h + 1, tz);
    leaves.castShadow = true;
    arenaGroup.add(leaves);
  }

  // Interior trees (obstacles)
  const treePositions = [
    [-6, -6], [7, -8], [-8, 5], [9, 4], [0, -9], [-10, 0], [5, 8],
  ];
  treePositions.forEach(([tx, tz]) => {
    const h = 2.5 + Math.random() * 2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), trunkMat);
    trunk.position.set(tx, h / 2, tz);
    trunk.castShadow = true;
    arenaGroup.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 + Math.random() * 0.5, 6, 6),
      leavesMats[Math.floor(Math.random() * 3)]
    );
    leaves.position.set(tx, h + 0.8, tz);
    leaves.castShadow = true;
    arenaGroup.add(leaves);
  });

  // Rocks
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  [[-4, 3], [6, -4], [-9, -7], [3, 9], [10, -2]].forEach(([rx, rz]) => {
    const rock = new THREE.Mesh(
      new THREE.SphereGeometry(0.6 + Math.random() * 0.5, 5, 5),
      rockMat
    );
    rock.position.set(rx, 0.4, rz);
    rock.scale.set(1, 0.6, 1.2);
    rock.castShadow = true;
    arenaGroup.add(rock);
  });

  // Small river/stream on one side
  const riverMat = new THREE.MeshLambertMaterial({ color: 0x3388aa, transparent: true, opacity: 0.6 });
  const river = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, D * 0.8), riverMat);
  river.position.set(W / 2 - 3, 0.02, 0);
  arenaGroup.add(river);

  // Mushrooms (decorative)
  const mushroomCapMat = new THREE.MeshLambertMaterial({ color: 0xCC2222 });
  const mushroomStemMat = new THREE.MeshLambertMaterial({ color: 0xEEDDCC });
  for (let i = 0; i < 8; i++) {
    const mx = (Math.random() - 0.5) * W * 0.8;
    const mz = (Math.random() - 0.5) * D * 0.8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6), mushroomStemMat);
    stem.position.set(mx, 0.15, mz);
    arenaGroup.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), mushroomCapMat);
    cap.position.set(mx, 0.3, mz);
    arenaGroup.add(cap);
  }

  // Fireflies (glowing dots)
  const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xccff44 });
  for (let i = 0; i < 12; i++) {
    const ff = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), fireflyMat);
    ff.position.set(
      (Math.random() - 0.5) * W,
      1 + Math.random() * 3,
      (Math.random() - 0.5) * D
    );
    arenaGroup.add(ff);
  }
}

// ============================================================
// CINEMATIC TRANSITIONS
// ============================================================
let cinematicState = null; // null = not playing

let cinematicForestGroup = null; // temp group for forest preview during cinematic

function startCinematic(fromZoneId, toZoneId, callback) {
  cinematicState = {
    timer: 0,
    duration: 10,
    fromZoneId,
    toZoneId,
    callback,
    phase: 0,
    built: false,
  };
  waveAnnounce.style.display = 'none';

  // Build forest NEXT TO the barn (offset on Z axis)
  // Barn is centered at 0,0. Forest will be at z = -(arenaD/2 + 28/2 + 5)
  const forestOffset = -(arenaD / 2 + 14 + 5); // gap between zones
  cinematicForestGroup = new THREE.Group();
  cinematicForestGroup.position.z = forestOffset;

  // Quick forest ground + trees for the cinematic
  const fGround = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 32),
    new THREE.MeshLambertMaterial({ color: 0x2d5a1e })
  );
  fGround.rotation.x = -Math.PI / 2;
  fGround.position.y = -0.02;
  cinematicForestGroup.add(fGround);

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
  const leavesMat = new THREE.MeshLambertMaterial({ color: 0x1a6b1a });
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r = 15 + Math.random() * 3;
    const tx = Math.cos(angle) * r;
    const tz = Math.sin(angle) * r;
    const h = 3 + Math.random() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 6), trunkMat);
    trunk.position.set(tx, h / 2, tz);
    cinematicForestGroup.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random(), 6, 6), leavesMat);
    leaves.position.set(tx, h + 1, tz);
    cinematicForestGroup.add(leaves);
  }
  scene.add(cinematicForestGroup);

  // Place pig at center of barn, facing the camera
  pig.position.set(0, 0, 0);
  pig.rotation.y = Math.PI;
  pigVel.set(0, 0, 0);
}

function animateBarnDoors(openAmount) {
  // Find door meshes in arenaGroup
  arenaGroup.traverse(obj => {
    if (obj.userData && obj.userData.isDoor) {
      const side = obj.userData.side; // -1 = left, 1 = right
      // Doors swing open outward (rotate around their edge)
      const doorHalfW = 3.5 / 4;
      const baseX = side * doorHalfW;
      const pivotX = side * (doorHalfW * 2);
      const angle = openAmount * Math.PI * 0.45 * side;
      obj.position.x = pivotX - Math.cos(angle) * doorHalfW * side;
      obj.position.z = -arenaD / 2 - Math.sin(Math.abs(angle)) * doorHalfW;
      obj.rotation.y = angle;
    }
  });
}

function updateCinematic(dt) {
  if (!cinematicState) return false;
  const c = cinematicState;
  c.timer += dt;
  const t = c.timer / c.duration; // 0 → 1 over 10 seconds
  const forestZ = -(arenaD / 2 + 14 + 5);

  // Animate pig running gently
  pig.userData.runPhase += dt * 6;
  const runPhase = pig.userData.runPhase;
  const hg = pig.userData.humanGroup;
  if (hg && hg.userData.armL) {
    hg.userData.armL.rotation.x = Math.sin(runPhase) * 0.3;
    hg.userData.armR.rotation.x = Math.sin(runPhase + Math.PI) * 0.3;
  }

  // Phase 0 (0-0.25): Close-up on pig's face, doors start opening
  if (t < 0.25) {
    const p = t / 0.25;
    pig.rotation.y = Math.PI; // facing camera
    const camDist = 2.5 + p * 1;
    camera.position.lerp(new THREE.Vector3(0, 1.8, camDist), dt * 6);
    camera.lookAt(pig.position.x, 1.3, pig.position.z);
    // Doors creak open behind him
    animateBarnDoors(p * 0.3);
  }
  // Phase 1 (0.25-0.5): Camera swings behind pig, pig turns, doors fully open
  else if (t < 0.5) {
    const p = (t - 0.25) / 0.25;
    // Pig rotates to face the forest (negative Z direction = rotation 0)
    pig.rotation.y = Math.PI * (1 - p);
    // Doors swing fully open
    animateBarnDoors(0.3 + p * 0.7);
    // Camera swings behind
    const angle = Math.PI * (1 - p);
    const camDist = 4 + p * 4;
    camera.position.lerp(new THREE.Vector3(
      Math.sin(angle) * camDist,
      3 + p * 5,
      pig.position.z + Math.cos(angle) * camDist
    ), dt * 4);
    camera.lookAt(pig.position.x, 1, pig.position.z);
    // Pig starts walking
    pig.position.z -= dt * 2 * p;
  }
  // Phase 2 (0.5-0.75): Pig runs out of barn toward forest, camera follows from above-behind
  else if (t < 0.75) {
    const p = (t - 0.5) / 0.25;
    pig.rotation.y = 0;
    // Pig runs toward forest
    pig.position.z -= dt * 8;
    // Camera follows from above and behind
    camera.position.lerp(new THREE.Vector3(
      0,
      8 + p * 4,
      pig.position.z + 10
    ), dt * 4);
    camera.lookAt(pig.position.x, 0, pig.position.z - 5);
  }
  // Phase 3 (0.75-0.95): Pig arrives in forest area, camera settles, title appears
  else if (t < 0.95) {
    const p = (t - 0.75) / 0.2;
    pig.rotation.y = 0;
    // Pig slows down and arrives at forest center
    const targetZ = forestZ;
    pig.position.z += (targetZ - pig.position.z) * dt * 3;
    // Camera settles into gameplay position relative to forest
    camera.position.lerp(new THREE.Vector3(0, 28, targetZ + 8), dt * 3);
    camera.lookAt(0, 0, targetZ);

    if (c.phase < 3) {
      c.phase = 3;
      const z = ZONES.find(z => z.id === c.toZoneId);
      waveAnnounce.innerHTML = `<div class="wave-num" style="font-size:48px;color:#fff">${z.name}</div>`;
      waveAnnounce.style.display = 'block';
    }
  }
  // Phase 4 (0.95-1.0): Clean up, transition to real zone
  else {
    waveAnnounce.style.display = 'none';

    // Remove cinematic forest preview
    if (cinematicForestGroup) {
      scene.remove(cinematicForestGroup);
      cinematicForestGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      cinematicForestGroup = null;
    }

    // Now build the real forest zone at origin
    state.wave = 6;
    buildZone(c.toZoneId);
    pig.position.set(0, 0, 0);
    pig.rotation.y = 0;
    pigVel.set(0, 0, 0);

    const cb = c.callback;
    cinematicState = null;
    if (cb) cb();
  }

  renderer.render(scene, camera);
  return true;
}

// ============================================================
// CHICKEN PLAYER
// ============================================================
let pig;
let pigVel = new THREE.Vector3();

function createPig() {
  pig = new THREE.Group();

  const pinkMat = new THREE.MeshLambertMaterial({ color: 0xFFAAAA });
  const darkPinkMat = new THREE.MeshLambertMaterial({ color: 0xEE8888 });

  // Fat round body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), pinkMat);
  body.position.y = 0.85;
  body.scale.set(1, 0.9, 1.15);
  body.castShadow = true;
  pig.add(body);

  // Big round head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), pinkMat);
  head.position.set(0, 1.5, 0.3);
  head.castShadow = true;
  pig.add(head);

  // Snout (flat cylinder)
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.15, 8), darkPinkMat);
  snout.position.set(0, 1.42, 0.68);
  snout.rotation.x = Math.PI / 2;
  pig.add(snout);

  // Nostrils
  const nostrilMat = new THREE.MeshBasicMaterial({ color: 0xCC5555 });
  [-1, 1].forEach(s => {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), nostrilMat);
    nostril.position.set(s * 0.07, 1.42, 0.76);
    pig.add(nostril);
  });

  // Eyes (beady, determined)
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });
  [-1, 1].forEach(s => {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeWhite);
    white.position.set(s * 0.18, 1.58, 0.55);
    pig.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeBlack);
    pupil.position.set(s * 0.18, 1.58, 0.61);
    pig.add(pupil);
  });

  // Angry eyebrows
  const browMat = new THREE.MeshBasicMaterial({ color: 0xCC7777 });
  [-1, 1].forEach(s => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.04), browMat);
    brow.position.set(s * 0.18, 1.67, 0.56);
    brow.rotation.z = s * -0.3;
    pig.add(brow);
  });

  // Big floppy ears
  [-1, 1].forEach(s => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), darkPinkMat);
    ear.position.set(s * 0.3, 1.8, 0.15);
    ear.scale.set(0.5, 1, 0.7);
    ear.rotation.z = s * 0.4;
    pig.add(ear);
  });

  // Short stubby legs with hooves
  const hoofMat = new THREE.MeshLambertMaterial({ color: 0x553333 });
  [-1, 1].forEach(s => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 6), pinkMat);
    leg.position.set(s * 0.3, 0.25, 0.3);
    pig.add(leg);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 6), hoofMat);
    hoof.position.set(s * 0.3, 0.02, 0.3);
    pig.add(hoof);
  });
  [-1, 1].forEach(s => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.5, 6), pinkMat);
    leg.position.set(s * 0.35, 0.25, -0.3);
    pig.add(leg);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.08, 6), hoofMat);
    hoof.position.set(s * 0.35, 0.02, -0.3);
    pig.add(hoof);
  });

  // Curly tail
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI * 1.5), darkPinkMat);
  tail.position.set(0, 1.0, -0.8);
  tail.rotation.y = Math.PI / 2;
  pig.add(tail);

  // Gun
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0.55, 1.0, 0.35);
  pig.add(gunGroup);
  pig.userData.gun = gunGroup;

  pig.position.set(0, 0, 0);
  scene.add(pig);
  buildGunModel();
}

function buildGunModel() {
  const gun = pig.userData.gun;
  while (gun.children.length) gun.remove(gun.children[0]);
  const w = getWeapon();

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(w.gunRadius, w.gunRadius, w.gunLength, 6),
    new THREE.MeshLambertMaterial({ color: w.gunColor })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = w.gunLength / 2;
  gun.add(barrel);

  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x5C3317 })
  );
  stock.position.z = -0.2;
  gun.add(stock);

  // Bazooka gets a wider back
  if (w.name === 'BAZOOKA' || w.name === 'GRENADE LAUNCHER') {
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(w.gunRadius * 1.5, w.gunRadius, 0.4, 6),
      new THREE.MeshLambertMaterial({ color: w.gunColor })
    );
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.1;
    gun.add(back);
  }

  // Minigun gets multiple barrels
  if (w.name === 'MINIGUN') {
    for (let i = 0; i < 3; i++) {
      const b2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, w.gunLength, 4),
        new THREE.MeshLambertMaterial({ color: 0x555555 })
      );
      b2.rotation.x = Math.PI / 2;
      b2.position.z = w.gunLength / 2;
      b2.position.x = Math.cos(i * Math.PI * 2 / 3) * 0.05;
      b2.position.y = Math.sin(i * Math.PI * 2 / 3) * 0.05;
      gun.add(b2);
    }
  }

  // Golden shotgun glows
  if (w.name === 'GOLDEN SHOTGUN') {
    barrel.material.emissive = new THREE.Color(0xFFAA00);
    barrel.material.emissiveIntensity = 0.3;
  }
}

// ============================================================
// FARMER ENEMIES
// ============================================================
function createFarmer(pos) {
  const farmer = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.5), bodyMat);
  body.position.y = 1.2; body.castShadow = true;
  farmer.add(body); // [0]

  const headMat = new THREE.MeshLambertMaterial({ color: 0xFFCBA4 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), headMat);
  head.position.y = 2.05; head.castShadow = true;
  farmer.add(head); // [1]

  const hatMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 8), hatMat);
  hatBrim.position.y = 2.3;
  farmer.add(hatBrim); // [2]
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.3, 8), hatMat);
  hatTop.position.y = 2.48;
  farmer.add(hatTop); // [3]

  const legMat = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
  [-1, 1].forEach(s => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.3), legMat);
    leg.position.set(s * 0.2, 0.3, 0);
    farmer.add(leg); // [4], [5]
  });

  const armMat = new THREE.MeshLambertMaterial({ color: 0xCC2222 });
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), armMat);
    arm.position.set(s * 0.55, 1.3, 0);
    farmer.add(arm); // [6], [7]
  });

  const pitchfork = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4), new THREE.MeshLambertMaterial({ color: 0x8B7355 }));
  handle.position.y = 0.9;
  pitchfork.add(handle);
  const tine = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 3), new THREE.MeshLambertMaterial({ color: 0x888888 }));
  tine.position.y = 1.85;
  pitchfork.add(tine);
  pitchfork.position.set(0.6, 0.5, 0.2);
  pitchfork.rotation.z = -0.3;
  farmer.add(pitchfork); // [8]

  farmer.position.copy(pos);
  farmer.userData = {
    health: 2 + Math.floor(state.wave / 3),
    vel: new THREE.Vector3(),
    knockback: new THREE.Vector3(),
    walkPhase: Math.random() * Math.PI * 2,
    attackTimer: 0,
    attackAnim: 0,
    isAttacking: false,
    frozen: 0,
    frozenSlow: 1,
  };

  farmer.scale.setScalar(entityScale);
  scene.add(farmer);
  farmers.push(farmer);
}

function spawnFarmer() {
  const side = Math.floor(Math.random() * 4);
  const margin = arenaW / 2 - 1.5;
  const marginD = arenaD / 2 - 1.5;
  let x, z;
  switch (side) {
    case 0: x = -margin; z = (Math.random() - 0.5) * arenaD * 0.8; break;
    case 1: x = margin; z = (Math.random() - 0.5) * arenaD * 0.8; break;
    case 2: z = -marginD; x = (Math.random() - 0.5) * arenaW * 0.8; break;
    case 3: z = marginD; x = (Math.random() - 0.5) * arenaW * 0.8; break;
  }
  const pos = new THREE.Vector3(x, 0, z);
  const zone = getZone();

  if (zone.id === 'forest') {
    // Pick random forest enemy
    const roll = Math.random();
    if (roll < 0.55) createHunter(pos);       // 55% hunters
    else if (roll < 0.8) createDog(pos);       // 25% dogs
    else createBearEnemy(pos);                  // 20% bears
  } else {
    createFarmer(pos);
  }
}

// ============================================================
// FOREST ENEMIES
// ============================================================
function createHunter(pos) {
  const hunter = new THREE.Group();

  // Body - green jacket
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x556B2F });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.5), bodyMat);
  body.position.y = 1.2; body.castShadow = true;
  hunter.add(body); // [0]

  // Head
  const headMat = new THREE.MeshLambertMaterial({ color: 0xFFCBA4 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), headMat);
  head.position.y = 2.05; head.castShadow = true;
  hunter.add(head); // [1]

  // Hunting cap (orange)
  const capMat = new THREE.MeshLambertMaterial({ color: 0xFF6600 });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
  cap.position.y = 2.25;
  hunter.add(cap); // [2]
  // Cap visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.15), capMat);
  visor.position.set(0, 2.15, 0.28);
  hunter.add(visor); // [3]

  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3a3a2a });
  [-1, 1].forEach(s => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.3), legMat);
    leg.position.set(s * 0.2, 0.3, 0);
    hunter.add(leg); // [4], [5]
  });

  // Arms
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), bodyMat);
    arm.position.set(s * 0.55, 1.3, 0);
    hunter.add(arm); // [6], [7]
  });

  // Rifle
  const rifle = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.5;
  rifle.add(barrel);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.6), new THREE.MeshLambertMaterial({ color: 0x5C3317 }));
  stock.position.z = -0.3;
  rifle.add(stock);
  rifle.position.set(0.5, 1.2, 0.2);
  hunter.add(rifle); // [8]

  hunter.position.copy(pos);
  hunter.userData = {
    health: 3 + Math.floor(state.wave / 4),
    vel: new THREE.Vector3(),
    knockback: new THREE.Vector3(),
    walkPhase: Math.random() * Math.PI * 2,
    attackTimer: 0,
    attackAnim: 0,
    isAttacking: false,
    frozen: 0, frozenSlow: 1, freezeHits: 0,
    type: 'hunter',
  };

  hunter.scale.setScalar(entityScale);
  scene.add(hunter);
  farmers.push(hunter);
}

function createDog(pos) {
  const dog = new THREE.Group();

  // Body (horizontal)
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.0), bodyMat);
  body.position.y = 0.5; body.castShadow = true;
  dog.add(body); // [0]

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), bodyMat);
  head.position.set(0, 0.65, 0.6); head.castShadow = true;
  dog.add(head); // [1]

  // Snout
  const snoutMat = new THREE.MeshLambertMaterial({ color: 0x6B4914 });
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.25), snoutMat);
  snout.position.set(0, 0.55, 0.85);
  dog.add(snout); // [2]
  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  nose.position.set(0, 0.58, 0.98);
  dog.add(nose); // [3]

  // Ears (floppy)
  [-1, 1].forEach(s => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.08), bodyMat);
    ear.position.set(s * 0.2, 0.7, 0.5);
    ear.rotation.z = s * 0.3;
    dog.add(ear); // [4], [5]
  });

  // Legs (4)
  [-1, 1].forEach(s => {
    const fLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4), bodyMat);
    fLeg.position.set(s * 0.2, 0.2, 0.35);
    dog.add(fLeg); // [6], [7]
  });
  [-1, 1].forEach(s => {
    const bLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 4), bodyMat);
    bLeg.position.set(s * 0.2, 0.2, -0.35);
    dog.add(bLeg); // [8], [9]
  });

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.3, 4), bodyMat);
  tail.position.set(0, 0.65, -0.55);
  tail.rotation.x = -0.5;
  dog.add(tail); // [10]

  dog.position.copy(pos);
  dog.userData = {
    health: 1,
    vel: new THREE.Vector3(),
    knockback: new THREE.Vector3(),
    walkPhase: Math.random() * Math.PI * 2,
    attackTimer: 0,
    attackAnim: 0,
    isAttacking: false,
    frozen: 0, frozenSlow: 1, freezeHits: 0,
    type: 'dog',
    speedMult: 2.0, // dogs are fast
  };

  dog.scale.setScalar(entityScale);
  scene.add(dog);
  farmers.push(dog);
}

function createBearEnemy(pos) {
  const bear = new THREE.Group();

  // Big body
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.8), bodyMat);
  body.position.y = 1.4; body.castShadow = true;
  bear.add(body); // [0]

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), bodyMat);
  head.position.y = 2.4; head.castShadow = true;
  bear.add(head); // [1]

  // Snout
  const snoutMat = new THREE.MeshLambertMaterial({ color: 0x6B4a30 });
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), snoutMat);
  snout.position.set(0, 2.25, 0.35);
  bear.add(snout); // [2]
  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  nose.position.set(0, 2.28, 0.5);
  bear.add(nose); // [3]

  // Ears
  [-1, 1].forEach(s => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), bodyMat);
    ear.position.set(s * 0.3, 2.7, 0);
    bear.add(ear); // [4], [5]
  });

  // Eyes (small, angry)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFFAA00 });
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), eyeMat);
    eye.position.set(s * 0.15, 2.45, 0.3);
    bear.add(eye); // [6], [7]
  });

  // Legs (thick)
  [-1, 1].forEach(s => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), bodyMat);
    leg.position.set(s * 0.35, 0.4, 0);
    bear.add(leg); // [8], [9]
  });

  // Arms
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), bodyMat);
    arm.position.set(s * 0.65, 1.5, 0);
    bear.add(arm); // [10], [11]
  });

  bear.position.copy(pos);
  bear.userData = {
    health: 6 + Math.floor(state.wave / 3),
    vel: new THREE.Vector3(),
    knockback: new THREE.Vector3(),
    walkPhase: Math.random() * Math.PI * 2,
    attackTimer: 0,
    attackAnim: 0,
    isAttacking: false,
    frozen: 0, frozenSlow: 1, freezeHits: 0,
    type: 'bear',
    speedMult: 0.6, // bears are slow
  };

  bear.scale.setScalar(entityScale);
  scene.add(bear);
  farmers.push(bear);
}

// ============================================================
// BOSS SYSTEM
// ============================================================
let boss = null;
const BOSS_WAVES = [5, 10];

function isBossWave(wave) { return BOSS_WAVES.includes(wave); }

function createBoss(pos) {
  const b = new THREE.Group();
  const scale = 2.5;

  // Body - big red overalls
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, 1.2 * scale, 0.5 * scale), bodyMat);
  body.position.y = 1.2 * scale; body.castShadow = true;
  b.add(body); // [0]

  // Head - bigger, angry
  const headMat = new THREE.MeshLambertMaterial({ color: 0xFFCBA4 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4 * scale, 8, 8), headMat);
  head.position.y = 2.2 * scale; head.castShadow = true;
  b.add(head); // [1]

  // Boss hat - big black cowboy hat
  const hatMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * scale, 0.6 * scale, 0.08, 12), hatMat);
  hatBrim.position.y = 2.55 * scale;
  b.add(hatBrim); // [2]
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.35 * scale, 0.5, 12), hatMat);
  hatTop.position.y = 2.8 * scale;
  b.add(hatTop); // [3]

  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
  [-1, 1].forEach(s => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.6 * scale, 0.3 * scale), legMat);
    leg.position.set(s * 0.25 * scale, 0.3 * scale, 0);
    b.add(leg); // [4], [5]
  });

  // Arms - thick
  const armMat = new THREE.MeshLambertMaterial({ color: 0x660000 });
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.9 * scale, 0.25 * scale), armMat);
    arm.position.set(s * 0.6 * scale, 1.4 * scale, 0);
    b.add(arm); // [6], [7]
  });

  // Giant pitchfork
  const pitchfork = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 3, 6),
    new THREE.MeshLambertMaterial({ color: 0x5C3317 })
  );
  handle.position.y = 1.5;
  pitchfork.add(handle);
  // 3 tines
  [-0.15, 0, 0.15].forEach(offset => {
    const tine = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.5, 4),
      new THREE.MeshLambertMaterial({ color: 0xAAAAAA })
    );
    tine.position.set(offset, 3.1, 0);
    pitchfork.add(tine);
  });
  pitchfork.position.set(0.8 * scale, 0.5, 0.3);
  pitchfork.rotation.z = -0.2;
  b.add(pitchfork); // [8]

  // Angry eyes (red glow)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 6, 6), eyeMat);
    eye.position.set(s * 0.2 * scale, 2.3 * scale, 0.35 * scale);
    b.add(eye); // [9], [10]
  });

  b.position.copy(pos);

  const bossHp = state.wave === 5 ? 36 : 90;
  b.userData = {
    health: bossHp,
    maxHealth: bossHp,
    vel: new THREE.Vector3(),
    knockback: new THREE.Vector3(),
    walkPhase: Math.random() * Math.PI * 2,
    attackTimer: 0,
    attackAnim: 0,
    isAttacking: false,
    frozen: 0,
    frozenSlow: 1,
    isBoss: true,
    chargeTimer: 0,    // boss charges at player periodically
    stompTimer: 5,     // stomp attack
  };

  b.scale.setScalar(entityScale);
  scene.add(b);
  farmers.push(b);
  boss = b;

  // Show boss health bar
  bossBarContainer.style.display = 'block';
  bossNameEl.textContent = getZone().bossName || 'BOSS';
  updateBossBar();
}

function updateBossBar() {
  if (!boss) { bossBarContainer.style.display = 'none'; return; }
  const pct = Math.max(0, boss.userData.health / boss.userData.maxHealth * 100);
  bossFill.style.width = pct + '%';
  if (pct > 50) bossFill.style.background = '#e44';
  else if (pct > 25) bossFill.style.background = '#f80';
  else bossFill.style.background = '#ff0';
}

function bossStompAttack() {
  if (!boss || !state.alive) return;
  // Shockwave that pushes pig away
  const dist = boss.position.distanceTo(pig.position);
  if (dist < 8) {
    const dir = new THREE.Vector3().subVectors(pig.position, boss.position).setY(0).normalize();
    const force = (1 - dist / 8) * 20;
    pigVel.x += dir.x * force;
    pigVel.z += dir.z * force;
    pigVel.y += 3;
    state.health -= 8;
    healthFill.style.width = Math.max(0, state.health / MAX_HEALTH * 100) + '%';
    damageFlashTimer = 0.2;
    if (state.health <= 0) die();
  }
  // Visual shockwave ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xFF4400, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.position.copy(boss.position);
  ring.position.y = 0.3;
  ring.rotation.x = -Math.PI / 2;
  ring.userData = { life: 0.5, vel: new THREE.Vector3() };
  scene.add(ring);
  particles.push(ring);
  shakeAmount = 0.8;
  playSound('boom');
}

// ============================================================
// BULLETS & PROJECTILES
// ============================================================
function createBullet(origin, direction, weapon) {
  const geo = new THREE.SphereGeometry(weapon.bulletSize, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: weapon.bulletColor });
  const bullet = new THREE.Mesh(geo, mat);
  bullet.position.copy(origin);
  bullet.userData = {
    vel: direction.clone().multiplyScalar(weapon.bulletSpeed),
    life: weapon.bulletLife,
    weapon: weapon,
    bounces: weapon.bounce,
    hitFarmers: new Set(), // for pierce - track who we already hit
  };
  scene.add(bullet);
  bullets.push(bullet);
}

// ============================================================
// BLACK HOLES
// ============================================================
function createBlackhole(pos, weapon) {
  const group = new THREE.Group();
  group.position.copy(pos);

  // Core
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x220044 })
  );
  group.add(core);

  // Swirling rings
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1 + i * 0.5, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x8800FF, transparent: true, opacity: 0.6 - i * 0.15 })
    );
    ring.rotation.x = Math.random() * Math.PI;
    ring.rotation.y = Math.random() * Math.PI;
    group.add(ring);
  }

  group.userData = {
    life: weapon.blackholeDuration,
    radius: weapon.blackholeRadius,
    damage: weapon.blackholeDamage,
    phase: 0,
  };

  scene.add(group);
  blackholes.push(group);
}

// ============================================================
// PARTICLES
// ============================================================
function spawnParticles(pos, count, color, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(size || 0.08, 4, 4);
    const c = typeof color === 'function' ? color() : color;
    const mat = new THREE.MeshBasicMaterial({ color: c });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(pos);
    p.userData = {
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * speed * 2,
        Math.random() * speed + speed * 0.5,
        (Math.random() - 0.5) * speed * 2,
      ),
      life: (life || 0.4) * (0.5 + Math.random() * 0.5),
    };
    scene.add(p);
    particles.push(p);
  }
}

function spawnMuzzleFlash(pos, dir, weapon) {
  const hue = weapon.bulletColor;
  spawnParticles(pos, 8, () => {
    const c = new THREE.Color(hue);
    c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.3);
    return c;
  }, 5, 0.3, 0.08);
}

function spawnExplosion(pos, radius, color) {
  // Big boom particles
  spawnParticles(pos, 25, () => {
    return new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.3 + Math.random() * 0.5);
  }, radius * 2, 0.6, 0.15);

  // Expanding ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.1, radius, 24),
    new THREE.MeshBasicMaterial({ color: color || 0xFF4400, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.position.copy(pos);
  ring.position.y = 0.5;
  ring.rotation.x = -Math.PI / 2;
  ring.userData = { life: 0.4, vel: new THREE.Vector3() };
  scene.add(ring);
  particles.push(ring);

  // Flash light
  const flash = new THREE.PointLight(color || 0xFF4400, 3, radius * 3);
  flash.position.copy(pos);
  flash.position.y = 2;
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 150);
}

function spawnFeathers(pos) {
  for (let i = 0; i < 6; i++) {
    const geo = new THREE.PlaneGeometry(0.15, 0.08);
    const mat = new THREE.MeshBasicMaterial({ color: 0xFFAAAA, side: THREE.DoubleSide });
    const f = new THREE.Mesh(geo, mat);
    f.position.copy(pos);
    f.position.y += 1;
    f.userData = {
      vel: new THREE.Vector3((Math.random()-0.5)*4, Math.random()*5+2, (Math.random()-0.5)*4),
      rotSpeed: (Math.random() - 0.5) * 10,
      life: 1 + Math.random(),
    };
    scene.add(f);
    feathers.push(f);
  }
}

function spawnFarmerDeath(pos) {
  spawnParticles(pos.clone().setY(1), 12, () => {
    return new THREE.Color().setHSL(Math.random() * 0.1, 0.8, 0.4 + Math.random() * 0.3);
  }, 6, 0.5, 0.12);
}

function spawnFreezeShatter(pos) {
  spawnParticles(pos.clone().setY(1), 15, () => {
    return new THREE.Color().setHSL(0.55, 0.8, 0.6 + Math.random() * 0.3);
  }, 8, 0.6, 0.1);
}

// Lightning bolt visual
function createLightningBolt(from, to, color) {
  const points = [from.clone()];
  const dir = to.clone().sub(from);
  const len = dir.length();
  const segments = 6;
  for (let i = 1; i < segments; i++) {
    const p = from.clone().add(dir.clone().multiplyScalar(i / segments));
    p.x += (Math.random() - 0.5) * len * 0.15;
    p.y = 1.5 + (Math.random() - 0.5) * 0.5;
    p.z += (Math.random() - 0.5) * len * 0.15;
    points.push(p);
  }
  points.push(to.clone());

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: color || 0xFFFF44, linewidth: 2 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  lightningBolts.push({ mesh: line, life: 0.15 });
}

// ============================================================
// AUDIO
// ============================================================
let audioCtx;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
  ensureAudio();
  const t = audioCtx.currentTime;

  if (type === 'shotgun') {
    const bufSize = audioCtx.sampleRate * 0.1;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/bufSize, 3);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    src.connect(g).connect(audioCtx.destination);
    src.start();
    // Thump
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(20, t + 0.15);
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g2).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.15);
  }
  else if (type === 'boom') {
    // Big explosion
    const bufSize = audioCtx.sampleRate * 0.3;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/bufSize, 2);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(g).connect(audioCtx.destination);
    src.start();
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(50, t);
    o.frequency.exponentialRampToValueAtTime(10, t + 0.4);
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.7, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g2).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.4);
  }
  else if (type === 'pew') {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.1);
  }
  else if (type === 'zap') {
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(800, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.12);
    // buzz
    const o2 = audioCtx.createOscillator();
    o2.type = 'square';
    o2.frequency.setValueAtTime(100, t);
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.1, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o2.connect(g2).connect(audioCtx.destination);
    o2.start(); o2.stop(t + 0.1);
  }
  else if (type === 'thump') {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.15);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.15);
  }
  else if (type === 'minigun') {
    const o = audioCtx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(400 + Math.random() * 200, t);
    o.frequency.exponentialRampToValueAtTime(100, t + 0.03);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.04);
  }
  else if (type === 'freeze') {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2000, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.1);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.1);
  }
  else if (type === 'hit') {
    const o = audioCtx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.1);
  }
  else if (type === 'death') {
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.5);
  }
  else if (type === 'cluck') {
    // Oink! (nasal low-to-high squeal)
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 3;
    o.connect(lp).connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.13);
  }
  else if (type === 'bounce') {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(t + 0.06);
  }
}

// ============================================================
// MUSIC SYSTEM - Plays patterns from beatmaker (localStorage)
// ============================================================
let musicCtx, musicGain, musicPlaying = false;
let musicNodes = [];
let customPatterns = null;

// Try loading custom patterns from beatmaker
function loadCustomPatterns() {
  try {
    const saved = localStorage.getItem('piggun_patterns');
    if (saved) {
      customPatterns = JSON.parse(saved);
      console.log('Loaded ' + customPatterns.length + ' custom patterns from beatmaker');
    }
  } catch(e) { customPatterns = null; }
}
loadCustomPatterns();

function stopMusic() {
  musicNodes.forEach(n => { try { n.stop(); } catch(e) {} try { n.disconnect(); } catch(e) {} });
  musicNodes = [];
  musicPlaying = false;
}

// --- Custom music from beatmaker patterns ---
function startCustomMusic(pat) {
  musicPlaying = true;
  const bpm = pat.bpm || 174;
  const swing = (pat.swing || 0) / 100;
  const sixteenth = 60 / bpm / 4;
  const loopLen = 16 * sixteenth;
  const grid = pat.grid;
  const SUB_NOTES = [36, 34, 32, 38];
  const REESE_NOTES = [55, 52, 49, 58];

  function scheduleLoop(startTime) {
    for (let i = 0; i < 16; i++) {
      let nt = startTime + i * sixteenth;
      if (i % 2 === 1 && swing > 0) nt += sixteenth * swing * 0.5;
      if (nt < musicCtx.currentTime - 0.1) continue;

      // Kick
      if (grid['kick'] && grid['kick'][i]) {
        const o = musicCtx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(200, nt);
        o.frequency.exponentialRampToValueAtTime(30, nt + 0.2);
        const g = musicCtx.createGain();
        g.gain.setValueAtTime(1.0, nt);
        g.gain.exponentialRampToValueAtTime(0.001, nt + 0.25);
        o.connect(g).connect(musicGain);
        o.start(nt); o.stop(nt + 0.25);
        musicNodes.push(o);
        // Click
        const o2 = musicCtx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(4000, nt);
        o2.frequency.exponentialRampToValueAtTime(100, nt + 0.015);
        const g2 = musicCtx.createGain();
        g2.gain.setValueAtTime(0.4, nt);
        g2.gain.exponentialRampToValueAtTime(0.001, nt + 0.02);
        o2.connect(g2).connect(musicGain);
        o2.start(nt); o2.stop(nt + 0.03);
        musicNodes.push(o2);
      }

      // Snare
      if (grid['snare'] && grid['snare'][i]) {
        const bufSize = musicCtx.sampleRate * 0.12;
        const buf = musicCtx.createBuffer(1, bufSize, musicCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufSize; j++) d[j] = (Math.random()*2-1) * Math.pow(1-j/bufSize, 1.5);
        const src = musicCtx.createBufferSource();
        src.buffer = buf;
        const g = musicCtx.createGain();
        g.gain.setValueAtTime(0.6, nt);
        g.gain.exponentialRampToValueAtTime(0.001, nt + 0.12);
        const bp = musicCtx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 1;
        src.connect(bp).connect(g).connect(musicGain);
        src.start(nt); musicNodes.push(src);
        const o = musicCtx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(250, nt);
        o.frequency.exponentialRampToValueAtTime(100, nt + 0.04);
        const g2 = musicCtx.createGain();
        g2.gain.setValueAtTime(0.5, nt);
        g2.gain.exponentialRampToValueAtTime(0.001, nt + 0.05);
        o.connect(g2).connect(musicGain);
        o.start(nt); o.stop(nt + 0.06);
        musicNodes.push(o);
      }

      // Hi-hat
      if (grid['hihat'] && grid['hihat'][i]) {
        const bufSize = musicCtx.sampleRate * 0.02;
        const buf = musicCtx.createBuffer(1, bufSize, musicCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufSize; j++) d[j] = (Math.random()*2-1) * Math.pow(1-j/bufSize, 6);
        const src = musicCtx.createBufferSource();
        src.buffer = buf;
        const g = musicCtx.createGain();
        g.gain.setValueAtTime(0.25, nt);
        g.gain.exponentialRampToValueAtTime(0.001, nt + 0.02);
        const hp = musicCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 9000;
        src.connect(hp).connect(g).connect(musicGain);
        src.start(nt); musicNodes.push(src);
      }

      // Open hat
      if (grid['open-hat'] && grid['open-hat'][i]) {
        const bufSize = musicCtx.sampleRate * 0.12;
        const buf = musicCtx.createBuffer(1, bufSize, musicCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufSize; j++) d[j] = (Math.random()*2-1) * Math.pow(1-j/bufSize, 2);
        const src = musicCtx.createBufferSource();
        src.buffer = buf;
        const g = musicCtx.createGain();
        g.gain.setValueAtTime(0.25, nt);
        g.gain.exponentialRampToValueAtTime(0.001, nt + 0.12);
        const hp = musicCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 7000;
        src.connect(hp).connect(g).connect(musicGain);
        src.start(nt); musicNodes.push(src);
      }

      // Crash
      if (grid['crash'] && grid['crash'][i]) {
        const bufSize = musicCtx.sampleRate * 0.5;
        const buf = musicCtx.createBuffer(1, bufSize, musicCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufSize; j++) d[j] = (Math.random()*2-1) * Math.pow(1-j/bufSize, 1.2);
        const src = musicCtx.createBufferSource();
        src.buffer = buf;
        const g = musicCtx.createGain();
        g.gain.setValueAtTime(0.35, nt);
        g.gain.exponentialRampToValueAtTime(0.001, nt + 0.5);
        const hp = musicCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 5000;
        src.connect(hp).connect(g).connect(musicGain);
        src.start(nt); musicNodes.push(src);
      }

      // Ride
      if (grid['ride'] && grid['ride'][i]) {
        const bufSize = musicCtx.sampleRate * 0.08;
        const buf = musicCtx.createBuffer(1, bufSize, musicCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < bufSize; j++) d[j] = (Math.random()*2-1) * Math.pow(1-j/bufSize, 3);
        const src = musicCtx.createBufferSource();
        src.buffer = buf;
        const g = musicCtx.createGain();
        g.gain.setValueAtTime(0.15, nt);
        g.gain.exponentialRampToValueAtTime(0.001, nt + 0.08);
        const hp = musicCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 11000;
        src.connect(hp).connect(g).connect(musicGain);
        src.start(nt); musicNodes.push(src);
        const o = musicCtx.createOscillator();
        o.type = 'sine'; o.frequency.value = 3500;
        const g2 = musicCtx.createGain();
        g2.gain.setValueAtTime(0.04, nt);
        g2.gain.exponentialRampToValueAtTime(0.001, nt + 0.06);
        o.connect(g2).connect(musicGain);
        o.start(nt); o.stop(nt + 0.07);
        musicNodes.push(o);
      }

      // Sub bass
      if (grid['sub'] && grid['sub'][i]) {
        const freq = SUB_NOTES[Math.floor(i / 4) % SUB_NOTES.length];
        const o = musicCtx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, nt);
        const g = musicCtx.createGain();
        g.gain.setValueAtTime(0.5, nt);
        g.gain.setValueAtTime(0.5, nt + sixteenth * 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, nt + sixteenth * 0.95);
        o.connect(g).connect(musicGain);
        o.start(nt); o.stop(nt + sixteenth);
        musicNodes.push(o);
      }

      // Reese bass
      if (grid['reese'] && grid['reese'][i]) {
        const freq = REESE_NOTES[Math.floor(i / 4) % REESE_NOTES.length];
        [-4, 4].forEach(detune => {
          const o = musicCtx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(freq, nt);
          o.detune.value = detune;
          const g = musicCtx.createGain();
          g.gain.setValueAtTime(0.12, nt);
          g.gain.exponentialRampToValueAtTime(0.001, nt + sixteenth * 0.9);
          const lp = musicCtx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(600, nt);
          lp.frequency.exponentialRampToValueAtTime(100, nt + sixteenth * 0.9);
          lp.Q.value = 5;
          o.connect(lp).connect(g).connect(musicGain);
          o.start(nt); o.stop(nt + sixteenth);
          musicNodes.push(o);
        });
      }

      // Strings (violin-like)
      const STRING_NOTES = [220, 196, 175, 233];
      if (grid['strings'] && grid['strings'][i]) {
        const freq = STRING_NOTES[Math.floor(i / 4) % STRING_NOTES.length];
        const dur = sixteenth * 2;
        [0, 3, -3, 7, -7].forEach(detune => {
          const o = musicCtx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(freq, nt);
          o.detune.value = detune;
          const lfo = musicCtx.createOscillator();
          lfo.frequency.value = 5;
          const lfoG = musicCtx.createGain();
          lfoG.gain.value = 4;
          lfo.connect(lfoG).connect(o.frequency);
          lfo.start(nt); lfo.stop(nt + dur);
          musicNodes.push(lfo);
          const g = musicCtx.createGain();
          g.gain.setValueAtTime(0.001, nt);
          g.gain.linearRampToValueAtTime(0.04, nt + dur * 0.3);
          g.gain.linearRampToValueAtTime(0.03, nt + dur * 0.7);
          g.gain.exponentialRampToValueAtTime(0.001, nt + dur);
          const lp = musicCtx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 1;
          o.connect(lp).connect(g).connect(musicGain);
          o.start(nt); o.stop(nt + dur + 0.01);
          musicNodes.push(o);
        });
      }

      // Bell
      const BELL_NOTES = [523, 659, 784, 523];
      if (grid['bell'] && grid['bell'][i]) {
        const freq = BELL_NOTES[Math.floor(i / 4) % BELL_NOTES.length];
        [1, 2.4, 4.1].forEach((harm, idx) => {
          const o = musicCtx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq * harm, nt);
          const g = musicCtx.createGain();
          g.gain.setValueAtTime(0.08 / (idx + 1), nt);
          g.gain.exponentialRampToValueAtTime(0.001, nt + sixteenth * 3);
          o.connect(g).connect(musicGain);
          o.start(nt); o.stop(nt + sixteenth * 3 + 0.01);
          musicNodes.push(o);
        });
      }
    }
  }

  let loopStart = musicCtx.currentTime + 0.1;
  function loop() {
    if (!musicPlaying) return;
    musicNodes = musicNodes.filter(n => {
      try { if (n.context.currentTime > (n._stopTime || 0) + 1) { try { n.disconnect(); } catch(e) {} return false; } } catch(e) {}
      return true;
    });
    scheduleLoop(loopStart);
    loopStart += loopLen;
    const delay = (loopStart - musicCtx.currentTime - 0.5) * 1000;
    setTimeout(loop, Math.max(50, delay));
  }

  scheduleLoop(loopStart);
  loopStart += loopLen;
  setTimeout(loop, loopLen * 800);
}

function startMusic(waveNum) {
  stopMusic();
  loadCustomPatterns();
  if (!musicCtx) musicCtx = new (window.AudioContext || window.webkitAudioContext)();

  if (!musicGain) {
    const comp = musicCtx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.1;
    comp.connect(musicCtx.destination);

    musicGain = musicCtx.createGain();
    musicGain.gain.value = 0.45;
    musicGain.connect(comp);
  }

  const cp = customPatterns && customPatterns[waveNum - 1];
  if (cp && cp.grid) {
    startCustomMusic(cp);
  }
  // No fallback - music comes from beatmaker only
}

// ============================================================
// SHOOTING
// ============================================================
function shoot() {
  if (!state.alive || state.shootTimer > 0) return;

  const w = getWeapon();
  state.shootTimer = w.cooldown;

  raycaster.setFromCamera(mouse, camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, target);

  const aimDir = new THREE.Vector3().subVectors(target, pig.position).setY(0).normalize();
  const gunTip = pig.position.clone().add(aimDir.clone().multiplyScalar(1.2));
  gunTip.y = 1;

  // Fire bullets (spread for shotgun-types)
  for (let i = 0; i < w.spread; i++) {
    const angle = (i - (w.spread - 1) / 2) * (w.spreadAngle / Math.max(1, w.spread - 1));
    const totalAngle = angle + (w.spreadAngle > 0 ? (Math.random() - 0.5) * 0.05 : 0);
    const dir = aimDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), totalAngle);
    createBullet(gunTip, dir, w);
  }

  // Muzzle flash
  spawnMuzzleFlash(gunTip, aimDir, w);

  // RECOIL!
  const recoilDir = aimDir.clone().negate();
  pigVel.x += recoilDir.x * w.recoil;
  pigVel.z += recoilDir.z * w.recoil;
  pigVel.y += Math.min(w.recoil * 0.12, 4);

  spawnFeathers(pig.position);
  shakeAmount = w.shake;

  playSound(w.sound);
  playSound('cluck');
}

// ============================================================
// SCREEN SHAKE & CAMERA
// ============================================================
let shakeAmount = 0;
const cameraBasePos = new THREE.Vector3(0, 28, 8);

// ============================================================
// WAVE SYSTEM
// ============================================================
function updateHealthMax() {
  MAX_HEALTH = state.wave > 5 ? BOOSTED_HEALTH : BASE_HEALTH;
  bonusSegment.style.display = state.wave > 5 ? 'block' : 'none';
}

function startWave() {
  state.waveActive = true;
  state.farmersSpawned = 0;
  state.spawnTimer = 0;
  boss = null;
  bossBarContainer.style.display = 'none';

  // Health boost after beating wave 5 boss
  const oldMax = MAX_HEALTH;
  updateHealthMax();
  if (MAX_HEALTH > oldMax) {
    // Grant the bonus HP
    state.health += (MAX_HEALTH - oldMax);
    state.health = Math.min(state.health, MAX_HEALTH);
    healthFill.style.width = (state.health / MAX_HEALTH * 100) + '%';
  }

  const isBoss = isBossWave(state.wave);

  if (isBoss) {
    // Boss wave: boss + fewer minions, slow spawn
    state.waveFarmerCount = Math.floor(state.wave * 0.8);
    state.spawnInterval = 2.5;
  } else {
    state.waveFarmerCount = 3 + state.wave * 2;
    state.spawnInterval = Math.max(0.4, 2 - state.wave * 0.15);
  }

  const w = getWeapon();
  buildGunModel();

  weaponNameEl.textContent = w.name;
  weaponNameEl.style.color = w.color;
  weaponDescEl.textContent = w.desc;

  if (isBoss) {
    const bossName = getZone().bossName || 'BOSS';
    waveAnnounce.innerHTML = `
      <div class="wave-num" style="color:#f44">BOSS WAVE ${state.wave}</div>
      <div class="weapon-unlock" style="color:#f44">${bossName}</div>
      <div class="weapon-unlock" style="color:${w.color};font-size:20px;margin-top:4px">${w.name}</div>
    `;
    // Spawn boss immediately
    createBoss(new THREE.Vector3(0, 0, -arenaD / 2 + 2));
  } else {
    waveAnnounce.innerHTML = `
      <div class="wave-num">WAVE ${state.wave}</div>
      <div class="weapon-unlock" style="color:${w.color}">${w.name}</div>
    `;
  }

  waveAnnounce.style.display = 'block';
  setTimeout(() => { waveAnnounce.style.display = 'none'; }, 2500);

  startMusic(state.wave);
}

function clampToArena(pos, radius) {
  const hw = arenaW / 2 - radius;
  const hd = arenaD / 2 - radius;
  pos.x = Math.max(-hw, Math.min(hw, pos.x));
  pos.z = Math.max(-hd, Math.min(hd, pos.z));
}

// ============================================================
// DAMAGE FARMER
// ============================================================
function damageFarmer(f, idx, damage, knockDir, knockForce, weapon) {
  // Freeze mechanic
  if (weapon && weapon.freeze) {
    if (!f.userData.freezeHits) f.userData.freezeHits = 0;
    f.userData.freezeHits++;
    if (f.userData.freezeHits >= 3) {
      // 3rd hit while frozen = shatter
      f.userData.health = 0;
      spawnFreezeShatter(f.position);
      playSound('zap');
    } else {
      f.userData.frozen = 2.0;
      f.userData.frozenSlow = 0.12;
      // Tint blue
      f.children.forEach(c => {
        if (c.material && c.material.emissive) {
          c.material.emissive.setHex(0x0088FF);
          c.material.emissiveIntensity = 0.5;
        }
      });
    }
  }

  f.userData.health -= damage;
  if (knockDir && knockForce) {
    const kbMult = f.userData.isBoss ? 0.15 : 1; // Boss barely moves
    f.userData.knockback.add(knockDir.clone().multiplyScalar(knockForce * kbMult));
  }
  playSound('hit');
  if (f.userData.isBoss) updateBossBar();

  if (f.userData.health <= 0) {
    const wasBoss = f.userData.isBoss;
    spawnFarmerDeath(f.position);
    if (wasBoss) {
      // Epic boss death
      spawnExplosion(f.position, 5, 0xFF4400);
      spawnExplosion(f.position.clone().add(new THREE.Vector3(1,0,1)), 3, 0xFFAA00);
      spawnExplosion(f.position.clone().add(new THREE.Vector3(-1,0,-1)), 3, 0xFF0000);
      shakeAmount = 1.5;
      boss = null;
      bossBarContainer.style.display = 'none';
      state.score += 100 * state.wave;
    } else {
      state.score += 10 * state.wave;
    }
    playSound('death');
    if (wasBoss) playSound('boom');
    scene.remove(f);
    farmers.splice(idx, 1);
    scoreEl.textContent = `Score: ${state.score}`;
    return true; // dead
  }
  return false;
}

// ============================================================
// UPDATE LOOP
// ============================================================
let lastTime = performance.now();

function update() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Cinematic takes over rendering
  if (updateCinematic(dt)) {
    requestAnimationFrame(update);
    return;
  }

  if (!state.alive) {
    renderer.render(scene, camera);
    requestAnimationFrame(update);
    return;
  }

  const w = getWeapon();

  // --- Auto-fire for minigun ---
  if (w.autofire && state.mouseDown) {
    shoot();
  }

  state.shootTimer = Math.max(0, state.shootTimer - dt);

  // Power charge
  if (getActivePower()) {
    if (state.powerCooldown > 0) {
      state.powerCooldown -= dt;
    } else if (state.powerCharge < 100) {
      state.powerCharge = Math.min(100, state.powerCharge + state.powerChargeRate * dt);
      if (state.powerCharge >= 100 && !state.powerReady) {
        state.powerReady = true;
        playSound('pew');
      }
    }
    updatePowerUI();
  }

  // --- Wave logic ---
  if (!state.waveActive) {
    state.waveTimer += dt;
    if (state.waveTimer > 2) {
      state.waveTimer = 0;
      startWave();
    }
  } else {
    state.spawnTimer += dt;
    if (state.spawnTimer >= state.spawnInterval && state.farmersSpawned < state.waveFarmerCount) {
      state.spawnTimer = 0;
      state.farmersSpawned++;
      spawnFarmer();
    }
    if (state.farmersSpawned >= state.waveFarmerCount && farmers.length === 0) {
      // Wave complete!
      const justFinished = state.wave;
      state.waveActive = false;
      state.wave++;
      waveEl.textContent = `Wave ${state.wave}`;

      // Rewards after every wave: full health
      state.health = MAX_HEALTH;
      healthFill.style.width = '100%';

      // Boss defeated: +1 life + checkpoint + unlock power + zone transition
      if (isBossWave(justFinished)) {
        state.lives = Math.min(state.lives + 1, 5);
        updateLivesDisplay();
        state.checkpoint = state.wave;

        // Unlock power if available
        const newPower = POWERS.find(p => p.unlockedAtWave === state.wave && !state.powers.includes(p.id));
        if (newPower) {
          state.powers.push(newPower.id);
          state.powerCharge = 100; // Start fully charged
          state.powerReady = true;
          // Announce
          setTimeout(() => {
            waveAnnounce.innerHTML = `
              <div class="wave-num" style="font-size:32px;color:${newPower.color}">POWER UNLOCKED!</div>
              <div class="weapon-unlock" style="color:${newPower.color}">${newPower.emoji} ${newPower.name}</div>
              <div style="font-size:16px;color:#aaa;margin-top:5px">${newPower.desc}<br>Press E to use!</div>
            `;
            waveAnnounce.style.display = 'block';
            setTimeout(() => { waveAnnounce.style.display = 'none'; }, 3000);
          }, 500);
          updatePowerUI();
        }

        // Check if next wave is a new zone
        const prevZoneIdx = getZoneIndex();
        const nextZone = ZONES.find(z => state.wave >= z.waves[0] && state.wave <= z.waves[1]);
        if (nextZone && nextZone !== ZONES[prevZoneIdx]) {
          // Zone transition cinematic!
          state.waveActive = false;
          startCinematic(ZONES[prevZoneIdx].id, nextZone.id, () => {
            // After cinematic, start first wave of new zone
            state.waveTimer = 0;
          });
        }
      }
    }
  }

  // --- Chicken movement (RECOIL ONLY, no WASD) ---
  pig.position.x += pigVel.x * dt;
  pig.position.z += pigVel.z * dt;
  pig.position.y += pigVel.y * dt;

  if (pig.position.y > 0) {
    pigVel.y -= 30 * dt;
  } else {
    pig.position.y = 0;
    pigVel.y = 0;
  }

  // Drag
  pigVel.x *= Math.pow(0.05, dt);
  pigVel.z *= Math.pow(0.05, dt);

  // Wall bounce
  const hw = arenaW / 2 - 0.8;
  const hd = arenaD / 2 - 0.8;
  if (Math.abs(pig.position.x) > hw) {
    pig.position.x = Math.sign(pig.position.x) * hw;
    pigVel.x *= -0.5;
    shakeAmount = Math.max(shakeAmount, 0.2);
  }
  if (Math.abs(pig.position.z) > hd) {
    pig.position.z = Math.sign(pig.position.z) * hd;
    pigVel.z *= -0.5;
    shakeAmount = Math.max(shakeAmount, 0.2);
  }

  // Face aim
  raycaster.setFromCamera(mouse, camera);
  const aimTarget = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, aimTarget);
  if (aimTarget) {
    pig.rotation.y = Math.atan2(aimTarget.x - pig.position.x, aimTarget.z - pig.position.z);
  }

  const speed = new THREE.Vector2(pigVel.x, pigVel.z).length();
  pig.rotation.z = Math.sin(now * 0.01) * Math.min(speed * 0.02, 0.3);

  // --- Bullets ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const bw = b.userData.weapon;
    // Sticky dynamite: follow attached enemy
    if (b.userData.stuck) {
      const target = b.userData.stuck;
      if (target.parent) { // still alive
        b.position.copy(target.position).setY(1.5);
        b.userData.stuckTimer -= dt;
        // Flashing effect
        b.material.color.setHex(Math.sin(b.userData.stuckTimer * 20) > 0 ? 0xFF0000 : 0xFF8800);
        if (b.userData.stuckTimer <= 0) {
          // BOOM
          spawnExplosion(b.position, bw.explosive, bw.bulletColor);
          playSound('boom');
          for (let k = farmers.length - 1; k >= 0; k--) {
            const ef = farmers[k];
            const ed = b.position.distanceTo(ef.position);
            if (ed < bw.explosive) {
              const eKnock = new THREE.Vector3().subVectors(ef.position, b.position).normalize();
              damageFarmer(ef, k, bw.damage, eKnock, bw.knockback * (1 - ed / bw.explosive), bw);
            }
          }
          scene.remove(b); bullets.splice(i, 1);
          continue;
        }
      } else {
        // Target died, explode now
        spawnExplosion(b.position, bw.explosive, bw.bulletColor);
        playSound('boom');
        for (let k = farmers.length - 1; k >= 0; k--) {
          const ef = farmers[k];
          const ed = b.position.distanceTo(ef.position);
          if (ed < bw.explosive) {
            const eKnock = new THREE.Vector3().subVectors(ef.position, b.position).normalize();
            damageFarmer(ef, k, bw.damage, eKnock, bw.knockback * (1 - ed / bw.explosive), bw);
          }
        }
        scene.remove(b); bullets.splice(i, 1);
        continue;
      }
      continue; // skip normal movement
    }

    // Trap: bullet becomes floor trap after short travel
    if (bw.trap && b.userData.life < bw.bulletLife - 0.3 && !b.userData.isTrap) {
      b.userData.isTrap = true;
      b.userData.vel.set(0, 0, 0);
      b.userData.life = bw.trapDuration;
      b.position.y = 0.1;
      // Make it look like a trap (flatten)
      b.scale.set(2, 0.3, 2);
      b.material.color.setHex(0x666666);
    }
    if (b.userData.isTrap) {
      // Check enemies walking over trap
      b.userData.life -= dt;
      b.rotation.y += dt;
      for (let j = farmers.length - 1; j >= 0; j--) {
        const f = farmers[j];
        const dist = b.position.distanceTo(f.position);
        if (dist < 1.0) {
          damageFarmer(f, j, bw.trapDamage || bw.damage, null, 0, bw);
          f.userData.frozen = 1.5;
          f.userData.frozenSlow = 0;
          spawnParticles(b.position, 6, 0x888888, 3, 0.3, 0.08);
          playSound('hit');
          scene.remove(b); bullets.splice(i, 1);
          break;
        }
      }
      if (b.userData.life <= 0) { scene.remove(b); bullets.splice(i, 1); }
      continue;
    }

    b.position.add(b.userData.vel.clone().multiplyScalar(dt));
    b.userData.life -= dt;

    // Trail for rail gun
    if (bw.trail) {
      const trail = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 3, 3),
        new THREE.MeshBasicMaterial({ color: bw.bulletColor, transparent: true, opacity: 0.5 })
      );
      trail.position.copy(b.position);
      trail.userData = { vel: new THREE.Vector3(), life: 0.2 };
      scene.add(trail);
      particles.push(trail);
    }

    // Check farmer hits
    let bulletRemoved = false;
    for (let j = farmers.length - 1; j >= 0; j--) {
      const f = farmers[j];
      if (b.userData.hitFarmers.has(f)) continue; // pierce: skip already-hit
      const dist = b.position.distanceTo(f.position);
      if (dist < 1.2) {
        const knockDir = b.userData.vel.clone().normalize();

        // Chain lightning
        if (bw.chain) {
          let lastPos = f.position.clone();
          let hitSet = new Set([f]);
          damageFarmer(f, j, bw.damage, knockDir, bw.knockback, bw);

          for (let c = 0; c < bw.chain; c++) {
            let closest = null, closestDist = bw.chainRange;
            for (const f2 of farmers) {
              if (hitSet.has(f2)) continue;
              const d = lastPos.distanceTo(f2.position);
              if (d < closestDist) { closest = f2; closestDist = d; }
            }
            if (closest) {
              hitSet.add(closest);
              createLightningBolt(lastPos.clone().setY(1.5), closest.position.clone().setY(1.5), bw.bulletColor);
              const ci = farmers.indexOf(closest);
              if (ci >= 0) damageFarmer(closest, ci, bw.damage, knockDir, bw.knockback * 0.5, bw);
              lastPos = closest.position.clone();
            }
          }
          scene.remove(b);
          bullets.splice(i, 1);
          bulletRemoved = true;
          break;
        }

        // Black hole gun
        if (bw.blackhole) {
          createBlackhole(b.position.clone(), bw);
          spawnExplosion(b.position, 2, 0x6600CC);
          scene.remove(b);
          bullets.splice(i, 1);
          bulletRemoved = true;
          break;
        }

        // Explosive
        if (bw.explosive > 0 && !bw.grenade) {
          // Explode on hit
          spawnExplosion(b.position, bw.explosive, bw.bulletColor);
          playSound('boom');
          // Damage all in radius
          for (let k = farmers.length - 1; k >= 0; k--) {
            const ef = farmers[k];
            const ed = b.position.distanceTo(ef.position);
            if (ed < bw.explosive) {
              const eKnock = new THREE.Vector3().subVectors(ef.position, b.position).normalize();
              damageFarmer(ef, k, bw.damage, eKnock, bw.knockback * (1 - ed / bw.explosive), bw);
            }
          }
          scene.remove(b);
          bullets.splice(i, 1);
          bulletRemoved = true;
          break;
        }

        // Pierce: damage but don't remove bullet
        if (bw.pierce) {
          b.userData.hitFarmers.add(f);
          damageFarmer(f, j, bw.damage, knockDir, bw.knockback, bw);
          continue; // don't remove bullet
        }

        // Sticky dynamite: attach to enemy, explode after delay
        if (bw.sticky && !b.userData.stuck) {
          b.userData.stuck = f;
          b.userData.stuckTimer = bw.stickyDelay;
          b.userData.vel.set(0, 0, 0);
          // Visual: bullet follows enemy
          bulletRemoved = false;
          break;
        }

        // Slingshot: bounce between enemies
        if (bw.enemyBounce && b.userData.enemyBounces === undefined) {
          b.userData.enemyBounces = bw.enemyBounce;
        }
        if (bw.enemyBounce && b.userData.enemyBounces > 0) {
          b.userData.enemyBounces--;
          b.userData.hitFarmers.add(f);
          damageFarmer(f, j, bw.damage, knockDir, bw.knockback, bw);
          // Find next closest enemy to bounce to
          let nextTarget = null, nextDist = 999;
          farmers.forEach(other => {
            if (b.userData.hitFarmers.has(other)) return;
            const d = f.position.distanceTo(other.position);
            if (d < 8 && d < nextDist) { nextTarget = other; nextDist = d; }
          });
          if (nextTarget) {
            const newDir = new THREE.Vector3().subVectors(nextTarget.position, f.position).setY(0).normalize();
            b.userData.vel = newDir.multiplyScalar(bw.bulletSpeed);
            b.position.copy(f.position).setY(1);
            playSound('bounce');
          } else {
            scene.remove(b); bullets.splice(i, 1); bulletRemoved = true;
          }
          break;
        }

        // Crossbow vortex: pull enemies to impact point
        if (bw.vortex) {
          // Create a pull vortex (reuse blackhole system)
          const vortexData = {
            blackholeRadius: bw.vortexRadius,
            blackholeDuration: bw.vortexDuration,
            blackholeDamage: 0.5,
          };
          createBlackhole(b.position.clone(), vortexData);
          spawnParticles(b.position, 10, 0x8B6914, 4, 0.4, 0.08);
          playSound('thump');
          damageFarmer(f, j, bw.damage, knockDir, bw.knockback, bw);
          scene.remove(b); bullets.splice(i, 1); bulletRemoved = true;
          break;
        }

        // Normal hit
        damageFarmer(f, j, bw.damage, knockDir, bw.knockback, bw);
        scene.remove(b);
        bullets.splice(i, 1);
        bulletRemoved = true;
        break;
      }
    }

    if (bulletRemoved) continue;

    // Wall collision / bounce / grenade
    const bx = Math.abs(b.position.x);
    const bz = Math.abs(b.position.z);
    const wallHit = bx > arenaW / 2 - 0.3 || bz > arenaD / 2 - 0.3;

    if (wallHit && b.userData.bounces > 0) {
      b.userData.bounces--;
      if (bx > arenaW / 2 - 0.3) {
        b.userData.vel.x *= -1;
        b.position.x = Math.sign(b.position.x) * (arenaW / 2 - 0.4);
      }
      if (bz > arenaD / 2 - 0.3) {
        b.userData.vel.z *= -1;
        b.position.z = Math.sign(b.position.z) * (arenaD / 2 - 0.4);
      }
      playSound('bounce');
      // Grenade: slow down on bounce
      if (bw.grenade) {
        b.userData.vel.multiplyScalar(0.6);
      }
      // Spark at bounce point
      spawnParticles(b.position, 3, bw.bulletColor, 3, 0.2, 0.05);
    }

    // Grenade explodes when life runs out
    if (bw.grenade && b.userData.life <= 0) {
      spawnExplosion(b.position, bw.explosive, bw.bulletColor);
      playSound('boom');
      for (let k = farmers.length - 1; k >= 0; k--) {
        const ef = farmers[k];
        const ed = b.position.distanceTo(ef.position);
        if (ed < bw.explosive) {
          const eKnock = new THREE.Vector3().subVectors(ef.position, b.position).normalize();
          damageFarmer(ef, k, bw.damage, eKnock, bw.knockback * (1 - ed / bw.explosive), bw);
        }
      }
      scene.remove(b);
      bullets.splice(i, 1);
      continue;
    }

    // Black hole bullet: create on timeout
    if (bw.blackhole && b.userData.life <= 0) {
      createBlackhole(b.position.clone(), bw);
      spawnExplosion(b.position, 2, 0x6600CC);
      scene.remove(b);
      bullets.splice(i, 1);
      continue;
    }

    // Out of bounds / expired
    if (b.userData.life <= 0 || (wallHit && b.userData.bounces <= 0 && !bw.grenade)) {
      scene.remove(b);
      bullets.splice(i, 1);
    }
  }

  // --- Black holes ---
  for (let i = blackholes.length - 1; i >= 0; i--) {
    const bh = blackholes[i];
    bh.userData.life -= dt;
    bh.userData.phase += dt * 3;

    // Spin rings
    bh.children.forEach((c, idx) => {
      if (idx > 0) {
        c.rotation.z += dt * (2 + idx);
        c.rotation.x += dt * (1 + idx * 0.5);
      }
    });

    // Pulse core
    const pulse = 1 + Math.sin(bh.userData.phase * 5) * 0.3;
    bh.children[0].scale.setScalar(pulse);

    // Suck in and damage farmers
    for (let j = farmers.length - 1; j >= 0; j--) {
      const f = farmers[j];
      const toHole = new THREE.Vector3().subVectors(bh.position, f.position).setY(0);
      const dist = toHole.length();
      if (dist < bh.userData.radius) {
        const force = (1 - dist / bh.userData.radius) * 12;
        const dir = toHole.normalize();
        f.position.x += dir.x * force * dt;
        f.position.z += dir.z * force * dt;

        if (dist < 1.5) {
          f.userData.health -= bh.userData.damage * dt;
          if (f.userData.health <= 0) {
            const wasBoss = f.userData.isBoss;
            spawnFarmerDeath(f.position);
            playSound('death');
            if (wasBoss) { boss = null; bossBarContainer.style.display = 'none'; spawnExplosion(f.position, 5, 0xFF4400); state.score += 100 * state.wave; }
            else { state.score += 10 * state.wave; }
            scene.remove(f);
            farmers.splice(j, 1);
            scoreEl.textContent = `Score: ${state.score}`;
          }
        }
      }
    }

    // Particles getting sucked in
    if (Math.random() < 0.3) {
      const angle = Math.random() * Math.PI * 2;
      const r = bh.userData.radius;
      const ppos = bh.position.clone().add(new THREE.Vector3(Math.cos(angle)*r, 0.5, Math.sin(angle)*r));
      spawnParticles(ppos, 1, 0x8800FF, 1, 0.3, 0.05);
    }

    if (bh.userData.life <= 0) {
      // Implode effect
      spawnExplosion(bh.position, 3, 0x8800FF);
      scene.remove(bh);
      blackholes.splice(i, 1);
    }
  }

  // --- Lightning bolts (visual decay) ---
  for (let i = lightningBolts.length - 1; i >= 0; i--) {
    const lb = lightningBolts[i];
    lb.life -= dt;
    if (lb.life <= 0) {
      scene.remove(lb.mesh);
      lightningBolts.splice(i, 1);
    }
  }

  // --- Farmers ---
  const baseFarmerSpeed = FARMER_BASE_SPEED + state.wave * 0.3;
  for (let i = farmers.length - 1; i >= 0; i--) {
    const f = farmers[i];
    const farmerSpeed = baseFarmerSpeed * (f.userData.speedMult || 1);
    const toChicken = new THREE.Vector3().subVectors(pig.position, f.position).setY(0);
    const dist = toChicken.length();
    const toNorm = dist > 0.01 ? toChicken.clone().normalize() : new THREE.Vector3(0, 0, 1);

    // Freeze decay
    if (f.userData.frozen > 0) {
      f.userData.frozen -= dt;
      if (f.userData.frozen <= 0) {
        f.userData.frozenSlow = 1;
        f.userData.freezeHits = 0;
        f.children.forEach(c => {
          if (c.material && c.material.emissive) c.material.emissiveIntensity = 0;
        });
      }
    }

    if (f.userData.attackTimer > 0) f.userData.attackTimer -= dt;
    const spd = farmerSpeed * f.userData.frozenSlow;

    if (dist > 1.0 && !f.userData.isAttacking) {
      f.position.x += toNorm.x * spd * dt;
      f.position.z += toNorm.z * spd * dt;
    }

    f.rotation.y = Math.atan2(toNorm.x, toNorm.z);

    f.position.x += f.userData.knockback.x * dt;
    f.position.z += f.userData.knockback.z * dt;
    f.userData.knockback.multiplyScalar(Math.pow(0.01, dt));

    // Attack animation
    if (f.userData.isAttacking) {
      f.userData.attackAnim -= dt;
      const t = 1 - (f.userData.attackAnim / 0.4);
      const lunge = Math.sin(t * Math.PI) * 0.6;
      f.position.x += toNorm.x * lunge * dt * 8 * f.userData.frozenSlow;
      f.position.z += toNorm.z * lunge * dt * 8 * f.userData.frozenSlow;
      if (f.children[0]) f.children[0].rotation.x = Math.sin(t * Math.PI) * 0.4;
      if (f.children[6]) f.children[6].rotation.x = Math.sin(t * Math.PI) * -1.2;
      if (f.children[7]) f.children[7].rotation.x = Math.sin(t * Math.PI) * -1.2;
      if (f.children[8]) {
        f.children[8].rotation.x = Math.sin(t * Math.PI) * -0.8;
        f.children[8].position.z = 0.2 + Math.sin(t * Math.PI) * 0.8;
      }
      if (t > 0.3 && t < 0.5 && dist < 2.0) {
        state.health -= FARMER_DAMAGE;
        healthFill.style.width = Math.max(0, state.health / MAX_HEALTH * 100) + '%';
        damageFlashTimer = 0.15;
        pigVel.x -= toNorm.x * 6;
        pigVel.z -= toNorm.z * 6;
        playSound('hit');
        if (state.health <= 0) die();
        f.userData.attackAnim = Math.min(f.userData.attackAnim, 0.12);
      }
      if (f.userData.attackAnim <= 0) {
        f.userData.isAttacking = false;
        f.userData.attackTimer = 0.8;
        if (f.children[0]) f.children[0].rotation.x = 0;
        if (f.children[6]) f.children[6].rotation.x = 0;
        if (f.children[7]) f.children[7].rotation.x = 0;
        if (f.children[8]) { f.children[8].rotation.x = 0; f.children[8].position.z = 0.2; }
      }
    }

    if (dist < 1.8 && !f.userData.isAttacking && f.userData.attackTimer <= 0) {
      f.userData.isAttacking = true;
      f.userData.attackAnim = 0.4;
    }

    if (!f.userData.isAttacking) {
      f.userData.walkPhase += dt * 8 * f.userData.frozenSlow;
      if (f.children[4]) f.children[4].position.y = 0.3 + Math.sin(f.userData.walkPhase) * 0.15;
      if (f.children[5]) f.children[5].position.y = 0.3 + Math.sin(f.userData.walkPhase + Math.PI) * 0.15;
      if (f.children[6]) f.children[6].rotation.x = Math.sin(f.userData.walkPhase) * 0.3;
      if (f.children[7]) f.children[7].rotation.x = Math.sin(f.userData.walkPhase + Math.PI) * 0.3;
      if (f.children[0]) f.children[0].position.y = 1.2 + Math.abs(Math.sin(f.userData.walkPhase)) * 0.05;
    }

    clampToArena(f.position, f.userData.isBoss ? 1.5 : 0.5);

    // Boss-specific behavior
    if (f.userData.isBoss) {
      // Stomp attack periodically
      f.userData.stompTimer -= dt;
      if (f.userData.stompTimer <= 0) {
        f.userData.stompTimer = 5.5 - state.wave * 0.15;
        bossStompAttack();
      }

      // Boss pulsing glow
      const pulse = Math.sin(now * 0.005) * 0.3 + 0.5;
      if (f.children[9]) f.children[9].material.emissiveIntensity = pulse;
      if (f.children[10]) f.children[10].material.emissiveIntensity = pulse;

      updateBossBar();
    }
  }

  // --- Particles ---
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.position.add(p.userData.vel.clone().multiplyScalar(dt));
    p.userData.vel.y -= 15 * dt;
    p.userData.life -= dt;
    p.scale.setScalar(Math.max(0.01, p.userData.life * 2));
    if (p.material.opacity !== undefined) p.material.opacity = Math.max(0, p.userData.life * 3);
    if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
  }

  // --- Feathers ---
  for (let i = feathers.length - 1; i >= 0; i--) {
    const f = feathers[i];
    f.position.add(f.userData.vel.clone().multiplyScalar(dt));
    f.userData.vel.y -= 5 * dt;
    f.userData.vel.multiplyScalar(Math.pow(0.3, dt));
    f.rotation.z += f.userData.rotSpeed * dt;
    f.userData.life -= dt;
    if (f.userData.life <= 0) { scene.remove(f); feathers.splice(i, 1); }
  }

  // --- Damage flash ---
  if (damageFlashTimer > 0) {
    damageFlashTimer -= dt;
    pig.children.forEach(c => {
      if (c.material && c.material.emissive) {
        c.material.emissive.setHex(0xff0000);
        c.material.emissiveIntensity = damageFlashTimer * 6;
      }
    });
    healthFill.style.background = damageFlashTimer > 0.08 ? '#ff0' : '#e44';
    damageFlash.style.opacity = damageFlashTimer * 5;
  } else {
    pig.children.forEach(c => {
      if (c.material && c.material.emissive) c.material.emissiveIntensity = 0;
    });
    damageFlash.style.opacity = 0;
  }
  if (damageFlashTimer <= 0) {
    const hpPct = state.health / MAX_HEALTH;
    if (hpPct > 0.6) healthFill.style.background = '#4e4';
    else if (hpPct > 0.3) healthFill.style.background = '#ea4';
    else healthFill.style.background = '#e44';
  }

  // --- Camera ---
  const camTarget = new THREE.Vector3(
    pig.position.x * 0.6,
    cameraBasePos.y,
    cameraBasePos.z + pig.position.z * 0.6
  );
  camera.position.lerp(camTarget, dt * 4);

  if (shakeAmount > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeAmount;
    camera.position.z += (Math.random() - 0.5) * shakeAmount * 0.3;
    shakeAmount *= Math.pow(0.01, dt);
    if (shakeAmount < 0.01) shakeAmount = 0;
  }

  camera.lookAt(pig.position.x * 0.6, 0, pig.position.z * 0.6);

  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

// ============================================================
// DEATH / RESTART
// ============================================================
function updateLivesDisplay() {
  let s = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    s += i < state.lives ? '\u{1F437}' : '\u{1F480}';
  }
  livesEl.textContent = s;
}

function clearArena() {
  farmers.forEach(f => scene.remove(f)); farmers = [];
  bullets.forEach(b => scene.remove(b)); bullets = [];
  particles.forEach(p => scene.remove(p)); particles = [];
  feathers.forEach(f => scene.remove(f)); feathers = [];
  blackholes.forEach(b => scene.remove(b)); blackholes = [];
  lightningBolts.forEach(l => scene.remove(l.mesh)); lightningBolts = [];
  boss = null;
  bossBarContainer.style.display = 'none';
}

function getCheckpointWave() {
  // Checkpoints after each boss: wave 1, wave 6, wave 11...
  if (state.wave > 5) return 6;
  return 1;
}

function die() {
  state.alive = false;
  spawnFeathers(pig.position);
  spawnFeathers(pig.position);
  spawnFeathers(pig.position);
  playSound('death');

  state.lives--;
  updateLivesDisplay();

  if (state.lives <= 0) {
    // Game over - restart from checkpoint
    stopMusic();
    finalScoreEl.textContent = `Score: ${state.score}`;
    gameOverEl.style.display = 'flex';
    // Store checkpoint for restart
    state.checkpoint = getCheckpointWave();
  } else {
    // Respawn on same wave after short delay
    setTimeout(respawnOnWave, 1500);
  }
}

function respawnOnWave() {
  clearArena();

  // Reset pig position & health, keep score & wave
  pig.position.set(0, 0, 0);
  pig.rotation.set(0, 0, 0);
  pigVel.set(0, 0, 0);

  state.health = MAX_HEALTH;
  state.alive = true;
  state.shootTimer = 0;

  // Restart the same wave
  state.waveActive = false;
  state.waveTimer = 0;
  state.farmersSpawned = 0;
  state.spawnTimer = 0;

  healthFill.style.width = '100%';
  waveAnnounce.style.display = 'none';
}

function restartGame() {
  clearArena();

  pig.position.set(0, 0, 0);
  pig.rotation.set(0, 0, 0);
  pigVel.set(0, 0, 0);

  // Restart from checkpoint (after boss = keep progress)
  const checkpoint = state.checkpoint || 1;
  state.wave = checkpoint;
  state.score = checkpoint > 1 ? Math.floor(state.score * 0.5) : 0; // Keep half score from checkpoint

  // Set health based on checkpoint
  if (checkpoint > 5) {
    MAX_HEALTH = BOOSTED_HEALTH;
    bonusSegment.style.display = 'block';
  } else {
    MAX_HEALTH = BASE_HEALTH;
    bonusSegment.style.display = 'none';
  }

  state.lives = MAX_LIVES;
  state.health = MAX_HEALTH;
  state.alive = true;
  state.shootTimer = 0;
  state.waveTimer = 0;
  state.waveFarmerCount = 4;
  state.farmersSpawned = 0;
  state.spawnTimer = 0;
  state.waveActive = false;
  state.checkpoint = checkpoint > 1 ? checkpoint : 1;

  // Restore powers based on checkpoint
  state.powers = [];
  state.powerCharge = 0;
  state.powerReady = false;
  state.powerCooldown = 0;
  POWERS.forEach(p => {
    if (p.unlockedAtWave <= checkpoint) {
      state.powers.push(p.id);
      state.powerCharge = 100;
      state.powerReady = true;
    }
  });
  updatePowerUI();

  // Build correct zone for checkpoint
  const zone = getZone();
  buildZone(zone.id);

  const w = getWeapon();
  weaponNameEl.textContent = w.name;
  weaponNameEl.style.color = w.color;
  weaponDescEl.textContent = w.desc;
  buildGunModel();
  updateLivesDisplay();

  scoreEl.textContent = `Score: ${state.score}`;
  waveEl.textContent = `Wave ${state.wave}`;
  healthFill.style.width = '100%';
  gameOverEl.style.display = 'none';
  waveAnnounce.style.display = 'none';

  stopMusic();
}

// ============================================================
// INPUT - Mouse + E key for power
// ============================================================
window.addEventListener('keydown', e => {
  if (e.code === 'KeyE') activatePower();
});

window.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('mousedown', e => {
  if (e.button === 0) {
    state.mouseDown = true;
    shoot();
  }
});

window.addEventListener('mouseup', e => {
  if (e.button === 0) state.mouseDown = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('contextmenu', e => e.preventDefault());

// ============================================================
// DEV TOOLS
// ============================================================
function devGoToWave(wave) {
  clearArena();
  cinematicState = null;

  pig.position.set(0, 0, 0);
  pig.rotation.set(0, 0, 0);
  pigVel.set(0, 0, 0);

  state.wave = wave;
  state.lives = MAX_LIVES;
  updateHealthMax();
  state.health = MAX_HEALTH;
  state.alive = true;
  state.shootTimer = 0;
  state.waveTimer = 0;
  state.farmersSpawned = 0;
  state.spawnTimer = 0;
  state.waveActive = false;

  // Build correct zone for this wave
  const zone = getZone();
  buildZone(zone.id);

  // Unlock all powers available at this wave
  state.powers = [];
  state.powerCharge = 0;
  state.powerReady = false;
  state.powerCooldown = 0;
  POWERS.forEach(p => {
    if (p.unlockedAtWave <= wave) {
      state.powers.push(p.id);
      state.powerCharge = 100;
      state.powerReady = true;
    }
  });
  updatePowerUI();

  const w = getWeapon();
  weaponNameEl.textContent = w.name;
  weaponNameEl.style.color = w.color;
  weaponDescEl.textContent = w.desc;
  buildGunModel();
  updateLivesDisplay();

  waveEl.textContent = `Wave ${state.wave}`;
  healthFill.style.width = '100%';
  gameOverEl.style.display = 'none';
  waveAnnounce.style.display = 'none';

  // Reset select
  document.getElementById('level-select').selectedIndex = 0;
}

function devSelectAction(val) {
  if (val === 'cinematic') {
    clearArena();
    state.wave = 5;
    state.alive = true;
    pig.position.set(0, 0, 0);
    pigVel.set(0, 0, 0);
    buildZone('barn');
    startCinematic('barn', 'forest', () => {
      state.wave = 6;
      state.waveTimer = 0;
      state.waveActive = false;
      waveEl.textContent = 'Wave 6';
    });
    document.getElementById('level-select').selectedIndex = 0;
  } else {
    devGoToWave(parseInt(val));
  }
}

// ============================================================
// INIT
// ============================================================
buildZone('barn');
createPig();
updateLivesDisplay();
requestAnimationFrame(update);
