# 小c的心愿口袋 — GitHub 部署说明

本包用于通过 **GitHub 自动部署** 到 Cloudflare Pages，从而激活云端同步接口 `/api/sync`。
（Cloudflare 的「拖 zip 直接上传」不会激活 functions，所以必须走 GitHub 部署。）

---

## 一、准备文件

1. 把这个压缩包下载到**电脑**上，解压。
2. 解压后你会看到这些文件/文件夹（都在同一层）：
   ```
   index.html  manifest.json  sw.js  _headers
   css/  js/  assets/  functions/
   ```
   `functions/api/sync.js` 就是云端同步后端，**必须留在根目录**。

---

## 二、创建 GitHub 仓库并上传

1. 打开 https://github.com ，注册/登录。
2. 点右上角 **＋ → New repository**。
3. 填一个仓库名（如 `love-app`），**勾选 Public**（私有也行但要付费 Pages），其他默认，**Create repository**。
4. 新仓库页面点 **“uploading an existing file”** 或把文件拖进网页。
   - 把解压出来的全部内容（`index.html`、`css/`、`js/`、`functions/` 等）**一起拖进去**。
   - 注意：是拖文件夹里的**内容**，不是拖外面那个大文件夹。
5. 拉到下面点 **Commit changes**（提交）。

---

## 三、Cloudflare Pages 连 GitHub 部署

1. 打开 Cloudflare 控制台 → **Workers 和 Pages** → 找到你的 `xiaoc-wish-pocket` 项目 → 点进去。
2. 进 **Settings → Build & deployments**（或「构建与部署」）。
3. 找到 **Connect to Git / 连接 Git** → 授权 GitHub → 选刚才的仓库 `love-app`。
4. 设置（关键，照填）：
   - **Framework preset（框架）**：选 `None`
   - **Build command（构建命令）**：**留空**（不用填）
   - **Build output directory（输出目录）**：填 `/` 或 `.`
   - **Root directory（根目录）**：留空（默认仓库根）
5. 点 **Save and Deploy**（保存并部署）。
6. 等 1–2 分钟，状态变成 **Success / Active**。

---

## 四、确认 KV 绑定（重要）

1. 项目里点 **Settings → Functions**（或「函数」）→ **KV namespace bindings**。
2. 确认有一项：
   - Variable name：`LOVE_APP_KV`
   - KV namespace：`love-app-sync`
3. 如果没有 → 点 **Add binding** 加上（变量名 `LOVE_APP_KV`，命名空间选 `love-app-sync`）。

> 这个 KV 绑定是你最早就建好的，连 Git 后一般不会丢；但请确认一下，丢了同步就会报“KV 未绑定”。

---

## 五、验证同步接口活了

用电脑或手机浏览器打开：
```
https://xiaoc-wish-pocket.pages.dev/api/sync
```
- 显示一行字 `{"ok":false,"error":"仅支持 POST 请求"}` → 🎉 同步接口活了
- 显示别的错误或打不开 → 回到第三步检查 functions 是否带上、第四步 KV 是否绑定

---

## 六、App 里开启实时同步

1. 打开 App → 首页 → **我们的信息**。
2. **「🔧 同步服务器地址」保持为空**（不要填 workers.dev 那个地址了）。
   - 留空 = 自动用 App 同域名 `xiaoc-wish-pocket.pages.dev/api/sync`，你俩都能连。
3. 你点 **「🔗 创建配对码」** → 生成 6 位码 → 微信发给对方。
4. 对方打开 App → 我们的信息 → 同步服务器地址**也留空** → 点 **「📥 加入」** 输入码。
5. 连接成功后，任意一方改数据自动双向同步。

---

## 常见问题

- **部署后 `/api/sync` 还是 405 / 打不开**：functions 没带上。确认第三步输出目录是 `/`，且 `functions/api/sync.js` 在仓库根目录；重新 Deploy 一次。
- **报“KV 未绑定”**：第四步 KV 绑定漏了，补上再 Retry deploy。
- **App 还是老的**：手机完全退出应用、关后台、重新打开（让 Service Worker 刷新）。
