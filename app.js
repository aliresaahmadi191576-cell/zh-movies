
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

  // ⭐ Zh Movies Rating System
  let movieRatings = {};
  let movieRatingCounts = {};

  function getMovieRating(movieId) {
    return movieRatings[movieId] || 0;
  }

  let searchQuery = "";
  const FAVORITES_KEY = "zh_movies_favorites";
  let favorites = [];

  try {
    const saved = JSON.parse(
      localStorage.getItem(FAVORITES_KEY) || "[]"
    );
    favorites = Array.isArray(saved) ? saved : [];
  } catch (error) {
    favorites = [];
  }

  function isFavorite(id) {
    return favorites.includes(id);
  }

  function toggleFavorite(id) {
    if (isFavorite(id)) {
      favorites = favorites.filter(x => x !== id);
    } else {
      favorites.push(id);
    }

    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(favorites)
    );

    render();
    renderFavorites();
  }

  const searchInput = document.getElementById("zhSearchInput");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value
        .trim()
        .toLocaleLowerCase("fa")
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک");

      render();
    });
  }

  async function ensureRatingUser() {
    if (auth.currentUser) {
      return auth.currentUser;
    }

    const result = await auth.signInAnonymously();
    return result.user;
  }

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
    اول: 1,
    دوم: 2,
    سوم: 3,
    چهارم: 4,
    پنجم: 5,
    ششم: 6,
    هفتم: 7,
    هشتم: 8,
    نهم: 9,
    دهم: 10
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

    return Number(m[1]) || words[m[1]] || 1;
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

  // 🎬 ZH MOVIES — Cinema Player
  function startVideo(url, area) {
    if (!url) return;

    const previous = document.getElementById("zhVideoOverlay");
    if (previous && typeof previous.zhClose === "function") previous.zhClose();

    const overlay = document.createElement("div");
    overlay.id = "zhVideoOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "پخش‌کننده ژ موویز");
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:999999;
      background:rgba(0,0,0,.97);display:flex;
      align-items:center;justify-content:center;
      padding:65px 12px 25px;box-sizing:border-box;
      direction:rtl;
    `;

    const video = makeVideo(url);
    video.style.cssText = `
      display:block;width:100%;max-width:1100px;
      max-height:80dvh;height:auto;aspect-ratio:16/9;
      object-fit:contain;background:#000;border-radius:14px;
      box-shadow:0 0 45px rgba(142,65,190,.3);
    `;

    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
      position:absolute;top:max(12px,env(safe-area-inset-top));
      left:12px;right:12px;display:flex;
      justify-content:space-between;align-items:center;
      gap:12px;z-index:10;
    `;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "✕ بستن";
    const fullscreenButton = document.createElement("button");
    fullscreenButton.type = "button";
    fullscreenButton.textContent = "⛶ تمام‌صفحه";

    [closeButton, fullscreenButton].forEach(button => {
      button.style.cssText = `
        background:rgba(55,28,75,.85);color:#ffd56a;
        border:1px solid rgba(255,213,106,.45);
        border-radius:12px;padding:10px 15px;
        font-size:13px;font-weight:bold;cursor:pointer;
        backdrop-filter:blur(12px);
      `;
    });

    toolbar.append(closeButton, fullscreenButton);
    overlay.append(toolbar, video);
    document.body.append(overlay);

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let closed = false;

    function closePlayer() {
      if (closed) return;
      closed = true;
      video.pause();
      if (document.fullscreenElement === video && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      video.removeAttribute("src");
      video.load();
      overlay.remove();
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeydown);
    }

    function onKeydown(event) {
      if (event.key === "Escape") closePlayer();
    }

    closeButton.onclick = closePlayer;
    fullscreenButton.onclick = () => {
      if (document.fullscreenElement === video) {
        document.exitFullscreen().catch(() => {});
      } else if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => {});
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    };

    document.addEventListener("keydown", onKeydown);
    overlay.zhClose = closePlayer;
    const playback = video.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {});
    }
  }

  // 🎬 ZH MOVIES — Movie Details
  function openMovieDetails(item) {
    if (!item) return;

    document.getElementById("zhMovieDetails")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "zhMovieDetails";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99990;
      overflow-y:auto;background:#10091b;
      color:white;direction:rtl;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      max-width:1050px;margin:auto;padding:22px;
    `;

    const close = document.createElement("button");
    close.textContent = "✕ بازگشت به ژ موویز";
    close.style.cssText = `
      background:#39224f;color:#ffd56a;
      border:1px solid #ffd56a66;
      border-radius:12px;padding:12px;
      margin-bottom:20px;cursor:pointer;
    `;
    close.onclick = () => overlay.remove();

    const hero = document.createElement("div");
    hero.style.cssText = `
      display:flex;flex-wrap:wrap;gap:25px;
      align-items:center;padding:24px;
      border-radius:24px;
      background:linear-gradient(135deg,#3b2054,#160d23);
      border:1px solid #ffd56a55;
    `;

    const poster = document.createElement("img");
    poster.src = item.poster || "";
    poster.alt = item.title;
    poster.style.cssText = `
      width:220px;max-width:100%;
      border-radius:16px;object-fit:cover;
    `;
    poster.onerror = () => poster.remove();

    const info = document.createElement("div");
    info.style.cssText = "flex:1;min-width:220px;";

    const title = document.createElement("h1");
    title.textContent = item.kind === "series"
      ? seriesName(item.title) : item.title;
    title.style.color = "#ffd56a";

    const rating = document.createElement("p");
    const count = movieRatingCounts[item.id] || 0;
    rating.textContent = count
      ? "⭐ " + getMovieRating(item.id).toFixed(1) +
        " از ۵ • " + count + " رأی"
      : "⭐ هنوز امتیازی ثبت نشده";

    const category = document.createElement("p");
    category.textContent =
      (item.kind === "series" ? "📺 سریال" : "🎬 فیلم") +
      " • " + (CATEGORIES[item.category] || "ژ موویز") +
      (item.year ? " • " + item.year : "");

    const description = document.createElement("p");
    description.textContent =
      item.description || "توضیحاتی برای این اثر ثبت نشده است.";
    description.style.lineHeight = "2";

    const watch = document.createElement("button");
    watch.textContent = "▶ تماشای اثر";
    watch.style.cssText = `
      background:#ffd56a;color:#241034;
      padding:13px 25px;border:0;
      border-radius:12px;font-weight:bold;
      cursor:pointer;
    `;
    watch.onclick = () => startVideo(item.url);

    info.append(title, rating, category, description, watch);
    hero.append(poster, info);
    panel.append(close, hero);
    overlay.append(panel);
    document.body.append(overlay);
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

  // ZH cinematic glass slider: poster-only, no embedded video.
  const zhSliderStyle = document.createElement("style");
  zhSliderStyle.textContent = `
    .hero.zh-cinema {display:block;min-height:0;padding:0;aspect-ratio:16/9;max-height:480px;background:#160d23;overflow:hidden;touch-action:pan-y;}
    .zh-cinema-stage {position:relative;width:100%;height:100%;min-height:210px;perspective:1100px;}
    .zh-cinema-slide {position:absolute;inset:0;opacity:0;transform:translateX(20%) rotateY(-12deg) scale(.94);transition:opacity .65s ease,transform .65s cubic-bezier(.2,.8,.2,1);pointer-events:none;}
    .zh-cinema-slide.is-active {opacity:1;transform:translateX(0) rotateY(0) scale(1);pointer-events:auto;z-index:2;}
    .zh-cinema-slide.is-before {transform:translateX(-20%) rotateY(12deg) scale(.94);}
    .zh-cinema-slide img {width:100%;height:100%;object-fit:cover;display:block;}
    .zh-cinema-slide::after {content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(10,5,20,.96),rgba(16,8,28,.18) 75%),linear-gradient(270deg,rgba(25,8,39,.4),transparent);pointer-events:none;}
    .zh-cinema-copy {position:absolute;z-index:3;right:5%;bottom:12%;left:5%;width:min(520px,90%);padding:12px 16px;background:rgba(43,21,62,.42);border:1px solid rgba(255,213,106,.35);border-radius:18px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 12px 30px #0005;}
    .zh-cinema-copy h2 {font-size:clamp(19px,3vw,32px);margin:3px 0 6px;color:#fff;line-height:1.5;}
    .zh-cinema-copy p {font-size:12px;margin:0 0 9px;color:#f0dff7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .zh-cinema-copy button {background:linear-gradient(135deg,#ffe9a5,#e9b840);color:#261132;padding:8px 17px;font-size:12px;}
    .zh-cinema-dots {position:absolute;z-index:5;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:7px;direction:ltr;}
    .zh-cinema-dots button {width:7px;height:7px;min-width:7px;padding:0;border:0;border-radius:20px;background:#ffffff80;transition:width .25s;}
    .zh-cinema-dots button.is-active {width:24px;background:#ffd56a;}
    .zh-cinema-arrow {position:absolute;z-index:5;top:44%;width:34px;height:34px;padding:0;border:1px solid #ffffff55;border-radius:50%;background:#25133488;color:white;font-size:23px;backdrop-filter:blur(8px);}
    .zh-cinema-arrow.prev {right:9px;} .zh-cinema-arrow.next {left:9px;}
    @media(max-width:600px){.hero.zh-cinema {aspect-ratio:4/3;max-height:350px;}.zh-cinema-copy{bottom:12%;padding:10px 12px;}.zh-cinema-copy p{font-size:11px;}.zh-cinema-arrow{width:28px;height:28px;font-size:19px;}}
    @media(prefers-reduced-motion:reduce){.zh-cinema-slide{transition:none;}}
  `;
  document.head.append(zhSliderStyle);
  const zhHero = document.querySelector(".hero");
  let zhSlideIndex = 0;
  let zhSlideTimer = null;
  function renderCinemaSlider() {
    if (!zhHero) return;
    const featured = [...items].filter(item => item.poster && /^https:\/\//i.test(item.poster))
      .sort((a,b) => getCreatedTime(b) - getCreatedTime(a)).slice(0, 6);
    if (!featured.length) return; // Keep original welcome hero if no posters exist.
    if (zhSlideTimer) clearInterval(zhSlideTimer);
    zhHero.classList.add("zh-cinema");
    zhHero.replaceChildren();
    const stage = document.createElement("div");
    stage.className = "zh-cinema-stage";
    const slides = [], dots = [];
    featured.forEach((item,i) => {
      const slide = document.createElement("div");
      slide.className = "zh-cinema-slide";
      const img = document.createElement("img");
      img.src = item.poster;
      img.alt = item.title;
      img.loading = i === 0 ? "eager" : "lazy";
      img.onerror = () => { img.style.visibility = "hidden"; slide.style.background = "linear-gradient(135deg,#4a2668,#10091b)"; };
      const copy = document.createElement("div");
      copy.className = "zh-cinema-copy";
      const heading = document.createElement("h2");
      heading.textContent = item.kind === "series" ? seriesName(item.title) : item.title;
      const details = document.createElement("p");
      details.textContent = (item.kind === "series" ? "📺 سریال" : "🎬 فیلم") + "  •  " + (CATEGORIES[item.category] || "ژ موویز");
      const watch = document.createElement("button");
      watch.type = "button";
      watch.textContent = item.kind === "series" ? "▶ تماشای قسمت " + episodeNumber(item.title) : "▶ تماشای فیلم";
      watch.onclick = () => startVideo(item.url);
      copy.append(heading,details,watch);
      slide.append(img,copy);
      stage.append(slide);
      slides.push(slide);
    });
    const controls = document.createElement("div");
    controls.className = "zh-cinema-dots";
    featured.forEach((item,i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "نمایش اسلاید " + (i+1));
      dot.onclick = () => { showSlide(i); restartTimer(); };
      controls.append(dot);
      dots.push(dot);
    });
    function showSlide(index) {
      zhSlideIndex = (index + slides.length) % slides.length;
      slides.forEach((slide,i) => {
        slide.classList.toggle("is-active", i === zhSlideIndex);
        slide.classList.toggle("is-before", i < zhSlideIndex);
        slide.setAttribute("aria-hidden", i === zhSlideIndex ? "false" : "true");
        slide.querySelector("button").tabIndex = i === zhSlideIndex ? 0 : -1;
        dots[i].classList.toggle("is-active", i === zhSlideIndex);
      });
    }
    function restartTimer() {
      if (zhSlideTimer) clearInterval(zhSlideTimer);
      if (slides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        zhSlideTimer = setInterval(() => {
          if (!document.hidden && zhHero.getClientRects().length) showSlide(zhSlideIndex+1);
        },5000);
      }
    }
    if (slides.length > 1) {
      for (const [cls,delta,label] of [["prev",-1,"اسلاید قبلی"],["next",1,"اسلاید بعدی"]]) {
        const arrow = document.createElement("button");
        arrow.type = "button";
        arrow.className = "zh-cinema-arrow " + cls;
        arrow.textContent = delta < 0 ? "‹" : "›";
        arrow.setAttribute("aria-label",label);
        arrow.onclick = () => { showSlide(zhSlideIndex+delta); restartTimer(); };
        stage.append(arrow);
      }
      let startX = null, startY = null;
      stage.addEventListener("touchstart",e => {startX=e.touches[0].clientX;startY=e.touches[0].clientY;},{passive:true});
      stage.addEventListener("touchend",e => {
        if(startX === null) return;
        const dx=e.changedTouches[0].clientX-startX;
        const dy=e.changedTouches[0].clientY-startY;
        if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.2){showSlide(zhSlideIndex+(dx>0?-1:1));restartTimer();}
        startX=null;startY=null;
      },{passive:true});
    }
    zhHero.append(stage,controls);
    showSlide(Math.min(zhSlideIndex,slides.length-1));
    restartTimer();
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

    // Each uploaded item appears separately.
    const latestItems = sorted.slice(0, 6).map(item => ({
      ...item,
      displayName: item.kind === "series"
        ? seriesName(item.title)
        : item.title
    }));

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
        aspect-ratio: 16 / 9;
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
          display: block;
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

      button.textContent = item.kind === "series"
        ? "▶ قسمت " + episodeNumber(item.title)
        : "▶ تماشا";

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

      const playerArea = document.createElement("div");
playerArea.style.display = "none";
      button.onclick = () => {
        startVideo(item.url, playerArea);
      };

      content.append(
        title,
        type,
        category,
        button,
        playerArea
      );

      card.append(posterBox, content);
      latestGrid.append(card);
    });
  }

  // 🏆 ZH MOVIES — Top Rated
  const topRatedSection = document.createElement("section");
  topRatedSection.id = "zhTopRated";
  topRatedSection.style.cssText = `
    width:94%;max-width:1700px;margin:18px auto 24px;
    padding:18px;border-radius:22px;direction:rtl;
    background:linear-gradient(135deg,#241034,#37164d);
    border:1px solid rgba(255,213,106,.35);
    box-shadow:0 10px 28px #0004;
  `;

  const topRatedTitle = document.createElement("h2");
  topRatedTitle.textContent = "🏆 محبوب‌ترین‌های ژ موویز";
  topRatedTitle.style.cssText =
    "color:#ffd56a;font-size:18px;margin:0 0 6px;";

  const topRatedSubtitle = document.createElement("p");
  topRatedSubtitle.textContent = "برترین آثار با رأی کاربران";
  topRatedSubtitle.style.cssText =
    "color:#d8c4e5;font-size:12px;margin:0 0 16px;";

  const topRatedGrid = document.createElement("div");
  topRatedGrid.id = "zhTopRatedGrid";
  topRatedGrid.style.cssText = `
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:12px;
  `;

  topRatedSection.append(
    topRatedTitle, topRatedSubtitle, topRatedGrid
  );
  latestSection.insertAdjacentElement(
    "afterend", topRatedSection
  );

  const topRatedStyle = document.createElement("style");
  topRatedStyle.textContent = `
    @media(min-width:768px) {
      #zhTopRatedGrid {
        grid-template-columns:repeat(4,minmax(0,1fr)) !important;
      }
    }
    #zhTopRatedGrid article {
      min-width:0;overflow:hidden;border-radius:15px;
      background:linear-gradient(155deg,#301b43,#170c25);
      border:1px solid #ffd56a55;
      display:flex;flex-direction:column;
      transition:transform .3s,border-color .3s;
    }
    #zhTopRatedGrid article:hover {
      transform:translateY(-4px);
      border-color:#ffd56a;
    }
    #zhTopRatedGrid img {
      display:block;width:100%;aspect-ratio:16/9;
      object-fit:cover;
    }
    #zhTopRatedGrid .zh-top-info {
      padding:11px;display:flex;flex-direction:column;
      gap:8px;flex:1;
    }
    #zhTopRatedGrid h3 {
      margin:0;color:white;font-size:13px;
      overflow-wrap:anywhere;
    }
    #zhTopRatedGrid p {
      margin:0;color:#ffd56a;font-size:12px;
    }
    #zhTopRatedGrid button {
      margin-top:auto;padding:9px 5px;
      background:linear-gradient(110deg,#ffe9a5,#e9b840);
      color:#261132;border:0;border-radius:10px;
      font-weight:800;font-size:12px;
    }
    @media(prefers-reduced-motion:reduce) {
      #zhTopRatedGrid article {transition:none;}
    }
  `;
  document.head.append(topRatedStyle);

  function renderTopRated() {
    topRatedGrid.replaceChildren();

    const ranked = items
      .filter(item =>
        (movieRatingCounts[item.id] || 0) > 0
      )
      .sort((a, b) =>
        getMovieRating(b.id) - getMovieRating(a.id) ||
        (movieRatingCounts[b.id] || 0) -
        (movieRatingCounts[a.id] || 0)
      )
      .slice(0, 6);

    topRatedSection.hidden = ranked.length === 0;

    ranked.forEach(item => {
      const card = document.createElement("article");

      if (item.poster) {
        const img = document.createElement("img");
        img.src = item.poster;
        img.alt = item.title;
        img.loading = "lazy";
        card.append(img);
      }

      const info = document.createElement("div");
      info.className = "zh-top-info";

      const title = document.createElement("h3");
      title.textContent = item.kind === "series"
        ? seriesName(item.title) : item.title;

      const rating = document.createElement("p");
      rating.textContent =
        "⭐ " + getMovieRating(item.id).toFixed(1) +
        " از ۵ • " + movieRatingCounts[item.id] + " رأی";

      const watch = document.createElement("button");
      watch.type = "button";
      watch.textContent = item.kind === "series"
        ? "▶ قسمت " + episodeNumber(item.title)
        : "▶ تماشا";
      watch.onclick = () => startVideo(item.url);

      info.append(title, rating, watch);
      card.append(info);
      topRatedGrid.append(card);
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

      const normalizedTitle = x.title
        .toLocaleLowerCase("fa")
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک");

      const searchMatches =
        !searchQuery || normalizedTitle.includes(searchQuery);

      return kindMatches && categoryMatches && searchMatches;
    });

    // Every Firestore item has its own card.
    const groups = new Map();

    list.forEach(x => {
      const name = x.kind === "series"
        ? seriesName(x.title)
        : x.title;

      const key = x.id;

      groups.set(key, {
        name,
        kind: x.kind,
        episodes: [x]
      });
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
      const entries = group.episodes;

      const card = document.createElement("article");
      card.className = "card";

      const thumb = document.createElement("div");
      thumb.className = "thumb";

      const poster = entries[0]?.poster;

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
        ? "📺 سریال"
        : "🎬 فیلم";

      info.append(title, details);

      // ❤️ Favorites
      const favoriteBtn = document.createElement("button");

      favoriteBtn.type = "button";
      favoriteBtn.textContent = isFavorite(entries[0].id)
        ? "❤️ حذف از علاقه‌مندی‌ها"
        : "🤍 افزودن به علاقه‌مندی‌ها";

      favoriteBtn.style.background = "#39224f";
      favoriteBtn.style.color = "#ffd56a";
      favoriteBtn.style.border = "1px solid #b18a4d";
      favoriteBtn.style.borderRadius = "12px";
      favoriteBtn.style.padding = "10px";
      favoriteBtn.style.marginBottom = "10px";
      favoriteBtn.style.cursor = "pointer";

      favoriteBtn.onclick = () => {
        toggleFavorite(entries[0].id);
      };

      info.append(favoriteBtn);

      // ⭐ Rating Stars
      const ratingBox = document.createElement("div");

      ratingBox.style.display = "flex";
      ratingBox.style.alignItems = "center";
      ratingBox.style.justifyContent = "center";
      ratingBox.style.gap = "6px";
      ratingBox.style.margin = "12px 0";
      ratingBox.style.direction = "ltr";

      const movieId = entries[0].id;
      const currentRating = getMovieRating(movieId);

      for (let star = 1; star <= 5; star++) {
        const starBtn = document.createElement("button");

        starBtn.type = "button";
        starBtn.textContent =
          star <= currentRating ? "★" : "☆";

        starBtn.style.background = "transparent";
        starBtn.style.border = "none";
        starBtn.style.color = "#ffd56a";
        starBtn.style.fontSize = "28px";
        starBtn.style.padding = "2px";
        starBtn.style.cursor = "pointer";

        starBtn.setAttribute(
          "aria-label",
          "امتیاز " + star + " از ۵"
        );

        starBtn.onclick = async () => {
          starBtn.disabled = true;

          try {
            const user = await ensureRatingUser();

            await db.collection("ratings")
              .doc(user.uid + "_" + movieId)
              .set({
                movieId: movieId,
                userId: user.uid,
                score: star
              });

            movieRatings[movieId] = star;
            render();

          } catch (error) {
            console.error("Rating error:", error);
            alert("امتیاز ثبت نشد. دوباره تلاش کن.");
            starBtn.disabled = false;
          }
        };

        ratingBox.append(starBtn);
      }

      info.append(ratingBox);

      const ratingInfo = document.createElement("p");
      const ratingCount = movieRatingCounts[movieId] || 0;

      ratingInfo.style.textAlign = "center";
      ratingInfo.style.color = "#ffd56a";
      ratingInfo.style.fontSize = "13px";

      ratingInfo.textContent = ratingCount > 0
        ? "⭐ " + currentRating.toFixed(1) +
          " از ۵  •  " + ratingCount + " رأی"
        : "هنوز امتیازی ثبت نشده";

      info.append(ratingInfo);

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

      const descText = entries[0]?.description;

      if (descText) {
        const desc = document.createElement("p");
        desc.textContent = descText;
        info.append(desc);
      }

      const playerArea = document.createElement("div");
      playerArea.style.display = "none";

      if (group.kind === "series") {
        const x = entries[0];

        if (x.url) {
          const btn = document.createElement("button");
          const num = episodeNumber(x.title);

          btn.type = "button";
          btn.textContent = "▶ قسمت " + num;
          btn.className = "yellow";
          btn.style.padding = "9px 12px";

          btn.onclick = () => {
            startVideo(x.url, playerArea);
          };

          info.append(btn, playerArea);
        }
      } else {
        const x = entries[0];

        if (x.url) {
          const btn = document.createElement("button");

          btn.type = "button";
          btn.className = "yellow";
          btn.textContent = "▶ تماشای فیلم";
          btn.style.padding = "9px 12px";

          btn.onclick = () => {
            startVideo(x.url);
          };

          info.append(btn);
        }
      }

     
      // 🎬 Open movie details by tapping the poster or title
      thumb.style.cursor = "pointer";
      title.style.cursor = "pointer";

      thumb.onclick = () => openMovieDetails(entries[0]);
      title.onclick = () => openMovieDetails(entries[0]);

      card.append(thumb, info);
      grid.append(card);

    });
  }

function renderFavorites() {
  const grid = document.getElementById("favoritesGrid");
  const empty = document.getElementById("favoritesEmpty");

  if (!grid || !empty) return;

  grid.replaceChildren();

  const savedItems = items.filter(item =>
    isFavorite(item.id)
  );

  empty.style.display = savedItems.length ? "none" : "block";

  savedItems.forEach(item => {
    const card = document.createElement("article");
    card.className = "card";

    const thumb = document.createElement("div");
    thumb.className = "thumb";

    if (item.poster) {
      const img = document.createElement("img");
      img.src = item.poster;
      img.alt = item.title;
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
    title.textContent = item.kind === "series"
      ? seriesName(item.title)
      : item.title;

    const details = document.createElement("p");
    details.textContent = item.kind === "series"
      ? "📺 سریال"
      : "🎬 فیلم";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "❤️ حذف از علاقه‌مندی‌ها";
    removeBtn.className = "yellow";

    removeBtn.onclick = () => {
      toggleFavorite(item.id);
    };

    info.append(title, details, removeBtn);

    if (item.url) {
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "yellow";
      playBtn.style.marginTop = "10px";

      playBtn.textContent = item.kind === "series"
        ? "▶ قسمت " + episodeNumber(item.title)
        : "▶ تماشا";

      playBtn.onclick = () => {
        startVideo(item.url);
      };

      info.append(playBtn);
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

        if (!confirm(
          `آیا از حذف «${item.title}» مطمئنی؟`
        )) {
          return;
        }

        try {
          deleteButton.disabled = true;

          await db.collection("movies")
            .doc(item.id)
            .delete();

          alert("فیلم با موفقیت حذف شد.");
        } catch (error) {
          deleteButton.disabled = false;
          alert("حذف انجام نشد: " + error.message);
        }
      };

      row.append(name, button, deleteButton);
      container.append(row);
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
      await db.collection("movies")
        .doc(editingId)
        .update({
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
// ⭐ Live ratings from Firebase
db.collection("ratings").onSnapshot(
  snapshot => {
    const totals = {};

    snapshot.forEach(doc => {
      const rating = doc.data();
      const movieId = rating.movieId;
      const score = Number(rating.score);

      if (!movieId || score < 1 || score > 5) return;

      if (!totals[movieId]) {
        totals[movieId] = { sum: 0, count: 0 };
      }

      totals[movieId].sum += score;
      totals[movieId].count++;
    });

    movieRatings = {};
movieRatingCounts = {};

Object.keys(totals).forEach(movieId => {
  movieRatings[movieId] =
    totals[movieId].sum / totals[movieId].count;

  movieRatingCounts[movieId] =
    totals[movieId].count;
});

      render();
    renderTopRated();
  },
  error => {
    console.error("Ratings loading error:", error);
  }
);
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
    renderTopRated();
    renderCinemaSlider();
    renderFavorites();
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
