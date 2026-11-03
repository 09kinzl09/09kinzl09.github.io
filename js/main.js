/* ============================================================
   我们的宇宙 — 页面逻辑（白蓝绿版 · 多相册 + 首屏播放器）
   原生 JS，不依赖任何库，离线可用。
   ============================================================ */

(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};
  var DAY = 86400000;

  var lightboxEl = null;
  var lightboxImg = null;
  var lightboxCap = null;
  var lastFocus = null;

  /* ---------- 小工具 ---------- */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function pick(value, fallback) {
    return (typeof value === "string" && value.trim() !== "") ? value.trim() : fallback;
  }

  function bind(name, value) {
    var nodes = document.querySelectorAll('[data-bind="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  }

  function parseDate(value) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value || "").trim());
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /* ---------- 首屏 ---------- */

  function initHero() {
    var title = pick(cfg.title, "我们的宇宙");
    document.title = title;
    bind("title", title);
    bind("subtitle", pick(cfg.subtitle, "写给最重要的人"));
    bind("footer", pick(cfg.footer, ""));

    var names = cfg.names || {};
    bind("names", pick(names.you, "你") + " & " + pick(names.me, "我"));

    var pets = cfg.pets || {};
    var catEl = document.querySelector(".pet--cat");
    var dogEl = document.querySelector(".pet--dog");
    if (catEl && pick(pets.cat, "")) catEl.setAttribute("aria-label", pets.cat);
    if (dogEl && pick(pets.dog, "")) dogEl.setAttribute("aria-label", pets.dog);

    var start = parseDate(cfg.startDate);
    var now = today();

    if (!start) {
      var counterBox = document.querySelector(".counter");
      if (counterBox) counterBox.classList.add("is-empty");
      bind("daysTogether", "—");
      bind("nextAnnivDays", "—");
      bind("nextAnnivLabel", "纪念日还没填");
      bind("since", "");
      return;
    }

    var days = Math.round((now - start) / DAY) + 1;
    if (!isFinite(days) || days < 1) days = 1;
    bind("daysTogether", String(days));

    bind("since", "自 " + start.getFullYear() + "." + pad2(start.getMonth() + 1) + "." + pad2(start.getDate()) + " 起");

    var next = new Date(now.getFullYear(), start.getMonth(), start.getDate());
    if (next < now) next = new Date(now.getFullYear() + 1, start.getMonth(), start.getDate());
    var left = Math.round((next - now) / DAY);
    bind("nextAnnivDays", String(left));
    bind("nextAnnivLabel", left === 0 ? "今天就是纪念日" : "天后是纪念日");
  }

  /* ---------- 图片放大 ---------- */

  function openLightbox(src, caption) {
    if (!lightboxEl) return;
    lastFocus = document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = caption || "";
    lightboxCap.textContent = caption || "";
    lightboxEl.hidden = false;
    document.body.style.overflow = "hidden";
    var closer = qs("#lightbox-close");
    if (closer) closer.focus();
  }

  function closeLightbox() {
    if (!lightboxEl || lightboxEl.hidden) return;
    lightboxEl.hidden = true;
    lightboxImg.removeAttribute("src");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initLightbox() {
    lightboxEl = qs("#lightbox");
    lightboxImg = qs("#lightbox-img");
    lightboxCap = qs("#lightbox-cap");
    if (!lightboxEl) return;

    var closer = qs("#lightbox-close");
    if (closer) closer.addEventListener("click", closeLightbox);

    lightboxEl.addEventListener("click", function (event) {
      if (event.target === lightboxEl) closeLightbox();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !lightboxEl.hidden) closeLightbox();
    });
  }

  /* ---------- 相册 ---------- */

  function albumList() {
    var raw = Array.isArray(cfg.albums) ? cfg.albums : [];
    var out = [];
    var known = {};

    raw.forEach(function (item, index) {
      if (!item) return;
      var id = pick(item.id, "album" + (index + 1));
      known[id] = true;
      out.push({
        id: id,
        icon: pick(item.icon, "📷"),
        title: pick(item.title, "相册 " + (index + 1)),
        desc: pick(item.desc, ""),
        cover: pick(item.cover, "")
      });
    });

    // photos-data.js 里出现了、但 config.js 没登记的相册（新建文件夹后自动出现）
    var map = window.SITE_ALBUM_PHOTOS || {};
    Object.keys(map).forEach(function (key) {
      if (known[key]) return;
      if (!Array.isArray(map[key]) || !map[key].length) return;
      out.push({
        id: key,
        icon: "📷",
        title: key === "unclassified" ? "未分类" : key,
        desc: ""
      });
    });

    return out;
  }

  function hasGroupedPhotos() {
    var map = window.SITE_ALBUM_PHOTOS;
    if (!map) return false;
    for (var key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key) && Array.isArray(map[key]) && map[key].length) return true;
    }
    return false;
  }

  function photosFor(id, albums) {
    var map = window.SITE_ALBUM_PHOTOS;
    var list = [];
    if (map && Array.isArray(map[id])) list = map[id];

    if (!list.length && !hasGroupedPhotos()) {
      var legacy = Array.isArray(window.SITE_PHOTOS) ? window.SITE_PHOTOS : [];
      var manual = Array.isArray(cfg.photos) ? cfg.photos : [];
      var flat = legacy.length ? legacy : manual;
      if (flat.length && albums.length && albums[0].id === id) list = flat;
    }

    return list.filter(function (p) {
      return p && pick(p.src, "");
    });
  }

  var PHOTO_DECOS = ["🐾", "🐱", "🐶", "🌸", "🍀", "✨"];

  function photoCard(photo, index) {
    var src = pick(photo.src, "");
    var caption = pick(photo.caption, "");

    var btn = el("button", "photo");
    btn.type = "button";
    btn.setAttribute("aria-label", caption ? "查看照片：" + caption : "查看照片 " + (index + 1));

    var img = document.createElement("img");
    img.src = src;
    img.alt = caption;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", function () {
      btn.classList.add("is-missing");
      btn.style.whiteSpace = "pre-line";
      btn.textContent = "照片没找到\n" + src;
      btn.removeAttribute("aria-label");
    });

    btn.appendChild(img);

    var deco = el("span", "photo__deco");
    deco.setAttribute("aria-hidden", "true");
    deco.textContent = PHOTO_DECOS[index % PHOTO_DECOS.length];
    btn.appendChild(deco);

    if (caption) {
      var cap = el("span", "photo__cap");
      cap.textContent = caption;
      btn.appendChild(cap);
    }

    btn.addEventListener("click", function () {
      if (!btn.classList.contains("is-missing")) openLightbox(src, caption);
    });

    return btn;
  }

  function renderAlbums() {
    var host = qs("#album-list");
    if (!host) return;

    var albums = albumList();
    host.innerHTML = "";

    if (!albums.length) {
      var hint = el("p", "lede");
      hint.textContent = "还没有相册。到 js/config.js 的 albums 里加一项，或者在 edit.html 里加一个相册。";
      host.appendChild(hint);
      return;
    }

    var grid = el("div", "albums-grid");

    albums.forEach(function (album) {
      var photos = photosFor(album.id, albums);
      var card = el("button", "album-card reveal");
      card.type = "button";
      card.id = "album-" + album.id;

      var cover = el("div", "album-card__cover");
      if (photos.length) {
        // 每次刷新从相册里随机挑一张当封面
        var pickIndex = Math.floor(Math.random() * photos.length);
        var img = document.createElement("img");
        img.src = photos[pickIndex].src;
        img.alt = album.title;
        img.loading = "lazy";
        cover.appendChild(img);
      } else if (album.cover) {
        // 空相册可以用一张手绘图当封面（比如「一起旅行 · 待续中」）
        cover.classList.add("album-card__cover--art");
        var art = document.createElement("img");
        art.src = album.cover;
        art.alt = album.title;
        cover.appendChild(art);
      } else {
        cover.classList.add("album-card__cover--empty");
        var bigIcon = el("span", "album-card__big-icon");
        bigIcon.textContent = album.icon;
        cover.appendChild(bigIcon);
      }

      var badge = el("span", "album-card__badge");
      badge.textContent = photos.length ? photos.length + " 张" : "还空着";
      cover.appendChild(badge);
      card.appendChild(cover);

      var body = el("div", "album-card__body");
      var title = el("span", "album-card__title");
      title.textContent = album.title;
      var go = el("span", "album-card__go");
      go.textContent = photos.length ? "进去看看 →" : "";
      body.appendChild(title);
      if (go.textContent) body.appendChild(go);
      card.appendChild(body);

      if (album.desc) {
        var desc = el("p", "album-card__desc");
        desc.textContent = album.desc;
        card.appendChild(desc);
      }

      if (photos.length) {
        card.addEventListener("click", function () { openAlbumView(album, photos); });
      } else {
        card.classList.add("is-empty");
        if (!album.cover) {
          var tips = el("p", "album-card__hint");
          tips.textContent = "把照片放进 assets/photos/" + album.id + "/ 再双击「生成照片数据.cmd」";
          card.appendChild(tips);
        }
      }

      grid.appendChild(card);
    });

    host.appendChild(grid);
  }

  /* ---------- 相册展开视图 ---------- */

  var albumViewEl = null;
  var albumViewTitleEl = null;
  var albumViewCountEl = null;
  var albumViewGridEl = null;

  function openAlbumView(album, photos, subtitle) {
    if (!albumViewEl) return;

    albumViewTitleEl.textContent = album.title;
    albumViewCountEl.textContent = subtitle || (photos.length + " 张照片 · 点开可以放大");
    albumViewGridEl.innerHTML = "";
    if (!photos.length) {
      var empty = el("p", "album-view__empty");
      empty.textContent = "这几天还没有照片。把照片放进对应相册，双击「更新照片」就会出现在这里。";
      albumViewGridEl.appendChild(empty);
    } else {
      photos.forEach(function (photo, index) {
        albumViewGridEl.appendChild(photoCard(photo, index));
      });
    }

    albumViewEl.hidden = false;
    document.body.style.overflow = "hidden";

    // 每次打开都从顶部开始
    var scroller = qs(".album-view__panel");
    if (scroller) scroller.scrollTop = 0;

    var back = qs("#album-view-back");
    if (back) back.focus();
  }

  function closeAlbumView() {
    if (!albumViewEl || albumViewEl.hidden) return;
    albumViewEl.hidden = true;
    document.body.style.overflow = "";
    albumViewGridEl.innerHTML = "";
  }

  function initAlbumView() {
    albumViewEl = qs("#album-view");
    albumViewTitleEl = qs("#album-view-title");
    albumViewCountEl = qs("#album-view-count");
    albumViewGridEl = qs("#album-view-grid");
    if (!albumViewEl) return;

    var back = qs("#album-view-back");
    var close = qs("#album-view-close");
    if (back) back.addEventListener("click", closeAlbumView);
    if (close) close.addEventListener("click", closeAlbumView);

    albumViewEl.addEventListener("click", function (event) {
      if (event.target === albumViewEl) closeAlbumView();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (albumViewEl.hidden) return;
      if (lightboxEl && !lightboxEl.hidden) return; // 先关大图
      closeAlbumView();
    });
  }

  /* ---------- 时间轴 ---------- */

  function renderTimeline() {
    var list = qs("#timeline-list");
    if (!list) return;

    var items = Array.isArray(cfg.timeline) ? cfg.timeline : [];
    if (!items.length) {
      list.classList.add("is-empty");
      var empty = el("p", "lede");
      empty.textContent = "时间轴还是空的。到 js/config.js 的 timeline 里加几条，或者用 edit.html 填。";
      list.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var node = el("div", "titem reveal");

      var date = el("div", "titem__date");
      date.textContent = pick(item && item.date, "");

      var title = el("h3", "titem__title");
      title.textContent = pick(item && item.title, "");

      var text = el("p", "titem__text");
      text.textContent = pick(item && item.text, "");

      if (date.textContent) node.appendChild(date);
      if (title.textContent) node.appendChild(title);
      if (text.textContent) node.appendChild(text);

      list.appendChild(node);
    });
  }

  /* ---------- 一封信 ---------- */

  function renderLetter() {
    var body = qs("#letter-body");
    if (!body) return;

    var paragraphs = [];
    if (Array.isArray(cfg.letter)) {
      paragraphs = cfg.letter;
    } else if (typeof cfg.letter === "string") {
      paragraphs = cfg.letter.split(/\n{2,}/);
    }

    var written = 0;
    paragraphs.forEach(function (text) {
      var value = typeof text === "string" ? text.trim() : "";
      if (!value) return;
      var p = document.createElement("p");
      p.textContent = value;
      body.appendChild(p);
      written += 1;
    });

    if (!written) {
      var hint = el("p", "letter__empty");
      hint.textContent = "信还没写。打开 edit.html，在「一封信」里写下想说的话，导出后刷新这一页就会出现。";
      body.appendChild(hint);
    }

    bind("sign", pick(cfg.sign, ""));
  }

  /* ---------- 翻牌小游戏 ---------- */

  var FALLBACK_FACES = ["🌙", "🐾", "⭐", "🍰", "🎧", "🐟"];

  function startGame() {
    var board = qs("#game-board");
    if (!board) return;

    var albums = albumList();
    var pool = [];
    albums.forEach(function (album) {
      pool = pool.concat(photosFor(album.id, albums));
    });

    var usePhotos = pool.length >= 6;
    var pairs = 6;

    board.innerHTML = "";

    var deck = [];
    for (var i = 0; i < pairs; i++) {
      var face = usePhotos
        ? { kind: "img", src: pool[i].src }
        : { kind: "text", value: FALLBACK_FACES[i] };
      deck.push({ key: i, face: face });
      deck.push({ key: i, face: face });
    }
    shuffle(deck);

    var first = null;
    var lock = false;
    var moves = 0;
    var matched = 0;

    var movesEl = qs("#game-moves");
    var statusEl = qs("#game-status");
    var resetEl = qs("#game-reset");

    if (movesEl) movesEl.textContent = "0";
    if (statusEl) statusEl.textContent = "找找看吧";

    deck.forEach(function (entry) {
      var card = el("button", "card");
      card.type = "button";
      card.setAttribute("aria-label", "未翻开的卡片");

      var inner = el("span", "card__inner");

      var back = el("span", "card__face card__face--back");
      back.textContent = "🐾";

      var front = el("span", "card__face card__face--front");

      if (entry.face.kind === "img") {
        var img = document.createElement("img");
        img.src = entry.face.src;
        img.alt = "";
        img.loading = "lazy";
        front.appendChild(img);
      } else {
        front.textContent = entry.face.value;
      }

      inner.appendChild(back);
      inner.appendChild(front);
      card.appendChild(inner);

      card.addEventListener("click", function () {
        if (lock) return;
        if (card.classList.contains("is-flipped") || card.classList.contains("is-matched")) return;

        card.classList.add("is-flipped");
        card.setAttribute("aria-label", "已翻开");

        if (!first) {
          first = { el: card, key: entry.key };
          return;
        }

        var second = { el: card, key: entry.key };
        moves += 1;
        if (movesEl) movesEl.textContent = String(moves);

        if (first.key === second.key) {
          first.el.classList.add("is-matched");
          second.el.classList.add("is-matched");
          first.el.setAttribute("aria-label", "已配对");
          second.el.setAttribute("aria-label", "已配对");
          first = null;
          matched += 1;
          if (matched === pairs && statusEl) {
            statusEl.textContent = "全部配对！用了 " + moves + " 步 🎉";
          }
          return;
        }

        var previous = first.el;
        first = null;
        lock = true;

        window.setTimeout(function () {
          previous.classList.remove("is-flipped");
          card.classList.remove("is-flipped");
          previous.setAttribute("aria-label", "未翻开的卡片");
          card.setAttribute("aria-label", "未翻开的卡片");
          lock = false;
        }, 720);
      });

      board.appendChild(card);
    });

    if (resetEl) resetEl.onclick = startGame;
  }

  /* ---------- 首屏音乐播放器 ---------- */

  function initMusic() {
    var audio = qs("#bgm");
    var card = qs("#music-card");
    if (!audio || !card) return;

    var music = cfg.music || {};
    var src = pick(music.src, "");

    if (!src) {
      card.hidden = true;
      return;
    }

    audio.src = src;

    // 音量：默认 50%，页面上的滑块随时可调
    var defaultVol = typeof music.volume === "number" ? music.volume : 50;
    defaultVol = Math.min(100, Math.max(0, defaultVol));
    audio.volume = defaultVol / 100;

    var volume = qs("#music-volume");
    if (volume) {
      volume.value = String(defaultVol);
      volume.addEventListener("input", function () {
        var v = Number(volume.value);
        if (!isFinite(v)) v = defaultVol;
        audio.volume = Math.min(1, Math.max(0, v / 100));
      });
    }

    var titleEl = qs("#music-title");
    if (titleEl) titleEl.textContent = pick(music.title, "背景音乐");

    var toggle = qs("#music-toggle");
    var bar = qs("#music-bar");
    var fill = qs("#music-fill");
    var timeEl = qs("#music-time");

    function fmt(sec) {
      if (!isFinite(sec) || sec < 0) return "0:00";
      sec = Math.floor(sec);
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function paint() {
      var duration = audio.duration;
      var current = audio.currentTime || 0;
      var pct = (isFinite(duration) && duration > 0) ? (current / duration) * 100 : 0;
      if (fill) fill.style.width = pct.toFixed(1) + "%";
      if (bar) bar.setAttribute("aria-valuenow", String(Math.round(pct)));
      if (timeEl) timeEl.textContent = fmt(current) + " / " + fmt(duration);
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        if (audio.paused) {
          var playing = audio.play();
          if (playing && playing.catch) playing.catch(function () {});
        } else {
          audio.pause();
        }
      });
    }

    audio.addEventListener("play", function () { card.classList.add("is-playing"); });
    audio.addEventListener("pause", function () { card.classList.remove("is-playing"); });
    audio.addEventListener("ended", function () { card.classList.remove("is-playing"); });
    audio.addEventListener("timeupdate", paint);
    audio.addEventListener("loadedmetadata", paint);

    if (bar) {
      bar.addEventListener("click", function (event) {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        var rect = bar.getBoundingClientRect();
        var ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * audio.duration;
        paint();
      });
    }

    paint();
  }

  /* ---------- 滚动出现 ---------- */

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add("is-in");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  /* ---------- 风雨时刻 ---------- */

  function renderStorms() {
    var host = qs("#storm-list");
    if (!host) return;

    var items = Array.isArray(cfg.storms) ? cfg.storms : [];

    if (!items.length) {
      var empty = el("p", "storm__empty");
      empty.textContent = "这里还空着。把你们吵过又和好的事写进 js/config.js 的 storms 里，或者告诉我，我帮你写。";
      host.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var card = el("article", "storm reveal");

      var head = el("header", "storm__head");
      var dateText = pick(item && item.date, "");
      if (dateText) {
        var date = el("span", "storm__date");
        date.textContent = dateText;
        head.appendChild(date);
      }
      var title = el("h3", "storm__title");
      title.textContent = pick(item && item.title, "");
      head.appendChild(title);
      card.appendChild(head);

      var body = el("div", "storm__body");
      var quotes = Array.isArray(item && item.quotes) ? item.quotes : [];
      quotes.forEach(function (quote) {
        if (!quote) return;
        var text = pick(quote.text, "");
        if (!text) return;
        var who = pick(quote.who, "me") === "you" ? "you" : "me";
        var bubble = el("div", "bubble bubble--" + who);
        bubble.textContent = text;
        body.appendChild(bubble);
      });
      if (body.children.length) card.appendChild(body);

      var settle = pick(item && item.settle, "");
      if (settle) {
        var settleEl = el("p", "storm__settle");
        settleEl.textContent = settle;
        card.appendChild(settleEl);
      }

      host.appendChild(card);
    });
  }

  /* ---------- 两侧图钉照片墙 ---------- */

  var RAIL_TILTS = [-6, 4, -3, 5];
  var RAIL_COLORS = ["", "orn--blue", "orn--lime", "orn--cream"];
  var RAIL_PINS = ["", "pin-dot--blue", "pin-dot--gold", "pin-dot--lime"];

  function makeSvgUse(id, className, viewBox) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    if (viewBox) svg.setAttribute("viewBox", viewBox);
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }

  function fillRail(host, photos, seed) {
    host.innerHTML = "";

    photos.forEach(function (photo, index) {
      var k = index + seed;
      var card = el("figure", "pin-card");
      card.style.setProperty("--tilt", RAIL_TILTS[k % RAIL_TILTS.length] + "deg");

      var pin = el("span", "pin-dot " + RAIL_PINS[k % RAIL_PINS.length]);
      card.appendChild(pin);

      var img = document.createElement("img");
      img.src = photo.src;
      img.alt = photo.caption || "";
      img.loading = "lazy";
      card.appendChild(img);

      if (photo.caption) {
        var cap = el("figcaption", "pin-card__cap");
        cap.textContent = photo.caption;
        card.appendChild(cap);
      }

      card.appendChild(makeSvgUse("cluster", "orn orn--tl " + RAIL_COLORS[k % RAIL_COLORS.length]));
      card.appendChild(makeSvgUse("bloom", "orn orn--br " + RAIL_COLORS[(k + 2) % RAIL_COLORS.length]));

      host.appendChild(card);
    });
  }

  function renderRails() {
    var left = qs("#rail-left");
    var right = qs("#rail-right");
    if (!left || !right) return;

    // 优先用 assets/photos/_两侧/ 里的照片；没有就用相册里的前几张
    var pool = [];
    var custom = Array.isArray(window.SITE_RAIL_PHOTOS) ? window.SITE_RAIL_PHOTOS : [];
    custom.forEach(function (photo) {
      if (photo && pick(photo.src, "")) pool.push(photo);
    });

    if (!pool.length) {
      var albums = albumList();
      albums.forEach(function (album) {
        photosFor(album.id, albums).forEach(function (photo) { pool.push(photo); });
      });
    }

    if (pool.length < 2) {
      left.hidden = true;
      right.hidden = true;
      return;
    }

    // 每次刷新随机：先洗牌，再随机决定左右各 3 张还是 2 张（谁多谁少也随机）
    pool = shuffle(pool.slice());

    var bigger = Math.random() < 0.5 ? 3 : 2;
    var smaller = bigger === 3 ? 2 : 3;
    var leftWanted = Math.random() < 0.5 ? bigger : smaller;
    var rightWanted = leftWanted === bigger ? smaller : bigger;

    // 给对侧至少留 1 张，避免一边全空
    var reserve = pool.length >= 2 ? 1 : 0;
    var leftCount = Math.min(leftWanted, pool.length - reserve);
    var rightCount = Math.min(rightWanted, pool.length - leftCount);

    var leftPhotos = pool.slice(0, leftCount);
    var rightPhotos = pool.slice(leftCount, leftCount + rightCount);

    if (leftPhotos.length) fillRail(left, leftPhotos, Math.random() < 0.5 ? 0 : 1);
    if (rightPhotos.length) fillRail(right, rightPhotos, Math.random() < 0.5 ? 0 : 2);

    left.hidden = !leftPhotos.length;
    right.hidden = !rightPhotos.length;
  }

  /* ---------- 下次见面倒计时 ---------- */

  function renderMeeting() {
    var host = qs("#meeting-host");
    if (!host) return;

    host.innerHTML = "";

    var conf = cfg.nextMeeting || {};
    var target = parseDate(pick(conf.date, ""));
    var label = pick(conf.label, "下次见面");
    var note = pick(conf.note, "");

    if (!target) {
      var hint = el("p", "meeting__hint");
      hint.textContent = "还没填日期。到 js/config.js 的 nextMeeting.date 写上，格式 2026-12-20，这里就会自动倒数。";
      host.appendChild(hint);
      return;
    }

    var now = today();
    var diff = Math.round((target - now) / DAY);

    var card = el("div", "meeting-card");

    var pets = el("div", "meeting-card__pets");
    var cat = makeSvgUse("pet-cat", "meeting__pet", "0 0 200 220");
    var dots = el("span", "meeting-card__dots");
    dots.textContent = "· · ·";
    var dog = makeSvgUse("pet-dog", "meeting__pet meeting__pet--dog", "0 0 200 220");
    pets.appendChild(cat);
    pets.appendChild(dots);
    pets.appendChild(dog);
    card.appendChild(pets);

    var labelEl = el("p", "meeting-card__label");
    labelEl.textContent = label;
    card.appendChild(labelEl);

    var num = el("p", "meeting-card__num");
    if (diff > 0) {
      var strong = el("span", "meeting-card__days");
      strong.textContent = String(diff);
      num.appendChild(strong);
      var unit = el("i", "meeting-card__unit");
      unit.textContent = "天";
      num.appendChild(unit);
    } else if (diff === 0) {
      var todayEl = el("span", "meeting-card__days meeting-card__days--today");
      todayEl.textContent = "今天";
      num.appendChild(todayEl);
    } else {
      var past = el("span", "meeting-card__days meeting-card__days--past");
      past.textContent = String(Math.abs(diff));
      num.appendChild(past);
      var pastUnit = el("i", "meeting-card__unit");
      pastUnit.textContent = "天前见的";
      num.appendChild(pastUnit);
    }
    card.appendChild(num);

    var dateEl = el("p", "meeting-card__date");
    dateEl.textContent = target.getFullYear() + "." + pad2(target.getMonth() + 1) + "." + pad2(target.getDate());
    card.appendChild(dateEl);

    if (note) {
      var noteEl = el("p", "meeting-card__note");
      noteEl.textContent = note;
      card.appendChild(noteEl);
    }

    host.appendChild(card);
  }

  /* ---------- 一起要做的事 ---------- */

  var WISH_KEY = "our-universe-wishlist-v1";

  function wishStored() {
    try {
      var raw = window.localStorage.getItem(WISH_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      return [];
    }
  }

  function wishSave(list) {
    try {
      window.localStorage.setItem(WISH_KEY, JSON.stringify(list));
    } catch (err) {
      /* 本地文件模式下存不了就算了，不影响勾选本身 */
    }
  }

  function renderWishlist() {
    var host = qs("#wishlist-host");
    if (!host) return;

    host.innerHTML = "";

    var items = (Array.isArray(cfg.wishlist) ? cfg.wishlist : []).filter(function (item) {
      return item && pick(item.text, "");
    });

    if (!items.length) {
      var hint = el("p", "wishlist__hint");
      hint.textContent = "清单还空着。到 js/config.js 的 wishlist 里写几件想一起做的事，例如 { text: \"一起看一次日出\" }。";
      host.appendChild(hint);
      return;
    }

    var stored = wishStored();
    var buttons = [];

    var head = el("div", "wishlist__head");
    var countEl = el("p", "wishlist__count");
    var barWrap = el("div", "wishlist__bar");
    var barFill = el("span", "wishlist__bar-fill");
    barWrap.appendChild(barFill);
    head.appendChild(countEl);
    head.appendChild(barWrap);
    host.appendChild(head);

    var grid = el("ul", "wishlist__grid");

    function refresh() {
      var done = 0;
      buttons.forEach(function (btn) {
        if (btn.classList.contains("is-done")) done += 1;
      });

      countEl.textContent = "";
      countEl.appendChild(document.createTextNode("已完成 "));
      var strong = el("b");
      strong.textContent = String(done);
      countEl.appendChild(strong);
      countEl.appendChild(document.createTextNode(" / " + buttons.length));

      barFill.style.width = (buttons.length ? (done / buttons.length) * 100 : 0) + "%";
    }

    items.forEach(function (item, index) {
      var text = pick(item.text, "");
      var li = el("li", "wishlist__item");

      var btn = el("button", "wish");
      btn.type = "button";

      var no = el("span", "wish__no");
      no.textContent = pad2(index + 1);

      var box = el("span", "wish__box");
      box.textContent = "✓";

      var label = el("span", "wish__text");
      label.textContent = text;

      btn.appendChild(no);
      btn.appendChild(box);
      btn.appendChild(label);

      var isDone = item.done === true || stored.indexOf(text) !== -1;
      if (isDone) btn.classList.add("is-done");
      btn.setAttribute("aria-pressed", isDone ? "true" : "false");

      btn.addEventListener("click", function () {
        var next = !btn.classList.contains("is-done");
        btn.classList.toggle("is-done", next);
        btn.setAttribute("aria-pressed", next ? "true" : "false");

        var list = wishStored();
        var at = list.indexOf(text);
        if (next && at === -1) list.push(text);
        if (!next && at !== -1) list.splice(at, 1);
        wishSave(list);
        refresh();
      });

      buttons.push(btn);
      li.appendChild(btn);
      grid.appendChild(li);
    });

    host.appendChild(grid);
    refresh();
  }

  /* ---------- 见面日历 ---------- */

  var MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  var WEEK_LETTERS = ["一", "二", "三", "四", "五", "六", "日"];

  function dateKey(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function photoDate(src) {
    var base = String(src || "").split("/").pop();
    var m = /^(\d{4})[_-](\d{1,2})[_-](\d{1,2})/.exec(base);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function allPhotoPool() {
    var albums = albumList();
    var out = [];
    albums.forEach(function (album) {
      photosFor(album.id, albums).forEach(function (photo) { out.push(photo); });
    });

    // _见面 文件夹里的照片（文件名带日期，供见面日历匹配）
    var extra = Array.isArray(window.SITE_MEETING_PHOTOS) ? window.SITE_MEETING_PHOTOS : [];
    extra.forEach(function (photo) {
      if (photo && pick(photo.src, "")) out.push(photo);
    });

    return out;
  }

  function meetingList() {
    var raw = Array.isArray(cfg.meetings) ? cfg.meetings : [];
    var out = [];
    raw.forEach(function (item) {
      if (!item) return;
      var start = parseDate(item.start);
      if (!start) return;
      var end = parseDate(item.end) || start;
      if (end < start) end = start;
      out.push({
        start: start,
        end: end,
        title: pick(item.title, "见面的日子"),
        note: pick(item.note, ""),
        manual: Array.isArray(item.photos) ? item.photos : []
      });
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  function photosForMeeting(meeting, pool) {
    var out = [];
    var seen = {};

    function keyOf(src) {
      // 用文件名去重：同一张图在几个相册里都放过时只显示一次
      return String(src || "").split("/").pop();
    }

    meeting.manual.forEach(function (src) {
      var s = pick(src, "");
      if (s && !seen[keyOf(s)]) {
        seen[keyOf(s)] = true;
        out.push({ src: s, caption: "" });
      }
    });

    pool.forEach(function (photo) {
      var d = photoDate(photo.src);
      if (!d) return;
      if (d < meeting.start || d > meeting.end) return;
      var k = keyOf(photo.src);
      if (seen[k]) return;
      seen[k] = true;
      out.push(photo);
    });

    return out;
  }

  function fmtDay(d) {
    return (d.getMonth() + 1) + "." + d.getDate();
  }

  function fmtRange(a, b) {
    if (dateKey(a) === dateKey(b)) return fmtDay(a);
    return fmtDay(a) + " – " + fmtDay(b);
  }

  function openMeetingPhotos(meeting, pool) {
    var photos = photosForMeeting(meeting, pool);

    var sub = fmtRange(meeting.start, meeting.end);
    sub += photos.length ? " · " + photos.length + " 张照片" : " · 这里还没有照片";
    if (meeting.note) sub += " · " + meeting.note;

    openAlbumView({ title: meeting.title }, photos, sub);
  }

  /* 按标题里的关键词给见面的日子配个小图标 */
  var MEETING_ICONS = [
    { re: /生日/, icon: "🎂" },
    { re: /志愿者/, icon: "🎗️" },
    { re: /清吧|喝醉/, icon: "🍸" },
    { re: /广州塔|海心沙/, icon: "🗼" },
    { re: /沙面|玩/, icon: "🎡" },
    { re: /自行车|骑车/, icon: "🚲" },
    { re: /做饭|吃饭/, icon: "🍳" },
    { re: /返校|接她|开学/, icon: "🚉" },
    { re: /老家/, icon: "🏠" },
    { re: /偷偷|拆穿/, icon: "🤫" },
    { re: /暑假|寒假/, icon: "🧣" },
    { re: /第一|第二/, icon: "💗" }
  ];

  function meetingIcon(title) {
    var t = String(title || "");
    for (var i = 0; i < MEETING_ICONS.length; i++) {
      if (MEETING_ICONS[i].re.test(t)) return MEETING_ICONS[i].icon;
    }
    return "💗";
  }

  function renderCalendar() {
    var monthsHost = qs("#cal-months");
    var stripHost = qs("#cal-strip");
    if (!monthsHost) return;

    var now = today();
    var year = now.getFullYear();
    var meetings = meetingList();
    var pool = allPhotoPool();

    var dayMap = {};
    meetings.forEach(function (m, index) {
      var d = new Date(m.start.getTime());
      var guard = 0;
      while (d <= m.end && guard < 400) {
        dayMap[dateKey(d)] = index;
        d.setDate(d.getDate() + 1);
        guard += 1;
      }
    });

    // 生日
    var bdayMap = {};
    (Array.isArray(cfg.birthdays) ? cfg.birthdays : []).forEach(function (item) {
      var d = parseDate(item && item.date);
      if (d) bdayMap[dateKey(d)] = pick(item.who, "");
    });

    var yearDays = 0;
    meetings.forEach(function (m) {
      var d = new Date(m.start.getTime());
      var guard = 0;
      while (d <= m.end && guard < 400) {
        if (d.getFullYear() === year) yearDays += 1;
        d.setDate(d.getDate() + 1);
        guard += 1;
      }
    });

    var yearMeetings = meetings.filter(function (m) {
      return m.end.getFullYear() >= year && m.start.getFullYear() <= year;
    }).length;

    var nextDate = parseDate(pick((cfg.nextMeeting || {}).date, ""));
    var nextDays = nextDate ? Math.round((nextDate - now) / DAY) : null;

    if (stripHost) {
      stripHost.innerHTML = "";
      var items = [
        { num: String(yearDays), label: "天，今年一起过的" },
        { num: String(yearMeetings), label: "次见面" }
      ];
      if (nextDays !== null && nextDays >= 0) {
        items.push({ num: String(nextDays), label: "天后下次见面" });
      }
      items.forEach(function (item) {
        var box = el("div", "cal-strip__item");
        var num = el("b");
        num.textContent = item.num;
        var label = el("span");
        label.textContent = item.label;
        box.appendChild(num);
        box.appendChild(label);
        stripHost.appendChild(box);
      });
    }

    monthsHost.innerHTML = "";
    for (var mi = 0; mi < 12; mi++) {      var first = new Date(year, mi, 1);
      var total = new Date(year, mi + 1, 0).getDate();
      var lead = (first.getDay() + 6) % 7;

      var month = el("div", "cal-month");
      var nameEl = el("p", "cal-month__name");
      nameEl.textContent = MONTH_NAMES[mi];
      month.appendChild(nameEl);

      var weekRow = el("div", "cal-week");
      WEEK_LETTERS.forEach(function (letter) {
        var w = el("span", "cal-week__day");
        w.textContent = letter;
        weekRow.appendChild(w);
      });
      month.appendChild(weekRow);

      var grid = el("div", "cal-grid");
      for (var pad = 0; pad < lead; pad++) {
        grid.appendChild(el("span", "cal-cell cal-cell--pad"));
      }

      for (var day = 1; day <= total; day++) {
        var cur = new Date(year, mi, day);
        var key = dateKey(cur);
        var has = Object.prototype.hasOwnProperty.call(dayMap, key);
        var isBday = Object.prototype.hasOwnProperty.call(bdayMap, key);
        var cell;

        if (has) {
          cell = el("button", "cal-cell cal-cell--hit");
          cell.type = "button";
          var meeting = meetings[dayMap[key]];
          cell.setAttribute("aria-label", "查看 " + key + " 的照片：" + meeting.title);
          (function (m) {
            cell.addEventListener("click", function () {
              openMeetingPhotos(m, pool);
            });
          }(meeting));
        } else if (isBday) {
          cell = el("span", "cal-cell cal-cell--bday");
          cell.setAttribute("title", bdayMap[key] + "的生日");
        } else {
          cell = el("span", "cal-cell");
        }

        cell.textContent = String(day);

        if (has) {
          var badge = el("span", "cal-badge");
          badge.textContent = meetingIcon(meetings[dayMap[key]].title);
          badge.setAttribute("aria-hidden", "true");
          cell.appendChild(badge);
          cell.setAttribute("title", meetings[dayMap[key]].title);
        } else if (isBday) {
          var cake = el("span", "cal-badge");
          cake.textContent = "🎂";
          cake.setAttribute("aria-hidden", "true");
          cell.appendChild(cake);
        }

        if (day === now.getDate() && mi === now.getMonth()) cell.classList.add("is-today");
        grid.appendChild(cell);
      }

      month.appendChild(grid);
      monthsHost.appendChild(month);
    }

    // 日历下方只留一句提示，不再铺照片卡片
    var note = qs("#cal-note");
    if (note) {
      if (!meetings.length) {
        note.hidden = false;
        note.textContent = "还没记录过见面的日子。到 js/config.js 的 meetings 里加一条（把日期告诉我，我帮你写也行）。";
      } else {
        note.hidden = false;
        note.textContent = "点日历上粉色的日期，就能翻那几天拍的照片。";
      }
    }
  }

  /* ---------- 「有些话」的锁：通关小游戏 或 输密码 ---------- */

  /* 只在本次打开有效：刷新或重开网页就重新上锁，不留记录 */
  var LETTER_OPEN_KEY = "our-universe-letter-open";
  var letterOpenNow = false;

  function openLetter(silent) {
    var lock = qs("#letter-lock");
    var content = qs("#letter-content");
    if (!lock || !content) return;

    letterOpenNow = true;
    lock.hidden = true;
    content.hidden = false;
    content.classList.add("is-fresh");

    if (!silent && typeof content.animate === "function") {
      content.animate(
        [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 600, easing: "cubic-bezier(0.2,0.7,0.2,1)" }
      );
    }
  }

  function initLetterLock() {
    var lock = qs("#letter-lock");
    if (!lock) return;

    // 清掉旧版本可能存下来的解锁记录，保证「每次打开都重新锁上」
    try {
      window.localStorage.removeItem(LETTER_OPEN_KEY);
    } catch (err) {
      /* 无所谓 */
    }

    // 同一次浏览里已经解过（比如刚通关）就保持打开
    if (letterOpenNow) {
      openLetter(true);
      return;
    }

    var input = qs("#letter-password");
    var btn = qs("#letter-unlock-btn");
    var msg = qs("#letter-lock-msg");
    var pass = pick((cfg.unlock || {}).password, "");

    function tryUnlock() {
      var typed = input ? input.value.trim() : "";
      if (!typed) {
        if (msg) msg.textContent = "先输入密码吧";
        return;
      }
      if (typed === pass) {
        if (msg) msg.textContent = "";
        openLetter(false);
        lock.hidden = true;
      } else if (msg) {
        msg.textContent = "密码不对，再想想～";
        input.value = "";
        input.focus();
      }
    }

    if (btn) btn.addEventListener("click", tryUnlock);
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          tryUnlock();
        }
      });
    }

    // 通关小游戏 -> 自动解锁
    window.addEventListener("our:game-win", function () {
      openLetter(false);
    });
  }

  /* ---------- 「留给你」问答 ---------- */

  var ASK_KEY = "our-universe-ask-draft";

  var ASK_LABELS = [
    "一首歌形容我们",
    "今年最想一起做的一件事",
    "关于张奶奶",
    "想对三年后的我们说"
  ];

  function initAsk() {
    var form = qs("#ask-form");
    if (!form) return;

    var inputs = Array.prototype.slice.call(form.querySelectorAll("[data-ask]"));
    var resultBox = qs("#ask-result");
    var resultText = qs("#ask-text");
    var copyBtn = qs("#ask-copy");
    var clearBtn = qs("#ask-clear");
    var msg = qs("#ask-msg");

    // 恢复草稿（只存在她自己的浏览器里）
    try {
      var saved = JSON.parse(window.localStorage.getItem(ASK_KEY) || "[]");
      if (Array.isArray(saved)) {
        inputs.forEach(function (input, i) {
          if (typeof saved[i] === "string") input.value = saved[i];
        });
      }
    } catch (err) { /* 忽略 */ }

    function saveDraft() {
      try {
        window.localStorage.setItem(ASK_KEY, JSON.stringify(inputs.map(function (i) { return i.value; })));
      } catch (err) { /* 忽略 */ }
    }

    inputs.forEach(function (input) {
      input.addEventListener("input", function () {
        saveDraft();
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 160) + "px";
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var answers = inputs.map(function (i) { return i.value.trim(); });
      if (!answers.some(function (a) { return a; })) {
        if (msg) msg.textContent = "先随便写一句吧～";
        return;
      }

      var d = today();
      var lines = ["恋瑄的答案 · " + d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate())];
      answers.forEach(function (a, i) {
        lines.push((i + 1) + ". " + ASK_LABELS[i] + "：" + (a || "（还没想好）"));
      });

      if (resultText) resultText.textContent = lines.join("\n");
      if (resultBox) resultBox.hidden = false;
      if (msg) msg.textContent = "";
      if (resultBox) resultBox.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = resultText ? resultText.textContent : "";
        if (!text) return;

        function done() { if (msg) msg.textContent = "已复制，粘贴发给他就行"; }
        function fallback() {
          var range = document.createRange();
          range.selectNodeContents(resultText);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          if (msg) msg.textContent = "已选中，按 Ctrl+C 复制";
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        inputs.forEach(function (i) { i.value = ""; i.style.height = "auto"; });
        saveDraft();
        if (resultBox) resultBox.hidden = true;
        if (msg) msg.textContent = "已清空";
      });
    }
  }

  /* ---------- 飘落的叶子 / 花瓣 ---------- */

  function initLeaves() {
    var host = qs("#scene-leaves");
    if (!host) return;

    var colors = ["#9ed8a8", "#bfe6cc", "#a8d8c0", "#ffb7cd", "#ffd6e3", "#ffe08a", "#bfd9ff"];
    var count = window.innerWidth < 700 ? 12 : 22;

    for (var i = 0; i < count; i++) {
      var leaf = document.createElement("span");
      leaf.className = "leaf " + (Math.random() < 0.55 ? "leaf--blade" : "leaf--petal");
      leaf.style.left = (Math.random() * 100).toFixed(2) + "vw";
      leaf.style.background = colors[Math.floor(Math.random() * colors.length)];
      leaf.style.width = (9 + Math.random() * 10).toFixed(1) + "px";
      leaf.style.height = (11 + Math.random() * 11).toFixed(1) + "px";
      leaf.style.animationDuration = (11 + Math.random() * 13).toFixed(1) + "s";
      leaf.style.animationDelay = (-Math.random() * 22).toFixed(1) + "s";
      leaf.style.opacity = "0";
      host.appendChild(leaf);
    }
  }

  /* ---------- 多米和熊猫：点一下会蹦 + 叫一声 ---------- */

  function initPets() {
    var pets = [
      {
        el: qs(".pet--cat"),
        lines: ["喵～", "喵呜…", "呼噜呼噜", "喵？", "饿饿…"]
      },
      {
        el: qs(".pet--dog"),
        lines: ["汪！", "汪汪汪", "嗷呜～", "汪…", "要抱抱"]
      }
    ].filter(function (p) { return p.el; });

    if (!pets.length) return;

    function say(pet) {
      var bubble = document.createElement("span");
      bubble.className = "pet-bubble";
      bubble.textContent = pet.lines[Math.floor(Math.random() * pet.lines.length)];

      var r = pet.el.getBoundingClientRect();
      bubble.style.left = (r.left + r.width / 2) + "px";
      bubble.style.top = (r.top + 4) + "px";
      document.body.appendChild(bubble);

      pet.el.classList.add("is-hop");
      setTimeout(function () { pet.el.classList.remove("is-hop"); }, 560);

      setTimeout(function () {
        bubble.classList.add("is-out");
        setTimeout(function () {
          if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
        }, 400);
      }, 1300);
    }

    pets.forEach(function (pet) {
      pet.el.addEventListener("click", function () { say(pet); });
      pet.el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); say(pet); }
      });
    });

    // 每隔一阵自己叫一声
    (function idle() {
      setTimeout(function () {
        if (!document.hidden) say(pets[Math.floor(Math.random() * pets.length)]);
        idle();
      }, 9000 + Math.random() * 8000);
    }());
  }

  /* ---------- 启动 ---------- */

  function boot() {
    initHero();
    initLeaves();
    initPets();
    initLightbox();
    initAlbumView();
    renderAlbums();
    renderRails();
    renderCalendar();
    renderWishlist();
    renderStorms();
    renderLetter();
    initAsk();
    initLetterLock();
    initMusic();
    startGame();
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
