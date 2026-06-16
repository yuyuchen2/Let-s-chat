# LetsChat

LetsChat is a small D1-backed chat room designed to run on Cloudflare Workers.

## Cloudflare deployment notes

This repository is configured for Cloudflare connected Workers Builds. The `wrangler.toml` file intentionally does **not** include `account_id`, because Cloudflare provides the account context during connected builds. Hard-coding an account ID or leaving a placeholder such as `YOUR_CLOUDFLARE_ACCOUNT_ID` can break deployment in CI.

Before using the chat API, create or select a D1 database and bind it to the Worker as `DB` in the Cloudflare dashboard. Then initialize the table with `worker/schema.sql`.

For local Wrangler usage, you can add your own D1 binding to `wrangler.toml` or pass it through your local Wrangler environment, for example:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your_real_database_name"
database_id = "your-real-d1-database-id"
```

Initialize the database schema with Wrangler after replacing the database name:

```bash
npx wrangler d1 execute your_real_database_name --file=worker/schema.sql
```

Deploy from the repository root:

```bash
npx wrangler deploy
```
