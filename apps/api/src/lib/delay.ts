async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), ms);
    if (signal) {
      const handleAbort = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", handleAbort);
        reject(signal.reason);
      };
      if (signal.aborted) handleAbort();
      signal.addEventListener("abort", handleAbort);
    }
  });
}

export { delay };
