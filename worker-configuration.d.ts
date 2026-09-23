// Ambient Cloudflare Workers bindings for this project. Bindings are injected by the
// hosting control plane (see .openai/hosting.json) rather than declared in a local
// wrangler.toml, so there is no `wrangler types` output to generate this from — keep it
// in sync by hand with what worker/index.ts and db/index.ts actually read off `env`.
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    IMAGES: {
      input(stream: ReadableStream): {
        transform(options: Record<string, unknown>): {
          output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
        };
      };
    };
  }
}

interface Env extends Cloudflare.Env {}
