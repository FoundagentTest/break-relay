import { useEffect, useRef, useState } from "react";

export default function ServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshRequested = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let reloading = false;

    function watch(registration: ServiceWorkerRegistration) {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setWaiting(registration.waiting);
          }
        });
      });
    }

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(watch)
      .catch(() => {
        // The app remains usable online if service workers are unavailable.
      });

    function reloadOnUpdate() {
      if (!refreshRequested.current || reloading) return;
      reloading = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnUpdate);
    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        reloadOnUpdate,
      );
  }, []);

  if (!waiting) return null;

  return (
    <div className="update-toast" role="status">
      <div>
        <strong>A calmer update is ready.</strong>
        <span>Your active relay is saved before the app refreshes.</span>
      </div>
      <button
        onClick={() => {
          refreshRequested.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
        type="button"
      >
        Update now
      </button>
    </div>
  );
}
