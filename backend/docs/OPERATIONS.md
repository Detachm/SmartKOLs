# Backend Operations

## Purpose

这份文档只回答运行与接入层面的事实问题：

- 后端现在怎么启动
- 怎么判断 backend base URL
- OAuth2 自动绑定链路怎么接
- 当前宿主机上到底有没有已经部署好的 SmartKOLs backend

不在这里重复领域设计和数据库细节。

## Run Commands

HTTP 入口：

```bash
npm run backend:dev
```

Worker 入口：

```bash
npm run backend:worker
```

后端不会自己给自己兜底。

- 不给必需环境变量，启动直接失败
- 不起 worker，异步任务就会停留在 `queued`

## Current Deployment

当前宿主机已经跑起来的进程：

- `smartkols-backend`
  - `pm2` 托管
  - 监听 `127.0.0.1:3100`
- `smartkols-backend-tunnel`
  - `pm2` 托管
  - Cloudflare Quick Tunnel
  - 转发到 `http://127.0.0.1:3100`
- `smartkols-publisher-worker`
  - `pm2` 托管
  - 运行 `publisher-worker`
- `smartkols-ingestion-worker`
  - `pm2` 托管
  - 运行 `ingestion-worker`
- `smartkols-engagement-worker`
  - `pm2` 托管
  - 运行 `engagement-worker`

当前实际可用地址：

- 本地:
  - `http://127.0.0.1:3100`
- 临时公网入口:
  - `https://vegetable-seconds-cleaning-stream.trycloudflare.com`

当前自动绑定链路已经配置到这个公网入口。

部署文件位置：

- env:
  - `/home/hliu/.smartkols/backend-http.env`
- 启动脚本:
  - `/home/hliu/.smartkols/start-smartkols-backend.sh`

当前部署模式：

- `LLM_ENABLED=false`
- 所以 connector / account credential / OAuth2 自动绑定这条链可用
- LLM 相关链路会显式报依赖未配置，不会静默降级
- 当前没有部署 `agent-worker`
- 所以所有依赖 LLM 的 agent task 仍然不会被执行

## Frontend Status

当前 Vercel 前端里，最短真实主链已经切到 backend：

- `/accounts`
  - 已经不再依赖 mock store 渲染账号列表
  - 通过 `/api/backend/workspaces` 和 `/api/backend/accounts` 读取真实 backend
  - “添加并绑定账号”会先创建 workspace/account，再跳 X OAuth2

当前仍然还在 mock 的页面：

- `dashboard`
- `calendar`
- `drafts`
- `monitoring`
- 以及大部分 account 子页面

也就是说：

- 账号创建 / 授权绑定主链已真实
- 整个产品面还没有全部切真

## Required Environment

Core:

- `BACKEND_PORT`
- `BACKEND_DB_PATH`
- `BACKEND_ARTIFACTS_DIR`

X:

- `X_API_KEY`
- `X_API_SECRET`
- `X_OAUTH2_CLIENT_ID`
- `X_OAUTH2_CLIENT_SECRET`
- `X_API_BASE_URL`
- `X_API_REQUEST_TIMEOUT_MS`

LLM:

- `LLM_ENABLED`
- `LLM_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_REQUEST_TIMEOUT_MS`

Source Fetch:

- `SOURCE_FETCH_REQUEST_TIMEOUT_MS`
- `SOURCE_FETCH_USER_AGENT`
- `SOURCE_FETCH_MAX_ITEMS`

Worker:

- `WORKER_NAME`
- `WORKER_POLL_INTERVAL_MS`
- `WORKER_MAX_JOBS_PER_TICK`

## How To Determine Backend Base URL

`SMARTKOLS_BACKEND_BASE_URL` 指的是 SmartKOLs backend API 的基地址，不是 Vercel OAuth callback 地址。

正确例子：

- `https://api.example.com`
- `http://185.14.47.155:3100`

错误例子：

- `https://smartkols-x-auth-20260415.vercel.app/auth/x/callback`

判断规则只有这三条：

1. 先确认后端 HTTP 进程真的在跑
2. 再确认它监听的端口
3. 最后确认这个端口是否对 Vercel 可达

如果后端绑定的是公网域名：

- `SMARTKOLS_BACKEND_BASE_URL=https://<your-domain>`

如果后端直接暴露在公网 IP 上：

- `SMARTKOLS_BACKEND_BASE_URL=http://<public-ip>:<BACKEND_PORT>`

如果后端只监听在 `127.0.0.1`：

- 不能直接给 Vercel 用
- 必须先做反向代理或公网入口

## Current Host Inspection

以下是 **2026-04-15** 这台宿主机的实际检查结果：

- 没发现正在运行的 SmartKOLs backend 进程
  - `ps -ef | rg 'start-http.ts|tsx backend|backend:dev'` 无命中
- 没发现 user-level `systemd` 里的 SmartKOLs backend service
  - `systemctl --user list-units --type=service --all` 只有系统基础服务
- `pm2` 里也没有任何应用
  - `pm2 ls` 为空

宿主机地址：

- 公网 IPv4: `185.14.47.155`
- 局域网 IPv4: `192.168.0.88`
- Tailscale IPv4: `100.71.100.56`

监听端口里与 HTTP 相关的观察：

- `0.0.0.0:80`
  - 存在服务
  - 访问后跳转到 `http://127.0.0.1/users/sign_in`
  - 响应头带 `X-Gitlab-Meta`
  - 这是 GitLab，不是 SmartKOLs backend
- `0.0.0.0:8060`
  - 存在服务
  - `/accounts` 和 `POST /workspaces` 都返回 `nginx/1.29.0` 的 HTML 404
  - 这也不是 SmartKOLs backend

当前结论：

- 这台机器上现在已经有运行中的 SmartKOLs backend
- 当前可用的 `SMARTKOLS_BACKEND_BASE_URL` 是：
  - `https://vegetable-seconds-cleaning-stream.trycloudflare.com`
- 但这个地址来自 Quick Tunnel，不是稳定生产域名

## OAuth2 Single-Auth Flow

现在已经实现的目标是：

- 每个账号只需要做一次 OAuth2 授权
- 后端保存 `access_token + refresh_token`
- token 即将过期时自动 refresh
- 收到 `401` 时也会 refresh 一次再重试

也就是说，账号不应该每 2 小时重新认证。

## Credential Storage Rules

`account_credentials.secret_ref` 现在分两类：

- `x_oauth1` / `api_key`
  - 必须使用 `env:VAR_NAME`
- `x_oauth2`
  - 必须使用 managed secret store
  - 不能再依赖只读 `env:`

这背后的第一性原理很直接：

- `x_oauth2` token 会刷新
- 会刷新就必须可写
- 只读环境变量不可能正确承载 refresh 生命周期

## Automatic Account Binding

Vercel OAuth 服务现在支持：

```text
https://smartkols-x-auth-20260415.vercel.app/auth/x/start?account_id=<smartkols-account-id>
```

流程是：

1. 用户打开带 `account_id` 的授权入口
2. X 授权成功后回调到 Vercel
3. Vercel 用 code 换到 token
4. Vercel 直接调用：

```text
POST {SMARTKOLS_BACKEND_BASE_URL}/accounts/:id/credentials
```

5. SmartKOLs backend 保存 OAuth2 凭证并进入自动 refresh 生命周期

前提有两个：

1. Vercel 必须配置 `SMARTKOLS_BACKEND_BASE_URL`
2. 这个 `account_id` 必须已经存在于 backend 数据库里

如果没配：

- 普通授权仍然能成功
- 但带 `account_id` 的自动绑定会显式失败

## Minimal Account Binding Steps

如果你要真正用上自动绑定，最短顺序是：

1. 创建 workspace
2. 创建 account
3. 用返回的 `account.id` 发起授权

创建 workspace：

```bash
curl -X POST https://vegetable-seconds-cleaning-stream.trycloudflare.com/workspaces \
  -H 'content-type: application/json' \
  --data '{
    "name": "SmartKOLs",
    "slug": "smartkols"
  }'
```

创建 account：

```bash
curl -X POST https://vegetable-seconds-cleaning-stream.trycloudflare.com/accounts \
  -H 'content-type: application/json' \
  --data '{
    "workspace_id": "<workspace_id>",
    "platform": "x",
    "handle": "example_handle",
    "display_name": "Example Handle"
  }'
```

发起自动绑定授权：

```text
https://smartkols-x-auth-20260415.vercel.app/auth/x/start?account_id=<account_id>
```

如果授权成功：

- Vercel callback 会直接把 OAuth2 凭证写到 backend
- 然后会继续：
  - `credentials/validate`
  - `profile/sync`
- 后端后续会自动 refresh token

## Manual Fallback

如果暂时不想走自动绑定，仍然可以手工绑定。

Vercel callback 返回 JSON 里会包含：

- `smartkols_account_credential_payload`

把它直接 POST 到：

```text
/accounts/:id/credentials
```

请求体格式：

```json
{
  "provider": "x_oauth2",
  "status": "valid",
  "oauth2_token": {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "bearer",
    "expires_in": 7200,
    "scope": "offline.access dm.read tweet.write users.read dm.write tweet.read"
  }
}
```

## What Is Missing Right Now

现在剩下的不是“有没有 backend”，而是稳定性问题：

- Quick Tunnel 地址会变化
- `pm2 startup` 还没有完成 systemd 自启

当前状态：

- `pm2 save --force` 已完成
- 但 `pm2 startup systemd -u hliu --hp /home/hliu` 需要 sudo 密码
- 所以宿主机重启后，当前 backend 和 tunnel 不保证自动恢复

如果要进一步收成稳定生产形态，优先级是：

1. 给 backend 一个稳定公网域名或稳定 tunnel
2. 配好 systemd/pm2 自启动
3. 再把 Vercel 的 `SMARTKOLS_BACKEND_BASE_URL` 固化到稳定地址
