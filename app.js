
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.FIREBASE_CONFIG;
  const ADMIN_UID = "PLbmf0H2PYcPhX52spP8VpLRES53";

  const CATEGORIES = {
    talkshow: "🎤 تاک شو",
    comedy: "😂 کمدی",
    romance: "❤️ عاشقانه",
    action: "💥 اکشن",
    musical: "🎵 موزیکال",
    foreign: "🌍 خارجی",
    cartoon: "🐣 کارتون",
    mystery: "🕵️ معمایی"
  };

  let auth, db;
  let items = [];
  let filter = "all";
  let categoryFilter = "all";
  let currentUser = null;
  let editingId = null;

  const modal = $("modal");
  const adminButton = $("adminOpen");
  const adminMode =
    new URLSearchParams(location.search).get("admin") === "1";

  function isAdmin(user) {
    return !!user && user.uid === ADMIN_UID;
  }

  const uploadPanel = $("uploadPanel");
  const editSection = document.createElement("section");
  editSection.id = "editSection";
  editSection.style.marginTop = "25px";
  editSection.style.borderTop = "1px solid #79588e";
  editSection.style.paddingTop = "20px";

  editSection.innerHTML = `
    <h3 style="color:#ffd56a">✏️ مدیریت و ویرایش آثار</h3>
    <p>برای ویرایش، روی یکی از آثار زیر بزن.</p>
    <div id="adminMovieList"></div>
  `;

  uploadPanel.append(editSection);

  const editForm = document.createElement("form");
  editForm.id = "editMovieForm";
  editForm.hidden = true;

  editForm.innerHTML = `
    <h3 style="color:#ffd56a">✏️ ویرایش اثر</h3>

    <input id="editTitle"
      placeholder="نام فیلم یا سریال"
      maxlength="90" required>

    <select id="editKind">
      <option value="movie">فیلم</option>
      <option value="series">سریال</option>
    </select>

    <select id="editCategory" required>
      <option value="">انتخاب دسته‌بندی</option>
      <option value="talkshow">🎤 تاک شو</option>
      <option value="comedy">😂 کمدی</option>
      <option value="romance">❤️ عاشقانه</option>
      <option value="action">💥 اکشن</option>
      <option value="musical">🎵 موزیکال</option>
      <option value="foreign">🌍 خارجی</option>
      <option value="cartoon">🐣 کارتون</option>
      <option value="mystery">🕵️ معمایی</option>
    </select>

    <input id="editYear" type="number" placeholder="سال">

    <textarea id="editDescription"
      placeholder="توضیحات کوتاه"></textarea>

    <input id="editPoster"
      type="url" placeholder="لینک پوستر">

    <input id="editVideo"
      type="url" placeholder="لینک ویدیو" required>

    <button class="yellow" type="submit">
      💾 ذخیره تغییرات
    </button>

    <button id="cancelEdit" type="button">
      انصراف
    </button>

    <p id="editStatus"></p>
  `;

  editSection.append(editForm);

  function updateAdminUI() {
    const allowed = isAdmin(currentUser);

    adminButton.hidden = !adminMode;
    $("login").hidden = !adminMode || allowed;
    uploadPanel.hidden = !adminMode || !allowed;

    $("who").textContent = allowed
      ? (currentUser.email || "مدیر")
      : "";

    if (!allowed) {
      editingId = null;
      editForm.hidden = true;
    }

    if (!adminMode) {
      modal.classList.remove("open");
    }

    renderAdminList();
  }

  adminButton.onclick = () => {
    if (adminMode) modal.classList.add("open");
  };

  $("close").onclick = () => modal.classList.remove("open");

  modal.onclick = e => {
    if (e.target === modal) modal.classList.remove("open");
  };

  function updateFilterButtons() {
    document.querySelectorAll(".filter").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === filter
      );
    });
  }

  document.querySelectorAll(".filter").forEach(button => {
    button.onclick = () => {
      filter = button.dataset.filter;
      categoryFilter = "all";
      updateFilterButtons();
      render();
    };
  });

  document.addEventListener("zh-category-filter", event => {
    const selected = event.detail?.category || "all";

    if (selected !== "all" && !CATEGORIES[selected]) return;

    categoryFilter = selected;
    filter = "all";
    updateFilterButtons();
    render();
  });

  const faDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arDigits = "٠١٢٣٤٥٦٧٨٩";

  const words = {
    اول: 1, دوم: 2, سوم: 3, چهارم: 4,
    پنجم: 5, ششم: 6, هفتم: 7,
    هشتم: 8, نهم: 9, دهم: 10
  };

  function episodeNumber(title) {
    const t = title.replace(/[۰-۹٠-٩]/g, c => {
      let n = faDigits.indexOf(c);
      if (n < 0) n = arDigits.indexOf(c);
      return String(n);
    });

    const m = t.match(
      /(?:قسمت|اپیزود)\s*(\d+|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم)/i
    );

    if (!m) {
      const n = t.match(/(\d+)$/);
      return n ? Number(n[1]) : 1;
    }

    return Number(m[1]) || words[m[1]] || null;
  }

  function seriesName(title) {
    return title
      .replace(
        /(?:قسمت|اپیزود)\s*(?:[0-9۰-۹٠-٩]+|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم)/gi,
        ""
      )
      .replace(/[0-9۰-۹٠-٩]+$/, "")
      .replace(/[-–—:|()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function makeVideo(url) {
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.style.width = "100%";
    video.style.borderRadius = "12px";
    video.style.marginTop = "10px";
    return video;
  }

  function playFullscreen(video) {
    if (!video) return;

    try {
      const playing = video.play();

      if (playing && typeof playing.catch === "function") {
        playing.catch(() => {});
      }
    } catch (error) {
      // Video controls remain available.
    }

    try {
      if (typeof video.requestFullscreen === "function") {
        const fullscreen = video.requestFullscreen();

        if (
          fullscreen &&
          typeof fullscreen.catch === "function"
        ) {
          fullscreen.catch(() => {});
        }
      } else if (
        typeof video.webkitEnterFullscreen === "function"
      ) {
        video.webkitEnterFullscreen();
      }
    } catch (error) {
      // Fall back to inline playback.
    }
  }

  // ========================================
  // 🔥 تازه‌های ژ موویز
  // ========================================

  const latestSection = document.createElement("section");
  latestSection.id = "zhLatest";

  latestSection.style.cssText = `
    margin: 22px 5%;
    padding: 20px;
    background: linear-gradient(135deg, #241034, #37164d);
    border: 1px solid rgba(255, 211, 79, 0.35);
    border-radius: 22px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
    color: white;
    direction: rtl;
  `;

  const latestHeading = document.createElement("div");

  latestHeading.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  `;

  const latestTitle = document.createElement("h2");
  latestTitle.textContent = "🔥 تازه‌های ژ موویز";

  latestTitle.style.cssText = `
    margin: 0;
    color: #ffd56a;
    font-size: 21px;
    font-weight: bold;
  `;

  const latestSubtitle = document.createElement("span");
  latestSubtitle.textContent = "جدیدترین فیلم‌ها و سریال‌ها";

  latestSubtitle.style.cssText = `
    color: #d8c4e5;
    font-size: 12px;
  `;

  latestHeading.append(latestTitle, latestSubtitle);

  const latestGrid = document.createElement("div");
  latestGrid.id = "zhLatestGrid";

  latestGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, 145px), 1fr)
    );
    gap: 13px;
  `;

  latestSection.append(latestHeading, latestGrid);

  const librarySection =
    document.getElementById("library");

  if (librarySection && librarySection.parentNode) {
    librarySection.parentNode.insertBefore(
      latestSection,
      librarySection
    );
  } else {
    const hero = document.querySelector(".hero");

    if (hero) {
      hero.insertAdjacentElement(
        "afterend",
        latestSection
      );
    } else {
      latestSection.hidden = true;
    }
  }

  function getCreatedTime(item) {
    if (!item.createdAt) return 0;

    if (typeof item.createdAt.toMillis === "function") {
      return item.createdAt.toMillis();
    }

    if (typeof item.createdAt.seconds === "number") {
      return item.createdAt.seconds * 1000;
    }

    return 0;
  }

  function renderLatest() {
    latestGrid.replaceChildren();

    if (!items.length) {
      latestSection.hidden = true;
      return;
    }

    const sorted = [...items].sort((a, b) => {
      return getCreatedTime(b) - getCreatedTime(a);
    });

    const unique = new Map();

    sorted.forEach(item => {
      const name = item.kind === "series"
        ? seriesName(item.title)
        : item.title;

      const key = item.kind + "|" + name;

      if (!unique.has(key)) {
        unique.set(key, {
          ...item,
          displayName: name
        });
      }
    });

    const latestItems = [...unique.values()].slice(0, 6);

    if (!latestItems.length) {
      latestSection.hidden = true;
      return;
    }

    latestSection.hidden = false;

    latestItems.forEach(item => {
      const card = document.createElement("article");

      card.style.cssText = `
        background: #1d102b;
        border: 1px solid #68417c;
        border-radius: 15px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-width: 0;
      `;

      const posterBox = document.createElement("div");

      posterBox.style.cssText = `
        width: 100%;
        aspect-ratio: 16 / 9
        background: linear-gradient(
          145deg,
          #482066,
          #170b24
        );
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        color: #ffd56a;
        font-size: 35px;
      `;

      if (item.poster) {
        const img = document.createElement("img");
        img.src = item.poster;
        img.alt = item.displayName;
        img.loading = "lazy";

        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: contain;
        `;

        img.onerror = () => {
          posterBox.replaceChildren();
          posterBox.textContent = "🎬";
        };

        posterBox.append(img);
      } else {
        posterBox.textContent = "🎬";
      }

      const content = document.createElement("div");

      content.style.cssText = `
        padding: 11px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
      `;

      const title = document.createElement("h3");
      title.textContent = item.displayName;

      title.style.cssText = `
        color: white;
        font-size: 14px;
        line-height: 1.6;
        margin: 0;
        overflow-wrap: anywhere;
      `;

      const type = document.createElement("p");

      type.textContent = item.kind === "series"
        ? "📺 سریال"
        : "🎬 فیلم";

      type.style.cssText = `
        color: #d6bddf;
        font-size: 12px;
        margin: 0;
      `;

      const category = document.createElement("p");

      category.textContent =
        CATEGORIES[item.category] || "ژ موویز";

      category.style.cssText = `
        color: #ffd56a;
        font-size: 11px;
        margin: 0;
      `;

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "▶ تماشا";

      button.style.cssText = `
        margin-top: auto;
        padding: 9px 6px;
        background: #ffd34f;
        color: #241034;
        border: none;
        border-radius: 9px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
      `;

      button.onclick = () => {
        filter = "all";
        categoryFilter = "all";
        updateFilterButtons();
        render();

        const grid = $("grid");

        if (!grid) return;

        const cards = [...grid.querySelectorAll(".card")];

        const matchingCard = cards.find(card => {
          const heading = card.querySelector(".info h3");
          return heading &&
            heading.textContent === item.displayName;
        });

        if (matchingCard) {
          matchingCard.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

          matchingCard.style.outline =
            "2px solid #ffd34f";

          setTimeout(() => {
            matchingCard.style.outline = "";
          }, 2500);
        } else {
          grid.scrollIntoView({
            behavior: "smooth"
          });
        }
      };

      content.append(
        title,
        type,
        category,
        button
      );

      card.append(posterBox, content);
      latestGrid.append(card);
    });
  }

  // ========================================
  // 🎬 آرشیو و دسته‌بندی‌ها
  // ========================================

  function render() {
    const grid = categoryFilter === "all"
      ? $("grid")
      : $("categoryGrid");

    if (!grid) return;

    grid.replaceChildren();

    const list = items.filter(x => {
      const kindMatches =
        filter === "all" || x.kind === filter;

      const categoryMatches =
        categoryFilter === "all" ||
        x.category === categoryFilter;

      return kindMatches && categoryMatches;
    });

    const groups = new Map();

    list.forEach(x => {
      const name = x.kind === "series"
        ? seriesName(x.title)
        : x.title;

      const key = x.kind + "|" + name;

      if (!groups.has(key)) {
        groups.set(key, {
          name,
          kind: x.kind,
          episodes: []
        });
      }

      groups.get(key).episodes.push(x);
    });

    if (!groups.size) {
      grid.textContent = categoryFilter !== "all"
        ? "هنوز اثری در دسته «" +
          CATEGORIES[categoryFilter] +
          "» ثبت نشده است."
        : "هنوز محتوایی ثبت نشده است.";

      const categoryEmpty = $("categoryEmpty");

      if (categoryEmpty && categoryFilter !== "all") {
        categoryEmpty.hidden = true;
      }

      return;
    }

    const categoryEmpty = $("categoryEmpty");

    if (categoryEmpty && categoryFilter !== "all") {
      categoryEmpty.hidden = true;
    }

    groups.forEach(group => {
      const entries = group.episodes.sort((a, b) =>
        (episodeNumber(a.title) || 999) -
        (episodeNumber(b.title) || 999)
      );

      const card = document.createElement("article");
      card.className = "card";

      const thumb = document.createElement("div");
      thumb.className = "thumb";

      const poster = entries.find(x => x.poster)?.poster;

      if (poster) {
        const img = document.createElement("img");
        img.src = poster;
        img.alt = group.name;
        img.loading = "lazy";

        img.onerror = () => {
          thumb.replaceChildren();
          thumb.textContent = "✦";
        };

        thumb.append(img);
      } else {
        thumb.textContent = "✦";
      }

      const info = document.createElement("div");
      info.className = "info";

      const title = document.createElement("h3");
      title.textContent = group.name;

      const details = document.createElement("p");
      details.textContent = group.kind === "series"
        ? "📺 سریال • " + entries.length + " قسمت"
        : "🎬 فیلم";

      info.append(title, details);

      const categories = [
        ...new Set(
          entries.map(x => x.category)
            .filter(x => CATEGORIES[x])
        )
      ];

      if (categories.length) {
        const categoryText = document.createElement("p");

        categoryText.textContent = categories
          .map(x => CATEGORIES[x])
          .join(" • ");

        categoryText.style.color = "#ffd56a";
        categoryText.style.fontSize = "12px";

        info.append(categoryText);
      }

      const descText =
        entries.find(x => x.description)?.description;

      if (descText) {
        const desc = document.createElement("p");
        desc.textContent = descText;
        info.append(desc);
      }

      const playerArea = document.createElement("div");

      if (group.kind === "series") {
        const heading = document.createElement("p");
        heading.textContent =
          "قسمت موردنظر را انتخاب کنید:";

        info.append(heading);

        const buttons = document.createElement("div");
        buttons.style.display = "flex";
        buttons.style.flexWrap = "wrap";
        buttons.style.gap = "8px";

        entries.forEach((x, i) => {
          if (!x.url) return;

          const btn = document.createElement("button");
          const num = episodeNumber(x.title);

          btn.textContent = "▶ قسمت " + (num || i + 1);
          btn.className = "yellow";
          btn.style.padding = "9px 12px";

          btn.onclick = () => {
            const video = makeVideo(x.url);

            playerArea.replaceChildren(video);

            playFullscreen(video);
          };

          buttons.append(btn);
        });

        info.append(buttons, playerArea);
      } else {
        const x = entries[0];

        if (x.url) {
          info.append(makeVideo(x.url));
        }
      }

      card.append(thumb, info);
      grid.append(card);
    });
  }

  // ========================================
  // ✏️ مدیریت آثار
  // ========================================

  function renderAdminList() {
    const container = $("adminMovieList");
    if (!container) return;

    container.replaceChildren();

    if (!adminMode || !isAdmin(currentUser)) return;

    if (!items.length) {
      container.textContent = "هنوز اثری ثبت نشده است.";
      return;
    }

    items.forEach(item => {
      const row = document.createElement("div");

      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.padding = "12px";
      row.style.marginBottom = "10px";
      row.style.background = "#302040";
      row.style.borderRadius = "12px";

      const name = document.createElement("span");
      name.textContent = item.title;
      name.style.flex = "1";
      name.style.minWidth = "0";
      name.style.overflowWrap = "anywhere";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "✏️ ویرایش";
      button.className = "yellow";
      button.style.padding = "8px 10px";

      button.onclick = () => openEditor(item.id);

const deleteButton = document.createElement("button");
deleteButton.type = "button";
deleteButton.textContent = "🗑️ حذف";
deleteButton.style.background = "#b42335";
deleteButton.style.color = "#fff";
deleteButton.style.padding = "8px 10px";
deleteButton.style.borderRadius = "8px";

deleteButton.onclick = async () => {
  if (!adminMode || !isAdmin(auth.currentUser)) {
    alert("اجازه حذف ندارید.");
    return;
  }

  if (!confirm(`آیا از حذف «${item.title}» مطمئنی؟`)) {
    return;
  }

  try {
    deleteButton.disabled = true;
    await db.collection("movies").doc(item.id).delete();
    alert("فیلم با موفقیت حذف شد.");
  } catch (error) {
    deleteButton.disabled = false;
    alert("حذف انجام نشد: " + error.message);
  }
};

row.append(name, button, deleteButton);      container.append(row);
    });
  }

  function openEditor(id) {
    if (!adminMode || !isAdmin(currentUser)) return;

    const item = items.find(x => x.id === id);
    if (!item) return;

    editingId = id;

    $("editTitle").value = item.title;
    $("editKind").value = item.kind;
    $("editCategory").value = item.category || "";
    $("editYear").value = item.year;
    $("editDescription").value = item.description;
    $("editPoster").value = item.poster;
    $("editVideo").value = item.url;

    $("editStatus").textContent = "";
    editForm.hidden = false;

    editForm.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  $("cancelEdit").onclick = () => {
    editingId = null;
    editForm.hidden = true;
    $("editStatus").textContent = "";
  };

  editForm.onsubmit = async e => {
    e.preventDefault();

    if (
      !adminMode ||
      !isAdmin(auth.currentUser) ||
      !editingId
    ) {
      $("editStatus").textContent =
        "اجازه ویرایش ندارید.";
      return;
    }

    const title = $("editTitle").value.trim();
    const kind = $("editKind").value;
    const category = $("editCategory").value;
    const year = $("editYear").value.trim();
    const description = $("editDescription").value.trim();
    const posterUrl = $("editPoster").value.trim();
    const videoUrl = $("editVideo").value.trim();

    if (!CATEGORIES[category]) {
      $("editStatus").textContent =
        "لطفاً دسته‌بندی را انتخاب کنید.";
      return;
    }

    if (
      !title ||
      !/^https:\/\//i.test(videoUrl) ||
      (posterUrl && !/^https:\/\//i.test(posterUrl))
    ) {
      $("editStatus").textContent =
        "نام اثر و لینک‌های معتبر https:// لازم است.";
      return;
    }

    const button = editForm.querySelector(
      'button[type="submit"]'
    );

    button.disabled = true;
    $("editStatus").textContent =
      "در حال ذخیره تغییرات…";

    try {
      await db.collection("movies").doc(editingId).update({
        title,
        type: kind,
        kind,
        category,
        year,
        description,
        posterUrl,
        videoUrl
      });

      $("editStatus").textContent =
        "✅ تغییرات با موفقیت ذخیره شد.";

      editingId = null;
      editForm.hidden = true;
    } catch (error) {
      $("editStatus").textContent =
        "ویرایش انجام نشد: " + error.message;
    } finally {
      button.disabled = false;
    }
  };

  // ========================================
  // 🔥 اتصال Firebase
  // ========================================

  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    $("notice").textContent =
      "تنظیمات Firebase تکمیل نشده است.";
    return;
  }

  try {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (e) {
    $("notice").textContent =
      "اتصال به Firebase برقرار نشد.";
    return;
  }

  db.collection("movies").onSnapshot(
    snapshot => {
      items = snapshot.docs.map(doc => {
        const x = doc.data();

        return {
          id: doc.id,
          title: x.title || "بدون عنوان",
          kind: x.kind === "series" || x.type === "series"
            ? "series" : "movie",
          category: CATEGORIES[x.category]
            ? x.category : "",
          year: x.year || "",
          poster: x.posterUrl || x.poster || "",
          url: x.videoUrl || x.url || "",
          description: x.description || "",
          createdAt: x.createdAt || null
        };
      });

      $("notice").textContent =
        items.length + " مورد در آرشیو";

      render();
      renderLatest();
      renderAdminList();
    },
    () => {
      $("notice").textContent =
        "آرشیو قابل خواندن نیست؛ قوانین Firestore را بررسی کنید.";
    }
  );

  auth.onAuthStateChanged(user => {
    currentUser = user;
    updateAdminUI();
  });

  $("login").onsubmit = async e => {
    e.preventDefault();

    if (!adminMode) return;

    try {
      const result =
        await auth.signInWithEmailAndPassword(
          $("email").value,
          $("password").value
        );

      if (!isAdmin(result.user)) {
        await auth.signOut();
        alert("این حساب اجازه مدیریت ندارد.");
        return;
      }

      $("password").value = "";
    } catch (error) {
      alert("ورود ناموفق: " + error.message);
    }
  };

  $("logout").onclick = async () => {
    await auth.signOut();
  };

  $("upload").onsubmit = async e => {
    e.preventDefault();

    const user = auth.currentUser;
    const status = $("status");

    if (!adminMode || !isAdmin(user)) {
      status.textContent =
        "شما اجازه مدیریت ندارید.";
      return;
    }

    const title = $("title").value.trim();
    const videoUrl = $("video").value.trim();
    const posterUrl = $("poster").value.trim();
    const category = $("category")?.value || "";

    if (!CATEGORIES[category]) {
      status.textContent =
        "لطفاً دسته‌بندی اثر را انتخاب کنید.";
      return;
    }

    if (
      !title ||
      !/^https:\/\//i.test(videoUrl) ||
      (posterUrl && !/^https:\/\//i.test(posterUrl))
    ) {
      status.textContent =
        "نام اثر و لینک‌های معتبر https:// لازم است.";
      return;
    }

    const button = $("upload").querySelector(
      'button[type="submit"]'
    );

    button.disabled = true;
    status.textContent = "در حال ذخیره…";

    try {
      await db.collection("movies").add({
        title,
        type: $("kind").value,
        kind: $("kind").value,
        category,
        year: $("year").value.trim(),
        description: $("description").value.trim(),
        posterUrl,
        videoUrl,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: user.uid
      });

      status.textContent =
        "با موفقیت منتشر شد.";

      $("upload").reset();
    } catch (error) {
      status.textContent =
        "ذخیره نشد: " + error.message;
    } finally {
      button.disabled = false;
    }
  };

  updateAdminUI();
})();
