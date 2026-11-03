/* ============================================================
   内容编辑器 — 逻辑
   在表单里改，点导出，生成 config.js 和 photos-data.js。
   页面本身不写任何内容，内容都来自 state。
   ============================================================ */

(function () {
  "use strict";

  var config = window.SITE_CONFIG || {};
  var grouped = window.SITE_ALBUM_PHOTOS || {};
  var flatSource = (Array.isArray(window.SITE_PHOTOS) && window.SITE_PHOTOS.length)
    ? window.SITE_PHOTOS
    : (Array.isArray(config.photos) ? config.photos : []);

  function readAlbums() {
    var raw = Array.isArray(config.albums) ? config.albums : [];
    var out = [];
    raw.forEach(function (item, index) {
      if (!item) return;
      out.push({
        id: item.id || ("album" + (index + 1)),
        icon: item.icon || "📷",
        title: item.title || ("相册 " + (index + 1)),
        desc: item.desc || ""
      });
    });
    return out.length ? out : [{ id: "album1", icon: "📷", title: "相册一", desc: "" }];
  }

  function readPhotos(albums) {
    var out = [];
    var hasGrouped = false;

    Object.keys(grouped).forEach(function (key) {
      if (Array.isArray(grouped[key]) && grouped[key].length) hasGrouped = true;
    });

    if (hasGrouped) {
      albums.forEach(function (album) {
        var list = Array.isArray(grouped[album.id]) ? grouped[album.id] : [];
        list.forEach(function (item) {
          if (!item || !item.src) return;
          out.push({ src: item.src, caption: item.caption || "", album: album.id });
        });
      });
    } else {
      var firstId = albums.length ? albums[0].id : "album1";
      flatSource.forEach(function (item) {
        if (!item || !item.src) return;
        out.push({ src: item.src, caption: item.caption || "", album: item.album || firstId });
      });
    }

    return out;
  }

  var state = {
    title: config.title || "",
    subtitle: config.subtitle || "",
    me: (config.names && config.names.me) || "",
    you: (config.names && config.names.you) || "",
    startDate: config.startDate || "",
    sign: config.sign || "",
    footer: config.footer || "",
    cat: (config.pets && config.pets.cat) || "",
    dog: (config.pets && config.pets.dog) || "",
    musicSrc: (config.music && config.music.src) || "",
    musicTitle: (config.music && config.music.title) || "",
    letter: Array.isArray(config.letter) ? config.letter.join("\n\n") : (config.letter || ""),
    timeline: (Array.isArray(config.timeline) ? config.timeline : []).map(function (item) {
      return { date: item.date || "", title: item.title || "", text: item.text || "" };
    }),
    albums: [],
    photos: []
  };

  state.albums = readAlbums();
  state.photos = readPhotos(state.albums);

  /* ---------- 小工具 ---------- */

  function qs(selector) { return document.querySelector(selector); }

  function setStatus(text) {
    var node = qs("#status");
    if (!node) return;
    node.textContent = text;
    if (setStatus.timer) window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(function () { node.textContent = ""; }, 7000);
  }

  function makeInput(value, placeholder, onInput, className) {
    var input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.placeholder = placeholder || "";
    if (className) input.className = className;
    input.addEventListener("input", function () { onInput(input.value); updateSize(); });
    return input;
  }

  function makeButton(label, onClick, className) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--sm" + (className ? " " + className : "");
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function makeHint(text) {
    var p = document.createElement("p");
    p.className = "hint";
    p.textContent = text;
    return p;
  }

  function photosInAlbum(id) {
    return state.photos.filter(function (photo) { return photo.album === id && photo.src; });
  }

  /* ---------- 相册 ---------- */

  function renderAlbums() {
    var box = qs("#album-rows");
    if (!box) return;

    box.innerHTML = "";

    if (!state.albums.length) {
      box.appendChild(makeHint("还没有相册。点右上角「加一个相册」。"));
      return;
    }

    state.albums.forEach(function (album, index) {
      var row = document.createElement("div");
      row.className = "row";

      var iconInput = makeInput(album.icon, "📷", function (value) {
        album.icon = value.trim() || "📷";
      });
      iconInput.style.width = "58px";
      iconInput.style.textAlign = "center";

      var body = document.createElement("div");
      body.className = "row__body";

      body.appendChild(makeInput(album.title, "相册标题，例如「日常碎片」", function (value) {
        album.title = value;
      }));

      body.appendChild(makeInput(album.desc, "一句话说明（可空）", function (value) {
        album.desc = value;
      }));

      body.appendChild(makeHint("编号 " + album.id + " · " + photosInAlbum(album.id).length + " 张照片"));

      var tools = document.createElement("div");
      tools.className = "row__tools";
      tools.appendChild(makeButton("↑", function () { moveAlbum(index, -1); }, "btn--icon"));
      tools.appendChild(makeButton("↓", function () { moveAlbum(index, 1); }, "btn--icon"));
      tools.appendChild(makeButton("删除", function () {
        if (!window.confirm("删除相册「" + (album.title || album.id) + "」？里面的照片也会一起移除。")) return;
        var removed = album.id;
        state.albums.splice(index, 1);
        state.photos = state.photos.filter(function (photo) { return photo.album !== removed; });
        renderAlbums();
        renderPhotos();
      }, "btn--danger"));

      row.appendChild(iconInput);
      row.appendChild(body);
      row.appendChild(tools);
      box.appendChild(row);
    });
  }

  function moveAlbum(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= state.albums.length) return;
    var tmp = state.albums[index];
    state.albums[index] = state.albums[target];
    state.albums[target] = tmp;
    renderAlbums();
  }

  function addAlbum() {
    var n = state.albums.length + 1;
    var id = "album" + n;
    var exists = function (candidate) {
      return state.albums.some(function (album) { return album.id === candidate; });
    };
    while (exists(id)) {
      n += 1;
      id = "album" + n;
    }
    state.albums.push({ id: id, icon: "📷", title: "新相册", desc: "" });
    renderAlbums();
    renderPhotos();
  }

  /* ---------- 照片行 ---------- */

  function renderPhotos() {
    var box = qs("#photo-rows");
    if (!box) return;

    box.innerHTML = "";

    var count = qs("#photo-count");
    if (count) count.textContent = state.photos.length ? "（" + state.photos.length + " 张）" : "（还没加）";

    if (!state.photos.length) {
      box.appendChild(makeHint("还没有照片。点右上角「添加照片」挑几张就行。"));
      updateSize();
      return;
    }

    state.photos.forEach(function (photo, index) {
      var row = document.createElement("div");
      row.className = "row";

      var thumb = document.createElement("div");
      thumb.className = "thumb";
      if (photo.src && photo.src.indexOf("data:") === 0) {
        var img = document.createElement("img");
        img.src = photo.src;
        img.alt = "";
        thumb.appendChild(img);
      } else if (photo.src) {
        thumb.textContent = "文件";
      } else {
        thumb.textContent = "空";
      }

      var body = document.createElement("div");
      body.className = "row__body";

      body.appendChild(makeInput(photo.caption, "这张照片的说明（可留空）", function (value) {
        photo.caption = value;
      }));

      var select = document.createElement("select");
      state.albums.forEach(function (album) {
        var option = document.createElement("option");
        option.value = album.id;
        option.textContent = album.title || album.id;
        if (photo.album === album.id) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", function () {
        photo.album = select.value;
        renderAlbums();
      });
      body.appendChild(select);

      if (photo.src.indexOf("data:") === 0) {
        body.appendChild(makeHint("已内嵌，约 " + Math.round(photo.src.length / 1024) + " KB"));
      } else {
        body.appendChild(makeInput(photo.src, "assets/photos/文件名.jpg", function (value) {
          photo.src = value.trim();
        }, "mono"));
      }

      var tools = document.createElement("div");
      tools.className = "row__tools";
      tools.appendChild(makeButton("↑", function () { movePhoto(index, -1); }, "btn--icon"));
      tools.appendChild(makeButton("↓", function () { movePhoto(index, 1); }, "btn--icon"));
      tools.appendChild(makeButton("删除", function () {
        state.photos.splice(index, 1);
        renderPhotos();
        renderAlbums();
      }, "btn--danger"));

      row.appendChild(thumb);
      row.appendChild(body);
      row.appendChild(tools);
      box.appendChild(row);
    });

    updateSize();
  }

  function movePhoto(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= state.photos.length) return;
    var tmp = state.photos[index];
    state.photos[index] = state.photos[target];
    state.photos[target] = tmp;
    renderPhotos();
  }

  /* ---------- 时间轴行 ---------- */

  function renderTimeline() {
    var box = qs("#timeline-rows");
    if (!box) return;

    box.innerHTML = "";

    if (!state.timeline.length) {
      box.appendChild(makeHint("还没有条目。点右上角「加一条」。"));
      return;
    }

    state.timeline.forEach(function (item, index) {
      var row = document.createElement("div");
      row.className = "row row--stack";

      var head = document.createElement("div");
      head.className = "row__head";

      head.appendChild(makeInput(item.date, "2023.05.20", function (value) {
        item.date = value;
      }, "mono"));

      head.appendChild(makeInput(item.title, "标题，例如「第一次一起出远门」", function (value) {
        item.title = value;
      }));

      head.appendChild(makeButton("删除", function () {
        state.timeline.splice(index, 1);
        renderTimeline();
      }, "btn--danger"));

      var text = document.createElement("textarea");
      text.rows = 3;
      text.placeholder = "那天具体发生了什么";
      text.value = item.text || "";
      text.addEventListener("input", function () { item.text = text.value; });

      row.appendChild(head);
      row.appendChild(text);
      box.appendChild(row);
    });
  }

  /* ---------- 体积提示 ---------- */

  function updateSize() {
    var node = qs("#size");
    if (!node) return;

    if (!state.photos.length) {
      node.textContent = "";
      return;
    }

    var bytes = 0;
    state.photos.forEach(function (photo) { bytes += (photo.src || "").length; });
    var kb = Math.round(bytes / 1024);
    node.textContent = "照片约 " + (kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB");
  }

  /* ---------- 图片压缩并内嵌 ---------- */

  function compressImage(file, done) {
    var url = URL.createObjectURL(file);
    var img = new Image();

    img.onload = function () {
      var max = 1400;
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      var scale = Math.min(1, max / Math.max(w, h));

      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));

      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      var dataUrl = "";
      try {
        dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      } catch (err) {
        dataUrl = "";
      }

      URL.revokeObjectURL(url);
      done(dataUrl || null);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      done(null);
    };

    img.src = url;
  }

  function defaultAlbumId() {
    return state.albums.length ? state.albums[0].id : "album1";
  }

  function addPhotos(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;

    var index = 0;

    function next() {
      if (index >= list.length) {
        renderPhotos();
        renderAlbums();
        setStatus("已加入 " + list.length + " 张照片，记得导出 photos-data.js");
        return;
      }

      var file = list[index];
      index += 1;
      setStatus("正在处理 " + index + "/" + list.length + "：" + file.name);

      compressImage(file, function (dataUrl) {
        if (dataUrl) {
          state.photos.push({ src: dataUrl, caption: "", album: defaultAlbumId() });
        } else {
          setStatus("跳过（读不了，可能是 HEIC）：" + file.name);
        }
        next();
      });
    }

    next();
  }

  /* ---------- 生成文件内容 ---------- */

  function jsString(value) {
    return JSON.stringify(String(value === null || value === undefined ? "" : value));
  }

  function paragraphsOf(text) {
    return String(text || "")
      .split(/\r?\n\s*\r?\n/)
      .map(function (part) { return part.trim(); })
      .filter(function (part) { return part.length > 0; });
  }

  function buildConfigText() {
    var lines = [];
    lines.push("/* 由 edit.html 生成。也可以手改，只改引号里的字。 */");
    lines.push("");
    lines.push("window.SITE_CONFIG = {");
    lines.push("  title: " + jsString(state.title) + ",");
    lines.push("  subtitle: " + jsString(state.subtitle) + ",");
    lines.push("  names: { me: " + jsString(state.me) + ", you: " + jsString(state.you) + " },");
    lines.push("  startDate: " + jsString(state.startDate) + ",");
    lines.push("");
    lines.push("  albums: [");

    state.albums.forEach(function (album) {
      lines.push("    { id: " + jsString(album.id) +
        ", icon: " + jsString(album.icon) +
        ", title: " + jsString(album.title) +
        ", desc: " + jsString(album.desc) + " },");
    });

    lines.push("  ],");
    lines.push("");
    lines.push("  pets: { cat: " + jsString(state.cat) + ", dog: " + jsString(state.dog) + " },");
    lines.push("");
    lines.push("  /* 照片在 js/photos-data.js */");
    lines.push("  photos: [],");
    lines.push("");
    lines.push("  timeline: [");

    state.timeline.forEach(function (item) {
      if (!item.date && !item.title && !item.text) return;
      lines.push("    { date: " + jsString(item.date) +
        ", title: " + jsString(item.title) +
        ", text: " + jsString(item.text) + " },");
    });

    lines.push("  ],");
    lines.push("");
    lines.push("  letter: [");

    paragraphsOf(state.letter).forEach(function (paragraph) {
      lines.push("    " + jsString(paragraph) + ",");
    });

    lines.push("  ],");
    lines.push("");
    lines.push("  sign: " + jsString(state.sign) + ",");
    lines.push("  music: { src: " + jsString(state.musicSrc) + ", title: " + jsString(state.musicTitle) + " },");
    lines.push("  footer: " + jsString(state.footer));
    lines.push("};");
    lines.push("");

    return lines.join("\n");
  }

  function buildPhotosText() {
    var lines = [];
    lines.push("/* 由 edit.html 生成。图片以 data URL 内嵌，不需要额外的图片文件。 */");
    lines.push("");
    lines.push("window.SITE_ALBUM_PHOTOS = {");

    if (!state.albums.length) {
      lines.push("};");
    } else {
      state.albums.forEach(function (album) {
        var list = photosInAlbum(album.id);
        if (!list.length) {
          lines.push("  " + jsString(album.id) + ": [],");
          return;
        }
        lines.push("  " + jsString(album.id) + ": [");
        list.forEach(function (photo) {
          lines.push("    { src: " + jsString(photo.src) + ", caption: " + jsString(photo.caption) + " },");
        });
        lines.push("  ],");
      });
      lines.push("};");
    }

    lines.push("");
    lines.push("window.SITE_PHOTOS = [];");
    lines.push("");

    return lines.join("\n");
  }

  function openCodePanel(name, text) {
    var panel = qs("#codepanel");
    if (!panel) return;
    var title = qs("#codepanel-title");
    var area = qs("#codepanel-text");
    if (title) title.textContent = name;
    if (area) {
      area.textContent = text;
      area.scrollTop = 0;
    }
    panel.hidden = false;
  }

  /* ---------- 保存 ---------- */

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();

    window.setTimeout(function () {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);

    setStatus("已下载 " + name + "（" + Math.round(blob.size / 1024) + " KB），请移到 js/ 目录");
  }

  function saveFile(name, text) {
    var blob = new Blob([text], { type: "text/javascript;charset=utf-8" });

    if (!window.showSaveFilePicker) {
      downloadBlob(blob, name);
      return;
    }

    var picker;
    try {
      picker = window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }]
      });
    } catch (err) {
      downloadBlob(blob, name);
      return;
    }

    picker
      .then(function (handle) { return handle.createWritable(); })
      .then(function (writable) {
        return writable.write(blob).then(function () { return writable.close(); });
      })
      .then(function () {
        setStatus("已保存 " + name + "（" + Math.round(blob.size / 1024) + " KB）");
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          setStatus("已取消");
          return;
        }
        downloadBlob(blob, name);
      });
  }

  /* ---------- 绑定静态字段 ---------- */

  function bindField(id, key) {
    var node = qs("#" + id);
    if (!node) return;

    node.value = state[key] || "";

    function sync() {
      state[key] = node.value;
      updateSize();
    }

    node.addEventListener("input", sync);
    node.addEventListener("change", sync);
  }

  /* ---------- 启动 ---------- */

  function boot() {
    bindField("f-title", "title");
    bindField("f-subtitle", "subtitle");
    bindField("f-me", "me");
    bindField("f-you", "you");
    bindField("f-date", "startDate");
    bindField("f-sign", "sign");
    bindField("f-footer", "footer");
    bindField("f-cat", "cat");
    bindField("f-dog", "dog");
    bindField("f-music-src", "musicSrc");
    bindField("f-music-title", "musicTitle");
    bindField("f-letter", "letter");

    var photoInput = qs("#photo-input");
    if (photoInput) {
      photoInput.addEventListener("change", function () {
        addPhotos(photoInput.files);
        photoInput.value = "";
      });
    }

    var addPath = qs("#photo-add-path");
    if (addPath) {
      addPath.addEventListener("click", function () {
        state.photos.push({ src: "assets/photos/", caption: "", album: defaultAlbumId() });
        renderPhotos();
      });
    }

    var albumAdd = qs("#album-add");
    if (albumAdd) albumAdd.addEventListener("click", addAlbum);

    var addTimeline = qs("#timeline-add");
    if (addTimeline) {
      addTimeline.addEventListener("click", function () {
        state.timeline.push({ date: "", title: "", text: "" });
        renderTimeline();
      });
    }

    var exportConfig = qs("#export-config");
    if (exportConfig) {
      exportConfig.addEventListener("click", function () {
        openCodePanel("config.js", buildConfigText());
      });
    }

    var exportPhotos = qs("#export-photos");
    if (exportPhotos) {
      exportPhotos.addEventListener("click", function () {
        openCodePanel("photos-data.js", buildPhotosText());
      });
    }

    var panelClose = qs("#codepanel-close");
    if (panelClose) {
      panelClose.addEventListener("click", function () {
        var panel = qs("#codepanel");
        if (panel) panel.hidden = true;
      });
    }

    var panelCopy = qs("#codepanel-copy");
    if (panelCopy) {
      panelCopy.addEventListener("click", function () {
        var area = qs("#codepanel-text");
        if (!area) return;

        var text = area.textContent || "";

        // ① 先把内容选中（这样即使自动复制失败，用户也能直接 Ctrl+C）
        var ok = false;
        try {
          var range = document.createRange();
          range.selectNodeContents(area);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          ok = document.execCommand("copy");
        } catch (err) {
          ok = false;
        }

        if (ok) {
          setStatus("已复制到剪贴板，去粘贴吧");
          return;
        }

        // ② 退而求其次：剪贴板 API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            setStatus("已复制到剪贴板，去粘贴吧");
          }, function () {
            setStatus("已全选，请按 Ctrl+C 复制");
          });
          return;
        }

        setStatus("已全选，请按 Ctrl+C 复制");
      });
    }

    renderAlbums();
    renderPhotos();
    renderTimeline();
    updateSize();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
