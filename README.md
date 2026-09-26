# LetsChat一起聊聊



LetsChat is a small D1-backed chat room designed to run on Cloudflare Workers.
本项目是一个基于cloudflare worker和D1的小型聊天室


## Features特点



- Account-style login with a display name stored in the browser.
- 有账号密码系统                          

- Online user list powered by a D1-backed heartbeat table.
- 在线用户显示                         

- Chat messages stored in Cloudflare D1.
- 聊天数据存储在cloudflare D1上                          


## Cloudflare deployment notes 部署指南







This repository is configured for Cloudflare connected Workers Builds. The `wrangler.toml` file intentionally does **not** include `account_id`, because Cloudflare provides the account context during connected builds. Hard-coding an account ID or leaving a placeholder such as `YOUR_CLOUDFLARE_ACCOUNT_ID` can break deployment in CI.


The Worker uses the D1 binding named `DB` and points to your database:


```toml                                                                                                                           
[[d1_databases]]                   
binding = "DB"                  
database_name = "chat_db"

database_id = "d3d83a2c-765a-4993-a4aa-0cdd0b7e6ae9"

``` 

## D1 table creation SQL

The complete, canonical SQL is saved at [`schema.sql`](schema.sql). Do not copy a separate schema into the Worker; apply that file from the repository root:

Initialize your D1 database with Wrangler:

```bash
npx wrangler d1 execute chat_db --remote --file=schema.sql
```

Deploy from the repository root:

```bash
npx wrangler deploy
```

For first-time setup, safely upgrading an existing database, verification commands, backups, and cleanup, see [the D1 operations guide](docs/D1.md).
