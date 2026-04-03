// ============================================================
// PIG BANG - Zone 2: Forest Platformer
// ============================================================

// This module handles the 2D side-scrolling platformer zone.
// It uses the same Three.js scene/renderer but with a side camera.

let platState = null; // null when not in platformer mode
let platObjects = new THREE.Group(); // all platformer-specific objects
let platPig = null;

const PLAT = {
  gravity: -35,
  jumpForce: 14,
  moveSpeed: 8,
  levelLength: 200,
  groundY: 0,
  cameraOffsetX: 5,
  cameraOffsetY: 4,
};

// ============================================================
// LEVEL GENERATION
// ============================================================
function generatePlatformerLevel() {
  const platforms = [];
  const enemies = [];
  const coins = [];

  // Ground segments (with gaps)
  let x = -5;
  while (x < PLAT.levelLength) {
    const segLen = 8 + Math.random() * 15;
    const hasGap = x > 10 && Math.random() < 0.3;
    const gapLen = hasGap ? 3 + Math.random() * 3 : 0;

    if (!hasGap) {
      platforms.push({ x: x + segLen / 2, y: 0, w: segLen, h: 1, type: 'ground' });
    } else {
      // Platform before gap
      platforms.push({ x: x + segLen / 2, y: 0, w: segLen, h: 1, type: 'ground' });
      x += segLen + gapLen;
      continue;
    }

    // Elevated platforms
    if (x > 5 && Math.random() < 0.4) {
      const py = 2 + Math.random() * 3;
      const pw = 3 + Math.random() * 4;
      platforms.push({
        x: x + segLen * (0.3 + Math.random() * 0.4),
        y: py, w: pw, h: 0.5, type: 'platform'
      });

      // Coin on platform
      coins.push({
        x: x + segLen * (0.3 + Math.random() * 0.4),
        y: py + 1.5,
      });
    }

    // Enemies on ground
    if (x > 8 && Math.random() < 0.5) {
      const etype = Math.random();
      if (etype < 0.5) {
        enemies.push({ x: x + segLen * 0.6, y: 0.5, type: 'dog' });
      } else if (etype < 0.8) {
        enemies.push({ x: x + segLen * 0.5, y: 0.5, type: 'hunter' });
      } else {
        enemies.push({ x: x + segLen * 0.5, y: 0.5, type: 'bear' });
      }
    }

    // Ground coins
    if (Math.random() < 0.3) {
      for (let i = 0; i < 3; i++) {
        coins.push({ x: x + segLen * 0.3 + i * 1.2, y: 1.5 });
      }
    }

    x += segLen;
  }

  // End flag
  platforms.push({ x: PLAT.levelLength, y: 0, w: 4, h: 1, type: 'end' });

  return { platforms, enemies, coins };
}

// ============================================================
// BUILD 3D PLATFORMER SCENE
// ============================================================
function buildPlatformerScene(level) {
  // Clear old
  if (platObjects.parent) scene.remove(platObjects);
  platObjects = new THREE.Group();

  // Sky backdrop
  scene.background = new THREE.Color(0x1a2a1a);
  scene.fog = new THREE.Fog(0x1a2a1a, 40, 80);
  ambientLight.color.setHex(0x558844);
  ambientLight.intensity = 0.5;
  dirLight.color.setHex(0xaaccaa);
  dirLight.intensity = 0.7;
  dirLight.position.set(20, 30, 10);

  // Platforms
  level.platforms.forEach(p => {
    let color = 0x4a3520; // ground brown
    if (p.type === 'platform') color = 0x5C3317; // wood
    if (p.type === 'end') color = 0xFFD700; // gold end

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(p.w, p.h, 3),
      new THREE.MeshLambertMaterial({ color })
    );
    mesh.position.set(p.x, p.y - p.h / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { platform: p };
    platObjects.add(mesh);

    // Grass on top of ground
    if (p.type === 'ground') {
      const grass = new THREE.Mesh(
        new THREE.BoxGeometry(p.w, 0.15, 3.1),
        new THREE.MeshLambertMaterial({ color: 0x2d5a1e })
      );
      grass.position.set(p.x, p.y + 0.07, 0);
      platObjects.add(grass);
    }
  });

  // Background trees (decorative, behind the action)
  const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
  const treeLeafMats = [
    new THREE.MeshLambertMaterial({ color: 0x1a5a1a }),
    new THREE.MeshLambertMaterial({ color: 0x0a4a0a }),
    new THREE.MeshLambertMaterial({ color: 0x2a6a2a }),
  ];
  for (let i = 0; i < 60; i++) {
    const tx = -10 + i * (PLAT.levelLength / 55);
    const tz = -4 - Math.random() * 8;
    const h = 4 + Math.random() * 5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, h, 6), treeTrunkMat);
    trunk.position.set(tx, h / 2 - 0.5, tz);
    platObjects.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 + Math.random(), 6, 6),
      treeLeafMats[i % 3]
    );
    leaves.position.set(tx + (Math.random() - 0.5), h + 0.5, tz);
    platObjects.add(leaves);
  }

  // Foreground bushes (in front, semi-transparent)
  for (let i = 0; i < 30; i++) {
    const bx = -5 + i * (PLAT.levelLength / 28);
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.8 + Math.random() * 0.5, 6, 4),
      new THREE.MeshLambertMaterial({ color: 0x1a5a1a, transparent: true, opacity: 0.5 })
    );
    bush.position.set(bx, 0.3, 3 + Math.random() * 2);
    platObjects.add(bush);
  }

  // Coins
  level.coins.forEach(c => {
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8),
      new THREE.MeshBasicMaterial({ color: 0xFFD700 })
    );
    coin.position.set(c.x, c.y, 0);
    coin.rotation.x = Math.PI / 2;
    coin.userData = { coin: true, collected: false };
    platObjects.add(coin);
  });

  // Enemies
  level.enemies.forEach(e => {
    const enemy = createPlatEnemy(e);
    platObjects.add(enemy);
  });

  // Finish flag
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 6, 4),
    new THREE.MeshLambertMaterial({ color: 0x888888 })
  );
  flagPole.position.set(PLAT.levelLength, 3, 0);
  platObjects.add(flagPole);
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xFF4444, side: THREE.DoubleSide })
  );
  flag.position.set(PLAT.levelLength + 0.8, 5, 0);
  platObjects.add(flag);

  scene.add(platObjects);
}

function createPlatEnemy(e) {
  const group = new THREE.Group();

  if (e.type === 'dog') {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.6), bodyMat);
    body.position.y = 0.4;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), bodyMat);
    head.position.set(0.3, 0.55, 0);
    group.add(head);
    // Legs
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), bodyMat);
      leg.position.set((i < 2 ? 0.15 : -0.15), 0.15, (i % 2 === 0 ? 0.15 : -0.15));
      group.add(leg);
    }
    group.userData = {
      type: 'dog', hp: 1, speed: 4, patrolRange: 3,
      startX: e.x, dir: 1, phase: Math.random() * Math.PI * 2,
      damage: 15, bounceForce: 8,
    };
  }
  else if (e.type === 'hunter') {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x556B2F });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.5), bodyMat);
    body.position.y = 1.0;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), new THREE.MeshLambertMaterial({ color: 0xFFCBA4 }));
    head.position.y = 1.75;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 6, 3, 0, Math.PI*2, 0, Math.PI*0.5), new THREE.MeshLambertMaterial({ color: 0xFF6600 }));
    cap.position.y = 1.9;
    group.add(cap);
    // Rifle
    const rifle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    rifle.rotation.z = Math.PI / 2;
    rifle.position.set(0.6, 1.2, 0);
    group.add(rifle);
    // Legs
    [-0.15, 0.15].forEach(offset => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), bodyMat);
      leg.position.set(offset, 0.25, 0);
      group.add(leg);
    });
    group.userData = {
      type: 'hunter', hp: 2, speed: 0, patrolRange: 0,
      startX: e.x, dir: -1, phase: Math.random() * Math.PI * 2,
      damage: 20, shootTimer: 2 + Math.random() * 2, shootInterval: 2.5,
    };
  }
  else if (e.type === 'bear') {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.8), bodyMat);
    body.position.y = 1.2;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), bodyMat);
    head.position.y = 2.1;
    group.add(head);
    // Eyes
    [-0.12, 0.12].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color: 0xFFAA00 }));
      eye.position.set(s, 2.15, 0.3);
      group.add(eye);
    });
    // Legs
    [-0.3, 0.3].forEach(s => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), bodyMat);
      leg.position.set(s, 0.35, 0);
      group.add(leg);
    });
    group.userData = {
      type: 'bear', hp: 4, speed: 2, patrolRange: 4,
      startX: e.x, dir: 1, phase: Math.random() * Math.PI * 2,
      damage: 25, bounceForce: 12,
    };
  }

  group.position.set(e.x, e.y, 0);
  group.userData.alive = true;
  group.userData.baseY = e.y;
  return group;
}

// ============================================================
// PLATFORMER PIG (reuse the pig model but side-view controls)
// ============================================================
function initPlatPig() {
  pig.position.set(0, 2, 0);
  pig.rotation.set(0, Math.PI / 2, 0); // face right
  pig.scale.setScalar(1);

  platPig = {
    vx: 0,
    vy: 0,
    grounded: false,
    facingRight: true,
    dead: false,
    jumpBuffer: 0,
    coyoteTime: 0,
    dashTimer: 0,
    dashCooldown: 0,
    invincible: 0,
  };
}

// ============================================================
// PLATFORMER UPDATE
// ============================================================
let platBullets = []; // hunter bullets
let platParticles = [];

function startPlatformer() {
  // Generate level
  const level = generatePlatformerLevel();
  platState = {
    level,
    coinsCollected: 0,
    totalCoins: level.coins.length,
    distance: 0,
    finished: false,
    time: 0,
    health: 100,
  };

  // Build scene
  buildPlatformerScene(level);
  initPlatPig();

  // Camera setup for side view
  camera.position.set(pig.position.x + PLAT.cameraOffsetX, PLAT.cameraOffsetY, 15);
  camera.lookAt(pig.position.x + PLAT.cameraOffsetX, PLAT.cameraOffsetY, 0);

  // UI updates
  healthFill.style.width = '100%';
}

function updatePlatformer(dt) {
  if (!platState || platState.finished) return;
  platState.time += dt;

  const pp = platPig;
  const keys = platKeys;

  // --- Input ---
  if (!pp.dead) {
    // Horizontal movement
    let moveX = 0;
    if (keys.right) moveX = 1;
    if (keys.left) moveX = -1;

    pp.vx = moveX * PLAT.moveSpeed;

    // Face direction
    if (moveX > 0 && !pp.facingRight) { pp.facingRight = true; pig.rotation.y = Math.PI / 2; }
    if (moveX < 0 && pp.facingRight) { pp.facingRight = false; pig.rotation.y = -Math.PI / 2; }

    // Jump
    pp.jumpBuffer -= dt;
    if (keys.jump) {
      pp.jumpBuffer = 0.1;
      keys.jump = false; // consume
    }
    pp.coyoteTime -= dt;
    if (pp.grounded) pp.coyoteTime = 0.1;

    if (pp.jumpBuffer > 0 && pp.coyoteTime > 0) {
      pp.vy = PLAT.jumpForce;
      pp.grounded = false;
      pp.jumpBuffer = 0;
      pp.coyoteTime = 0;
      playSound('pew');
    }

    // Dash (shift)
    pp.dashCooldown -= dt;
    if (keys.dash && pp.dashCooldown <= 0) {
      pp.dashTimer = 0.2;
      pp.dashCooldown = 0.8;
      pp.vx = (pp.facingRight ? 1 : -1) * 25;
      pp.invincible = 0.25;
      keys.dash = false;
      playSound('thump');
      // Dash particles
      for (let i = 0; i < 5; i++) {
        spawnPlatParticle(pig.position.clone(), 0xFFAAAA);
      }
    }
    if (pp.dashTimer > 0) {
      pp.dashTimer -= dt;
    }
  }

  // --- Physics ---
  pp.vy += PLAT.gravity * dt;
  pig.position.x += pp.vx * dt;
  pig.position.y += pp.vy * dt;

  // Invincibility timer
  if (pp.invincible > 0) {
    pp.invincible -= dt;
    pig.visible = Math.sin(pp.invincible * 30) > 0;
  } else {
    pig.visible = true;
  }

  // --- Platform collision ---
  pp.grounded = false;
  platObjects.children.forEach(obj => {
    if (!obj.userData.platform) return;
    const p = obj.userData.platform;

    // Only collide from above
    const pigLeft = pig.position.x - 0.4;
    const pigRight = pig.position.x + 0.4;
    const pigBottom = pig.position.y;
    const platTop = p.y;
    const platLeft = p.x - p.w / 2;
    const platRight = p.x + p.w / 2;

    if (pigRight > platLeft && pigLeft < platRight &&
        pigBottom <= platTop + 0.2 && pigBottom >= platTop - 0.5 &&
        pp.vy <= 0) {
      pig.position.y = platTop;
      pp.vy = 0;
      pp.grounded = true;
    }
  });

  // Fall death
  if (pig.position.y < -10) {
    platDie();
  }

  // --- Coin collection ---
  platObjects.children.forEach(obj => {
    if (!obj.userData.coin || obj.userData.collected) return;
    const dist = pig.position.distanceTo(obj.position);
    if (dist < 1) {
      obj.userData.collected = true;
      obj.visible = false;
      platState.coinsCollected++;
      state.score += 5;
      scoreEl.textContent = `Score: ${state.score}`;
      playSound('pew');
    }
  });

  // --- Enemy update ---
  platObjects.children.forEach(obj => {
    if (!obj.userData.alive) return;
    const ud = obj.userData;

    if (ud.type === 'dog' || ud.type === 'bear') {
      // Patrol back and forth
      ud.phase += dt;
      obj.position.x = ud.startX + Math.sin(ud.phase * (ud.speed / ud.patrolRange)) * ud.patrolRange;
      obj.rotation.y = Math.sin(ud.phase * (ud.speed / ud.patrolRange)) > 0 ? Math.PI / 2 : -Math.PI / 2;

      // Walking animation
      obj.position.y = ud.baseY + Math.abs(Math.sin(ud.phase * 6)) * 0.1;
    }

    if (ud.type === 'hunter') {
      // Face pig
      obj.rotation.y = pig.position.x > obj.position.x ? Math.PI / 2 : -Math.PI / 2;

      // Shoot at pig
      ud.shootTimer -= dt;
      if (ud.shootTimer <= 0 && Math.abs(pig.position.x - obj.position.x) < 15) {
        ud.shootTimer = ud.shootInterval;
        const dir = pig.position.x > obj.position.x ? 1 : -1;
        const bullet = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 4, 4),
          new THREE.MeshBasicMaterial({ color: 0xFF4400 })
        );
        bullet.position.copy(obj.position);
        bullet.position.y += 1.2;
        bullet.position.x += dir * 0.5;
        bullet.userData = { vx: dir * 12, life: 3 };
        scene.add(bullet);
        platBullets.push(bullet);
        playSound('minigun');
      }
    }

    // Collision with pig
    if (pp.invincible <= 0 && !pp.dead) {
      const dx = Math.abs(pig.position.x - obj.position.x);
      const dy = Math.abs(pig.position.y - obj.position.y);

      if (dx < 0.8 && dy < 1.0) {
        // Jump on top = kill enemy
        if (pp.vy < 0 && pig.position.y > obj.position.y + 0.3) {
          // Stomp!
          ud.hp--;
          pp.vy = 10; // bounce up
          playSound('hit');
          spawnPlatParticle(obj.position.clone(), 0xFFFF00);

          if (ud.hp <= 0) {
            ud.alive = false;
            obj.visible = false;
            state.score += 20;
            scoreEl.textContent = `Score: ${state.score}`;
            playSound('death');
            // Death particles
            for (let i = 0; i < 8; i++) spawnPlatParticle(obj.position.clone(), 0xFF4400);
          }
        } else {
          // Hit by enemy
          platTakeDamage(ud.damage, obj);
        }
      }
    }
  });

  // --- Hunter bullets ---
  for (let i = platBullets.length - 1; i >= 0; i--) {
    const b = platBullets[i];
    b.position.x += b.userData.vx * dt;
    b.userData.life -= dt;

    // Hit pig
    if (pp.invincible <= 0 && !pp.dead) {
      const dx = Math.abs(pig.position.x - b.position.x);
      const dy = Math.abs(pig.position.y + 0.8 - b.position.y);
      if (dx < 0.5 && dy < 0.8) {
        platTakeDamage(15, null);
        scene.remove(b);
        platBullets.splice(i, 1);
        continue;
      }
    }

    if (b.userData.life <= 0) {
      scene.remove(b);
      platBullets.splice(i, 1);
    }
  }

  // --- Particles ---
  for (let i = platParticles.length - 1; i >= 0; i--) {
    const p = platParticles[i];
    p.position.add(p.userData.vel.clone().multiplyScalar(dt));
    p.userData.vel.y -= 15 * dt;
    p.userData.life -= dt;
    p.scale.setScalar(Math.max(0.01, p.userData.life * 2));
    if (p.userData.life <= 0) {
      scene.remove(p);
      platParticles.splice(i, 1);
    }
  }

  // --- Finish check ---
  if (pig.position.x >= PLAT.levelLength - 1 && !platState.finished) {
    platState.finished = true;
    // Victory!
    waveAnnounce.innerHTML = `
      <div class="wave-num" style="color:#FFD700">LEVEL COMPLETE!</div>
      <div class="weapon-unlock" style="color:#fff">Coins: ${platState.coinsCollected}/${platState.totalCoins}</div>
    `;
    waveAnnounce.style.display = 'block';
    setTimeout(() => {
      waveAnnounce.style.display = 'none';
      endPlatformer(true);
    }, 2500);
  }

  // --- Camera ---
  const camX = pig.position.x + PLAT.cameraOffsetX;
  const camY = Math.max(PLAT.cameraOffsetY, pig.position.y + 2);
  camera.position.lerp(new THREE.Vector3(camX, camY, 15), dt * 5);
  camera.lookAt(camX, camY - 1, 0);

  // --- UI ---
  healthFill.style.width = Math.max(0, platState.health) + '%';
  const hpPct = platState.health / 100;
  if (hpPct > 0.6) healthFill.style.background = '#4e4';
  else if (hpPct > 0.3) healthFill.style.background = '#ea4';
  else healthFill.style.background = '#e44';

  // Distance display
  waveEl.textContent = `${Math.floor(pig.position.x)}m / ${PLAT.levelLength}m`;

  // Animate coins spinning
  platObjects.children.forEach(obj => {
    if (obj.userData.coin && !obj.userData.collected) {
      obj.rotation.z += dt * 3;
      obj.position.y += Math.sin(platState.time * 3 + obj.position.x) * dt * 0.5;
    }
  });

  renderer.render(scene, camera);
}

function platTakeDamage(amount, source) {
  if (platPig.invincible > 0 || platPig.dead) return;
  platState.health -= amount;
  platPig.invincible = 1.0;
  damageFlashTimer = 0.15;
  playSound('hit');

  // Knockback
  if (source) {
    const dir = pig.position.x > source.position.x ? 1 : -1;
    platPig.vx = dir * 8;
    platPig.vy = 6;
  }

  if (platState.health <= 0) {
    platDie();
  }
}

function platDie() {
  if (platPig.dead) return;
  platPig.dead = true;
  playSound('death');

  state.lives--;
  updateLivesDisplay();

  if (state.lives <= 0) {
    gameOverEl.querySelector('h1').textContent = 'GAME OVER';
    finalScoreEl.textContent = `Score: ${state.score}`;
    gameOverEl.style.display = 'flex';
  } else {
    // Respawn
    setTimeout(() => {
      platState.health = 100;
      pig.position.set(0, 2, 0);
      platPig.vx = 0;
      platPig.vy = 0;
      platPig.dead = false;
      platPig.invincible = 1.5;
      healthFill.style.width = '100%';
    }, 1000);
  }
}

function spawnPlatParticle(pos, color) {
  const p = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 4, 4),
    new THREE.MeshBasicMaterial({ color })
  );
  p.position.copy(pos);
  p.position.y += 0.5;
  p.userData = {
    vel: new THREE.Vector3((Math.random()-0.5)*6, Math.random()*5+2, (Math.random()-0.5)*2),
    life: 0.5 + Math.random() * 0.3,
  };
  scene.add(p);
  platParticles.push(p);
}

function endPlatformer(success) {
  // Clean up platformer objects
  if (platObjects.parent) scene.remove(platObjects);
  platBullets.forEach(b => scene.remove(b));
  platBullets = [];
  platParticles.forEach(p => scene.remove(p));
  platParticles = [];
  platState = null;

  if (success) {
    // Advance to next zone or end
    state.wave++;
    waveEl.textContent = `Wave ${state.wave}`;
    // TODO: transition to zone 3
  }
}

function cleanupPlatformer() {
  if (platObjects.parent) scene.remove(platObjects);
  platBullets.forEach(b => scene.remove(b));
  platBullets = [];
  platParticles.forEach(p => scene.remove(p));
  platParticles = [];
  platState = null;
  platPig = null;
}

// --- Platformer input ---
const platKeys = { left: false, right: false, jump: false, dash: false };

window.addEventListener('keydown', e => {
  if (!platState) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') platKeys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') platKeys.right = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); platKeys.jump = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') platKeys.dash = true;
});

window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') platKeys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') platKeys.right = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') platKeys.dash = false;
});
