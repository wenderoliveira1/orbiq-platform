import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test, afterEach } from "node:test";
import vm from "node:vm";

const requireWeb = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const ts = requireWeb("typescript");
function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(`../../apps/web/src/${relativePath}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, process, Request, Response, URL,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}
const guard = load("lib/request-origin.ts");
const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
});

test("only the exact public origin may submit authenticated mutations", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
  for (const origin of [null, "null", "https://evil.example", "https://app.example.evil.example",
    "https://user@app.example", "https://app.example/path", "http://app.example", "https://app.example:444"]) {
    const request = new Request("http://internal:3000/action", {
      method: "POST", headers: origin === null ? {} : { origin },
    });
    assert.equal(guard.isSameOriginMutation(request), false, String(origin));
  }
  assert.equal(guard.isSameOriginMutation(new Request("http://internal:3000/action", {
    method: "POST", headers: { origin: "https://app.example", "sec-fetch-site": "same-origin" },
  })), true);
  assert.equal(guard.isSameOriginMutation(new Request("http://internal:3000/action", {
    method: "POST", headers: { origin: "https://app.example", "sec-fetch-site": "same-site" },
  })), false);
});

test("forwarded headers cannot authorize a foreign origin; local development works", () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(guard.isSameOriginMutation(new Request("http://127.0.0.1:3000/action", {
    method: "POST", headers: { origin: "https://evil.example", "x-forwarded-host": "evil.example" },
  })), false);
  assert.equal(guard.isSameOriginMutation(new Request("http://127.0.0.1:3000/action", {
    method: "POST", headers: { origin: "http://127.0.0.1:3000" },
  })), true);
});

const routes = [
  ["app/dashboard/compras/abrir/[orderId]/route.ts", "../../../_lib/current-organization"],
  ["app/dashboard/cotacoes/abrir/[requestId]/route.ts", "../../../_lib/current-organization"],
  ["app/dashboard/dados/exportar/route.ts", "../../_lib/permissions"],
];
for (const [path, contextImport] of routes) {
  test(`${path}: rejects CSRF before reading sessions, bodies or database`, async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
    const unexpected = () => { throw new Error("Protected dependency was called"); };
    const route = load(path, {
      "@/lib/request-origin": guard,
      "next/server": { NextResponse: { redirect: unexpected } },
      [contextImport]: { getCurrentContext: unexpected, requireCurrentPermission: unexpected },
    });
    assert.equal(route.GET, undefined);
    for (const origin of [undefined, "null", "https://evil.example"]) {
      const response = await route.POST(new Request("https://app.example/action", {
        method: "POST", headers: origin ? { origin } : {}, body: "untrusted",
      }));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  });
}

test("supplier POST updates once and redirects to WhatsApp with GET (303)", async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
  let mutations = 0;
  const supabase = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        update() { mutations++; return query; },
        async maybeSingle() {
          return { data: table === "suppliers"
            ? { id: "supplier", whatsapp: "5511999999999", active: true }
            : { id: "request", quote_id: "quote", supplier_id: "supplier", message: "Test", status: "prepared" } };
        },
      };
      return query;
    },
  };
  const route = load(routes[1][0], {
    "@/lib/request-origin": guard,
    "next/server": { NextResponse: { redirect: (url, status) => new Response(null, {
      status, headers: { location: String(url) },
    }) } },
    [routes[1][1]]: { getCurrentContext: async () => ({ supabase, organization: { id: "org" } }) },
  });
  const response = await route.POST(new Request("https://app.example/action", {
    method: "POST", headers: { origin: "https://app.example" },
  }), { params: Promise.resolve({ requestId: "request" }) });
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location")).hostname, "wa.me");
  assert.equal(mutations, 1);
});
