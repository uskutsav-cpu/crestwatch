/** Ground height is optional context. An upstream outage must never turn into 0 ft. */
export async function optionalGroundHeight(
  point: { lat: number; lon: number },
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const response = await fetcher("/api/elevation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(point),
      signal,
    });
    const data = (await response.json()) as {
      ok?: boolean;
      elevationFt?: unknown;
    };
    if (signal?.aborted)
      throw signal.reason ?? new DOMException("Canceled", "AbortError");
    return response.ok &&
      data.ok === true &&
      typeof data.elevationFt === "number" &&
      Number.isFinite(data.elevationFt) &&
      data.elevationFt > -400 &&
      data.elevationFt < 30000
      ? data.elevationFt
      : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}
export function inSupportedBounds(point: {
  lat: number;
  lon: number;
}): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= 29 &&
    point.lat <= 35.2 &&
    point.lon >= -91.8 &&
    point.lon <= -88
  );
}

/** Let the user skip optional elevation without turning cancellation into a save. */
export async function groundHeightOrSkip(
  point: { lat: number; lon: number },
  fetcher: typeof fetch,
  signal: AbortSignal,
  registerSkip: (skip: (() => void) | null) => void,
): Promise<number | null> {
  if (signal.aborted)
    throw signal.reason ?? new DOMException("Canceled", "AbortError");
  const lookupController = new AbortController();
  let cancel = () => {};
  const control = new Promise<null>((resolve, reject) => {
    registerSkip(() => {
      resolve(null);
      lookupController.abort();
    });
    cancel = () => {
      lookupController.abort();
      reject(signal.reason ?? new DOMException("Canceled", "AbortError"));
    };
    signal.addEventListener("abort", cancel, { once: true });
  });
  try {
    return await Promise.race([
      optionalGroundHeight(point, fetcher, lookupController.signal),
      control,
    ]);
  } finally {
    signal.removeEventListener("abort", cancel);
    registerSkip(null);
  }
}
