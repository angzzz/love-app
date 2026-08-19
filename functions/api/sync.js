/**
 * Cloudflare Pages Function —— 云端同步 API
 * 端点：POST /api/sync
 * Body: { pairCode, data?, action: 'push'|'pull'|'join'|'create' }
 * 返回: { ok, data?, pairId?, error? }
 */

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export async function onRequestOptions() {
  return new Response(null, { headers })
}

export async function onRequestPost(context) {
  const { request, env } = context
  const KV = env.LOVE_APP_KV

  if (!KV) {
    return jsonResponse({ ok: false, error: '服务端 KV 未绑定' }, 500)
  }

  try {
    const body = await request.json()
    const { pairCode, data, action } = body

    if (!pairCode || !/^[A-Z0-9]{6}$/.test(pairCode)) {
      return jsonResponse({ ok: false, error: '配对码格式不对（6位大写字母或数字）' }, 400)
    }

    const key = `pair:${pairCode}`
    const raw = await KV.get(key)
    const cloud = raw ? JSON.parse(raw) : null

    // 创建新配对
    if (action === 'create') {
      if (cloud) return jsonResponse({ ok: false, error: '配对码已存在，换一个' }, 409)
      const initData = data || {}
      initData.pairId = 'A'
      initData.createdAt = Date.now()
      initData.lastSyncAt = Date.now()
      await KV.put(key, JSON.stringify(initData))
      return jsonResponse({ ok: true, pairId: 'A' })
    }

    // 加入已有配对
    if (action === 'join') {
      if (!cloud) return jsonResponse({ ok: false, error: '配对码不存在' }, 404)
      return jsonResponse({ ok: true, pairId: 'B', data: cloud })
    }

    if (!cloud) return jsonResponse({ ok: false, error: '配对码不存在，先创建' }, 404)

    // 拉取（启动时/定时）
    if (action === 'pull') {
      return jsonResponse({ ok: true, data: cloud })
    }

    // 推送（本地有变更时）
    if (action === 'push') {
      if (!data) return jsonResponse({ ok: false, error: '缺少 data' }, 400)
      data.lastSyncAt = Date.now()
      await KV.put(key, JSON.stringify(data))
      return jsonResponse({ ok: true, data })
    }

    return jsonResponse({ ok: false, error: '未知 action' }, 400)
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500)
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers })
}
