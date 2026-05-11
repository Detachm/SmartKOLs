# AWS Deployment Guide

这份文档针对 `AWS EC2 + Docker Compose + Caddy`。

目标是两件事：

- 前端和后端都走正式公网域名，不再依赖临时 tunnel
- 一台新机器按文档操作后可以直接跑起来

## 1. 部署拓扑

- `app.example.com`
  - 对外前端入口
  - 由 `caddy -> frontend(next start)` 提供
- `api.example.com`
  - 对外 backend API
  - 由 `caddy -> backend-http` 提供
- `backend-worker`
  - 消费队列、执行 source fetch / publish / engagement / agent task
  - 不直接对外暴露
- `SQLite volume`
  - 持久化 runtime DB
- `artifacts volume`
  - 持久化 backend 生成物

## 2. 前置条件

- 一台 Ubuntu 22.04/24.04 EC2
- 安全组放开：
  - `22/tcp`
  - `80/tcp`
  - `443/tcp`
- 两个 DNS 记录已经指向这台机器：
  - `app.example.com`
  - `api.example.com`
- 已拿到 X OAuth 凭证
- 如果要跑完整 AI 生成链，已拿到：
  - `OPENAI_API_KEY`
  - 或 `ZHIPU_API_KEY`

## 3. 首次部署

```bash
git clone git@github.com:yb2999/SmartKOLs.git
cd SmartKOLs
git checkout <aws-deploy-branch>
cp deploy/aws/.env.example deploy/aws/.env
vim deploy/aws/.env
```

必须至少改这些值：

- `APP_DOMAIN`
- `BACKEND_DOMAIN`
- `SMARTKOLS_BACKEND_BASE_URL`
- `SMARTKOLS_BACKEND_SHARED_SECRET`
- `BACKEND_PROXY_SHARED_SECRET`
- `X_OAUTH2_CLIENT_ID`
- `X_OAUTH2_CLIENT_SECRET`
- `OPENAI_API_KEY` 或 `ZHIPU_API_KEY`

要求：

- `SMARTKOLS_BACKEND_SHARED_SECRET`
- `BACKEND_PROXY_SHARED_SECRET`

这两个值保持一致。

## 4. 安装 Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

## 5. 启动

```bash
docker compose -f deploy/aws/compose.yml --env-file deploy/aws/.env up -d --build
```

第一次启动会更慢，因为前端容器会执行一次 `next build`。

## 6. 验收

```bash
docker compose -f deploy/aws/compose.yml ps
curl -i https://api.example.com/ops/health
curl -i https://app.example.com/login
```

通过标准：

- `frontend` / `backend-http` / `backend-worker` / `caddy` 都是 `Up`
- `https://api.example.com/ops/health` 返回 `200`
- `https://app.example.com/login` 能打开

## 7. 升级

```bash
git fetch origin
git checkout <aws-deploy-branch>
git pull --ff-only
docker compose -f deploy/aws/compose.yml --env-file deploy/aws/.env up -d --build
```

## 8. 常见问题

### `ops/health` 是 `degraded`

这通常不是服务没起来，而是数据库里还有失败任务或最近 critical runtime events。

先看：

```bash
curl -s https://api.example.com/ops/health | jq
```

如果你们是第一次部署，希望得到一套干净环境，建议使用全新的 SQLite volume。

### 登录成功后页面一直转圈

先确认前端配置的 backend 地址就是正式公网 backend：

- `SMARTKOLS_BACKEND_BASE_URL=https://api.example.com`

再确认 backend secret 一致：

- `SMARTKOLS_BACKEND_SHARED_SECRET`
- `BACKEND_PROXY_SHARED_SECRET`

### 没填 LLM key

如果 `LLM_ENABLED=true` 但 key 没填，内容生成链会失败。

如果只是先验 UI 和非生成链路，可以改成：

```env
LLM_ENABLED=false
```

但这样：

- brief generation
- draft generation
- reply proposal

这些能力都不能算完整可用。

## 9. 生产建议

- 不要再用临时 tunnel
- 不要把 SQLite 放在容器层，必须挂 volume
- 至少每天备份一次 `smartkols_runtime` volume
- 真正上量后，建议把 SQLite 替换到托管数据库，并把 worker 做成独立可扩容单元
