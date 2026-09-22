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
  const BROTHS = ["BBQ", "Вершкові", "Класика", "Томатний", "Пікантний / HOT"];
  const BROTH_PHOTOS = {
    BBQ: "assets/cray-bbq.jpg",
    "Вершкові": "assets/cray-cream.jpg",
    "Класика": "assets/cray-classic.jpg",
    "Томатний": "assets/cray-tomato.jpg",
    "Пікантний / HOT": "assets/cray-hot.jpg",
  };
  const SIZES = [
    { id: "M", label: "M", price: 1300, pcs: "30–35 шт/кг" },
    { id: "L", label: "L", price: 1750, pcs: "23–25 шт/кг" },
    { id: "XL", label: "XL", price: 2300, pcs: "15–18 шт/кг" },
    { id: "XXL", label: "XXL", price: 2800, pcs: "10–14 шт/кг" },
  ];

  let cart = JSON.parse(localStorage.getItem("kv-cart") || "[]");
  let db = null;

  function money(n) {
    return new Intl.NumberFormat("uk-UA").format(n) + " грн";
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
    if (!f.apiKey || !f.projectId) return;
    try {
      firebase.initializeApp(f);
      db = firebase.firestore();
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

  $("#shrimpGrid").innerHTML = SHRIMP_FLAVORS.map(
    (f) => `
    <article class="card" data-shrimp="${f}">
      <div class="card-photo" style="background-image:url('${SHRIMP_PHOTOS[f]}')"></div>
      <div class="card-body">
        <div class="row-between">
          <h3>Креветки</h3>
          <div class="price">999 грн/кг</div>
        </div>
        <p class="meta">${f}</p>
        <div class="qty">
          <button type="button" data-step="-1">−</button>
          <span class="qty-val">1</span>
          <button type="button" data-step="1">+</button>
          <span class="meta">кг</span>
        </div>
        <button class="add-btn add-shrimp">Додати в кошик</button>
      </div>
    </article>`
  ).join("");

  function sizeOptions() {
    return SIZES.map(
      (s) => `<option value="${s.id}">${s.label} · ${s.pcs} · ${money(s.price)}/кг</option>`
    ).join("");
  }

  $("#crayGrid").innerHTML = BROTHS.map(
    (b) => `
    <article class="card" data-broth="${b}">
      <div class="card-photo" style="background-image:url('${BROTH_PHOTOS[b]}')"></div>
      <div class="card-body">
        <div class="row-between">
          <h3>Раки</h3>
          <div class="price">${money(SIZES[0].price)}/кг</div>
        </div>
        <p class="meta">${b}</p>
        <select class="select size">${sizeOptions()}</select>
        <div class="qty">
          <button type="button" data-step="-1">−</button>
          <span class="qty-val">1</span>
          <button type="button" data-step="1">+</button>
          <span class="meta">кг</span>
        </div>
        <button class="add-btn add-cray">Додати в кошик</button>
      </div>
    </article>`
  ).join("");


  document.addEventListener("click", (e) => {
    const stepBtn = e.target.closest(".qty [data-step]");
    if (stepBtn) {
      const valEl = stepBtn.parentElement.querySelector(".qty-val");
      const next = Math.max(1, Math.round((+valEl.textContent || 1) + +stepBtn.dataset.step));
      valEl.textContent = String(next);
    }
  });

  $$(".add-shrimp").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const flavor = card.dataset.shrimp;
      const kg = Math.max(1, Math.round(+card.querySelector(".qty-val").textContent || 1));
      addItem({
        id: "shrimp-" + flavor,
        title: "Креветки",
        extra: flavor,
        kg,
        price: 999,
      });
    });
  });

  $$("#crayGrid .size").forEach((sel) => {
    sel.addEventListener("change", () => {
      const size = SIZES.find((s) => s.id === sel.value) || SIZES[0];
      sel.closest(".card").querySelector(".price").textContent = money(size.price) + "/кг";
    });
  });

  $$(".add-cray").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const broth = card.dataset.broth;
      const size = SIZES.find((s) => s.id === card.querySelector(".size").value) || SIZES[0];
      const kg = Math.max(1, Math.round(+card.querySelector(".qty-val").textContent || 1));
      addItem({
        id: "cray-" + size.id + "-" + broth,
        title: "Раки " + size.label,
        extra: broth,
        kg,
        price: size.price,
      });
    });
  });

  function addItem(item) {
    const found = cart.find((x) => x.id === item.id);
    if (found) found.kg = found.kg + item.kg;
    else cart.push(item);
    saveCart();
    toast("Додано в кошик");
  }

  function renderCart() {
    const list = $("#cartList");
    const n = cart.reduce((s, i) => s + i.kg, 0);
    const count = $("#cartCount");
    if (cart.length) {
      count.hidden = false;
      count.textContent = cart.length;
    } else count.hidden = true;

    if (!cart.length) {
      list.innerHTML = '<p class="empty">Кошик порожній</p>';
      $("#cartSum").textContent = money(0);
      return;
    }
    list.innerHTML = cart
      .map(
        (i, idx) => `
      <div class="cart-item">
        <div>
          <b>${i.title}</b>
          <small>${i.extra} · ${i.kg} кг × ${money(i.price)}</small>
        </div>
        <div style="text-align:right">
          <b>${money(Math.round(i.kg * i.price))}</b>
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
    const sum = cart.reduce((s, i) => s + i.kg * i.price, 0);
    $("#cartSum").textContent = money(Math.round(sum));
  }

  $("#orderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!cart.length) return toast("Кошик порожній");
    const fd = new FormData(e.target);
    const type = fd.get("type");
    const sum = Math.round(cart.reduce((s, i) => s + i.kg * i.price, 0));
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
      items: cart,
      sum,
      status: "new",
    };

    const btn = $("#submitBtn");
    btn.disabled = true;
    btn.textContent = "Надсилаємо…";
    try {
      if (db) {
        await db.collection("orders").add(order);
      } else {
        const all = JSON.parse(localStorage.getItem("kv-orders") || "[]");
        all.push(order);
        localStorage.setItem("kv-orders", JSON.stringify(all));
        console.log("ORDER (локально, підключіть Firebase):", order);
      }
      cart = [];
      saveCart();
      e.target.reset();
      closeAll();
      toast(db ? "Замовлення прийнято" : "Замовлення збережено локально (Firebase ще не підключено)");
    } catch (err) {
      console.error(err);
      toast("Не вдалося надіслати. Зателефонуйте нам.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Оформити замовлення";
    }
  });

  initFirebase();
  renderCart();
})();
