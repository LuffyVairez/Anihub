const API = "https://kitsu.io/api/edge";
let currentType = "anime";
let currentView = "browse";
let currentItem = null;
let listFilter = "all";
let library = { manga: [], anime: [] };
let savedList = loadList();

const detailDialog = document.getElementById("detail");

const STATUS_GROUPS = [
  { value: "in-progress", label: "In progress" },
  { value: "planned", label: "Planned" },
  { value: "finished", label: "Finished" }
];

/* ---------- saved list (memory) ---------- */

function loadList() {
  try {
    return JSON.parse(localStorage.getItem("shelfmark-list")) || {};
  } catch (error) {
    return {};
  }
}

function saveList() {
  try {
    localStorage.setItem("shelfmark-list", JSON.stringify(savedList));
  } catch (error) {
    console.error(error);
  }
  document.getElementById("list-count").textContent = Object.keys(savedList).length;
}

function itemKey(item) {
  return item.type + "-" + item.id;
}

/* ---------- library (your own files) ---------- */

async function loadLibrary() {
  try {
    const response = await fetch("library.json");
    if (!response.ok) {
      throw new Error("Library file not found: " + response.status);
    }
    library = await response.json();
  } catch (error) {
    console.error(error);
  }
}

function findInLibrary(type, id) {
  const list = library[type] || [];
  return list.find(function (entry) {
    return entry.kitsuId === String(id);
  });
}

// Works for local files ("episode-1.mp4" + a folder) and full links ("https://...")
function fileUrl(entry, file) {
  if (/^https?:\/\//i.test(file)) {
    return file;
  }
  const base = entry.folder || "";
  return base ? base.replace(/\/$/, "") + "/" + file : file;
}

/* ---------- AniList info link ---------- */

async function getAnilistId(kitsuId) {
  try {
    const response = await fetch(API + "/anime/" + kitsuId + "?include=mappings");
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    const mapping = (json.included || []).find(function (item) {
      return item.type === "mappings" && item.attributes.externalSite === "anilist/anime";
    });
    return mapping ? mapping.attributes.externalId : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/* ---------- player and link inside the pop-up ---------- */
//here where i comment out...
function showPlayerAndLink(anilistId, mine) {
//   const linksRow = document.getElementById("d-links");
  const anilistBtn = document.getElementById("d-anilist");
  const anisnatchBtn = document.getElementById("d-anisnatch");
 // const playerWrap = document.getElementById("local-player-wrap");
  //const video = document.getElementById("localVideoPlayer");

  // Reset whatever the last title left behind
 // video.pause();
  //video.removeAttribute("src");
  //video.load();
  //playerWrap.hidden = true;
  anisnatchBtn.hidden = true;

  // Your own video, if this title is in library.json
//   if (mine && mine.episodes && mine.episodes.length > 0) {
//     video.src = fileUrl(mine, mine.episodes[0].file);
//     playerWrap.hidden = false;
//   }

  // AniList (blue) + AniSnatch (pink) buttons side by side
  if (anilistId) {
    anilistBtn.href = "https://anilist.co/anime/" + anilistId;
    anisnatchBtn.href = "https://anisnatch.top/watch/" + anilistId + "?ep=1";
    anisnatchBtn.hidden = false;
    //linksRow.hidden = false;
  } else {
    anilistBtn.removeAttribute("href");
    anisnatchBtn.removeAttribute("href");
    //linksRow.hidden = true;
  }
  anilistBtn.hidden = !anilistId;
}
//i stop here
/* ---------- fetching ---------- */

async function getTitles(type, searchText) {
  let url = API + "/" + type + "?page[limit]=20";

  if (searchText) {
    url += "&filter[text]=" + encodeURIComponent(searchText);
  } else {
    url += "&sort=popularityRank";
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Request failed: " + response.status);
  }
  const json = await response.json();
  return json.data;
}

/* ---------- showing things ---------- */

function showCards(anime, target) {
  const results = target || document.getElementById("results");
  results.innerHTML = "";
  if (!target) {
    results.classList.add("grid");
  }

  anime.forEach(function (item) {
    const attrs = item.attributes;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";

    const img = document.createElement("img");
    img.className = "poster";
    img.alt = "";
    img.loading = "lazy";
    if (attrs.posterImage) {
      img.src = attrs.posterImage.small;
    }

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = attrs.canonicalTitle;

    card.append(img, title);
    card.addEventListener("click", function () {
      openDetail(item);
    });
    results.append(card);
  });
}

async function openDetail(item) {
  const attrs = item.attributes;

  const img = document.getElementById("d-img");
  if (attrs.posterImage) {
    img.src = attrs.posterImage.medium;
  } else {
    img.removeAttribute("src");
  }

  document.getElementById("d-title").textContent = attrs.canonicalTitle;

  const facts = [];
  if (attrs.subtype) {
    facts.push(attrs.subtype);
  }
  if (attrs.startDate) {
    facts.push(attrs.startDate.slice(0, 4));
  }
  if (attrs.episodeCount) {
    facts.push(attrs.episodeCount + " episodes");
  }
  if (attrs.chapterCount) {
    facts.push(attrs.chapterCount + " chapters");
  }
  if (attrs.averageRating) {
    facts.push("Rating " + attrs.averageRating + "/100");
  }
  document.getElementById("d-meta").textContent = facts.join(", ");

  document.getElementById("d-synopsis").textContent =
    attrs.synopsis || "No synopsis available.";

  currentItem = item;
  const saved = savedList[itemKey(item)];
  document.getElementById("d-status").value = saved ? saved.status : "";

  const mine = findInLibrary(item.type, item.id);
  const note = document.getElementById("d-library");
  if (mine && mine.chapters) {
    note.textContent = "In your library: " + mine.chapters.length + " chapters";
  } else if (mine && mine.episodes) {
    const count = mine.episodes.length;
    note.textContent = "In your library: " + count + (count === 1 ? " episode" : " episodes");
  } else {
    note.textContent = "";
  }
  document.getElementById("d-play").textContent =
    mine && mine.episodes && mine.episodes.length > 0 ? "Play from library" : "Play MP4";

  // Show the pop-up straight away, then finish the link in the background
  showPlayerAndLink(null, mine);
  detailDialog.showModal();

  if (item.type === "anime") {
    const anilistId = await getAnilistId(item.id);
    if (currentItem === item) {
      showPlayerAndLink(anilistId, mine);
    }
  }
}

async function loadTitles(searchText) {
  currentView = "browse";
  document.getElementById("tab-browse").setAttribute("aria-pressed", true);
  document.getElementById("tab-list").setAttribute("aria-pressed", false);
  document.getElementById("list-filter").hidden = true;

  const status = document.getElementById("status");
  const heading = document.getElementById("results-title");

  if (searchText) {
    heading.textContent = "Results for " + searchText;
  } else {
    heading.textContent = "Top " + currentType;
  }
  status.textContent = "Loading...";

  try {
    const items = await getTitles(currentType, searchText);
    showCards(items);
    if (items.length === 0) {
      status.textContent = "No matches. Try a different spelling or the other catalogue.";
    } else {
      status.textContent = "Showing " + items.length + " Great Titles.";
    }
  } catch (error) {
    status.textContent = "Could not load titles. Check your connection and try again.";
    console.error(error);
  }
}

function showSavedList() {
  currentView = "list";
  document.getElementById("tab-browse").setAttribute("aria-pressed", false);
  document.getElementById("tab-list").setAttribute("aria-pressed", true);
  document.getElementById("results-title").textContent = "My list";
  document.getElementById("list-filter").hidden = false;

  const results = document.getElementById("results");
  const status = document.getElementById("status");
  results.innerHTML = "";
  results.classList.remove("grid");

  const entries = Object.values(savedList).filter(function (entry) {
    return listFilter === "all" || entry.item.type === listFilter;
  });

  if (entries.length === 0) {
    if (listFilter === "all") {
      status.textContent = "Nothing here yet. Open a title and choose a list status to add it.";
    } else {
      status.textContent = "No " + listFilter + " on your list yet.";
    }
    return;
  }
  status.textContent = "Showing " + entries.length + " saved titles.";

  STATUS_GROUPS.forEach(function (group) {
    const items = entries
      .filter(function (entry) {
        return entry.status === group.value;
      })
      .map(function (entry) {
        return entry.item;
      });

    if (items.length === 0) {
      return;
    }

    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = group.label + " (" + items.length + ")";

    const grid = document.createElement("div");
    grid.className = "grid";
    showCards(items, grid);

    section.append(heading, grid);
    results.append(section);
  });
}

/* ---------- reacting to the visitor ---------- */

// "close" fires however the pop-up closes (x button, backdrop, Escape key)
// detailDialog.addEventListener("close", function () {
//   document.getElementById("localVideoPlayer").pause();
// });
/* ---------- video player ---------- */

let blobUrl = null;

function resetPlayer() {
  const video = document.getElementById("localVideoPlayer");
  video.pause();
  video.removeAttribute("src");
  video.load();
  document.getElementById("local-player-wrap").hidden = true;
  document.getElementById("player-note").textContent = "";
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
}

function startVideo(url) {
  const video = document.getElementById("localVideoPlayer");
  const wrap = document.getElementById("local-player-wrap");
  document.getElementById("player-note").textContent = "";
  video.src = url;
  wrap.hidden = false;
  video.play().catch(function () {});
  wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

const mp4Input = document.getElementById("mp4-input");

document.getElementById("d-play").addEventListener("click", function () {
  const mine = currentItem ? findInLibrary(currentItem.type, currentItem.id) : null;
  if (mine && mine.episodes && mine.episodes.length > 0) {
    startVideo(fileUrl(mine, mine.episodes[0].file));
  } else {
    mp4Input.click();
  }
});

mp4Input.addEventListener("change", function () {
  const file = mp4Input.files[0];
  if (!file) {
    return;
  }
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrl = URL.createObjectURL(file);
  startVideo(blobUrl);
  mp4Input.value = "";
});

document.getElementById("localVideoPlayer").addEventListener("error", function () {
  if (!this.getAttribute("src")) {
    return;
  }
  document.getElementById("player-note").textContent =
    "This video can't be played. Use an MP4 with H.264 video and AAC audio, or check the link points straight at the file.";
});

detailDialog.addEventListener("close", resetPlayer);


document.getElementById("d-close").addEventListener("click", function () {
  detailDialog.close();
});

detailDialog.addEventListener("click", function (event) {
  if (event.target === detailDialog) {
    detailDialog.close();
  }
});

const form = document.getElementById("search-form");
form.addEventListener("submit", function (event) {
  event.preventDefault();
  loadTitles(document.getElementById("q").value.trim());
});

const typeButtons = document.querySelectorAll(".seg-btn");
typeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    currentType = button.dataset.type;
    typeButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", b === button);
    });
    loadTitles(document.getElementById("q").value.trim());
  });
});

document.getElementById("tab-list").addEventListener("click", showSavedList);

document.getElementById("tab-browse").addEventListener("click", function () {
  loadTitles(document.getElementById("q").value.trim());
});

const filterButtons = document.querySelectorAll(".filter-btn");
filterButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    listFilter = button.dataset.filter;
    filterButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", b === button);
    });
    showSavedList();
  });
});

document.getElementById("d-status").addEventListener("change", function (event) {
  if (!currentItem) {
    return;
  }
  if (event.target.value) {
    savedList[itemKey(currentItem)] = { item: currentItem, status: event.target.value };
  } else {
    delete savedList[itemKey(currentItem)];
  }
  saveList();
  if (currentView === "list") {
    showSavedList();
  }
});

/* ---------- start ---------- */

saveList();
loadLibrary();
loadTitles("");