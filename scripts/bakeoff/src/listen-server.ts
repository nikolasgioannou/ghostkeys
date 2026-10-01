/**
 * Serves the bake-off listening page on localhost and the run files it
 * plays. Bun bundles the page's TypeScript (and the engine) for the browser.
 *
 *   bun run bakeoff:listen
 */
import { readdir } from "node:fs/promises";

import page from "./listen/index.html";

const RUNS = new URL("../runs/", import.meta.url);

const server = Bun.serve({
  port: 3001,
  development: true,
  routes: {
    "/": page,
    "/api/runs": async () => {
      const names = (await readdir(RUNS).catch(() => []))
        .filter((name) => name.endsWith(".json"))
        .sort();
      return Response.json(names);
    },
    "/api/runs/:name": (request) => {
      const { name } = request.params;
      if (!/^[\w.-]+\.json$/.test(name))
        return new Response("Not found", { status: 404 });
      return new Response(Bun.file(new URL(name, RUNS)));
    },
  },
});

console.log(`Listening page: ${server.url.href}`);
