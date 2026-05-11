# SmartKOLs Runbook

## Purpose

这份 runbook 只回答长期运行时最短的排障问题：

- 系统现在是不是健康
- 哪个进程挂了、卡了、还是只是队列里有失败项
- 怎么看 structured runtime event
- managed secret 现在由谁持有

它不复述产品功能，也不复述领域设计。

## Primary Endpoints

健康检查：

```bash
curl -sS http://127.0.0.1:3100/ops/health
```

完整运行概览：

```bash
curl -sS 'http://127.0.0.1:3100/ops/overview?limit=20'
```

workspace 级 operator 面：

```bash
curl -sS 'http://127.0.0.1:3100/monitoring/overview?workspace_id=<workspace-id>&limit=20'
```

浏览器操作面：

- `/monitoring`
  - `运营事件`
  - `队列排障`
  - `运行健康`
  - `报警通道`

## Health Model

`/ops/health` 和 `/ops/overview.summary.health_status` 只会返回三种状态：

- `healthy`
  - 至少有一个 `http_server` heartbeat
  - 至少有一个 `worker` heartbeat
  - 没有 stale process
  - 最近没有把系统降级的 failed queue item / critical runtime event
- `degraded`
  - 进程还活着
  - 但存在 failed queue item 或 recent critical runtime event
- `unhealthy`
  - 缺少 `http_server` 或 `worker` heartbeat
  - 或存在 stale process

系统不会静默把这些问题吞掉。

## What To Check First

### 1. 看 `/ops/health`

重点字段：

- `health_status`
- `reasons`
- `active_http_servers`
- `active_workers`
- `stale_processes`
- `failed_jobs`

### 2. 看 `/ops/overview`

重点区块：

- `processes`
  - 当前 HTTP / worker heartbeat
- `queue_metrics`
  - `agent_task / worker_job / publish_job / source_fetch_run`
- `recent_events`
  - 结构化运行事件
- `secret_inventory`
  - 只看 namespace / kind / count，不回显 secret

### 3. 再看 workspace 级 `/monitoring/overview`

当 `/ops/health` 已知是 `degraded` 时，再下钻：

- `operator_queues`
- `agent_traces`
- `connector_requests`
- `model_requests`
- `audit_logs`

## Common Cases

### No Worker Heartbeat

症状：

- `/ops/health.health_status = unhealthy`
- `reasons` 包含 `no running worker heartbeat found`

处理：

1. 重启 worker
2. 再看 `/ops/overview.processes`
3. 如果 heartbeat 回来了，再看 `queue_metrics` 是否还有 backlog / failed item

### Stale Process

症状：

- `/ops/overview.processes[*].health_status = stale`

处理：

1. 确认对应 pid 是否还活着
2. 如果进程已死，直接重启
3. 如果进程还活着但 heartbeat 不动，优先看 stdout / stderr 和 `recent_events`

### Failed Queue Items

症状：

- `/ops/health.health_status = degraded`
- `failed_jobs > 0`

处理：

1. 打开 `/monitoring` 的 `队列排障`
2. 先看是哪一类：
   - `agent_task`
   - `worker_job`
   - `publish_job`
   - `source_fetch_run`
3. 先看对应 trace / error message
4. 确认根因后再显式 retry

### Critical Runtime Events

症状：

- `/ops/overview.recent_events[*].severity = critical`

典型来源：

- `http.request.failed`
- `http.response.5xx`
- `worker.job.failed`

处理：

1. 看 `event_type`
2. 看 `payload_json`
3. 再用 `request_id` 去交叉查：
   - `connector_requests`
   - `model_requests`
   - `audit_logs`
   - `agent trace`

## Secret Storage Rules

managed secret 已统一进入 shared vault。

当前 namespace：

- `connector_x`
  - `x_oauth2`
- `alert_channel`
  - `lark_webhook`
  - `telegram_bot`

运行时只暴露 inventory：

- `namespace`
- `kind`
- `item_count`

不会回显任何真实 secret。

## Expected Local Processes

最小本地链路：

```bash
npm run backend:dev:local
npm run backend:worker:local -- all
npm run dev -- --hostname 127.0.0.1 --port 3000
```

对应 heartbeat：

- `backend-http`
- `all`

## Escalation Rule

按这个顺序处理，不要反过来：

1. 先确认进程 heartbeat 是否健康
2. 再确认 queue metrics 是否健康
3. 再看 structured runtime event
4. 最后才进具体 workspace trace / connector / model request

原因很简单：

- 如果 heartbeat 都不健康，下钻 workspace 没意义
- 如果 queue 已经 failed，下钻 feed 不会解决执行面问题
