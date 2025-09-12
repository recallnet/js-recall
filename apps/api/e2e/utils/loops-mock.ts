import http from "http";

let server: http.Server | null = null;

export async function startLoopsMockServer(
  baseUrl = "http://127.0.0.1:4010",
): Promise<void> {
  if (server) return;

  const url = new URL(baseUrl);
  const port = parseInt(url.port, 10);
  const hostname = url.hostname;

  server = http.createServer((req, res) => {
    const { method, url } = req;
    const reqUrl = new URL(
      url || "/",
      `${url?.startsWith("http") ? "" : `http://${hostname}:${port}`}`,
    );
    const pathname = reqUrl.pathname;
    if (method === "PUT" && pathname.endsWith("/contacts/update")) {
      // Drain request body without storing to avoid unused variable
      req.on("data", () => {});
      req.on("end", () => {
        // Always succeed by default; could be extended per-test
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, message: "Not Found" }));
  });

  await new Promise<void>((resolve) => {
    server!.listen(port, hostname, () => resolve());
  });

  console.log(`[LoopsMock] Listening on ${baseUrl}`);
}

export async function stopLoopsMockServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
}
