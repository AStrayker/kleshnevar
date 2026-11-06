(function () {
  function pageName() {
    const last = location.pathname.split("/").filter(Boolean).pop() || "index.html";
    return last.split("?")[0];
  }
  function finish() {
    if (typeof window.KV_TRACK_THEN === "function") window.KV_TRACK_THEN();
  }
  async function run() {
    const secrets = (window.KLESHNEVAR_SECRETS && window.KLESHNEVAR_SECRETS.firebase) || {};
    if (!secrets.apiKey || !window.firebase || !firebase.firestore) {
      finish();
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(secrets);
      const db = firebase.firestore();
      const path = pageName();
      const key = "kv-visit-" + path;
      if (!sessionStorage.getItem(key)) {
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Kyiv",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const ref = db.collection("statsDays").doc(day);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const counts = Object.assign({}, (snap.exists && snap.data().counts) || {});
          counts[path] = (counts[path] || 0) + 1;
          tx.set(ref, { counts: counts });
        });
        sessionStorage.setItem(key, "1");
      }
    } catch (err) {
      console.warn("visit", err);
    }
    finish();
  }
  run();
})();
