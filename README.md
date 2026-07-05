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


The same SQL is saved in `worker/schema.sql`:


```sql        
-- users: 存储用户名与密码哈希（hash 包含 salt）
CREATE TABLE IF NOT EXISTS users (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  username TEXT NOT NULL UNIQUE,

  password_hash TEXT NOT NULL,

  failed_login_attempts INTEGER NOT NULL DEFAULT 0,

  locked_until INTEGER,

  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- sessions/messages/online_users
CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT,
  user TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);

CREATE TABLE IF NOT EXISTS online_users (
  session_token TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON online_users (last_seen DESC);

```

Initialize your D1 database with Wrangler:

```bash
npx wrangler d1 execute chat_db --file=worker/schema.sql
```

Deploy from the repository root:

```bash
npx wrangler deploy
```
