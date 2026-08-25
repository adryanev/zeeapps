export const SERVICE_WORKER_VERSION = "1";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) {
    return undefined;
  }

  try {
    const controllerReady = waitForController();
    const registration = await navigator.serviceWorker.register(
      `/service-worker.js?v=${SERVICE_WORKER_VERSION}`,
      { scope: "/" },
    );
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await controllerReady;
    }
    return registration;
  } catch {
    return undefined;
  }
}

function waitForController(): Promise<void> {
  if (navigator.serviceWorker.controller) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    let pollTimer: number;
    let timeoutTimer: number;

    const handleControllerChange = (): void => {
      settle();
    };

    const settle = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      resolve();
    };

    pollTimer = window.setInterval(() => {
      if (navigator.serviceWorker.controller) {
        settle();
      }
    }, 25);
    timeoutTimer = window.setTimeout(settle, 2_000);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    if (navigator.serviceWorker.controller) {
      settle();
    }
  });
}
