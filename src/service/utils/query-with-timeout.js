/**
 * Await a query, but give up after `ms` milliseconds and resolve null instead.
 * Discord interactions must be answered within 3 seconds and modals cannot be
 * deferred, so prefill queries must never block past that window.
 */
export default async function queryWithTimeout(query, ms = 2000) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });

  try {
    return await Promise.race([
      Promise.resolve(query).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('queryWithTimeout query failed:', error);
        return null;
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
