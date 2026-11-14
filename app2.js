(() => {
  const C = window.KLESHNEVAR || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const SHRIMP_FLAVORS = [
    "Том Ям",
    "Том Кха",
    "Класичні",
    "Вершкові",
    "Часниково-гострі",
    "Томатний",
  ];
  const SHRIMP_PHOTOS = {
    "Том Ям": "assets/shrimp-tomyum.jpg",
    "Том Кха": "assets/shrimp-tomkha.jpg",
    "Класичні": "assets/shrimp-classic.jpg",
    "Вершкові": "assets/shrimp-cream.jpg",
    "Часниково-гострі": "assets/shrimp-garlic.jpg",
    "Томатний": "assets/shrimp-tomato.jpg",
  };
  const BROTHS = ["BBQ", "Вершкові", "Класика", "Томатний", "Пікантний / HOT", "Табаско"];
  const BROTH_PHOTOS = {
    BBQ: "assets/cray-bbq.jpg?v=2",
    "Вершкові": "assets/cray-cream.jpg?v=2",
    "Класика": "assets/cray-classic.jpg?v=2",
    "Томатний": "assets/cray-tomato.jpg?v=2",
    "Пікантний / HOT": "assets/cray-hot.jpg?v=2",
    "Табаско": "assets/cray-tabasco.jpg?v=1",
  };
  const SIZES = [
    { id: "M", label: "M", price: 1300, pcs: "30–35 шт/кг" },
    { id: "L", label: "L", price: 1750, pcs: "23–25 шт/кг" },
    { id: "XL", label: "XL", price: 2300, pcs: "15–18 шт/кг" },
    { id: "XXL", label: "XXL", price: 2800, pcs: "10–14 шт/кг" },
  ];
  const SHRIMP_PRICE = 999;
  const SHRIMP_SAUCES = [
    { id: "shrimp-sauce-cream", name: "Креветки соус вершковий", price: 1199, photo: "assets/shrimp-cream.jpg" },
    { id: "shrimp-sauce-tomyum", name: "Креветка соус Том Ям", price: 1199, photo: "assets/shrimp-tomyum.jpg" },
  ];

  let cart = JSON.parse(localStorage.getItem("kv-cart") || "[]");
  let db = null;
  let auth = null;
  let storage = null;
  let user = null;
  let profile = null;
  let isAdmin = false;
  let editMode = false;
  let live = null;
  let authMode = "login";
  let editingId = null;
  let lastWrite = "";
  let draggingSectionId = "";

  function money(n) {
    const v = Math.round(Number(n) * 100) / 100;
    return new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(v) + " грн";
  }
  function lineSum(item) {
    const qty = item.qty != null ? item.qty : item.kg;
    return qty * item.price;
  }
  function taraCost(liters, table) {
    const n = Number(liters);
    if (table && table.length) {
      const row = table.find((entry) => Math.abs(Number(entry.liters) - n) < 0.01);
      if (row) return Number(row.price) || 0;
    }
    const halves = Math.max(1, Math.round(n * 2));
    const full = Math.floor(halves / 4);
    const rem = halves % 4;
    return full * 9 + (rem ? 5 + rem : 0);
  }
  function payable(item) {
    const qty = item.qty != null ? item.qty : item.kg;
    return lineSum(item) + (item.tara ? taraCost(qty, item.taraTable) : 0);
  }
  function litersText(n) {
    const v = Math.round(Number(n) * 10) / 10;
    return new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: Number.isInteger(v) ? 0 : 1,
      maximumFractionDigits: 1,
    }).format(v);
  }
  function parseQty(text) {
    const n = Number(String(text).replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 1;
  }
  function saveCart() {
    localStorage.setItem("kv-cart", JSON.stringify(cart));
    renderCart();
  }
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ----- Firebase (опційно) ----- */
  function initFirebase() {
    const f = (window.KLESHNEVAR_SECRETS && window.KLESHNEVAR_SECRETS.firebase) || C.firebase || {};
    if (!f.apiKey || !f.projectId || !window.firebase) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(f);
      db = firebase.firestore();
      auth = firebase.auth();
      storage = firebase.storage();
      auth.onAuthStateChanged(onUser);
      db.collection("catalog").doc("live").onSnapshot((snap) => {
        if (!snap.exists) return;
        const next = JSON.stringify(snap.data().sections || []);
        live = { sections: snap.data().sections || [] };
        ensureSauceShrimp(live.sections);
        if (next === lastWrite) return;
        lastWrite = next;
        renderMenu();
      });
    } catch (e) {
      console.warn("Firebase:", e);
    }
  }

  /* ----- Header shrink + move left ----- */
  const header = $("#header");
  const onScroll = () => {
    header.classList.toggle("scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ----- Smooth scroll ----- */
  function go(id) {
    closeAll();
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-scroll]");
    if (!a) return;
    e.preventDefault();
    go(a.dataset.scroll);
  });

  /* ----- Drawers ----- */
  const menu = $("#menu");
  const cartPanel = $("#cartPanel");
  const overlay = $("#overlay");
  const burger = $("#burger");

  function openMenu() {
    menu.classList.add("open");
    burger.classList.add("open");
    overlay.classList.add("show");
    cartPanel.classList.remove("open");
  }
  function closeMenu() {
    menu.classList.remove("open");
    burger.classList.remove("open");
  }
  function openCart() {
    cartPanel.classList.add("open");
    overlay.classList.add("show");
    closeMenu();
    renderCart();
  }
  function closeCart() {
    cartPanel.classList.remove("open");
  }
  function closeAll() {
    closeMenu();
    closeCart();
    overlay.classList.remove("show");
  }

  $("#burger").addEventListener("click", () =>
    menu.classList.contains("open") ? closeAll() : openMenu()
  );
  $("#closeMenu").addEventListener("click", closeAll);
  $("#cartBtn").addEventListener("click", () =>
    cartPanel.classList.contains("open") ? closeAll() : openCart()
  );
  $("#closeCart").addEventListener("click", closeAll);
  overlay.addEventListener("click", closeAll);

  /* swipe from right edge */
  let startX = null;
  let tracking = false;
  const edge = $("#swipeEdge");
  const start = (x, fromEdge) => {
    startX = x;
    tracking = fromEdge || menu.classList.contains("open");
  };
  const move = (x) => {
    if (!tracking || startX == null) return;
    const dx = x - startX;
    if (!menu.classList.contains("open") && dx < -40) openMenu();
    if (menu.classList.contains("open") && dx > 40) closeAll();
  };
  edge.addEventListener("touchstart", (e) => start(e.touches[0].clientX, true), { passive: true });
  menu.addEventListener("touchstart", (e) => start(e.touches[0].clientX, false), { passive: true });
  window.addEventListener("touchmove", (e) => move(e.touches[0].clientX), { passive: true });
  window.addEventListener("touchend", () => { startX = null; tracking = false; });

  /* mouse drag from edge (для ПК) */
  edge.addEventListener("mousedown", (e) => start(e.clientX, true));
  window.addEventListener("mousemove", (e) => {
    if (e.buttons === 1) move(e.clientX);
  });

  /* ----- Maps ----- */
  function mapsSearch() {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(C.mapsQuery || C.address);
  }
  function mapsDir() {
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(C.mapsQuery || C.address);
  }
  function openMap() {
    window.open(mapsSearch(), "_blank", "noopener");
  }
  $("#showMapBtn").addEventListener("click", openMap);
  $("#mapBtn2").addEventListener("click", openMap);
  $("#routeBtn").href = mapsDir();

  /* ----- Config into UI ----- */
  $("#igLink").href = C.instagram;
  $("#ttLink").href = C.tiktok;
  $("#tgLink").href = C.telegram;
  $("#phoneLink").href = C.phoneHref;
  $("#phoneLink").textContent = C.phonePretty;
  $("#callBtn").href = C.phoneHref;
  $("#addressText").textContent = C.address;
  $("#deliveryText").textContent = C.deliveryNote;
  $("#hoursText").textContent = C.workHours;
  $("#hoursText2").textContent = C.workHours;
  $("#year").textContent = new Date().getFullYear();
  $("#minHint").textContent = "Мінімальне замовлення на доставку — " + C.minOrder + " грн.";

  document.querySelector('meta[property="og:url"]').setAttribute("content", location.href.split("#")[0]);

  /* ----- Catalog ----- */
  function flavorOptions(list) {
    return list.map((f) => `<option value="${f}">${f}</option>`).join("");
  }

  function addItem(item) {
    const found = cart.find((x) => x.id === item.id);
    if (found) {
      found.kg = Math.round((Number(found.kg) + Number(item.kg)) * 10) / 10;
      if (item.tara) found.tara = true;
      if (item.taraTable) found.taraTable = item.taraTable;
    } else cart.push(item);
    saveCart();
    toast("Додано в кошик");
  }

  function renderCart() {
    const list = $("#cartList");
    const count = $("#cartCount");
    const head = $("#cartHeadSum");
    const sum = cart.reduce((s, i) => s + payable(i), 0);
    if (cart.length) {
      count.hidden = false;
      count.textContent = String(cart.length);
      head.hidden = false;
      head.textContent = money(sum);
      $("#header").classList.add("has-sum");
    } else {
      count.hidden = true;
      head.hidden = true;
      head.textContent = "";
      $("#header").classList.remove("has-sum");
    }
    $("#cartSum").textContent = money(sum);

    if (!cart.length) {
      list.innerHTML = '<p class="empty">Кошик порожній</p>';
      return;
    }
    list.innerHTML = cart
      .map(
        (i, idx) => `
      <div class="cart-item">
        <div>
          <b>${i.title}</b>
          <small>${i.extra} · ${i.unit === "л" ? litersText(i.qty != null ? i.qty : i.kg) : (i.qty != null ? i.qty : i.kg)} ${i.unit || "кг"} × ${money(i.price)}${i.tara ? " · тара " + money(taraCost(i.qty != null ? i.qty : i.kg, i.taraTable)) : ""}</small>
        </div>
        <div style="text-align:right">
          <b>${money(payable(i))}</b>
          <div><button data-del="${idx}" style="color:#ff8a8a;font-size:12px;margin-top:6px">прибрати</button></div>
        </div>
      </div>`
      )
      .join("");
    list.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        cart.splice(+b.dataset.del, 1);
        saveCart();
      })
    );
  }

  $("#orderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!cart.length) return toast("Кошик порожній");
    const fd = new FormData(e.target);
    const type = fd.get("type");
    const sum = Math.round(cart.reduce((s, i) => s + payable(i), 0) * 100) / 100;
    if (type === "delivery" && sum < C.minOrder) {
      return toast("Мінімальне замовлення на доставку — " + C.minOrder + " грн");
    }
    const order = {
      createdAt: new Date().toISOString(),
      name: fd.get("name").trim(),
      phone: fd.get("phone").trim(),
      type,
      address: fd.get("address").trim(),
      comment: fd.get("comment").trim(),
      items: cart.map((i) => {
        if (!i.tara) return i;
        const tara = taraCost(i.qty != null ? i.qty : i.kg, i.taraTable);
        return Object.assign({}, i, { extra: i.extra + " · тара " + tara + " грн" });
      }),
      sum,
      status: "new",
    };

    const btn = $("#submitBtn");
    btn.disabled = true;
    btn.textContent = "Надсилаємо…";
    try {
      if (user && db) {
        try {
          order.uid = user.uid;
          order.createdAtIso = new Date().toISOString();
          await db.collection("orders").add(order);
          await db.collection("users").doc(user.uid).update({
            name: order.name,
            phone: order.phone,
            address: order.address || "",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
          profile = Object.assign({}, profile, { name: order.name, phone: order.phone, address: order.address || "" });
          paintAccount();
        } catch (err) {
          console.warn("order history", err);
        }
      }
      if (C.orderBotUrl) {
        const res = await fetch(String(C.orderBotUrl).replace(/\/$/, "") + "/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        });
        if (!res.ok) throw new Error("bot " + res.status);
      } else if (!user && db) {
        await db.collection("orders").add(order);
      } else if (!user) {
        const all = JSON.parse(localStorage.getItem("kv-orders") || "[]");
        all.push(order);
        localStorage.setItem("kv-orders", JSON.stringify(all));
      }
      cart = [];
      saveCart();
      e.target.reset();
      closeAll();
      toast(C.orderBotUrl || db ? "Замовлення прийнято" : "Замовлення збережено локально");
    } catch (err) {
      console.error(err);
      toast("Не вдалося надіслати. Зателефонуйте нам.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Оформити замовлення";
    }
  });
    const orderType = $("#orderForm [name=type]");
  const addressInput = $("#orderForm [name=address]");
  function syncAddress() {
    const pickup = orderType.value === "pickup";
    addressInput.hidden = pickup;
    addressInput.required = !pickup;
    if (pickup) addressInput.value = "";
  }
  orderType.addEventListener("change", syncAddress);
  syncAddress();

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function slug(value) {
    return String(value || "item").toLowerCase().replace(/\s+/g, "-");
  }
  function buildSeed() {
    const note = (id) => {
      const el = document.querySelector("#" + id + " .sec-head p");
      return el ? el.textContent.trim() : "";
    };
    const title = (id, fallback) => {
      const el = document.querySelector("#" + id + " .sec-head h2");
      return el ? el.textContent.trim() : fallback;
    };
    const sections = [
      {
        id: "krevetky",
        title: title("krevetky", "Креветки"),
        note: note("krevetky"),
        items: SHRIMP_FLAVORS.map((flavor) => ({
          id: "shrimp-" + flavor,
          kind: "shrimp",
          name: "Креветки",
          meta: flavor,
          price: SHRIMP_PRICE,
          unit: "кг",
          photo: SHRIMP_PHOTOS[flavor] || "",
        })).concat(SHRIMP_SAUCES.map((item) => ({
          id: item.id,
          kind: "shrimp",
          name: item.name,
          meta: "1 кг",
          price: item.price,
          unit: "кг",
          photo: item.photo,
        }))),
      },
      {
        id: "raky",
        title: title("raky", "Раки"),
        note: note("raky"),
        items: BROTHS.map((broth) => ({
          id: "craycard-" + slug(broth),
          kind: "cray",
          broth,
          name: "Раки",
          meta: broth,
          price: SIZES[0].price,
          unit: "кг",
          photo: BROTH_PHOTOS[broth] || "",
          sizes: SIZES.map((size) => Object.assign({}, size)),
        })),
      },
    ];
    ((window.KLESHNEVAR_CATALOG && window.KLESHNEVAR_CATALOG.sections) || []).forEach((section) => {
      sections.push(JSON.parse(JSON.stringify(section)));
    });
    ensureSauceShrimp(sections);
    return { sections };
  }
  function ensureSauceShrimp(sections) {
    const section = (sections || []).find((entry) => entry.id === "krevetky");
    if (!section) return;
    section.items = section.items || [];
    (sections || []).forEach((entry) => {
      (entry.items || []).forEach((item) => {
        if ((item.id === "shrimp-cream-sauce" || item.id === "shrimp-sauce-cream") && Number(item.price) === 900) item.price = 1199;
      });
    });
    SHRIMP_SAUCES.forEach((item) => {
      const found = section.items.find((entry) => entry.id === item.id);
      if (found) {
        if (Number(found.price) === 900) found.price = item.price;
        return;
      }
      section.items.push({
        id: item.id,
        kind: "shrimp",
        name: item.name,
        meta: "1 кг",
        price: item.price,
        unit: "кг",
        photo: item.photo,
      });
    });
  }
  function findItem(id) {
    for (const section of (live && live.sections) || []) {
      const found = (section.items || []).find((item) => item.id === id);
      if (found) return found;
    }
    return null;
  }
  function findSectionOf(id) {
    return ((live && live.sections) || []).find((section) => (section.items || []).some((item) => item.id === id)) || null;
  }
  function visibleItems(section) {
    return (section.items || []).filter((item) => !item.hidden || isAdmin);
  }
  function editTools(item) {
    if (editMode && isAdmin) {
      return `<div class="edit-tools">
        <button type="button" data-edit="${esc(item.id)}">Змінити</button>
        <button type="button" data-hide="${esc(item.id)}">${item.hidden ? "Показати" : "Сховати"}</button>
        <button type="button" data-delcard="${esc(item.id)}">Видалити</button>
      </div>`;
    }
    return item.hidden && isAdmin ? '<div class="hidden-flag">Приховано</div>' : "";
  }
  function wrapCard(item, inner) {
    const drag = editMode && isAdmin ? ' draggable="true"' : "";
    return `<article class="card${item.hidden ? " card-hidden" : ""}" data-id="${esc(item.id)}"${drag}>
      <div class="card-photo" style="background-image:url('${esc(item.photo || "")}')"></div>
      <div class="card-body">${inner}${editTools(item)}</div>
    </article>`;
  }
  function shrimpCard(item) {
    return wrapCard(item, `
      <div class="row-between">
        <h3>${esc(item.name || "Креветки")}</h3>
        <div class="price">${money(item.price)}/${esc(item.unit || "кг")}</div>
      </div>
      <p class="meta">${esc(item.meta || "")}</p>
      <div class="qty">
        <button type="button" data-step="-1">−</button>
        <span class="qty-val">1</span>
        <button type="button" data-step="1">+</button>
        <span class="meta">${esc(item.unit || "кг")}</span>
      </div>
      <button class="add-btn add-shrimp" type="button">Додати в кошик</button>`);
  }
  function crayCard(item) {
    const sizes = item.sizes && item.sizes.length ? item.sizes : SIZES;
    const opts = sizes.map((size) =>
      `<option value="${esc(size.id)}">${esc(size.label)} · ${esc(size.pcs || "")} · ${money(size.price)}/кг</option>`
    ).join("");
    return wrapCard(item, `
      <div class="row-between">
        <h3>${esc(item.name || "Раки")}</h3>
        <div class="price">${money(sizes[0].price)}/кг</div>
      </div>
      <p class="meta">${esc(item.meta || "")}</p>
      <select class="select size">${opts}</select>
      <div class="qty">
        <button type="button" data-step="-1">−</button>
        <span class="qty-val">1</span>
        <button type="button" data-step="1">+</button>
        <span class="meta">кг</span>
      </div>
      <button class="add-btn add-cray" type="button">Додати в кошик</button>`);
  }
  function catalogCard(item) {
    const drink = item.unit === "л" || item.kind === "drink";
    const qty = drink
      ? `<div class="qty qty-drink">
            <button type="button" data-step="-0.5">−</button>
            <span class="qty-val">0,5</span>
            <button type="button" data-step="0.5">+</button>
            <span class="meta">л</span>
            <span class="tara-note">${money(taraCost(0.5, item.taraPrices))}/тара</span>
          </div>`
      : `<div class="qty">
            <button type="button" data-step="-1">−</button>
            <span class="qty-val">1</span>
            <button type="button" data-step="1">+</button>
            <span class="meta">${esc(item.unit || "")}</span>
          </div>`;
    const half = drink ? `<div class="price price-half">${money(item.price / 2)} / 0,5 л</div>` : "";
    return wrapCard(item, `
          <h3>${esc(item.name)}</h3>
          <p class="meta">${esc(item.meta || "")}</p>
          ${half}
          <div class="price">${money(item.price)} / ${esc(item.unit || "")}</div>
          ${qty}
          <button class="add-btn add-extra" type="button">Додати в кошик</button>`);
  }
  function renderItem(item) {
    if (item.kind === "shrimp") return shrimpCard(item);
    if (item.kind === "cray") return crayCard(item);
    return catalogCard(item);
  }
  const GRID = {
    krevetky: "shrimpGrid",
    raky: "crayGrid",
    kuhnia: "kuhniaGrid",
    zhyvi: "zhyviGrid",
    zamorozka: "zamorozkaGrid",
    napoi: "napoiGrid",
  };
  function paintSection(section) {
    const sec = document.getElementById(section.id);
    if (sec) {
      const h2 = sec.querySelector(".sec-head h2");
      const note = sec.querySelector(".sec-head p");
      if (h2 && document.activeElement !== h2) h2.textContent = section.title || "";
      if (note && section.note && document.activeElement !== note) note.textContent = section.note;
      if (h2) {
        h2.dataset.section = section.id;
        h2.contentEditable = editMode && isAdmin ? "true" : "false";
        h2.classList.toggle("title-edit", !!(editMode && isAdmin));
      }
      sec.dataset.drop = section.id;
      ensureSectionHandle(sec, section);
    }
    const nav = document.querySelector('[data-nav="' + section.id + '"]');
    if (nav) nav.textContent = section.title || nav.textContent;
  }
  function ensureSectionHandle(sec, section) {
    const head = sec.querySelector(".sec-head");
    if (!head) return;
    let handle = head.querySelector(".section-handle");
    if (editMode && isAdmin) {
      if (!handle) {
        handle = document.createElement("button");
        handle.type = "button";
        handle.className = "section-handle";
        handle.textContent = "Перетягнути розділ";
        handle.draggable = true;
        head.insertBefore(handle, head.firstChild);
      }
      handle.hidden = false;
      handle.dataset.dragSection = section.id;
    } else if (handle) {
      handle.hidden = true;
    }
  }
  function orderSections() {
    const anchor = document.getElementById("dostavka");
    const main = anchor && anchor.parentElement;
    if (main && anchor) {
      (live.sections || []).forEach((section) => {
        const el = document.getElementById(section.id);
        if (el) main.insertBefore(el, anchor);
      });
    }
    const nav = document.querySelector("#menu nav");
    const delivery = nav && nav.querySelector('[data-scroll="dostavka"]');
    if (nav && delivery) {
      (live.sections || []).forEach((section) => {
        const link = nav.querySelector('[data-nav="' + section.id + '"]');
        if (link) nav.insertBefore(link, delivery);
      });
    }
  }
  function moveSection(id, beforeId) {
    if (!live || !id || !beforeId || id === beforeId || beforeId === "dostavka") return;
    const list = live.sections || [];
    const from = list.findIndex((section) => section.id === id);
    if (from < 0) return;
    const [moved] = list.splice(from, 1);
    const dest = list.findIndex((section) => section.id === beforeId);
    if (dest < 0) {
      list.splice(from, 0, moved);
      return;
    }
    list.splice(dest, 0, moved);
    renderMenu();
    scheduleSave();
  }
  function renderMenu() {
    if (!live) live = buildSeed();
    document.body.classList.toggle("is-editing", !!(editMode && isAdmin));
    orderSections();
    live.sections.forEach((section) => {
      paintSection(section);
      const items = visibleItems(section);
      if (section.grouped || section.id === "vitryna") {
        const root = document.getElementById("vitrynaRoot");
        if (!root) return;
        const order = [];
        const groups = {};
        items.forEach((item) => {
          const key = item.group || "Інше";
          if (!groups[key]) {
            groups[key] = [];
            order.push(key);
          }
          groups[key].push(item);
        });
        root.innerHTML = order.map((key) => `
          <div class="shop-block">
            <h3>${esc(key)}</h3>
            <div class="grid" data-drop="vitryna" data-group="${esc(key)}">${groups[key].map(renderItem).join("")}</div>
          </div>`).join("") || `<div class="grid" data-drop="vitryna" data-group="Інше"></div>`;
        return;
      }
      const grid = document.getElementById(GRID[section.id] || section.id + "Grid");
      if (grid) {
        grid.dataset.drop = section.id;
        grid.innerHTML = items.map(renderItem).join("");
      }
    });
  }
  function scheduleSave() {
    clearTimeout(scheduleSave.timer);
    scheduleSave.timer = setTimeout(saveLive, 350);
  }
  async function saveLive() {
    if (!db || !isAdmin) {
      toast("Зберегти може лише адміністратор");
      return false;
    }
    const sections = JSON.parse(JSON.stringify(live.sections || []));
    lastWrite = JSON.stringify(sections);
    try {
      await db.collection("catalog").doc("live").set({
        sections,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    } catch (err) {
      lastWrite = "";
      console.warn(err);
      toast("Не вдалося зберегти меню");
      return false;
    }
  }
  function moveItem(id, sectionId, group) {
    let moved = null;
    (live.sections || []).forEach((section) => {
      const index = (section.items || []).findIndex((item) => item.id === id);
      if (index >= 0) moved = section.items.splice(index, 1)[0];
    });
    const dest = (live.sections || []).find((section) => section.id === sectionId);
    if (!moved || !dest) return;
    if (group) moved.group = group;
    else if (sectionId !== "vitryna") delete moved.group;
    dest.items = dest.items || [];
    dest.items.push(moved);
    renderMenu();
    scheduleSave();
  }
  function authText(code) {
    const map = {
      "auth/email-already-in-use": "Цей email уже зареєстрований",
      "auth/invalid-email": "Некоректний email",
      "auth/wrong-password": "Невірний пароль",
      "auth/invalid-credential": "Невірний email або пароль",
      "auth/user-not-found": "Акаунт не знайдено",
      "auth/weak-password": "Пароль має бути від 6 символів",
      "auth/popup-closed-by-user": "Вікно Google закрито",
      "auth/operation-not-allowed": "Увімкніть цей спосіб входу в Firebase",
      "auth/unauthorized-domain": "Домен ще не дозволений у Firebase",
    };
    return map[code] || "Не вдалося виконати вхід";
  }
  async function ensureUser(person) {
    const ref = db.collection("users").doc(person.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        email: person.email || "",
        name: person.displayName || "",
        phone: "",
        address: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    profile = (await ref.get()).data() || {};
  }
  function paintAccount() {
    const btn = $("#accountBtn");
    if (btn) btn.textContent = user ? ((profile && profile.name) || "Профіль") : "Увійти";
    const link = $("#adminLink");
    if (link) link.hidden = !isAdmin;
    const bar = $("#editBar");
    if (bar) bar.hidden = !isAdmin;
    if (!isAdmin) editMode = false;
    document.body.classList.toggle("is-editing", !!(editMode && isAdmin));
  }
  function fillCheckout() {
    const form = $("#orderForm");
    if (!form || !profile) return;
    if (profile.name && !form.name.value) form.name.value = profile.name;
    if (profile.phone && !form.phone.value) form.phone.value = profile.phone;
    if (profile.address && !form.address.value) form.address.value = profile.address;
  }
  async function onUser(person) {
    user = person;
    isAdmin = false;
    profile = null;
    if (person && db) {
      try {
        await ensureUser(person);
        const adminDoc = await db.collection("admins").doc(person.uid).get();
        isAdmin = adminDoc.exists;
      } catch (err) {
        console.warn(err);
      }
    }
    paintAccount();
    fillCheckout();
    renderMenu();
  }
  async function loadOrders() {
    const box = $("#orderHistory");
    if (!box) return;
    if (!user || !db) {
      box.innerHTML = '<p class="meta">Увійдіть, щоб бачити замовлення.</p>';
      return;
    }
    const snap = await db.collection("orders").where("uid", "==", user.uid).get();
    const rows = snap.docs.map((doc) => doc.data()).sort((a, b) => String(b.createdAtIso || "").localeCompare(String(a.createdAtIso || "")));
    if (!rows.length) {
      box.innerHTML = '<p class="meta">Поки немає замовлень.</p>';
      return;
    }
    box.innerHTML = rows.map((order) => {
      const when = order.createdAtIso ? new Date(order.createdAtIso).toLocaleString("uk-UA") : "";
      const items = (order.items || []).map((item) => esc(item.title) + " · " + esc(item.kg) + " " + esc(item.unit || "")).join("<br>");
      return `<div class="order-row"><b>${esc(when)} · ${money(order.sum)}</b><div class="meta">${items}</div></div>`;
    }).join("");
  }
  function openAuth() {
    $("#authError").textContent = "";
    $("#authModal").hidden = false;
  }
  function closeAuth() { $("#authModal").hidden = true; }
  async function openProfile() {
    if (!user) return openAuth();
    const form = $("#profileForm");
    form.name.value = (profile && profile.name) || "";
    form.phone.value = (profile && profile.phone) || "";
    form.address.value = (profile && profile.address) || "";
    $("#profileModal").hidden = false;
    try { await loadOrders(); } catch (err) { console.warn(err); }
  }
  function fillUnits(current) {
    const units = ["шт", "кг", "г", "л"];
    if (current && units.indexOf(current) < 0) units.push(current);
    const form = $("#editForm");
    form.unit.innerHTML = units.map((unit) => `<option value="${esc(unit)}"${unit === current ? " selected" : ""}>${esc(unit)}</option>`).join("");
  }
  function fillSections(selected) {
    const sel = $("#cardSection");
    sel.innerHTML = ((live && live.sections) || []).map((section) =>
      `<option value="${esc(section.id)}"${section.id === selected ? " selected" : ""}>${esc(section.title || section.id)}</option>`
    ).join("");
  }
  function defaultTara() {
    return [0.5, 1, 1.5, 2].map((liters) => ({ liters, price: taraCost(liters) }));
  }
  function taraLine(liters, price) {
    return `<div class="tara-line"><input data-liters type="number" min="0.1" step="0.1" value="${Number(liters)}" aria-label="Літраж"><input data-tara type="number" min="0" step="0.01" value="${Number(price)}" aria-label="Ціна тари"><button type="button" data-remove-row aria-label="Прибрати">×</button></div>`;
  }
  function sizeLine(size) {
    return `<div class="size-line" data-size-id="${esc(size.id || "")}"><input data-size-label value="${esc(size.label || "")}" placeholder="Розмір" aria-label="Розмір"><input data-size-pcs value="${esc(size.pcs || "")}" placeholder="Шт/кг" aria-label="Кількість"><input data-size-price type="number" min="0" step="0.01" value="${size.price != null ? size.price : ""}" placeholder="Ціна" aria-label="Ціна за кг"><button type="button" data-remove-row aria-label="Прибрати">×</button></div>`;
  }
  function readTaraRows(root) {
    return [...root.querySelectorAll(".tara-line")].map((row) => ({
      liters: Number(String(row.querySelector("[data-liters]").value).replace(",", ".")),
      price: Number(String(row.querySelector("[data-tara]").value).replace(",", ".")),
    })).filter((row) => row.liters > 0 && Number.isFinite(row.price));
  }
  function readSizeRows(root) {
    return [...root.querySelectorAll(".size-line")].map((row, index) => {
      const label = row.querySelector("[data-size-label]").value.trim();
      return {
        id: row.dataset.sizeId || label.replace(/\s+/g, "") || ("s" + index),
        label: label || ("S" + (index + 1)),
        pcs: row.querySelector("[data-size-pcs]").value.trim(),
        price: Number(String(row.querySelector("[data-size-price]").value).replace(",", ".")) || 0,
      };
    }).filter((size) => size.label);
  }
  function cardKindOf(item) {
    if (item.kind === "cray") return "cray";
    if (item.kind === "drink" || item.unit === "л") return "drink";
    return "plain";
  }
  function syncKindPanels() {
    const form = $("#editForm");
    const kind = form.kind.value;
    $("#editTara").hidden = kind !== "drink";
    $("#editSizes").hidden = kind !== "cray";
    $("#addSizeRow").hidden = kind !== "cray";
    if (kind === "drink") {
      form.unit.value = "л";
      if (!$("#taraRows").children.length) {
        $("#taraRows").innerHTML = defaultTara().map((row) => taraLine(row.liters, row.price)).join("");
      }
    }
    if (kind === "cray") {
      form.unit.value = "кг";
      if (!$("#editSizes").children.length) {
        $("#editSizes").innerHTML = SIZES.map((size) => sizeLine(size)).join("");
      }
      if (!form.price.value) form.price.value = String(SIZES[0].price);
    }
  }
  function paintPreview(url) {
    $("#editPreview").style.backgroundImage = url ? "url('" + String(url).replace(/'/g, "") + "')" : "";
  }
  function placeItem(item, sectionId) {
    const current = findSectionOf(item.id);
    const dest = ((live && live.sections) || []).find((section) => section.id === sectionId) || ((live && live.sections) || [])[0];
    if (!dest) return;
    if (current && current.id === sectionId) {
      if ((dest.grouped || dest.id === "vitryna") && !item.group) item.group = "Інше";
      return;
    }
    if (current) current.items = current.items.filter((entry) => entry.id !== item.id);
    if (dest.grouped || dest.id === "vitryna") {
      if (!item.group) item.group = "Інше";
    } else {
      delete item.group;
    }
    dest.items = dest.items || [];
    dest.items.push(item);
  }
  function openNewCard() {
    if (!isAdmin) return;
    if (!live) live = buildSeed();
    editingId = null;
    const form = $("#editForm");
    form.reset();
    $("#editTitle").textContent = "Нова картка";
    fillUnits("шт");
    fillSections(((live.sections || [])[0] || {}).id || "");
    form.kind.value = "plain";
    $("#taraRows").innerHTML = "";
    $("#editSizes").innerHTML = "";
    paintPreview("");
    syncKindPanels();
    $("#editModal").hidden = false;
  }
  function openEdit(id) {
    const item = findItem(id);
    if (!item) return;
    editingId = id;
    const form = $("#editForm");
    $("#editTitle").textContent = "Картка товару";
    form.name.value = item.name || "";
    form.price.value = item.price != null ? item.price : "";
    form.meta.value = item.meta || "";
    form.photo.value = item.photo || "";
    form.file.value = "";
    fillUnits(item.unit || "шт");
    fillSections((findSectionOf(id) || {}).id || "");
    form.kind.value = cardKindOf(item);
    const tara = item.taraPrices && item.taraPrices.length ? item.taraPrices : defaultTara();
    $("#taraRows").innerHTML = tara.map((row) => taraLine(row.liters, row.price)).join("");
    const sizes = item.sizes && item.sizes.length ? item.sizes : SIZES.map((size) => Object.assign({}, size));
    $("#editSizes").innerHTML = sizes.map((size) => sizeLine(size)).join("");
    paintPreview(item.photo || "");
    syncKindPanels();
    $("#editModal").hidden = false;
  }

  document.addEventListener("click", (e) => {
    const stepBtn = e.target.closest(".qty [data-step]");
    if (stepBtn) {
      const qtyBox = stepBtn.closest(".qty");
      const valEl = qtyBox.querySelector(".qty-val");
      const drink = qtyBox.classList.contains("qty-drink");
      const current = parseQty(valEl.textContent);
      const rawStep = +stepBtn.dataset.step;
      const step = drink ? rawStep : Math.sign(rawStep) || 1;
      const min = drink ? 0.5 : 1;
      let next = Math.round((current + step) * 10) / 10;
      if (next < min) next = min;
      if (!drink) next = Math.round(next);
      valEl.textContent = drink ? litersText(next) : String(next);
      if (drink) {
        const card = qtyBox.closest(".card");
        const item = card ? findItem(card.dataset.id) : null;
        const note = qtyBox.querySelector(".tara-note");
        if (note) note.textContent = money(taraCost(next, item && item.taraPrices)) + "/тара";
      }
      return;
    }
    const shrimp = e.target.closest(".add-shrimp");
    if (shrimp) {
      const card = shrimp.closest(".card");
      const item = findItem(card.dataset.id);
      if (!item) return;
      const kg = Math.max(1, Math.round(parseQty(card.querySelector(".qty-val").textContent)));
      addItem({ id: item.id, title: item.name || "Креветки", extra: item.meta || "", kg, price: item.price, unit: item.unit || "кг" });
      return;
    }
    const cray = e.target.closest(".add-cray");
    if (cray) {
      const card = cray.closest(".card");
      const item = findItem(card.dataset.id);
      if (!item) return;
      const sizes = item.sizes && item.sizes.length ? item.sizes : SIZES;
      const size = sizes.find((entry) => entry.id === card.querySelector(".size").value) || sizes[0];
      const kg = Math.max(1, Math.round(parseQty(card.querySelector(".qty-val").textContent)));
      addItem({
        id: "cray-" + size.id + "-" + (item.broth || item.id),
        title: (item.name || "Раки") + " " + size.label,
        extra: item.meta || item.broth || "",
        kg,
        price: size.price,
        unit: "кг",
      });
      return;
    }
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) { openEdit(editBtn.dataset.edit); return; }
    const hideBtn = e.target.closest("[data-hide]");
    if (hideBtn) {
      const item = findItem(hideBtn.dataset.hide);
      if (!item) return;
      item.hidden = !item.hidden;
      renderMenu();
      scheduleSave();
      return;
    }
    const delBtn = e.target.closest("[data-delcard]");
    if (delBtn) {
      const item = findItem(delBtn.dataset.delcard);
      if (!item || !confirm("Видалити картку «" + (item.name || "") + "»?")) return;
      const section = findSectionOf(item.id);
      if (section) section.items = section.items.filter((entry) => entry.id !== item.id);
      renderMenu();
      scheduleSave();
    }
  });
  document.addEventListener("change", (e) => {
    const sel = e.target.closest(".size");
    if (!sel) return;
    const card = sel.closest(".card");
    const item = findItem(card.dataset.id);
    const sizes = (item && item.sizes) || SIZES;
    const size = sizes.find((entry) => entry.id === sel.value) || sizes[0];
    const price = card.querySelector(".price");
    if (price && size) price.textContent = money(size.price) + "/кг";
  });
  document.addEventListener("dragstart", (e) => {
    const handle = e.target.closest(".section-handle");
    if (handle && editMode && isAdmin) {
      draggingSectionId = handle.dataset.dragSection || "";
      e.dataTransfer.setData("text/plain", "section:" + draggingSectionId);
      e.dataTransfer.effectAllowed = "move";
      return;
    }
    draggingSectionId = "";
    const card = e.target.closest(".card[data-id]");
    if (!editMode || !isAdmin || !card || e.target.closest("button,select,input,a")) {
      if (e.target.closest("button,select,input,a")) e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", card.dataset.id);
    e.dataTransfer.effectAllowed = "move";
  });
  document.addEventListener("dragend", () => {
    draggingSectionId = "";
    document.querySelectorAll(".section-over").forEach((el) => el.classList.remove("section-over"));
  });
  document.addEventListener("dragover", (e) => {
    if (!editMode || !isAdmin) return;
    if (draggingSectionId) {
      const target = e.target.closest("main > section[id]");
      if (!target || target.id === "dostavka") return;
      e.preventDefault();
      document.querySelectorAll(".section-over").forEach((el) => el.classList.remove("section-over"));
      if (target.id !== draggingSectionId) target.classList.add("section-over");
      return;
    }
    if (e.target.closest("[data-drop]")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    if (!editMode || !isAdmin) return;
    if (draggingSectionId) {
      const target = e.target.closest("main > section[id]");
      e.preventDefault();
      const id = draggingSectionId;
      draggingSectionId = "";
      document.querySelectorAll(".section-over").forEach((el) => el.classList.remove("section-over"));
      if (target && target.id !== "dostavka") moveSection(id, target.id);
      return;
    }
    const zone = e.target.closest("[data-drop]");
    if (!zone) return;
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id && id.indexOf("section:") !== 0) moveItem(id, zone.dataset.drop, zone.dataset.group || "");
  });
  document.addEventListener("focusout", (e) => {
    const h2 = e.target.closest && e.target.closest(".sec-head h2[data-section]");
    if (!h2 || !editMode || !isAdmin) return;
    const section = (live.sections || []).find((entry) => entry.id === h2.dataset.section);
    const title = h2.textContent.trim();
    if (!section || !title || title === section.title) return;
    section.title = title;
    const nav = document.querySelector('[data-nav="' + section.id + '"]');
    if (nav) nav.textContent = title;
    scheduleSave();
  });

  $("#accountBtn").addEventListener("click", () => user ? openProfile() : openAuth());
  $("#closeAuth").addEventListener("click", closeAuth);
  $("#closeProfile").addEventListener("click", () => { $("#profileModal").hidden = true; });
  $("#closeEdit").addEventListener("click", () => { $("#editModal").hidden = true; });
  $("#toggleAuth").addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    $("#authTitle").textContent = authMode === "login" ? "Вхід" : "Реєстрація";
    $("#authSubmit").textContent = authMode === "login" ? "Увійти" : "Створити акаунт";
    $("#toggleAuth").textContent = authMode === "login" ? "Немає акаунта? Зареєструватися" : "Вже є акаунт? Увійти";
  });
  $("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    $("#authError").textContent = "";
    try {
      if (authMode === "register") await auth.createUserWithEmailAndPassword(email, password);
      else await auth.signInWithEmailAndPassword(email, password);
      closeAuth();
    } catch (err) {
      $("#authError").textContent = authText(err && err.code);
    }
  });
  $("#googleBtn").addEventListener("click", async () => {
    try {
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      closeAuth();
    } catch (err) {
      $("#authError").textContent = authText(err && err.code);
    }
  });
  $("#resetPass").addEventListener("click", async () => {
    const email = $("#authForm [name=email]").value.trim();
    if (!email) { $("#authError").textContent = "Вкажіть email"; return; }
    try {
      await auth.sendPasswordResetEmail(email);
      $("#authError").textContent = "Лист для нового пароля надіслано";
    } catch (err) {
      $("#authError").textContent = authText(err && err.code);
    }
  });
  $("#profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    const next = {
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    try {
      await db.collection("users").doc(user.uid).update(next);
      profile = Object.assign({}, profile, next);
      fillCheckout();
      paintAccount();
      toast("Профіль збережено");
    } catch (err) {
      console.warn(err);
      toast("Не вдалося зберегти профіль");
    }
  });
  $("#logoutBtn").addEventListener("click", () => auth.signOut());
  $("#editToggle").addEventListener("click", () => {
    editMode = !editMode;
    $("#editToggle").textContent = editMode ? "Готово" : "Редагування";
    renderMenu();
  });
  $("#addCardBtn").addEventListener("click", openNewCard);
  $("#cardKind").addEventListener("change", syncKindPanels);
  $("#addTaraRow").addEventListener("click", () => {
    $("#taraRows").insertAdjacentHTML("beforeend", taraLine(0.5, taraCost(0.5)));
  });
  $("#addSizeRow").addEventListener("click", () => {
    $("#editSizes").insertAdjacentHTML("beforeend", sizeLine({ id: "s" + Date.now(), label: "", pcs: "", price: "" }));
  });
  $("#editModal").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-row]");
    if (!btn) return;
    const row = btn.closest(".tara-line, .size-line");
    if (row) row.remove();
  });
  $("#editForm [name=photo]").addEventListener("input", () => {
    paintPreview($("#editForm").photo.value.trim());
  });
  $("#editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!live) live = buildSeed();
    const fd = new FormData(e.target);
    const kindPick = String(fd.get("kind") || "plain");
    const sectionId = String(fd.get("section") || "");
    let item = editingId ? findItem(editingId) : null;
    const creating = !item;
    if (creating) item = { id: "item-" + Date.now() };
    item.name = String(fd.get("name") || "").trim();
    item.price = Number(fd.get("price"));
    item.unit = String(fd.get("unit") || "");
    item.meta = String(fd.get("meta") || "").trim();
    const photo = String(fd.get("photo") || "").trim();
    if (photo) item.photo = photo;
    if (kindPick === "drink") {
      item.kind = "drink";
      item.unit = "л";
      item.taraPrices = readTaraRows($("#taraRows"));
      delete item.sizes;
    } else if (kindPick === "cray") {
      item.kind = "cray";
      item.unit = "кг";
      item.sizes = readSizeRows($("#editSizes"));
      if (!item.sizes.length) item.sizes = SIZES.map((size) => Object.assign({}, size));
      if (item.sizes[0]) item.price = item.sizes[0].price;
      delete item.taraPrices;
    } else if (item.kind === "drink" || item.kind === "cray") {
      delete item.kind;
      delete item.taraPrices;
      delete item.sizes;
    }
    const file = e.target.file.files && e.target.file.files[0];
    try {
      if (file) {
        const ext = ((file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")) || "jpg";
        const ref = storage.ref().child("product-photos/" + item.id + "-" + Date.now() + "." + ext);
        await ref.put(file, { contentType: file.type || "image/jpeg" });
        item.photo = await ref.getDownloadURL();
      }
      placeItem(item, sectionId);
      editingId = item.id;
      renderMenu();
      const saved = await saveLive();
      if (!saved) return;
      $("#editModal").hidden = true;
      toast(creating ? "Картку додано" : "Картку збережено");
    } catch (err) {
      console.warn(err);
      toast("Не вдалося зберегти картку");
    }
  });


  document.addEventListener("click", (e) => {
    const add = e.target.closest(".add-extra");
    if (!add) return;
    const card = add.closest(".card");
    const item = findItem(card.dataset.id);
    if (!item) return;
    const drink = card.querySelector(".qty-drink");
    const raw = parseQty(card.querySelector(".qty-val").textContent);
    const qty = drink ? Math.max(0.5, Math.round(raw * 2) / 2) : Math.max(1, Math.round(raw));
    addItem({
      id: item.id,
      title: item.name,
      extra: item.meta,
      kg: qty,
      unit: item.unit,
      price: item.price,
      tara: drink ? true : undefined,
      taraTable: drink && item.taraPrices && item.taraPrices.length ? item.taraPrices : undefined,
    });
  });

  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "_", "0", "Add", "Subtract"].indexOf(e.key) >= 0) e.preventDefault();
  });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  live = buildSeed();
  renderMenu();
  initFirebase();
  renderCart();
})();
