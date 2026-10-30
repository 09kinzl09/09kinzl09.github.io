/* ============================================================
   小游戏：王子田育瑄去救被囚禁的张子龙
   v2 —— 地图更大、有草丛潜行、士兵会随机补位
   - 方向键 / WASD 移动，空格（或点按）投掷爱心
   - 士兵射箭，中一箭掉 1 点血，共 5 点；受伤后 1 秒无敌
   - 躲进草丛：士兵看不见你，你也打不到他
   - 碰到笼子 = 救出；血空要答对小题才能复活
   ============================================================ */

(function () {
  "use strict";

  var canvas = document.getElementById("game-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var TILE = 32;
  var COLS = 24;
  var ROWS = 14;
  var W = COLS * TILE;
  var H = ROWS * TILE;

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  var HP_MAX = 5;
  var INVULN = 1.0;
  var START_SOLDIERS = 4;
  var MAX_SOLDIERS = 7;
  var RESPAWN_DELAY = 2.8;
  var REVIVE_HP = 1.5;   // 答对小题后恢复的血量
  var MAX_DEATHS = 3;    // 连续倒下这么多次，张子龙自己撞开笼子

  var deaths = 0;
  var cgTime = 0;
  var cgDone = false;

  var grid = [];
  var player = null;
  var enemies = [];
  var arrows = [];
  var hearts = [];
  var cage = { x: 0, y: 0 };
  var particles = [];
  var respawnTimer = 0;

  var keys = { up: false, down: false, left: false, right: false, fire: false };
  var state = "cover"; // cover | tutorial | playing | dead | win
  var lastTime = 0;
  var shake = 0;
  var fireCooldown = 0;
  var questionPool = [];
  var currentQuestion = null;

  /* ---------- 地图 ---------- */

  function rect(x, y, w, h, ch) {
    for (var yy = y; yy < y + h; yy++) {
      for (var xx = x; xx < x + w; xx++) {
        if (yy <= 0 || yy >= ROWS - 1 || xx <= 0 || xx >= COLS - 1) continue;
        grid[yy][xx] = ch;
      }
    }
  }

  function buildGrid() {
    grid = [];
    for (var y = 0; y < ROWS; y++) {
      var row = [];
      for (var x = 0; x < COLS; x++) row.push(".");
      grid.push(row);
    }

    // 外框
    for (var i = 0; i < COLS; i++) {
      grid[0][i] = "#";
      grid[ROWS - 1][i] = "#";
    }
    for (var j = 0; j < ROWS; j++) {
      grid[j][0] = "#";
      grid[j][COLS - 1] = "#";
    }

    // 墙（留出通道）
    rect(4, 1, 1, 4, "#");
    rect(10, 1, 4, 1, "#");
    rect(18, 1, 1, 4, "#");

    rect(1, 5, 5, 1, "#");
    rect(9, 5, 7, 1, "#");
    rect(19, 5, 4, 1, "#");

    rect(5, 8, 2, 1, "#");
    rect(16, 8, 2, 1, "#");

    rect(1, 10, 6, 1, "#");
    rect(10, 10, 5, 1, "#");
    rect(18, 10, 5, 1, "#");

    // 草丛
    rect(2, 2, 3, 2, "G");
    rect(19, 2, 3, 2, "G");
    rect(2, 7, 3, 2, "G");
    rect(18, 7, 3, 2, "G");
    rect(11, 11, 4, 2, "G");
    rect(2, 11, 3, 2, "G");
  }

  function isWallTile(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
    return grid[y][x] === "#";
  }

  function isGrassTile(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    return grid[y][x] === "G";
  }

  function tileOf(e) {
    return {
      x: Math.floor(e.x / TILE),
      y: Math.floor(e.y / TILE)
    };
  }

  function inGrass(e) {
    var t = tileOf(e);
    return isGrassTile(t.x, t.y);
  }

  /* ---------- 初始化 ---------- */

  var SPAWNS = [
    { x: 6, y: 3, type: "archer" },
    { x: 14, y: 2, type: "archer" },
    { x: 20, y: 6, type: "melee" },
    { x: 8, y: 9, type: "melee" }
  ];

  function spawnEnemy(tx, ty, type) {
    var isMelee = type === "melee";

    return {
      type: isMelee ? "melee" : "archer",
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      r: isMelee ? 11 : 10,
      speed: isMelee ? 56 : 48,
      chaseSpeed: isMelee ? 118 : 106,
      vision: isMelee ? 232 : 206,
      hp: isMelee ? 3 : 2,
      dir: Math.random() * Math.PI * 2,
      turn: 0.8 + Math.random(),
      shoot: 1.4 + Math.random(),
      hitFlash: 0,
      alert: 0,
      lastX: null,
      lastY: null,
      target: null,   // 巡逻要去的格子
      repick: 0,      // 多久后重新挑目标
      stuck: 0,       // 卡住了多久
      attackCd: 0     // 近战出手冷却
    };
  }

  function resetLevel() {
    buildGrid();

    player = {
      x: TILE * 1.5,
      y: TILE * 1.5,
      r: 10,
      speed: 148,
      hp: HP_MAX,
      invuln: 0,
      face: 1,
      fx: 1,
      fy: 0
    };

    enemies = SPAWNS.map(function (s) { return spawnEnemy(s.x, s.y, s.type); });

    cage = { x: (COLS - 3) * TILE + TILE / 2, y: (ROWS - 2) * TILE + TILE / 2 };

    arrows = [];
    hearts = [];
    particles = [];
    fireCooldown = 0;
    shake = 0;
    respawnTimer = 0;
    deaths = 0;
    cgTime = 0;
    cgDone = false;

    // 保证笼子那一格不是墙/草丛
    var cx = tileOf(cage).x;
    var cy = tileOf(cage).y;
    grid[cy][cx] = ".";

    // 地图定稿后把静态层烘焙一次
    paintStaticLayer();
  }

  function randomFreeTile(minDistFromPlayer) {
    for (var tries = 0; tries < 60; tries++) {
      var x = 1 + Math.floor(Math.random() * (COLS - 2));
      var y = 1 + Math.floor(Math.random() * (ROWS - 2));
      if (isWallTile(x, y)) continue;
      var px = x * TILE + TILE / 2;
      var py = y * TILE + TILE / 2;
      if (Math.abs(px - cage.x) < 70 && Math.abs(py - cage.y) < 70) continue;
      if (player && Math.hypot(px - player.x, py - player.y) < (minDistFromPlayer || 150)) continue;
      return { x: x, y: y };
    }
    return null;
  }

  /* ---------- 碰撞 ---------- */

  function hitsWall(e) {
    var x0 = Math.floor((e.x - e.r) / TILE);
    var x1 = Math.floor((e.x + e.r) / TILE);
    var y0 = Math.floor((e.y - e.r) / TILE);
    var y1 = Math.floor((e.y + e.r) / TILE);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        if (isWallTile(x, y)) return true;
      }
    }
    return false;
  }

  function moveAxis(e, dx, dy) {
    e.x += dx;
    if (hitsWall(e)) e.x -= dx;
    e.y += dy;
    if (hitsWall(e)) e.y -= dy;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /* 两点之间有没有墙挡着（沿直线每 8px 采一次） */
  function hasLineOfSight(a, b) {
    var steps = Math.ceil(dist(a, b) / 8);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var x = a.x + (b.x - a.x) * t;
      var y = a.y + (b.y - a.y) * t;
      if (isWallTile(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  }

  function shootArrow(from, target) {
    var ang = Math.atan2(target.y - from.y, target.x - from.x);
    arrows.push({
      x: from.x,
      y: from.y,
      vx: Math.cos(ang) * 156,
      vy: Math.sin(ang) * 156,
      life: 4,
      ang: ang
    });
  }
  /* 给士兵挑一个「合理」的巡逻目标：别太近、别扎堆、也别老往你脸上撞 */
  function pickWanderTarget(en) {
    var best = null;
    var bestScore = -Infinity;

    for (var i = 0; i < 16; i++) {
      var tx = 1 + Math.floor(Math.random() * (COLS - 2));
      var ty = 1 + Math.floor(Math.random() * (ROWS - 2));
      if (isWallTile(tx, ty)) continue;

      var px = tx * TILE + TILE / 2;
      var py = ty * TILE + TILE / 2;
      var dSelf = Math.hypot(px - en.x, py - en.y);
      if (dSelf < TILE * 1.6) continue;

      var nearestMate = 9999;
      enemies.forEach(function (other) {
        if (other === en || other.hp <= 0) return;
        nearestMate = Math.min(nearestMate, Math.hypot(px - other.x, py - other.y));
      });

      var dPlayer = player ? Math.hypot(px - player.x, py - player.y) : 9999;

      var score = dSelf * 0.45 + Math.min(nearestMate, 240) * 1.1;
      if (dPlayer < 190) score -= (190 - dPlayer) * 0.9;

      if (score > bestScore) {
        bestScore = score;
        best = { x: tx, y: ty };
      }
    }

    return best;
  }

  /* 同伴之间互相排斥的方向，避免全挤在一坨 */
  function separationVector(en) {
    var sx = 0;
    var sy = 0;
    var range = 46;

    enemies.forEach(function (other) {
      if (other === en || other.hp <= 0) return;
      var dx = en.x - other.x;
      var dy = en.y - other.y;
      var d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < range * range) {
        var d = Math.sqrt(d2);
        sx += (dx / d) * (1 - d / range);
        sy += (dy / d) * (1 - d / range);
      }
    });

    if (!sx && !sy) return null;
    var len = Math.hypot(sx, sy) || 1;
    return { x: sx / len, y: sy / len };
  }

  /* ---------- 输入 ---------- */

  var KEYMAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    Space: "fire", Enter: "fire"
  };

  window.addEventListener("keydown", function (e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    if (state === "playing") e.preventDefault();
    keys[k] = true;
  });

  window.addEventListener("keyup", function (e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    keys[k] = false;
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-game-key]"), function (btn) {
    var k = btn.getAttribute("data-game-key");
    function on(e) { e.preventDefault(); keys[k] = true; }
    function off(e) { e.preventDefault(); keys[k] = false; }
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", off);
  });

  /* ---------- 更新 ---------- */

  function update(dt) {
    if (state === "cg") {
      cgTime += dt;
      if (cgTime > 5.4) finishCG();
      return;
    }

    if (state !== "playing") return;

    var p = player;

    if (p.invuln > 0) p.invuln -= dt;
    if (fireCooldown > 0) fireCooldown -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 22);

    var hidden = inGrass(p);

    var dx = 0;
    var dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;

    if (dx && dy) {
      dx *= 0.707;
      dy *= 0.707;
    }

    if (dx) p.face = dx > 0 ? 1 : -1;

    // 记住朝向：上下左右都能投掷
    if (dx || dy) {
      var l0 = Math.hypot(dx, dy) || 1;
      p.fx = dx / l0;
      p.fy = dy / l0;
    }

    moveAxis(p, dx * p.speed * dt, dy * p.speed * dt);

    // 草丛里不能攻击
    if (keys.fire && fireCooldown <= 0 && !hidden) {
      fireCooldown = 0.34;
      sfxThrow();
      var ax = p.fx;
      var ay = p.fy;
      var len = Math.hypot(ax, ay) || 1;
      hearts.push({
        x: p.x + (ax / len) * 12,
        y: p.y + (ay / len) * 12,
        vx: (ax / len) * 330,
        vy: (ay / len) * 330,
        life: 1.1,
        spin: 0
      });
    }

    // 爱心
    for (var i = hearts.length - 1; i >= 0; i--) {
      var h = hearts[i];
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.life -= dt;
      h.spin += dt * 10;

      var hit = false;
      for (var j = 0; j < enemies.length; j++) {
        var en = enemies[j];
        if (en.hp <= 0) continue;
        if (dist(h, en) < en.r + 8) {
          en.hp -= 1;
          en.hitFlash = 0.18;
          sfxEnemyHit();
          hit = true;
          burst(en.x, en.y, "#ff9ec4");
          break;
        }
      }

      if (hit || h.life <= 0 || isWallTile(Math.floor(h.x / TILE), Math.floor(h.y / TILE))) {
        hearts.splice(i, 1);
      }
    }

    // 士兵
    var alive = 0;
    enemies.forEach(function (en) {
      if (en.hp <= 0) return;
      alive += 1;

      if (en.hitFlash > 0) en.hitFlash -= dt;
      if (en.attackCd > 0) en.attackCd -= dt;

      // 能不能发现你：草丛里隐身 + 视野半径内 + 中间没墙
      var seen = !hidden && dist(en, p) < en.vision && hasLineOfSight(en, p);
      if (seen) {
        en.alert = 1.8;
        en.lastX = p.x;
        en.lastY = p.y;
      } else if (en.alert > 0) {
        en.alert -= dt;
        if (en.alert <= 0) en.target = null; // 跟丢了，重新挑个巡逻点
      }

      en.shoot -= dt;

      if (en.alert > 0) {
        // 追：朝最后看见你的位置走
        var tx = (en.lastX === null) ? p.x : en.lastX;
        var ty = (en.lastY === null) ? p.y : en.lastY;
        var ang2 = Math.atan2(ty - en.y, tx - en.x);
        var bx = en.x;
        var by = en.y;
        moveAxis(en, Math.cos(ang2) * en.chaseSpeed * dt, Math.sin(ang2) * en.chaseSpeed * dt);
        if (Math.abs(en.x - bx) < 0.3 && Math.abs(en.y - by) < 0.3) {
          en.alert = 0; // 被墙卡住就放弃
        }

        // 近战兵：贴到身上就砍一刀
        if (en.type === "melee" && en.attackCd <= 0 && dist(en, p) < en.r + 20) {
          en.attackCd = 1.05;
          if (p.invuln <= 0) {
            p.hp -= 1;
            p.invuln = INVULN;
            shake = 10;
            sfxMelee();
            burst(p.x, p.y, "#ff7b8a");
            if (p.hp <= 0) {
              p.hp = 0;
              onDeath();
              return;
            }
          }
        }
      } else {
        // 巡逻：挑一个远处的格子走过去，而不是原地乱转
        en.repick -= dt;
        if (!en.target || en.repick <= 0) {
          en.target = pickWanderTarget(en);
          en.repick = 4 + Math.random() * 3.5;
        }

        if (en.target) {
          var tx2 = en.target.x * TILE + TILE / 2;
          var ty2 = en.target.y * TILE + TILE / 2;
          if (Math.hypot(tx2 - en.x, ty2 - en.y) < 12) {
            en.target = null;
            en.repick = 0;
          }
        }

        var bx2 = en.x;
        var by2 = en.y;

        if (en.target) {
          var moveAng = Math.atan2(
            en.target.y * TILE + TILE / 2 - en.y,
            en.target.x * TILE + TILE / 2 - en.x
          );
          moveAxis(en, Math.cos(moveAng) * en.speed * dt, Math.sin(moveAng) * en.speed * dt);
        }

        // 和同伴保持点距离，别全挤成一坨
        var sep = separationVector(en);
        if (sep) {
          moveAxis(en, sep.x * 34 * dt, sep.y * 34 * dt);
        }

        // 卡住检测：0.3 秒没挪动就换个目标
        var moved = Math.hypot(en.x - bx2, en.y - by2);
        if (moved < en.speed * dt * 0.3) {
          en.stuck += dt;
          if (en.stuck > 0.3) {
            en.stuck = 0;
            en.target = pickWanderTarget(en);
            en.repick = 3 + Math.random() * 3;
          }
        } else {
          en.stuck = 0;
        }
      }

      // 弓箭手才射箭，近战兵只管冲
      if (en.type !== "melee" && en.shoot <= 0 && seen) {
        en.shoot = 1.0 + Math.random() * 0.55;
        shootArrow(en, p);
      }
    });

    // 清理尸体 + 排队补位
    var before = enemies.length;
    enemies = enemies.filter(function (en) { return en.hp > 0; });
    if (enemies.length < before) {
      if (respawnTimer <= 0) respawnTimer = RESPAWN_DELAY;
    }

    if (respawnTimer > 0) {
      respawnTimer -= dt;
      if (respawnTimer <= 0 && enemies.length < MAX_SOLDIERS) {
        var spot = randomFreeTile(160);
        if (spot) {
          var freshType = Math.random() < 0.34 ? "melee" : "archer";
          var fresh = spawnEnemy(spot.x, spot.y, freshType);
          fresh.shoot = 1.8 + Math.random();
          enemies.push(fresh);
          burst(fresh.x, fresh.y, "#9aa7b4");
          respawnTimer = 0;
        } else {
          respawnTimer = 1;
        }
      }
    }

    // 箭
    for (var k = arrows.length - 1; k >= 0; k--) {
      var a = arrows[k];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;

      if (a.life <= 0 || isWallTile(Math.floor(a.x / TILE), Math.floor(a.y / TILE))) {
        arrows.splice(k, 1);
        continue;
      }

      if (p.invuln <= 0 && dist(a, p) < p.r + 5) {
        arrows.splice(k, 1);
        p.hp -= 1;
        p.invuln = INVULN;
        shake = 8;
        sfxHurt();
        burst(p.x, p.y, "#ff7b8a");
        if (p.hp <= 0) {
          p.hp = 0;
          onDeath();
          return;
        }
      }
    }

    // 粒子
    for (var m = particles.length - 1; m >= 0; m--) {
      var pt = particles[m];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 120 * dt;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(m, 1);
    }

    if (dist(p, cage) < 30) onWin();
  }

  function burst(x, y, color) {
    for (var i = 0; i < 8; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 90;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 30,
        life: 0.5 + Math.random() * 0.3,
        color: color,
        r: 1.5 + Math.random() * 2
      });
    }
  }

  /* ---------- 绘制 ---------- */

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function heartPath(cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.75);
    ctx.bezierCurveTo(cx + s * 1.15, cy - s * 0.25, cx + s * 0.45, cy - s * 1.05, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx - s * 0.45, cy - s * 1.05, cx - s * 1.15, cy - s * 0.25, cx, cy + s * 0.75);
    ctx.closePath();
  }

  /* 静态地图（地板 + 墙）只画一次，之后每帧直接贴图 */
  var staticLayer = document.createElement("canvas");

  function paintStaticLayer() {
    staticLayer.width = Math.round(W * dpr);
    staticLayer.height = Math.round(H * dpr);

    var c = staticLayer.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    function rr(x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    c.fillStyle = "#f2f8f5";
    c.fillRect(0, 0, W, H);

    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (grid[y][x] === "#") {
          c.fillStyle = "#dfe9e3";
          rr(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2, 7);
          c.fill();
          c.fillStyle = "#cbd9d0";
          rr(x * TILE + 1, y * TILE + 1, TILE - 2, 7, 6);
          c.fill();
        } else if (grid[y][x] !== "G" && (x + y) % 2 === 0) {
          c.fillStyle = "rgba(160, 200, 180, 0.10)";
          rr(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6, 5);
          c.fill();
        }
      }
    }
  }

  function drawFloor() {
    if (staticLayer.width) ctx.drawImage(staticLayer, 0, 0, W, H);
  }

  function drawGrassOverlay() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (grid[y][x] !== "G") continue;

        var gx = x * TILE;
        var gy = y * TILE;
        var sway = Math.sin((Date.now() / 700) + x * 0.6 + y * 0.3) * 1.4;

        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "#bfe6cc";
        ctx.beginPath();
        ctx.ellipse(gx + TILE / 2, gy + TILE - 4, TILE * 0.52, TILE * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#6fbf8e";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        for (var i = 0; i < 5; i++) {
          var bx = gx + 6 + i * 5.2 + (x % 2) * 1.5;
          var by = gy + TILE - 2;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx + sway, by - 12, bx + sway * 1.6 + (i - 2), by - 20 - (i % 3) * 3);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  function drawCage() {
    var x = cage.x;
    var y = cage.y;

    ctx.fillStyle = "rgba(255, 214, 102, 0.30)";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fbe0c3";
    ctx.beginPath();
    ctx.arc(x, y - 3, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4b3b31";
    ctx.beginPath();
    ctx.arc(x, y - 6, 8, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = "#8ec9f5";
    roundRect(x - 8, y + 4, 16, 12, 5);
    ctx.fill();

    ctx.strokeStyle = "#7f8f9d";
    ctx.lineWidth = 2.5;
    roundRect(x - 17, y - 17, 34, 34, 6);
    ctx.stroke();
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 9, y - 16);
      ctx.lineTo(x + i * 9, y + 16);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    var p = player;
    if (!p) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) return;

    var x = p.x;
    var y = p.y;
    var f = p.face;

    ctx.fillStyle = "rgba(60, 90, 80, 0.14)";
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#6fc3a1";
    roundRect(x - 9, y - 4, 18, 16, 6);
    ctx.fill();

    ctx.fillStyle = "#2f9ff2";
    ctx.beginPath();
    ctx.moveTo(x - f * 9, y - 3);
    ctx.lineTo(x - f * 15, y + 10);
    ctx.lineTo(x - f * 7, y + 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fbe0c3";
    ctx.beginPath();
    ctx.arc(x, y - 9, 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4b3b31";
    ctx.beginPath();
    ctx.arc(x, y - 11, 8.5, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - f * 7, y - 9, 3.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 17);
    ctx.lineTo(x - 4, y - 22);
    ctx.lineTo(x, y - 18);
    ctx.lineTo(x + 4, y - 22);
    ctx.lineTo(x + 7, y - 17);
    ctx.closePath();
    ctx.fill();

    // 眼睛跟着朝向走：上下也能看出来面朝哪
    var vertical = Math.abs(p.fy) > Math.abs(p.fx);
    var ex = vertical ? 0 : f * 3;
    var ey = p.fy < -0.5 ? y - 11 : (p.fy > 0.5 ? y - 7 : y - 8);

    ctx.fillStyle = "#4b3b31";
    ctx.beginPath();
    ctx.arc(x + ex, ey, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 手上那颗爱心，提示投掷方向
    var al = Math.hypot(p.fx, p.fy) || 1;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ff8fa3";
    heartPath(x + (p.fx / al) * 15, y + (p.fy / al) * 13 - 1, 3.6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawEnemy(en) {
    if (en.hp <= 0) return;

    var x = en.x;
    var y = en.y;

    ctx.fillStyle = "rgba(60, 90, 80, 0.14)";
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    var isMelee = en.type === "melee";
    var bodyColor = isMelee ? "#77808c" : "#9aa7b4";

    ctx.fillStyle = en.hitFlash > 0 ? "#ffd0d6" : bodyColor;
    roundRect(x - 9, y - 4, 18, 16, 6);
    ctx.fill();

    // 近战兵：红腰带
    if (isMelee) {
      ctx.fillStyle = "#c2557a";
      roundRect(x - 9, y + 4, 18, 4, 2);
      ctx.fill();
    }

    ctx.fillStyle = "#fbe0c3";
    ctx.beginPath();
    ctx.arc(x, y - 9, 8, 0, Math.PI * 2);
    ctx.fill();

    if (isMelee) {
      // 红头巾
      ctx.fillStyle = "#c2557a";
      ctx.beginPath();
      ctx.arc(x, y - 11, 8.4, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      roundRect(x - 8.4, y - 12.4, 16.8, 3.8, 2);
      ctx.fill();
      // 头巾飘带
      ctx.beginPath();
      ctx.moveTo(x + 8, y - 11);
      ctx.lineTo(x + 15, y - 8);
      ctx.lineTo(x + 14, y - 4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#c2557a";
      ctx.beginPath();
      ctx.arc(x, y - 11, 8.4, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      roundRect(x - 8.4, y - 12, 16.8, 3.4, 2);
      ctx.fill();
    }

    if (isMelee) {
      // 短刀
      ctx.strokeStyle = "#dfe6ec";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 2);
      ctx.lineTo(x + 17, y - 5);
      ctx.stroke();
      ctx.strokeStyle = "#8a6a45";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 4);
      ctx.lineTo(x + 9, y + 1);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#8a6a45";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 10, y + 1, 8, -Math.PI / 2.2, Math.PI / 2.2);
      ctx.stroke();
    }

    var w = 20;
    ctx.fillStyle = "rgba(30, 60, 50, 0.18)";
    roundRect(x - w / 2, y - 24, w, 3.4, 2);
    ctx.fill();
    ctx.fillStyle = "#ff8fa3";
    roundRect(x - w / 2, y - 24, w * (en.hp / (en.type === 'melee' ? 3 : 2)), 3.4, 2);
    ctx.fill();

    // 发现你了：头顶冒个红色感叹号
    if (en.alert > 0) {
      ctx.fillStyle = "#e5566f";
      ctx.beginPath();
      ctx.arc(x, y - 33, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px -apple-system, 'PingFang SC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", x, y - 29.6);
      ctx.textAlign = "left";
    }
  }

  function drawArrow(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.ang);
    ctx.strokeStyle = "#8a6a45";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(5, 0);
    ctx.stroke();
    ctx.fillStyle = "#8a6a45";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(3, -3.4);
    ctx.lineTo(3, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHearts() {
    hearts.forEach(function (h) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.spin);
      ctx.fillStyle = "#ff8fa3";
      heartPath(0, 0, 5);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHud() {
    for (var i = 0; i < HP_MAX; i++) {
      var x = 16 + i * 20;
      var y = 18;
      var filled = player.hp - i;

      if (filled >= 1) {
        ctx.fillStyle = "#ff6f88";
        heartPath(x, y, 7);
        ctx.fill();
      } else if (filled >= 0.5) {
        // 半颗心
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 9, y - 10, 9, 20);
        ctx.clip();
        ctx.fillStyle = "#ff6f88";
        heartPath(x, y, 7);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = "rgba(255, 143, 163, 0.7)";
        ctx.lineWidth = 1.4;
        heartPath(x, y, 7);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(120, 140, 150, 0.5)";
        ctx.lineWidth = 1.6;
        heartPath(x, y, 7);
        ctx.stroke();
      }
    }

    ctx.font = "12px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "right";

    if (inGrass(player)) {
      ctx.fillStyle = "rgba(40, 120, 80, 0.85)";
      ctx.fillText("潜行中 · 不可攻击", W - 14, 22);
    } else {
      ctx.fillStyle = "rgba(30, 60, 50, 0.55)";
      ctx.fillText("还有 " + enemies.filter(function (e) { return e.hp > 0; }).length + " 个士兵", W - 14, 22);
    }

    ctx.textAlign = "left";
  }

  function draw() {
    if (state === "cg") {
      drawCG();
      return;
    }

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawFloor();
    drawCage();
    enemies.forEach(drawEnemy);
    arrows.forEach(drawArrow);
    drawHearts();
    drawPlayer();

    particles.forEach(function (pt) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    drawGrassOverlay();
    drawHud();
    ctx.restore();
  }


  /* ---------- 结局 CG：张子龙自己撞开笼子 ---------- */

  var CG_LINE = "小菜宝田育瑄，还得是我来吧！";

  var cgSoldiers = [];
  var cgPath = [];

  function buildCgPath() {
    var cageX = W * 0.76;
    var cageY = H * 0.52;
    var princeX = W * 0.4;
    var princeY = H * 0.56;

    cgPath = [{ t: 0.5, x: cageX, y: cageY }];

    var tt = 0.5;
    cgSoldiers.forEach(function (s, i) {
      tt += 0.42;
      s.koAt = tt;
      cgPath.push({ t: tt, x: s.x, y: s.y });
    });

    cgPath.push({ t: tt + 0.55, x: princeX + 46, y: princeY });
  }

  function startCG() {
    state = "cg";
    cgTime = 0;
    cgDone = false;
    arrows = [];

    // 把场上还活着的士兵抓进 CG 里
    cgSoldiers = enemies.filter(function (e) { return e.hp > 0; }).slice(0, 2).map(function (e) {
      return { x: e.x, y: e.y, hp: e.hp, type: e.type, koAt: 99 };
    });
    buildCgPath();

    stopMusic();
    tone(160, 0.3, "sawtooth", 0.08);
    tone(90, 0.5, "sine", 0.06, 0.06);

    hideOverlay();
    syncLoop();
  }

  function finishCG() {
    if (cgDone) return;
    cgDone = true;
    onWin(true);
  }

  function drawZhang(x, y, t, faceLeft) {
    var f = faceLeft ? -1 : 1;

    // 影子
    ctx.fillStyle = "rgba(40, 60, 70, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 腿（跑动）
    var swing = Math.sin(t * 12) * 3;
    ctx.strokeStyle = "#4b5b6b";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 8); ctx.lineTo(x - 3 - swing, y + 14);
    ctx.moveTo(x + 3, y + 8); ctx.lineTo(x + 3 + swing, y + 14);
    ctx.stroke();

    // 身体
    ctx.fillStyle = "#8ec9f5";
    roundRect(x - 9, y - 4, 18, 15, 6);
    ctx.fill();

    // 手臂
    ctx.strokeStyle = "#7ab6e0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + f * 8, y - 1);
    ctx.lineTo(x + f * 14, y + 2);
    ctx.stroke();

    // 头
    ctx.fillStyle = "#fbe0c3";
    ctx.beginPath();
    ctx.arc(x, y - 10, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // 头发
    ctx.fillStyle = "#4b3b31";
    ctx.beginPath();
    ctx.arc(x, y - 12, 8.6, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();

    // 表情
    ctx.fillStyle = "#4b3b31";
    ctx.beginPath();
    ctx.arc(x + f * 3, y - 9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4b3b31";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + f * 2, y - 5, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  function drawPrince(x, y) {
    // 披风
    ctx.fillStyle = "#2f9ff2";
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 3);
    ctx.lineTo(x - 15, y + 11);
    ctx.lineTo(x - 6, y + 10);
    ctx.closePath();
    ctx.fill();

    // 身体
    ctx.fillStyle = "#6fc3a1";
    roundRect(x - 9, y - 4, 18, 16, 6);
    ctx.fill();

    // 头
    ctx.fillStyle = "#fbe0c3";
    ctx.beginPath();
    ctx.arc(x, y - 10, 8.5, 0, Math.PI * 2);
    ctx.fill();

    // 头发
    ctx.fillStyle = "#4b3b31";
    ctx.beginPath();
    ctx.arc(x, y - 12, 8.5, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 7, y - 9, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // 王冠
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 18);
    ctx.lineTo(x - 4, y - 23);
    ctx.lineTo(x, y - 19);
    ctx.lineTo(x + 4, y - 23);
    ctx.lineTo(x + 7, y - 18);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    ctx.fillStyle = "#4b3b31";
    ctx.beginPath();
    ctx.arc(x + 3, y - 9, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBubble(text, alpha, cx, cy) {
    var lines = text.split("\n");
    ctx.font = "bold 14px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    w = Math.max(w + 36, 200);
    var h = 24 + lines.length * 22;

    var bx = cx - w / 2;
    var by = cy - h;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    roundRect(bx, by, w, h, 16);
    ctx.fill();

    // 小尾巴
    ctx.beginPath();
    ctx.moveTo(cx - 9, by + h - 2);
    ctx.lineTo(cx + 2, by + h + 12);
    ctx.lineTo(cx + 13, by + h - 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1e2f3e";
    ctx.textAlign = "center";
    lines.forEach(function (l, i) {
      ctx.fillText(l, cx, by + 26 + i * 22);
    });
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  function cgActorPos(t) {
    if (!cgPath.length) return { x: W * 0.76, y: H * 0.52 };

    if (t <= cgPath[0].t) return { x: cgPath[0].x, y: cgPath[0].y };

    for (var i = 0; i < cgPath.length - 1; i++) {
      var a = cgPath[i];
      var b = cgPath[i + 1];
      if (t >= a.t && t <= b.t) {
        var k = (t - a.t) / Math.max(0.001, (b.t - a.t));
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // 缓动，冲得快一点
        return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      }
    }

    var last = cgPath[cgPath.length - 1];
    return { x: last.x, y: last.y };
  }

  function drawCgSoldier(s, t) {
    var k = t - s.koAt;

    if (k < 0) {
      // 还站着
      ctx.save();
      ctx.translate(s.x, s.y);
      drawEnemy({ x: 0, y: 0, hp: s.hp, type: s.type, hitFlash: 0, alert: 0 });
      ctx.restore();
      return;
    }

    if (k > 1.1) return;

    // 被放倒：飞出去 + 旋转 + 淡出
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k / 1.0);
    ctx.translate(s.x + k * 70, s.y - k * 110 + k * k * 150);
    ctx.rotate(k * 7);
    drawEnemy({ x: 0, y: 0, hp: 0.2, type: s.type, hitFlash: 0, alert: 0 });
    ctx.restore();

    // 打中的星星
    if (k < 0.28) {
      var a = 1 - k / 0.28;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffe066";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✧", s.x + 6, s.y - 16);
      ctx.fillStyle = "#ff9ec4";
      ctx.fillText("✧", s.x - 10, s.y - 4);
      ctx.textAlign = "left";
      ctx.restore();
    }
  }

  function drawCG() {
    var t = cgTime;

    // 背景
    drawFloor();
    ctx.fillStyle = "rgba(10, 26, 38, 0.6)";
    ctx.fillRect(0, 0, W, H);

    var cageX = W * 0.76;
    var cageY = H * 0.52;

    // 笼子：先抖，再碎
    var shakeX = t < 0.5 ? Math.sin(t * 70) * 3.5 : 0;
    ctx.save();
    ctx.translate(cageX + shakeX, cageY);
    ctx.strokeStyle = "#8fa2b0";
    ctx.lineWidth = 4;
    roundRect(-22, -24, 44, 46, 8);
    ctx.stroke();
    if (t < 0.45) {
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 11, -22);
        ctx.lineTo(i * 11, 20);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 飞出去的栏杆
    if (t >= 0.45) {
      var kk = Math.min(1, (t - 0.45) / 0.7);
      ctx.strokeStyle = "#8fa2b0";
      ctx.lineWidth = 4;
      for (var j = -1; j <= 1; j++) {
        ctx.save();
        ctx.translate(cageX + j * 11 + kk * (30 + j * 26), cageY - kk * 10 + kk * kk * 70);
        ctx.rotate(kk * (2 + j) * 0.9);
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(0, 16);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 士兵（站着的 / 被放倒的）
    cgSoldiers.forEach(function (s) { drawCgSoldier(s, t); });

    // 张子龙
    var pos = cgActorPos(t);
    var running = t > 0.5 && t < (cgPath.length ? cgPath[cgPath.length - 1].t : 2);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(1.8, 1.8);
    drawZhang(0, 0, running ? t : 0, true);
    ctx.restore();

    // 王子
    ctx.save();
    ctx.translate(W * 0.4, H * 0.56);
    ctx.scale(1.8, 1.8);
    drawPrince(0, 0);
    ctx.restore();

    // 爱心
    if (t > 2.0) {
      var n = Math.min(10, Math.floor((t - 2.0) * 4));
      for (var m = 0; m < n; m++) {
        var hx = W * 0.42 + Math.sin(m * 1.7 + t * 1.6) * 72;
        var hy = H * 0.58 - ((t - 2.0) * 46 + m * 22) % 150;
        ctx.globalAlpha = 0.65 + 0.3 * Math.sin(m + t * 3);
        ctx.fillStyle = m % 2 ? "#ff8fa3" : "#ffb7cd";
        heartPath(hx, hy, 5 + (m % 3));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 台词
    if (t > 2.1) {
      drawBubble(CG_LINE, Math.min(1, (t - 2.1) / 0.5), W * 0.45, H * 0.34);
    }

    // 字幕
    ctx.font = "13px -apple-system, 'PingFang SC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    if (t > 0.4 && t < 1.6) {
      ctx.fillText("笼子被他一脚踹开了", W / 2, H - 26);
    } else if (t >= 1.6 && t < 2.1) {
      ctx.fillText("三两下就把士兵都放倒了", W / 2, H - 26);
    } else if (t >= 2.1) {
      ctx.fillText("张子龙拍了拍手，走过来", W / 2, H - 26);
    }
    ctx.textAlign = "left";
  }
  /* ---------- 循环 ---------- */

  var running = false;
  var onScreen = true;

  function startLoop() {
    if (running) return;
    running = true;
    lastTime = 0;
    requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
  }

  /* 画布是不是在视野附近（自己算，不依赖 IntersectionObserver 的时机） */
  function canvasVisible() {
    var rect = canvas.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var margin = 240;
    return rect.width > 0 && rect.bottom > -margin && rect.top < vh + margin;
  }

  /* 只有「在玩 + 页面可见 + 滚动到附近」才跑帧循环 */
  function syncLoop() {
    onScreen = canvasVisible();

    if ((state === "playing" || state === "cg") && onScreen && !document.hidden) {
      startLoop();
    } else {
      stopLoop();
      if (player) draw();
    }
  }

  /* 滚动/改窗口大小的时候重新判断一次（120ms 内不重复算） */
  var lastSync = 0;
  function onViewportChange() {
    var now = Date.now();
    if (now - lastSync < 120) return;
    lastSync = now;
    syncLoop();
  }

  function loop(ts) {
    if (!running) return;

    if (!lastTime) lastTime = ts;
    var dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    update(dt);
    draw();

    if (running) requestAnimationFrame(loop);
  }

  /* ---------- 弹窗 ---------- */

  var overlay = document.getElementById("game-overlay");
  var overlayTitle = document.getElementById("game-overlay-title");
  var overlayText = document.getElementById("game-overlay-text");
  var overlayAnswers = document.getElementById("game-overlay-answers");
  var overlayBtn = document.getElementById("game-overlay-btn");
  var overlayCover = document.getElementById("game-cover");
  var overlayTips = document.getElementById("game-tips");
  var overlayBtn2 = document.getElementById("game-overlay-btn2");
  var questionEl = document.getElementById("game-question");
  var stageEl = document.querySelector(".arcade__stage");
  var fullBtn = document.getElementById("game-full");
  var soundBtn = document.getElementById("game-sound");
  var restartBtn = document.getElementById("game-restart");

  /* ---------- 音效与背景音乐（用 WebAudio 现场合成，不额外放音频文件） ---------- */

  var actx = null;
  var soundOn = true;
  var musicTimer = null;
  var musicStep = 0;
  var MELODY = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];

  function ensureAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { actx = null; }
    }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }

  function tone(freq, dur, type, vol, delay) {
    if (!soundOn) return;
    var c = ensureAudio();
    if (!c) return;

    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.06, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function sfxThrow() { tone(720, 0.08, "triangle", 0.045); }
  function sfxEnemyHit() { tone(330, 0.09, "square", 0.05); tone(250, 0.11, "square", 0.035, 0.045); }
  function sfxHurt() { tone(190, 0.22, "sawtooth", 0.075); }
  function sfxMelee() { tone(880, 0.07, "sawtooth", 0.05); tone(300, 0.12, "sawtooth", 0.045, 0.05); }
  function sfxRevive() { tone(523, 0.18, "sine", 0.06); tone(784, 0.22, "sine", 0.055, 0.11); }
  function sfxWin() { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.26, "sine", 0.07, i * 0.13); }); }
  function sfxDie() { [440, 349, 262].forEach(function (f, i) { tone(f, 0.3, "sine", 0.07, i * 0.15); }); }

  function startMusic() {
    if (!soundOn || musicTimer) return;
    if (!ensureAudio()) return;

    musicStep = 0;
    musicTimer = setInterval(function () {
      if (!soundOn) return;
      var f = MELODY[musicStep % MELODY.length];
      tone(f, 0.4, "triangle", 0.026);
      if (musicStep % 4 === 0) tone(f / 4, 0.75, "sine", 0.045);
      musicStep += 1;
    }, 440);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function showOverlay(opts) {
    if (!overlay) return;

    overlayCover.hidden = !opts.cover;
    overlayTips.hidden = !opts.tips;
    overlayBtn.hidden = !!opts.hideButton;
    overlayAnswers.hidden = !(opts.answers && opts.answers.length);
    if (gameAsk) gameAsk.hidden = !opts.ask;
    if (questionEl) questionEl.hidden = !opts.ask;

    overlayTitle.textContent = opts.title || "";
    overlayText.textContent = opts.text || "";

    overlayAnswers.innerHTML = "";
    (opts.answers || []).forEach(function (label, index) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "game-answer";
      b.textContent = label;
      b.addEventListener("click", function () { onAnswer(index); });
      overlayAnswers.appendChild(b);
    });

    overlayBtn.textContent = opts.button || "开始";
    overlayBtn.onclick = opts.onClick || function () {};

    if (overlayBtn2) {
      overlayBtn2.hidden = !opts.second;
      if (opts.second) {
        overlayBtn2.textContent = opts.second.label;
        overlayBtn2.onclick = opts.second.onClick;
      }
    }

    overlay.hidden = false;
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
    if (gameAsk) gameAsk.hidden = true;
    if (answerTimer) { clearInterval(answerTimer); answerTimer = null; }
  }

  function loadQuestions() {
    var list = (window.SITE_CONFIG && Array.isArray(window.SITE_CONFIG.gameQuestions))
      ? window.SITE_CONFIG.gameQuestions : [];

    questionPool = list.filter(function (q) {
      return q && typeof q.q === "string" && Array.isArray(q.answers) && q.answers.length;
    });

    if (!questionPool.length) {
      questionPool = [
        { q: "张子龙最喜欢的游戏是什么？", answers: ["cs", "csgo", "反恐精英"], hint: "两个字母" }
      ];
    }
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[，。！？、,.!?"'“”‘’]/g, "");
  }

  function isAnswerRight(value, q) {
    var v = normalizeAnswer(value);
    if (!v) return false;

    if (q.numeric) {
      var digits = v.replace(/\D/g, "");
      return q.answers.some(function (a) {
        return digits === String(a).replace(/\D/g, "");
      });
    }

    return q.answers.some(function (a) {
      var n = normalizeAnswer(a);
      return n && v.indexOf(n) !== -1;
    });
  }

  function revealAnswer(q) {
    if (!q || !q.answers || !q.answers.length) return "";
    // 多个可接受答案时，全部列出来
    return q.answers.join(" / ");
  }

  /* ---------- 答题弹窗 ---------- */

  var gameAsk = document.getElementById("game-ask");
  var answerInput = document.getElementById("game-answer-input");
  var answerSubmit = document.getElementById("game-answer-submit");
  var attempt = 0;
  var answerTimer = null;

  function askQuestion() {
    attempt = 0;
    if (answerTimer) { clearInterval(answerTimer); answerTimer = null; }

    showOverlay({
      title: "被箭射倒了… 第 " + deaths + " 次",
      text: "答对这道题就能复活，但只恢复 1.5 滴血。",
      hideButton: true,
      ask: true
    });

    if (questionEl) {
      questionEl.hidden = false;
      questionEl.textContent = currentQuestion.q + (currentQuestion.hint ? "（" + currentQuestion.hint + "）" : "");
    }

    if (gameAsk) gameAsk.hidden = false;
    if (answerInput) {
      answerInput.disabled = false;
      answerInput.value = "";
      setTimeout(function () { answerInput.focus(); }, 80);
    }
    if (answerSubmit) answerSubmit.disabled = false;
  }

  function submitAnswer() {
    if (!currentQuestion || state !== "dead" || !answerInput) return;

    var val = answerInput.value.trim();
    if (!val) { answerInput.focus(); return; }

    if (isAnswerRight(val, currentQuestion)) {
      answerInput.disabled = true;
      if (answerSubmit) answerSubmit.disabled = true;
      if (gameAsk) gameAsk.hidden = true;
      overlayText.textContent = "答对啦，恢复 1.5 滴血。";
      overlayBtn.hidden = false;
      overlayBtn.textContent = "继续救他";
      overlayBtn.onclick = function () { hideOverlay(); revive(); };
      return;
    }

    attempt += 1;

    if (attempt === 1) {
      // 先亮答案 3 秒，再给一次机会
      answerInput.disabled = true;
      if (answerSubmit) answerSubmit.disabled = true;
      var correct = revealAnswer(currentQuestion);
      var left = 3;
      overlayText.textContent = "答错了。正确答案是「" + correct + "」，3 秒后可以再答一次。";

      answerTimer = setInterval(function () {
        left -= 1;
        if (left > 0) {
          overlayText.textContent = "答错了。正确答案是「" + correct + "」，" + left + " 秒后可以再答一次。";
        } else {
          clearInterval(answerTimer);
          answerTimer = null;
          overlayText.textContent = "再答一次吧，还有一次机会。";
          answerInput.disabled = false;
          if (answerSubmit) answerSubmit.disabled = false;
          answerInput.value = "";
          answerInput.focus();
        }
      }, 1000);
      return;
    }

    // 第二次仍然错：只能重开
    answerInput.disabled = true;
    if (answerSubmit) answerSubmit.disabled = true;
    if (gameAsk) gameAsk.hidden = true;
    overlayText.textContent = "又答错了…只能重新开始了。";
    overlayBtn.hidden = false;
    overlayBtn.textContent = "重新开始";
    overlayBtn.onclick = function () { hideOverlay(); startGame(); };
  }

  function showCover() {
    state = "cover";
    showOverlay({
      cover: true,
      title: "",
      text: "",
      button: "开始",
      onClick: function () { showTutorial(); }
    });
    syncLoop();
  }

  function showTutorial() {
    state = "tutorial";
    showOverlay({
      title: "先看清楚规则",
      text: "",
      tips: true,
      button: "知道了，出发",
      onClick: function () {
        hideOverlay();
        startGame();
      }
    });
    syncLoop();
  }

  function onDeath() {
    deaths += 1;
    sfxDie();
    stopMusic();

    // 连续倒下三次：张子龙自己撞开笼子出来
    if (deaths >= MAX_DEATHS) {
      startCG();
      return;
    }

    state = "dead";
    loadQuestions();
    currentQuestion = questionPool[Math.floor(Math.random() * questionPool.length)];
    askQuestion();
    syncLoop();
  }

  function revive() {
    player.hp = REVIVE_HP;
    player.invuln = 1.6;
    player.x = TILE * 1.5;
    player.y = TILE * 1.5;
    arrows = [];
    state = "playing";
    sfxRevive();
    startMusic();
    syncLoop();
  }

  function onWin(fromCg) {
    state = "win";

    // 通知页面：通关了，「有些话」可以打开了
    try {
      window.dispatchEvent(new Event("our:game-win"));
    } catch (err) {
      /* 老浏览器就算了 */
    }

    showOverlay({
      title: fromCg ? "笼子被他自己撞开了" : "救出来啦！",
      text: fromCg
        ? "张子龙拍了拍身上的灰：「小菜宝田育瑄，还得是我来吧。」"
        : "张子龙从笼子里跑出来抱住了你。",
      button: "再玩一次",
      onClick: function () {
        hideOverlay();
        startGame();
      },
      second: {
        label: "确定",
        onClick: function () {
          hideOverlay();
          stopMusic();
        }
      }
    });
    sfxWin();
    syncLoop();
  }

  function startGame() {
    resetLevel();
    loadQuestions();
    state = "playing";
    hideOverlay();
    startMusic();
    syncLoop();
  }

  function boot() {
    resetLevel();
    loadQuestions();
    showCover();

    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.addEventListener("resize", onViewportChange, { passive: true });
    document.addEventListener("visibilitychange", onViewportChange);

    if ("IntersectionObserver" in window) {
      try {
        var io = new IntersectionObserver(function () { onViewportChange(); }, { rootMargin: "240px" });
        io.observe(canvas);
      } catch (err) { /* 没有就算了，靠滚动事件 */ }
    }

    syncLoop();
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", function () { startGame(); });
  }

  if (soundBtn) {
    soundBtn.addEventListener("click", function () {
      soundOn = !soundOn;
      soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
      soundBtn.textContent = soundOn ? "🔊 音效" : "🔇 静音";
      if (soundOn && state === "playing") startMusic();
      if (!soundOn) stopMusic();
    });
  }

  function fitCanvas() {
    if (!canvas) return;
    if (stageEl && document.fullscreenElement === stageEl) {
      var scale = Math.min(window.innerWidth / W, window.innerHeight / H);
      canvas.style.width = Math.floor(W * scale) + "px";
      canvas.style.height = Math.floor(H * scale) + "px";
    } else {
      canvas.style.width = "";
      canvas.style.height = "";
    }
  }

  if (fullBtn) {
    fullBtn.addEventListener("click", function () {
      if (!stageEl) return;
      if (!document.fullscreenElement) {
        if (stageEl.requestFullscreen) stageEl.requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });
  }

  document.addEventListener("fullscreenchange", fitCanvas);
  window.addEventListener("resize", fitCanvas);

  if (answerSubmit) answerSubmit.addEventListener("click", submitAnswer);
  if (answerInput) {
    answerInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submitAnswer(); }
    });
  }

  canvas.addEventListener("pointerdown", function () {
    if (state === "playing") keys.fire = true;
  });
  canvas.addEventListener("pointerup", function () { keys.fire = false; });
  canvas.addEventListener("pointerleave", function () { keys.fire = false; });

  // 自测入口：__game.damage(5) 扣血、__game.win() 胜利
  window.__game = {
    damage: function (n) {
      if (state !== "playing" || !player) return;
      player.hp -= (typeof n === "number" ? n : 1);
      if (player.hp <= 0) { player.hp = 0; onDeath(); }
    },
    win: function () { if (state === "playing") onWin(); },
    question: function () {
      return currentQuestion ? { q: currentQuestion.q, answers: currentQuestion.answers } : null;
    },
    status: function () {
      return {
        state: state,
        hp: player ? player.hp : null,
        enemies: enemies.length,
        grass: player ? inGrass(player) : null,
        fx: player ? Math.round(player.fx * 100) / 100 : null,
        fy: player ? Math.round(player.fy * 100) / 100 : null,
        alerted: enemies.filter(function (e) { return e.hp > 0 && e.alert > 0; }).length,
        hearts: hearts.length,
        arrows: arrows.length,
        running: running,
        onScreen: onScreen
      };
    },
    teleport: function (tx, ty) {
      if (!player) return;
      player.x = tx * TILE + TILE / 2;
      player.y = ty * TILE + TILE / 2;
    },
    soldiers: function () {
      return enemies.map(function (e) {
        return { x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, type: e.type, target: e.target ? (e.target.x + "," + e.target.y) : null };
      });
    },
    wipeSoldiers: function () {
      enemies.forEach(function (e) { e.hp = 0; });
    },
    // 手动推进一帧，方便自动化测试（无头环境里 rAF 不一定跑）
    step: function (dt) {
      update(dt || 0.016);
      draw();
      return window.__game.status();
    }
  };

  boot();
})();
