const DEFAULT_PLAYWRIGHT_PORT = 4173;
const MIN_PLAYWRIGHT_PORT = 1;
const MAX_PLAYWRIGHT_PORT = 65_535;
const PORT_ERROR_MESSAGE = "PLAYWRIGHT_PORT must be an integer between 1 and 65535";

export function parsePlaywrightPort(rawPort: string | undefined): number {
  const normalizedPort = rawPort?.trim() ?? "";

  if (normalizedPort === "") {
    return DEFAULT_PLAYWRIGHT_PORT;
  }

  if (!/^\d+$/.test(normalizedPort)) {
    throw new Error(PORT_ERROR_MESSAGE);
  }

  const port = Number(normalizedPort);
  if (!Number.isSafeInteger(port) || port < MIN_PLAYWRIGHT_PORT || port > MAX_PLAYWRIGHT_PORT) {
    throw new Error(PORT_ERROR_MESSAGE);
  }

  return port;
}
