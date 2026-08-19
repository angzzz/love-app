/**
 * 数据层 —— 本地优先 + 云端同步
 *
 * 设计原则：
 * 1. 本地 localStorage 即时读写，体验零延迟
 * 2. 云端异步同步，双人数据合并
 * 3. 数据结构带 schemaVersion，后续加字段自动补齐旧数据
 * 4. 同步用"最后写入胜"+ 数组项按 id 去重合并
 */

const SCHEMA_VERSION = 5  // v5: 头像带修改时间戳，修复头像被云端覆盖的问题

// 默认数据骨架 —— 后续加字段在这里加，旧数据会自动补齐
function defaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    // 配对信息
    pairCode: '',           // 配对码，两人共用同一个码
    pairId: '',             // 本机身份：'A' 或 'B'
    // 恋爱信息
    avatarA: '',            // A 的头像（base64 或 URL）
    avatarB: '',            // B 的头像
    avatarAUpdatedAt: 0,    // A 头像最后修改时间（同步时按时间取新，防止覆盖）
    avatarBUpdatedAt: 0,    // B 头像最后修改时间
    togetherSince: '',      // 在一起的日期 YYYY-MM-DD
    partnerNameA: '',       // A 的昵称
    partnerNameB: '',       // B 的昵称
    // 功能数据
    wishes: [],             // 心愿卡 [{id,type,emoji,title,desc,color,isCustom,message,from,received,createdAt}]
    customCards: [],        // 自定义卡类型
    nextMeet: null,         // 下次见面 {date}
    todoList: [],           // 见面想做的事 [{id,text,done}]
    foodList: [],           // 想一起吃的店 [{id,text,done}]
    moments: [],            // 约会瞬间 [{id,title,place,date,mood,moodLabel,photos,createdAt}]
    anniversaries: [],      // 纪念日 [{id,title,date,note,repeat}]
    foodOptions: [],        // 自定义美食选项 [{id,text}]
    foodHistory: [],        // 吃啥决定记录 [{id,name,emoji,decidedAt}]
    // 元数据
    lastSyncAt: 0,
    syncServer: '',        // 可选：独立 Worker 同步服务器地址（填了即走联网自动同步）
    createdAt: Date.now()
  }
}

// ===== 本地存储 =====
const STORAGE_KEY = 'loveAppData'

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const data = JSON.parse(raw)
    return migrateData(data)
  } catch (e) {
    console.error('加载数据失败', e)
    return defaultData()
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('保存数据失败', e)
    // 存储满了？尝试清理照片
    if (e.name === 'QuotaExceededError') {
      console.warn('存储空间不足，尝试压缩')
    }
  }
}

/**
 * 数据迁移 —— 确保旧数据补齐新字段
 * 这是"后续加功能不丢数据"的关键
 */
function migrateData(old) {
  const def = defaultData()
  const migrated = { ...def, ...old }
  // 逐字段补齐（防止某个字段是 undefined）
  Object.keys(def).forEach(key => {
    if (migrated[key] === undefined || migrated[key] === null) {
      migrated[key] = def[key]
    }
    // 数组类型确保是数组
    if (Array.isArray(def[key]) && !Array.isArray(migrated[key])) {
      migrated[key] = def[key]
    }
  })
  migrated.schemaVersion = SCHEMA_VERSION
  return migrated
}

// ===== 云端同步 =====
// 端点：默认走同源 Pages Function(/api/sync)；
// 若用户在 App 内填了"同步服务器地址"（独立 Worker URL），则优先用它实现跨域联网同步
const SYNC_ENDPOINT = '/api/sync'

// 解析实际同步端点：用户填了 Worker 地址就拼上 /api/sync，否则用默认同源路径
function syncEndpoint() {
  const s = ((Store.get() && Store.get().syncServer) || '').trim().replace(/\/+$/, '')
  return s ? s + '/api/sync' : SYNC_ENDPOINT
}

const SYNC_ENABLED = true

/**
 * 同步请求封装：把空响应/非JSON/网络错误都翻译成清晰的中文错误
 * 避免浏览器原生 "Unexpected end of JSON input" 这种让人懵的报错
 */
async function postSync(body) {
  const resp = await fetch(syncEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const text = await resp.text()
  if (!text || !text.trim()) {
    throw new Error('同步服务未响应（functions/api/sync 未部署或 KV 未绑定），请检查 Cloudflare 部署设置')
  }
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error('同步服务返回异常（' + resp.status + '）：' + text.slice(0, 80))
  }
}

/**
 * 生成 6 位配对码（大写字母+数字，排除易混字符）
 */
function genPairCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  // 去掉 I L O 0 1
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/**
 * 创建配对：生成配对码，把本地数据推上去，标记自己为 A
 */
async function createPair() {
  const data = Store.get()
  let code, attempts = 0
  // 尝试生成不冲突的配对码
  while (attempts < 5) {
    code = genPairCode()
    const r = await postSync({ pairCode: code, action: 'create', data: stripForSync(data) })
    if (r.ok) {
      Store.update(d => ({ ...d, pairCode: code, pairId: 'A' }))
      Store.data._paired = true
      return code
    }
    // 配对码冲突，重试
    attempts++
  }
  throw new Error('生成配对码失败，请重试')
}

/**
 * 加入配对：输入配对码，拉取对方数据，标记自己为 B
 */
async function joinPair(code) {
  code = (code || '').toUpperCase().trim()
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('配对码格式不对')

  const r = await postSync({ pairCode: code, action: 'join' })
  if (!r.ok) throw new Error(r.error || '加入失败')

  // 合并对方数据到本地
  const local = Store.get()
  const merged = mergeData(local, r.data || {})
  // 标记自己为 B，保留配对码
  merged.pairCode = code
  merged.pairId = 'B'
  Store.data = merged
  saveData(merged)

  // 推送合并后的数据回云端（让对方看到 B 的本地数据）
  await pushSync()
  Store.data._paired = true
  return true
}

/**
 * 拉取云端数据并合并到本地
 */
async function pullSync() {
  const data = Store.get()
  if (!data.pairCode) return null

  const r = await postSync({ pairCode: data.pairCode, action: 'pull' })
  if (!r.ok || !r.data) return null

  const local = Store.get()
  const merged = mergeData(local, r.data)
  merged.pairCode = data.pairCode
  merged.pairId = data.pairId || 'A'
  Store.data = merged
  saveData(merged)
  return merged
}

/**
 * 推送本地数据到云端
 * 注意：照片等大字段可能超出 KV 值大小限制，剥离掉
 */
async function pushSync() {
  const data = Store.get()
  if (!data.pairCode) return false

  const r = await postSync({ pairCode: data.pairCode, action: 'push', data: stripForSync(data) })
  return r.ok
}

/**
 * 剥离同步数据：默认保留全部字段（含约会瞬间的照片）。
 * 前端上传时已把照片压缩到 800px / jpeg 0.75，单张约 80–150KB，9 张也就 ~1MB，
 * 远在 KV 单值 25MB 上限之内，可以放心同步，让对方直接看到照片。
 * 仅当整体体积过大（瞬间攒得特别多）时降级：从最旧的瞬间开始逐条丢弃照片，
 * 优先保住卡片/文字等核心数据能正常同步，不至于整包同步失败。
 */
function stripForSync(data) {
  const stripped = JSON.parse(JSON.stringify(data))
  const MAX = 6 * 1024 * 1024 // 6MB 安全阈值
  const sizeOf = () => JSON.stringify(stripped).length
  if (sizeOf() > MAX && stripped.moments && stripped.moments.length) {
    // 从最旧到最新逐条清空照片，直到回到阈值内；仍超则全部清空
    const ordered = [...stripped.moments].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    for (const m of ordered) {
      m.photos = []
      if (sizeOf() <= MAX) break
    }
  }
  return stripped
}

/**
 * 解绑配对
 */
function unpair() {
  Store.update(d => ({ ...d, pairCode: '', pairId: '' }))
  Store.data._paired = false
}

/**
 * 完整同步：pull → merge → push
 */
async function syncData() {
  if (!SYNC_ENABLED) return null
  const data = Store.get()
  if (!data.pairCode) return null
  try {
    await pullSync()
    await pushSync()
    Store.update(d => ({ ...d, lastSyncAt: Date.now() }))
    return true
  } catch (e) {
    console.warn('同步失败', e)
    return false
  }
}

/**
 * 合并两份数据（本地 + 云端）
 * 数组按 id 合并，同 id 取 createdAt 更大的（更新的）
 */
function mergeData(local, remote) {
  if (!remote || remote.schemaVersion === undefined) return local
  const merged = { ...local }
  Object.keys(defaultData()).forEach(key => {
    const lv = local[key]
    const rv = remote[key]

    // 头像：按修改时间戳取新，绝不拿占位符/旧值覆盖
    if (key === 'avatarA' || key === 'avatarB') {
      const tsKey = key + 'UpdatedAt'
      const lts = local[tsKey] || 0
      const rts = remote[tsKey] || 0
      const lOK = typeof lv === 'string' && lv.startsWith('data:image')
      const rOK = typeof rv === 'string' && rv.startsWith('data:image')
      if (rOK && (!lOK || rts > lts)) {
        merged[key] = rv            // 云端是真实头像且更新（或本地没有）
      } else if (lOK) {
        merged[key] = lv            // 保留本地（本地更新，或云端是占位符/空/旧）
      }
      return
    }
    // 头像时间戳由上面的头像分支管理，跳过标量覆盖
    if (key === 'avatarAUpdatedAt' || key === 'avatarBUpdatedAt') return

    if (Array.isArray(lv) && Array.isArray(rv)) {
      // 数组合并：按 id 去重
      const map = {}
      ;[...lv, ...rv].forEach(item => {
        if (item && item.id) {
          const existing = map[item.id]
          if (!existing || (item.createdAt || 0) > (existing.createdAt || 0)) {
            map[item.id] = item
          } else if (existing && item.done !== undefined) {
            // todo/food 的 done 状态取 true 优先
            map[item.id] = item.done ? item : existing
          }
        }
      })
      merged[key] = Object.values(map)
    } else if (typeof rv !== 'undefined' && rv !== null && typeof rv !== 'object') {
      // 标量取云端（假设云端是更新的）
      merged[key] = rv
    } else if (typeof rv === 'object' && rv !== null && !Array.isArray(rv)) {
      merged[key] = { ...lv, ...rv }
    }
  })
  merged.lastSyncAt = Date.now()
  return merged
}

// ===== 对外 API =====
const Store = {
  data: null,

  init() {
    this.data = loadData()
    return this.data
  },

  get() {
    if (!this.data) this.data = loadData()
    return this.data
  },

  update(updater) {
    const data = this.get()
    const next = typeof updater === 'function' ? updater({ ...data }) : { ...data, ...updater }
    next.schemaVersion = SCHEMA_VERSION
    this.data = next
    saveData(next)
    // 联网时自动推送（防抖：500ms 内多次操作只推一次）
    if (next.pairCode) {
      clearTimeout(this._pushTimer)
      this._pushTimer = setTimeout(() => pushSync().catch(() => {}), 500)
    }
    return next
  },

  // 配对
  setPair(code, myId) {
    this.update(d => ({ ...d, pairCode: code, pairId: myId }))
  },

  // 云端同步
  createPair, joinPair, unpair, pullSync, pushSync, syncData,

  // 重置
  reset() {
    this.data = defaultData()
    saveData(this.data)
  },

  // 导出/导入（备份用）
  export() {
    return JSON.stringify(this.get(), null, 2)
  },

  import(jsonStr) {
    try {
      const data = JSON.parse(jsonStr)
      this.data = migrateData(data)
      saveData(this.data)
      return true
    } catch (e) {
      return false
    }
  }
}
