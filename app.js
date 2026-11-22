
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.FIREBASE_CONFIG;

  // شناسه مدیر ژ موویز
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

  const modal = $("modal");
  const adminButton = $("adminOpen");

  const adminMode =
    new URLSearchParams(window.location.search)
      .get("admin") === "1";

  function isAdmin(user) {
    return !!user && user.uid === ADMIN_UID;
  }

  function updateAdminUI() {
    const allowed = isAdmin(currentUser);

    adminButton.hidden = !adminMode;

    $("login").hidden = !adminMode || allowed;
    $("uploadPanel").hidden = !adminMode || !allowed;

    $("who").textContent =
      allowed ? (currentUser.email || "مدیر") : "";

    if (!adminMode) {
      modal.classList.remove("open");
    }
  }

  adminButton.onclick = () => {
    if (adminMode) modal.classList.add("open");
  };

  $("close").onclick = () => {
    modal.classList.remove("open");
  };

  modal.onclick = e => {
    if (e.target === modal) {
      modal.classList.remove("open");
    }
  };

  function updateFilterButtons() {
    document.querySelectorAll(".filter").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === filter
      );
    });
  }

  // فیلتر فیلم و سریال در صفحه هوم
  document.querySelectorAll(".filter").forEach(button => {
    button.onclick = () => {
      filter = button.dataset.filter;
      categoryFilter = "all";
      updateFilterButtons();
      render();
    };
  });

  // دریافت دسته انتخاب‌شده از index.html
  document.addEventListener("zh-category-filter", event => {
    const selected = event.detail?.category || "all";

    if (selected !== "all" && !CATEGORIES[selected]) {
      return;
    }

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

      if (n < 0) {
        n = arDigits.indexOf(c);
      }

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

  function render() {
    const grid = $("grid");
    grid.replaceChildren();

    // ابتدا فیلتر فیلم/سریال و سپس دسته‌بندی
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
      grid.textContent =
        categoryFilter !== "all"
          ? "هنوز اثری در دسته «" +
            CATEGORIES[categoryFilter] +
            "» ثبت نشده است."
          : "هنوز محتوایی ثبت نشده است.";

      return;
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

      // نمایش دسته‌بندی اثر
      const categories = [
        ...new Set(
          entries
            .map(x => x.category)
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

          btn.textContent =
            "▶ قسمت " + (num || i + 1);

          btn.className = "yellow";
          btn.style.padding = "9px 12px";

          btn.onclick = () => {
            playerArea.replaceChildren(makeVideo(x.url));

            playerArea.querySelector("video")
              .scrollIntoView({
                behavior: "smooth",
                block: "nearest"
              });
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
          title: x.title || "بدون عنوان",

          kind:
            x.kind === "series" || x.type === "series"
              ? "series"
              : "movie",

          category: CATEGORIES[x.category]
            ? x.category
            : "",

          year: x.year || "",

          poster:
            x.posterUrl || x.poster || "",

          url:
            x.videoUrl || x.url || "",

          description:
            x.description || ""
        };
      });

      $("notice").textContent =
        items.length + " مورد در آرشیو";

      render();
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

        description:
          $("description").value.trim(),

        posterUrl,
        videoUrl,

        createdAt:
          firebase.firestore.FieldValue.serverTimestamp(),

        createdBy: user.uid
      });

      status.textContent =
        "با موفقیت در دسته «" +
        CATEGORIES[category] +
        "» منتشر شد.";

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
