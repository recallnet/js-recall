// @vitest-environment node
import { os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { afterEach, describe, expect, it } from "vitest";

const marker = "rpcPrototypePollutionRegression";
const handler = new RPCHandler({
  check: os.handler(() => ({ ok: true })),
});

afterEach(() => {
  Reflect.deleteProperty(Object.prototype, marker);
});

describe("RPC request deserialization", () => {
  it.each([["__proto__"], ["constructor", "prototype"]])(
    "rejects metadata paths through inherited properties: %j",
    async (...segments): Promise<void> => {
      const request = new Request("http://localhost/rpc/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          json: {},
          meta: [[2, ...segments, marker]],
        }),
      });

      const { response } = await handler.handle(request, { prefix: "/rpc" });

      expect(Object.hasOwn(Object.prototype, marker)).toBe(false);
      expect(response?.status).toBe(400);
    },
  );

  it.each([["__proto__"], ["constructor", "prototype"]])(
    "rejects multipart paths through inherited properties: %j",
    async (...segments): Promise<void> => {
      const body = new FormData();
      body.set(
        "data",
        JSON.stringify({ json: {}, meta: [], maps: [[...segments, marker]] }),
      );
      body.set("0", "polluted");
      const request = new Request("http://localhost/rpc/check", {
        method: "POST",
        body,
      });

      const { response } = await handler.handle(request, { prefix: "/rpc" });

      expect(Object.hasOwn(Object.prototype, marker)).toBe(false);
      expect(response?.status).toBe(400);
    },
  );

  it("accepts a valid request", async (): Promise<void> => {
    const request = new Request("http://localhost/rpc/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });

    const { response } = await handler.handle(request, { prefix: "/rpc" });

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ json: { ok: true } });
  });
});
