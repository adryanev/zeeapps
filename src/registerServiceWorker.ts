export const SERVICE_WORKER_VERSION = __DUNIA_ZEE_BUILD_VERSION__;

const SERVICE_WORKER_READY_TIMEOUT_MS = 5_000;

export type ServiceWorkerStatus =
  | { supported: false; registration?: undefined; error?: undefined }
  | { supported: true; registration: ServiceWorkerRegistration; error?: undefined }
  | { supported: true; registration?: ServiceWorkerRegistration; error: Error };

export async function registerServiceWorker(): Promise<ServiceWorkerStatus> {
  if (!("serviceWorker" in navigator)) {
    return { supported: false };
  }

  try {
    const registration = await withTimeout(
      navigator.serviceWorker.register(`/service-worker.js?v=${SERVICE_WORKER_VERSION}`, {
        scope: "/",
      }),
      SERVICE_WORKER_READY_TIMEOUT_MS,
      "Service-worker registration timed out.",
    );
    await withTimeout(
      navigator.serviceWorker.ready,
      SERVICE_WORKER_READY_TIMEOUT_MS,
      "Service-worker readiness timed out.",
    );
    if (!navigator.serviceWorker.controller) {
      await waitForController();
    }
    return { supported: true, registration };
  } catch (error) {
    return { supported: true, error: toError(error) };
  }
}

function waitForController(): Promise<void> {
  if (navigator.serviceWorker.controller) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let pollTimer: number | undefined;
    let timeoutTimer: number | undefined;

    const settle = (error?: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer);
      }
      if (timeoutTimer !== undefined) {
        window.clearTimeout(timeoutTimer);
      }
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const handleControllerChange = (): void => {
      settle();
    };

    pollTimer = window.setInterval(() => {
      if (navigator.serviceWorker.controller) {
        settle();
      }
    }, 25);
    timeoutTimer = window.setTimeout(
      () => settle(new Error("Service-worker controller change timed out.")),
      SERVICE_WORKER_READY_TIMEOUT_MS,
    );
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    if (navigator.serviceWorker.controller) {
      settle();
    }
  });
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutTimer = window.setTimeout(() => {
      settled = true;
      reject(new Error(message));
    }, timeoutMs);

    void promise.then(
      (value) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutTimer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutTimer);
        reject(error);
      },
    );
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
