
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.FIREBASE_CONFIG;
  let auth, db, items = [], filter = "all";

  const modal = $("modal");
  $("adminOpen").onclick = () => modal.classList.add("open");
  $("close").onclick = () => modal.classList.remove("open");
  modal.onclick = e => {
    if (e.target === modal) modal.classList.remove("open");
  };

  document.querySelectorAll(".filter").forEach(b => {
    b.onclick = () => {
      filter = b.dataset.filter;
      document.querySelectorAll(".filter").forEach(x => {
        x.classList.toggle("active", x === b);
      });
      render();
    };
  });

  function render() {
    const grid = $("grid");
    grid.replaceChildren();

    const list = items.filter(x =>
      filter === "all" || x.kind === filter
    );

    if (!list.length) {
      grid.textContent = "هنوز محتوایی در این بخش ثبت نشده است.";
      return;
    }

    list.forEach(x => {
      const card = document.createElement("article");
      card.className = "card";

      const thumb = document.createElement("div");
      thumb.className = "thumb";

      if (x.poster) {
        const img = document.createElement("img");
        img.src = x.poster;
        img.alt = x.title;
        img.loading = "lazy";
        img.onerror = () => {
          thumb.textContent = "✦";
        };
        thumb.append(img);
      } else {
        thumb.textContent = "✦";
      }

      const info = document.createElement("div");
      info.className = "info";

      const title = document.createElement("h3");
      title.textContent = x.title;

      const details = document.createElement("p");
      details.textContent =
        (x.kind === "series" ? "سریال" : "فیلم") +
        (x.year ? " • " + x.year : "");

      info.append(title, details);

      if (x.description) {
        const desc = document.createElement("p");
        desc.textContent = x.description;
        info.append(desc);
      }

      if (x.url) {
        const link = document.createElement("a");
        link.href = x.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "تماشای ویدیو";
        info.append(link);
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
          year: x.year || "",
          poster: x.posterUrl || x.poster || "",
          url: x.videoUrl || x.url || "",
          description: x.description || ""
        };
      });

      $("notice").textContent =
        items.length + " مورد در آرشیو";
      render();
    },
    error => {
      $("notice").textContent =
        "آرشیو قابل خواندن نیست؛ قوانین Firestore را بررسی کنید.";
    }
  );

  auth.onAuthStateChanged(user => {
    $("login").hidden = !!user;
    $("uploadPanel").hidden = !user;

    if (user) {
      $("who").textContent = user.email;
    }
  });

  $("login").onsubmit = async e => {
    e.preventDefault();

    try {
      await auth.signInWithEmailAndPassword(
        $("email").value,
        $("password").value
      );
    } catch (error) {
      alert("ورود ناموفق: " + error.message);
    }
  };

  $("logout").onclick = () => auth.signOut();

  $("upload").onsubmit = async e => {
    e.preventDefault();

    const user = auth.currentUser;
    const status = $("status");

    if (!user) {
      status.textContent = "ابتدا وارد شوید.";
      return;
    }

    const title = $("title").value.trim();
    const videoUrl = $("video").value.trim();
    const posterUrl = $("poster").value.trim();

    if (
      !title ||
      !/^https:\/\//i.test(videoUrl) ||
      (posterUrl && !/^https:\/\//i.test(posterUrl))
    ) {
      status.textContent =
        "لینک‌ها باید با https:// شروع شوند.";
      return;
    }

    const button = $("upload").querySelector(
      'button[type="submit"]'
    );
    button.disabled = true;
    status.textContent = "در حال ذخیره…";

    try {
      await db.collection("movies").add({
        title: title,
        type: $("kind").value,
        kind: $("kind").value,
        year: $("year").value.trim(),
        description: $("description").value.trim(),
        posterUrl: posterUrl,
        videoUrl: videoUrl,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: user.uid
      });

      status.textContent = "با موفقیت منتشر شد.";
      $("upload").reset();
    } catch (error) {
      status.textContent =
        "ذخیره نشد: " +
        (error.code === "permission-denied"
          ? "دسترسی مدیر در قوانین Firestore مجاز نیست."
          : error.message);
    } finally {
      button.disabled = false;
    }
  };
})();
