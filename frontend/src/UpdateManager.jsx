import { AnimatePresence, motion as Motion } from "framer-motion";
import { Bug, Sparkles, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import "./UpdateManager.css";
import { APP_VERSION } from "./version.js";

const ICON = { fix: Bug, feature: Sparkles, improve: Wrench };
const LABEL = { fix: "Fixed", feature: "New", improve: "Better" };

const cmp = (a, b) => {
  const x = String(a).split(".").map(Number);
  const y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
};

async function loadNotes() {
  try {
    const r = await fetch(`/release-notes.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.releases || []).slice().sort((a, b) => cmp(b.version, a.version));
  } catch {
    return [];
  }
}

function Notes({ releases }) {
  return releases.map((release) => (
    <div key={release.version} className="um-rel">
      <div className="um-rel-head">
        <b>{release.title || `Version ${release.version}`}</b>
        <span>v{release.version}</span>
      </div>
      {(release.items || []).map((item, index) => {
        const Icon = ICON[item.type] || Sparkles;
        return (
          <div key={`${release.version}-${index}`} className={`um-item ${item.type}`}>
            <Icon size={14} />
            <span><em>{LABEL[item.type] || "New"}</em> {item.text}</span>
          </div>
        );
      })}
    </div>
  ));
}

export default function UpdateManager({ paused = false, onUpdateState, actionsRef }) {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  const [incoming, setIncoming] = useState([]);
  const [whatsNew, setWhatsNew] = useState([]);
  // Dev-only: open the app with ?simulateUpdate to preview the update UI without a real update.
  const simulateUpdate = import.meta.env.DEV && new URLSearchParams(window.location.search).has("simulateUpdate");
  const updateReady = needRefresh || simulateUpdate;

  useEffect(() => {
    if (!updateReady) return;
    loadNotes().then((all) => setIncoming(simulateUpdate ? all.slice(0, 1) : all.filter((release) => cmp(release.version, APP_VERSION) > 0)));
  }, [updateReady, simulateUpdate]);

  useEffect(() => {
    onUpdateState?.({ available: updateReady, releases: incoming });
  }, [updateReady, incoming, onUpdateState]);

  useEffect(() => {
    const openUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker?.getRegistration?.();
        if (!registration) return;
        if (registration.waiting) {
          await updateServiceWorker(true);
          return;
        }
        await registration.update();
        if (registration.waiting) await updateServiceWorker(true);
      } catch { /* the regular update check will retry when the app is visible */ }
    };
    window.addEventListener("app:open-update", openUpdate);
    return () => window.removeEventListener("app:open-update", openUpdate);
  }, [updateServiceWorker]);

  useEffect(() => {
    if (!actionsRef) return undefined;
    const actions = {
      async checkForUpdates() {
        const registration = await navigator.serviceWorker?.getRegistration?.();
        if (!registration) return false;
        if (registration.waiting) return true;
        let updateFound = false;
        const onUpdateFound = () => { updateFound = true; };
        registration.addEventListener("updatefound", onUpdateFound, { once: true });
        try {
          await registration.update();
        } finally {
          registration.removeEventListener("updatefound", onUpdateFound);
        }
        return Boolean(updateFound || registration.waiting || registration.installing);
      },
      applyUpdate: () => updateServiceWorker(true),
    };
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [actionsRef, updateServiceWorker]);

  useEffect(() => {
    let prior = null;
    try {
      prior = localStorage.getItem("rc_last_version");
      localStorage.setItem("rc_last_version", APP_VERSION);
    } catch {
      // ignore storage issues
    }
    if (prior && prior !== APP_VERSION) {
      loadNotes().then((all) => setWhatsNew(all.filter((release) => cmp(release.version, prior) > 0 && cmp(release.version, APP_VERSION) <= 0)));
    }
  }, []);

  return (
    <>
      <AnimatePresence>
        {whatsNew.length > 0 && !paused && (
          <Motion.div className="um-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Motion.div className="um-modal" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}>
              <div className="um-title big"><Sparkles size={18} /> What&apos;s new</div>
              <div className="um-scroll"><Notes releases={whatsNew} /></div>
              <button className="um-primary full" onClick={() => setWhatsNew([])}>Got it</button>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
