# Vercel X OAuth Setup

## 1. 目的

这个最小服务只做两件事：

- `/auth/x/start`
- `/auth/x/callback`

它不是完整账号绑定后台，只是一个安全的公网 OAuth 入口。

## 2. 部署

在仓库根目录执行：

```bash
npm install -g vercel
vercel
```

首次部署会生成一个地址，例如：

```text
https://smartkols-auth.vercel.app
```

## 3. 必需环境变量

在 Vercel 项目里配置：

- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `X_REDIRECT_URI`
- `X_AUTH_STATE_SECRET`
- `SMARTKOLS_BACKEND_BASE_URL`

建议：

- `X_REDIRECT_URI=https://<your-project>.vercel.app/auth/x/callback`
- `X_AUTH_STATE_SECRET` 用一段随机长字符串
- `SMARTKOLS_BACKEND_BASE_URL=http://<your-backend-host>:<port>` 或公网 `https://...`

## 4. X App 配置

在 X Developer Console 里把这些值改成：

- `Callback URI / Redirect URL`
  - `https://<your-project>.vercel.app/auth/x/callback`
- `Website URL`
  - `https://<your-project>.vercel.app`

## 5. 使用

授权入口：

```text
https://<your-project>.vercel.app/auth/x/start
```

如果你要把授权结果直接绑定到某个 SmartKOLs 账号：

```text
https://<your-project>.vercel.app/auth/x/start?account_id=<smartkols-account-id>
```

用户授权成功后，callback 会直接返回 JSON：

```json
{
  "provider": "x_oauth2",
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 7200,
  "scope": "...",
  "smartkols_account_credential_payload": {
    "provider": "x_oauth2",
    "status": "valid",
    "oauth2_token": {
      "access_token": "...",
      "refresh_token": "...",
      "token_type": "bearer",
      "expires_in": 7200,
      "scope": "..."
    }
  },
  "smartkols_binding": {
    "account_id": "acc_xxx",
    "endpoint": "http://<backend>/accounts/acc_xxx/credentials",
    "response": {
      "ok": true
    }
  }
}
```

后续把 `smartkols_account_credential_payload` 直接 POST 到：

```text
/accounts/:id/credentials
```

后端会把 `x_oauth2` token 存进 managed secret store，并在 access token 即将过期或收到 401 时自动 refresh。

如果授权入口带了 `account_id`：

- callback 会直接调用 `SMARTKOLS_BACKEND_BASE_URL/accounts/:id/credentials`
- 如果绑定失败，callback 会显式报错，不会假装授权成功
