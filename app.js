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
