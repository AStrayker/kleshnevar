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
  let user = null;
  let isAdmin = false;
  let sections = [];

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
          price: 899,
          unit: "кг",
          photo: shrimpPhotos[flavor] || "",
        })),
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
    sections = snap.exists ? (snap.data().sections || []) : [];
    paintRows();
  }
  function paintRows() {
    const rows = [];
    sections.forEach((section) => {
      (section.items || []).forEach((item) => {
        rows.push(`<tr>
          <td><img src="${esc(item.photo || "")}" alt=""></td>
          <td>${esc(item.name)}${item.hidden ? " · приховано" : ""}</td>
          <td>${money(item.price)}</td>
          <td>${esc(item.unit || "")}</td>
          <td>${esc(item.meta || "")}</td>
          <td>${esc(section.title || section.id)}</td>
          <td><button type="button" data-edit="${esc(item.id)}">Змінити</button></td>
        </tr>`);
      });
    });
    $("#rows").innerHTML = rows.join("") || "<tr><td colspan='7'>Меню ще не опубліковане.</td></tr>";
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
  function showPanel(on) {
    $("#loginBox").hidden = on;
    $("#panel").hidden = !on;
    $("#gate").hidden = on;
  }
  auth.onAuthStateChanged(async (person) => {
    user = person;
    if (!person) { showPanel(false); $("#gate").textContent = "Увійдіть, щоб відкрити адмінку."; return; }
    const adminDoc = await db.collection("admins").doc(person.uid).get();
    isAdmin = adminDoc.exists;
    if (!isAdmin) {
      showPanel(false);
      $("#gate").textContent = "Акаунт " + (person.email || "") + " не є адміністратором. Перший адмін з'являється на index2 кнопкою «Стати адміністратором».";
      return;
    }
    showPanel(true);
    await loadCatalog();
    await loadStats();
    await loadAdmins();
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
    const btn = e.target.closest("[data-edit]");
    if (!btn) return;
    const item = findItem(btn.dataset.edit);
    if (!item) return;
    const name = prompt("Назва", item.name || "");
    if (name == null) return;
    const price = prompt("Ціна", String(item.price));
    if (price == null) return;
    const unit = prompt("Тип тари: шт, кг, г або л", item.unit || "");
    if (unit == null) return;
    const meta = prompt("Вага або опис", item.meta || "");
    if (meta == null) return;
    const photo = prompt("Посилання на фото", item.photo || "");
    if (photo == null) return;
    item.name = name.trim();
    item.price = Number(String(price).replace(",", "."));
    item.unit = unit.trim();
    item.meta = meta.trim();
    item.photo = photo.trim();
    try {
      await save();
      paintRows();
    } catch (err) {
      console.warn(err);
      say("Не вдалося зберегти. Задеплойте правила Firestore.");
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
  $("#adminForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = String(new FormData(e.target).get("email") || "").trim().toLowerCase();
    const found = await db.collection("users").where("email", "==", email).get();
    if (found.empty) { say("Ця людина має спочатку зареєструватися на сайті"); return; }
    for (const doc of found.docs) {
      await db.collection("admins").doc(doc.id).set({
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    e.target.reset();
    await loadAdmins();
    say("Адміністратора додано");
  });
})();
