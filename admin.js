(() => {
  const $ = (s) => document.querySelector(s);
  const secrets = (window.KLESHNEVAR_SECRETS && window.KLESHNEVAR_SECRETS.firebase) || {};
  if (!secrets.apiKey || !window.firebase) {
    $("#gate").textContent = "Немає конфігурації Firebase.";
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(secrets);
  const db = firebase.firestore();
  const auth = firebase.auth();
  const storage = firebase.storage();
  let user = null;
  let isAdmin = false;
  let sections = [];
  let photoTarget = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function money(n) {
    return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(Number(n) || 0) + " грн";
  }
  function say(text) { $("#status").textContent = text; }
  function seed() {
    const shrimpFlavors = ["Том Ям", "Том Кха", "Класичні", "Вершкові", "Часниково-гострі", "Томатний"];
    const shrimpPhotos = {
      "Том Ям": "assets/shrimp-tomyum.jpg",
      "Том Кха": "assets/shrimp-tomkha.jpg",
      "Класичні": "assets/shrimp-classic.jpg",
      "Вершкові": "assets/shrimp-cream.jpg",
      "Часниково-гострі": "assets/shrimp-garlic.jpg",
      "Томатний": "assets/shrimp-tomato.jpg",
    };
    const broths = ["BBQ", "Вершкові", "Класика", "Томатний", "Пікантний / HOT", "Табаско"];
    const brothPhotos = {
      BBQ: "assets/cray-bbq.jpg?v=2",
      "Вершкові": "assets/cray-cream.jpg?v=2",
      "Класика": "assets/cray-classic.jpg?v=2",
      "Томатний": "assets/cray-tomato.jpg?v=2",
      "Пікантний / HOT": "assets/cray-hot.jpg?v=2",
      "Табаско": "assets/cray-tabasco.jpg?v=1",
    };
    const sizes = [
      { id: "M", label: "M", price: 1300, pcs: "30–35 шт/кг" },
      { id: "L", label: "L", price: 1750, pcs: "23–25 шт/кг" },
      { id: "XL", label: "XL", price: 2300, pcs: "15–18 шт/кг" },
      { id: "XXL", label: "XXL", price: 2800, pcs: "10–14 шт/кг" },
    ];
    const catalog = JSON.parse(JSON.stringify((window.KLESHNEVAR_CATALOG && window.KLESHNEVAR_CATALOG.sections) || []));
    return [
      {
        id: "krevetky",
        title: "Креветки",
        items: shrimpFlavors.map((flavor) => ({
          id: "shrimp-" + flavor,
          kind: "shrimp",
          name: "Креветки",
          meta: flavor,
          price: 999,
          unit: "кг",
          photo: shrimpPhotos[flavor] || "",
        })).concat([
          { id: "shrimp-sauce-cream", kind: "shrimp", name: "Креветки соус вершковий", meta: "1 кг", price: 900, unit: "кг", photo: "assets/shrimp-cream.jpg" },
          { id: "shrimp-sauce-tomyum", kind: "shrimp", name: "Креветка соус Том Ям", meta: "1 кг", price: 1199, unit: "кг", photo: "assets/shrimp-tomyum.jpg" },
        ]),
      },
      {
        id: "raky",
        title: "Раки",
        items: broths.map((broth) => ({
          id: "craycard-" + String(broth).toLowerCase().replace(/\s+/g, "-"),
          kind: "cray",
          broth,
          name: "Раки",
          meta: broth,
          price: sizes[0].price,
          unit: "кг",
          photo: brothPhotos[broth] || "",
          sizes: sizes.map((size) => Object.assign({}, size)),
        })),
      },
    ].concat(catalog);
  }
  async function loadCatalog() {
    const snap = await db.collection("catalog").doc("live").get();
    const live = snap.exists ? (snap.data().sections || []) : [];
    if (live.length) sections = live;
    else {
      sections = seed();
      say("Показано меню сайту. Перша зміна запише його.");
    }
    paintRows();
  }
  function paintRows() {
    const pick = $("#sectionPick");
    const chosen = pick.value;
    pick.innerHTML = sections.map((section) => `<option value="${esc(section.id)}">${esc(section.title || section.id)}</option>`).join("");
    if (chosen) pick.value = chosen;
    const rows = [];
    sections.forEach((section) => {
      (section.items || []).forEach((item) => {
        rows.push(`<tr data-id="${esc(item.id)}" class="${item.hidden ? "row-hidden" : ""}">
          <td><button type="button" class="photo-btn" data-photo="${esc(item.id)}" title="Замінити фото"><img src="${esc(item.photo || "")}" alt=""></button></td>
          <td class="cell-edit" data-field="name">${esc(item.name || "")}</td>
          <td class="cell-edit" data-field="price">${money(item.price)}</td>
          <td class="cell-edit" data-field="unit">${esc(item.unit || "")}</td>
          <td class="cell-edit" data-field="meta">${esc(item.meta || "")}</td>
          <td>${esc(section.title || section.id)}</td>
          <td class="row-actions">
            <button type="button" data-hide="${esc(item.id)}">${item.hidden ? "Показати" : "Сховати"}</button>
            <button type="button" data-del="${esc(item.id)}">Видалити</button>
          </td>
        </tr>`);
      });
    });
    $("#rows").innerHTML = rows.join("") || "<tr><td colspan='7'>Товарів ще немає.</td></tr>";
  }
  function findSectionOf(id) {
    return sections.find((section) => (section.items || []).some((entry) => entry.id === id)) || null;
  }
  async function uploadPhoto(item, file) {
    const ext = ((file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")) || "jpg";
    const ref = storage.ref().child("product-photos/" + item.id + "-" + Date.now() + "." + ext);
    await ref.put(file, { contentType: file.type || "image/jpeg" });
    item.photo = await ref.getDownloadURL();
  }
  function beginEdit(cell) {
    if (cell.querySelector("input, select")) return;
    const item = findItem(cell.closest("tr").dataset.id);
    if (!item) return;
    const field = cell.dataset.field;
    const previous = item[field] == null ? "" : String(item[field]);
    const editor = field === "unit" ? document.createElement("select") : document.createElement("input");
    if (field === "unit") {
      const units = ["шт", "кг", "г", "л"];
      if (previous && units.indexOf(previous) < 0) units.push(previous);
      units.forEach((unit) => {
        const option = document.createElement("option");
        option.value = unit;
        option.textContent = unit;
        option.selected = unit === previous;
        editor.appendChild(option);
      });
    } else {
      editor.value = field === "price" ? String(item.price) : previous;
      if (field === "price") {
        editor.type = "number";
        editor.min = "0";
        editor.step = "0.01";
      }
    }
    cell.textContent = "";
    cell.appendChild(editor);
    editor.focus();
    if (editor.select) editor.select();
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      if (field === "price") {
        const next = Number(String(editor.value).replace(",", "."));
        if (!Number.isFinite(next) || next < 0) { paintRows(); return; }
        item.price = next;
        if (item.sizes && item.sizes[0]) item.sizes[0].price = next;
      } else {
        item[field] = String(editor.value || "").trim();
      }
      paintRows();
      try { await save(); }
      catch (err) { console.warn(err); say("Не вдалося зберегти. Задеплойте правила Firestore."); }
    };
    editor.addEventListener("blur", finish);
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); editor.blur(); }
      if (event.key === "Escape") { done = true; paintRows(); }
    });
    if (field === "unit") editor.addEventListener("change", () => editor.blur());
  }
  function findItem(id) {
    for (const section of sections) {
      const item = (section.items || []).find((entry) => entry.id === id);
      if (item) return item;
    }
    return null;
  }
  async function save() {
    await db.collection("catalog").doc("live").set({
      sections,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    say("Збережено");
  }
  async function loadStats() {
    const cfg = await db.collection("stats").doc("pages").get();
    const saved = (cfg.exists && cfg.data().paths) || [];
    const days = await db.collection("statsDays").get();
    const totals = {};
    days.forEach((doc) => {
      const counts = doc.data().counts || {};
      Object.keys(counts).forEach((path) => { totals[path] = (totals[path] || 0) + Number(counts[path] || 0); });
    });
    const paths = Array.from(new Set(["index2.html", "link1.html"].concat(saved, Object.keys(totals))));
    $("#stats").innerHTML = paths.map((path) => `<div class="stat-row"><b>${esc(path)}</b><span>${totals[path] || 0} візитів</span></div>`).join("");
  }
  async function loadAdmins() {
    const snap = await db.collection("admins").get();
    $("#admins").innerHTML = snap.docs.map((doc) => `<div class="admin-row">${esc((doc.data() && doc.data().email) || doc.id)}</div>`).join("") || "<p class='meta'>Поки немає</p>";
  }
  function showPanel(mode) {
    $("#loginBox").hidden = mode !== "login";
    $("#panel").hidden = mode !== "admin";
    $("#gate").hidden = mode === "admin";
    $("#leaveBtn").hidden = mode === "login" || mode === "admin";
  }
  auth.onAuthStateChanged(async (person) => {
    user = person;
    if (!person) {
      isAdmin = false;
      showPanel("login");
      $("#gate").textContent = "Увійдіть, щоб відкрити адмінку.";
      return;
    }
    showPanel("checking");
    $("#gate").hidden = false;
    $("#gate").textContent = "Перевіряємо права…";
    try {
      const adminDoc = await db.collection("admins").doc(person.uid).get();
      isAdmin = adminDoc.exists;
    } catch (err) {
      console.warn(err);
      isAdmin = false;
      showPanel("denied");
      $("#gate").textContent = "Вхід виконано, але права адміністратора прочитати не вдалося. Задеплойте правила Firestore.";
      return;
    }
    if (!isAdmin) {
      showPanel("denied");
      $("#gate").textContent = "Акаунт " + (person.email || "") + " не є адміністратором. Адміна додають у Firebase, у колекції admins.";
      return;
    }
    showPanel("admin");
    try {
      await loadCatalog();
      await loadStats();
      await loadAdmins();
    } catch (err) {
      console.warn(err);
      say("Не вдалося завантажити меню.");
    }
  });
  $("#loginBox").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await auth.signInWithEmailAndPassword(String(fd.get("email")).trim(), String(fd.get("password")));
    } catch (err) {
      $("#authError").textContent = "Не вдалося увійти";
    }
  });
  $("#googleBtn").addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(() => {
    $("#authError").textContent = "Google-вхід не вдався. Перевірте, що він увімкнений у Firebase.";
  }));
  $("#resetPass").addEventListener("click", async () => {
    const email = $("#loginBox [name=email]").value.trim();
    if (!email) { $("#authError").textContent = "Вкажіть email"; return; }
    try {
      await auth.sendPasswordResetEmail(email);
      $("#authError").textContent = "Лист для нового пароля надіслано";
    } catch (err) {
      $("#authError").textContent = "Не вдалося надіслати лист";
    }
  });
  $("#logoutBtn").addEventListener("click", () => auth.signOut());
  $("#leaveBtn").addEventListener("click", () => auth.signOut());
  $("#publishBtn").addEventListener("click", async () => {
    if (sections.length) {
      say("Меню вже опубліковане. Зміни робіть у таблиці або на index2.");
      return;
    }
    sections = seed();
    try {
      await save();
      paintRows();
    } catch (err) {
      console.warn(err);
      say("Не вдалося опублікувати. Задеплойте правила Firestore.");
    }
  });
  $("#rows").addEventListener("click", async (e) => {
    const photoBtn = e.target.closest("[data-photo]");
    if (photoBtn) {
      photoTarget = photoBtn.dataset.photo;
      $("#photoFile").click();
      return;
    }
    const hideBtn = e.target.closest("[data-hide]");
    if (hideBtn) {
      const item = findItem(hideBtn.dataset.hide);
      if (!item) return;
      item.hidden = !item.hidden;
      paintRows();
      try { await save(); } catch (err) { console.warn(err); say("Не вдалося зберегти."); }
      return;
    }
    const delBtn = e.target.closest("[data-del]");
    if (delBtn) {
      const item = findItem(delBtn.dataset.del);
      const section = findSectionOf(delBtn.dataset.del);
      if (!item || !section || !confirm("Видалити «" + (item.name || "") + "»?")) return;
      section.items = section.items.filter((entry) => entry.id !== item.id);
      paintRows();
      try { await save(); } catch (err) { console.warn(err); say("Не вдалося зберегти."); }
      return;
    }
    const cell = e.target.closest("[data-field]");
    if (cell) beginEdit(cell);
  });
  $("#photoFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    const item = findItem(photoTarget);
    e.target.value = "";
    if (!file || !item) return;
    try {
      await uploadPhoto(item, file);
      paintRows();
      await save();
    } catch (err) {
      console.warn(err);
      say("Не вдалося замінити фото.");
    }
  });
  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const section = sections.find((entry) => entry.id === fd.get("section")) || sections[0];
    if (!section) { say("Немає розділу для товару"); return; }
    const item = {
      id: "item-" + Date.now(),
      name: String(fd.get("name") || "").trim(),
      price: Number(fd.get("price")),
      unit: String(fd.get("unit") || "шт"),
      meta: String(fd.get("meta") || "").trim(),
      photo: "",
    };
    section.items = section.items || [];
    section.items.push(item);
    const file = e.target.file.files && e.target.file.files[0];
    try {
      if (file) await uploadPhoto(item, file);
      await save();
      e.target.reset();
      paintRows();
    } catch (err) {
      console.warn(err);
      say("Товар додано локально, але зберегти не вдалося.");
      paintRows();
    }
  });
  $("#pageForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const path = new FormData(e.target).get("path").trim().replace(/^\/+/, "");
    if (!path) return;
    const ref = db.collection("stats").doc("pages");
    const snap = await ref.get();
    const paths = Array.from(new Set(((snap.exists && snap.data().paths) || []).concat(path)));
    await ref.set({ paths });
    e.target.reset();
    await loadStats();
    say("Сторінку додано. Щоб візити рахувались, на ній має бути track.js.");
  });
})();
