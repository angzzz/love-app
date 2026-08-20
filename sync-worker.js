/**
 * 独立 Cloudflare Worker —— 「小c的心愿口袋」云端同步后端
 *
 * 部署方式（Cloudflare Dashboard，无需命令行）：
 *   1. 控制台 → Workers 和 Pages → 创建 → 创建 Worker
 *   2. 名称随意（如 love-sync）→ 在代码编辑器里清空默认代码，粘贴本文件全部内容 → 部署
 *   3. 该 Worker 的「设置 → 变量 → KV 命名空间绑定」→ 添加：
 *        变量名：LOVE_APP_KV
 *        KV 命名空间：选你已有的 love-app-sync（或新建一个）
 *   4. 改完绑定后点「重新部署」让绑定生效
 *   5. 部署后地址形如：https://love-sync.<你的子域>.workers.dev
 *      把这个地址填进 App「我们的信息 → 同步服务器地址」即可联网同步
 *
 * 端点：POST /api/sync
 * Body: { pairCode, data?, action: 'create'|'join'|'pull'|'push' }
 * 返回: { ok, data?, pairId?, error? }
 */

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers })
    if (request.method !== 'POST') return json({ ok: false, error: '仅支持 POST 请求' }, 405)

    const KV = env.LOVE_APP_KV
    if (!KV) {
      return json({ ok: false, error: '服务端 KV 未绑定：请在 Worker 设置里绑定变量 LOVE_APP_KV' }, 500)
    }

    let body
    try {
      body = await request.json()
    } catch (e) {
      return json({ ok: false, error: '请求体不是合法 JSON' }, 400)
    }

    const { pairCode, data, action } = body
    if (!pairCode || !/^[A-Z0-9]{6}$/.test(pairCode)) {
      return json({ ok: false, error: '配对码格式不对（6位大写字母或数字）' }, 400)
    }

    const key = `pair:${pairCode}`
    const raw = await KV.get(key)
    const cloud = raw ? JSON.parse(raw) : null

    // 创建新配对（A 端）
    if (action === 'create') {
      if (cloud) return json({ ok: false, error: '配对码已存在，换一个' }, 409)
      const init = data || {}
      init.pairId = 'A'
      init.createdAt = Date.now()
      init.lastSyncAt = Date.now()
      await KV.put(key, JSON.stringify(init))
      return json({ ok: true, pairId: 'A' })
    }

    // 加入配对（B 端）
    if (action === 'join') {
      if (!cloud) return json({ ok: false, error: '配对码不存在，请确认对方已创建' }, 404)
      return json({ ok: true, pairId: 'B', data: cloud })
    }

    if (!cloud) return json({ ok: false, error: '配对码不存在，请先创建' }, 404)

    // 拉取（B 端加入后 / 定时）
    if (action === 'pull') {
      return json({ ok: true, data: cloud })
    }

    // 推送（本地有变更时）
    if (action === 'push') {
      if (!data) return json({ ok: false, error: '缺少 data' }, 400)
      data.lastSyncAt = Date.now()
      await KV.put(key, JSON.stringify(data))
      return json({ ok: true, data })
    }

    return json({ ok: false, error: '未知 action' }, 400)
  }
}
