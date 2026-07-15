# 🌸 CloudMail Monet 完整邮箱版

CloudMail Monet 是在完整 `cloud-mail` 邮箱系统基础上改造的 Cloudflare 邮件平台。它不是单纯的发件 API，而是一套可以创建 `@你的域名` 邮箱、收取邮件、查看附件、写信、回复、转发和管理用户的完整邮箱系统。

本版本保留原项目成熟的收件、账户、权限、D1、KV、R2 和附件逻辑，并把原来仅支持 Resend 的站外发件功能升级为：

- Resend
- MailerSend
- Brevo
- Postmark
- Amazon SES
- 按设置顺序自动故障切换
- 每个域名单独配置服务商
- 服务商密钥 AES-GCM 加密保存到 D1
- 页面仅返回掩码，不回传完整密钥
- 兼容旧版 `resend_tokens` 配置
- 莫奈风格界面

> 当前 `wrangler.toml` 默认部署为一套独立测试环境，会自动创建新的 D1、KV 和 R2，不会修改现有 `cloud-mail`、DNS、Email Routing 或历史邮件。

---

## 目录结构

```text
cloudmail-monet-full/
├── mail-worker/                 # Cloudflare Worker 后端
│   ├── src/
│   │   ├── email/               # Cloudflare Email Routing 收件处理
│   │   ├── service/             # 邮件、用户、设置和多服务商发件
│   │   ├── entity/              # D1 数据表映射
│   │   └── index.js             # Worker 入口
│   ├── wrangler.toml            # 独立测试环境配置
│   └── wrangler-existing.example.toml
├── mail-vue/                    # Vue 邮箱前端
├── README.md
└── LICENSE
```

---

# 一、安全并行部署

## 1. 保留旧系统

在新系统全部测试完成前，请保持以下内容不变：

```text
旧 Worker：cloud-mail
mail.282520.xyz → cloud-mail
Email Routing Catch-all → cloud-mail
旧 D1 / KV / R2 → 不删除、不解绑
DNS MX → 不修改
```

新系统先使用独立地址：

```text
https://cloudmail-monet-full.<你的workers.dev子域>.workers.dev
```

---

## 2. 上传到 GitHub

新建一个仓库，把本项目根目录中的内容上传进去。GitHub 仓库首页应直接看到：

```text
mail-worker/
mail-vue/
README.md
LICENSE
```

不要多套一层重复目录。

---

## 3. 在 Cloudflare 导入仓库

进入：

```text
Cloudflare
→ Workers & Pages
→ Create application
→ Import a repository
```

构建设置填写：

```text
Worker 名称：cloudmail-monet-full
Production branch：main
Root directory：mail-worker
Build command：pnpm run build:web
Deploy command：pnpm exec wrangler deploy
```

`wrangler.toml` 已使用无资源 ID 的绑定：

```toml
[[d1_databases]]
binding = "db"

[[kv_namespaces]]
binding = "kv"

[[r2_buckets]]
binding = "r2"
```

Cloudflare 会为测试环境自动创建独立的 D1、KV 和 R2；资源 ID 不会写进公开 GitHub 仓库。

---

# 二、配置运行变量

第一次部署完成后进入：

```text
Workers & Pages
→ cloudmail-monet-full
→ Settings
→ Variables and Secrets
```

## 普通变量

### `domain`

类型：普通变量

值：

```json
["282520.xyz"]
```

必须是 JSON 数组格式。多个域名示例：

```json
["282520.xyz","example.com"]
```

### `admin`

类型：普通变量

值填写你准备使用的管理员邮箱，例如：

```text
admin@282520.xyz
```

这个邮箱需要随后在系统注册页面注册，邮箱地址必须与这里完全一致。

## Secret

### `jwt_secret`

类型：Secret

填写一个较长的随机字符串，用于登录令牌和数据库初始化验证。

### `mail_config_secret`

类型：Secret

填写另一个较长的随机字符串，专门加密邮件服务商密钥。

建议两个 Secret 都使用密码管理器生成的 40～64 位随机字符串，并且不要相同。

> 保存服务商配置后不要更换 `mail_config_secret`。更换后，原有加密配置无法解密，需要重新填写所有服务商密钥。

保存变量后重新部署一次。

---

# 三、初始化数据库

浏览器访问：

```text
https://你的新Worker地址/api/init/你的jwt_secret
```

例如：

```text
https://cloudmail-monet-full.xxx.workers.dev/api/init/你设置的jwt_secret
```

页面返回：

```text
success
```

表示数据库表和升级字段已经创建完成。

初始化过程同时兼容旧版数据库结构，并增加：

```text
setting.mail_providers
setting.provider_priority
email.send_provider
```

---

# 四、创建管理员

1. 打开新 Worker 地址。
2. 进入注册页面。
3. 使用 `admin` 变量中填写的邮箱注册。
4. 登录后，该邮箱会被系统识别为超级管理员。

例如 `admin` 设置为：

```text
admin@282520.xyz
```

注册时也必须使用：

```text
admin@282520.xyz
```

---

# 五、配置多服务商发件

管理员登录后进入：

```text
系统设置
→ 多服务商发件
→ 配置服务商
```

先选择发件域名，再填写实际使用的服务商。

## Resend

填写：

```text
API Key
启用：打开
```

## MailerSend

填写：

```text
API Key
启用：打开
```

## Brevo

填写：

```text
API Key
启用：打开
```

## Postmark

填写：

```text
Server Token
Message Stream：通常填写 outbound
启用：打开
```

## Amazon SES

填写：

```text
Access Key ID
Secret Access Key
Session Token：仅临时凭证需要
Region：例如 us-east-1
启用：打开
```

## 故障切换顺序

默认：

```text
Resend → MailerSend → Brevo → Postmark → Amazon SES
```

系统只尝试“已启用且配置完整”的服务商。当前服务商失败后，会自动继续尝试下一家。

每个域名可以保存不同配置。例如：

```text
282520.xyz：Resend → Brevo
example.com：Postmark → SES
```

密钥保存后会加密写入 D1，再次打开页面只显示掩码。保持掩码不修改会保留原密钥。

---

# 六、测试发邮件

1. 在系统中创建一个邮箱账户，例如：

```text
test@282520.xyz
```

2. 打开“写邮件”。
3. 选择该邮箱作为发件人。
4. 给你的 QQ、Gmail 或其他外部邮箱发送测试邮件。
5. 在“已发送”中确认邮件状态。

站外发送成功时，系统会把实际使用的服务商写入：

```text
email.send_provider
```

如果自动切换前几家失败，最终成功服务商仍会被记录。

---

# 七、安全测试收件功能

当前 DNS 和 Catch-all 仍由旧 `cloud-mail` 处理，因此新系统不会自动收到所有 `@282520.xyz` 邮件。

需要测试收件时，可以只建立一个专用测试地址，不切换整个域名：

```text
monet-test@282520.xyz
```

操作：

1. 在新系统创建 `monet-test@282520.xyz` 账户。
2. Cloudflare → Email Routing → Routing Rules。
3. 新增精确地址规则：

```text
monet-test@282520.xyz
→ Send to Worker
→ cloudmail-monet-full
```

4. 保持原 Catch-all 继续指向 `cloud-mail`。
5. 从外部邮箱给 `monet-test@282520.xyz` 发邮件。
6. 检查正文、附件、回复和转发。

该测试不会影响其他邮箱地址，也不需要修改 MX 或 DNS。

---

# 八、附件与存储

当前测试版自动创建独立 R2，并使用绑定名：

```text
r2
```

系统支持：

- 收件附件保存
- 发件附件
- 内嵌图片
- 附件预览和下载
- R2 或兼容 S3 的对象存储

绑定名称 `db`、`kv`、`r2` 被代码使用，不要自行改名。

---

# 九、最终替换旧 cloud-mail

只有以下内容全部验证成功后再切换：

```text
管理员登录正常
邮箱账户创建正常
站内发送正常
站外发送正常
五家服务商至少实际验证你需要的几家
自动故障切换正常
指定测试地址收件正常
正文显示正常
附件上传、接收和下载正常
回复、转发正常
```

## 暂时不要直接删除旧系统

最终切换前，需要先决定是否保留旧历史数据。

### 方案 A：使用全新数据

如果不需要旧历史邮件，可直接使用测试环境创建的新 D1、KV 和 R2，然后切换：

```text
Email Routing Catch-all：cloud-mail → cloudmail-monet-full
mail.282520.xyz Worker 路由：cloud-mail → cloudmail-monet-full
```

### 方案 B：保留旧历史邮件和附件

本项目的数据结构兼容旧 `cloud-mail`，可以接管旧 D1、KV 和 R2。

操作前必须：

1. 备份旧 D1。
2. 保留旧 Worker，不删除。
3. 使用 `mail-worker/wrangler-existing.example.toml` 作为模板。
4. 在本地或私有仓库中填入旧 D1、KV、R2 信息。
5. 部署后再次执行 `/api/init/<jwt_secret>`，只增加兼容字段。
6. 使用新 Worker 地址检查历史邮件和附件。
7. 确认无误后再切换 Email Routing 和 `mail.282520.xyz`。

`wrangler-existing.example.toml` 中的资源 ID 占位符不能直接用于部署，也不要把真实 ID 提交到公开仓库。

---

# 十、旧 Resend 配置兼容

如果最终绑定旧 D1，原来的：

```text
setting.resend_tokens
```

会被自动读取为 Resend 配置。你在新的多服务商页面保存后，配置会迁移到加密的：

```text
setting.mail_providers
```

因此不需要手工复制旧 Resend Token。

---

# 十一、本地构建检查

需要本地运行时：

```bash
cd mail-worker
pnpm install
pnpm run build:web
pnpm run dev
```

初始化本地数据库：

```text
http://127.0.0.1:8787/api/init/local-dev-only-change-me
```

正式部署：

```bash
cd mail-worker
pnpm install
pnpm run deploy
```

---

# 十二、安全说明

以下内容不会写入公开代码：

```text
邮件服务商 API Key
Postmark Server Token
AWS Secret Access Key
AWS Session Token
jwt_secret
mail_config_secret
D1 / KV 资源 ID（默认测试配置）
```

服务商密钥使用 AES-GCM 加密后保存到 D1。系统设置接口只返回掩码。

仍需注意：

- GitHub 中不要提交 `.dev.vars`。
- 不要把真实密钥写入 `wrangler.toml`。
- 不要公开截图中的完整 Token。
- 不要随意更换 `mail_config_secret`。
- 正式接管旧数据前必须备份 D1。

---

# 已完成的构建验证

本版本已完成：

```text
Vue 前端生产构建
Cloudflare Worker dry-run 打包
D1 / KV / R2 绑定检查
本地 Worker 启动
本地 D1 全量初始化
v3 数据库字段迁移检查
```

DNS、MX、`mail.282520.xyz` 和现有 Email Routing 均未修改。

---

## License

MIT License。原项目许可和版权信息保留在 `LICENSE` 中。
