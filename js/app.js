/**
 * 小c的心愿口袋 —— 主应用
 * PWA 单页应用，路由 + 页面渲染 + 交互逻辑
 */

// 导入依赖（全局变量模式，PWA 不用打包工具）
// store.js / config.js / date.js 在 HTML 中先于本文件加载

const App = {
  currentTab: 'home',
  history: [],

  init() {
    Store.init()
    this.bindEvents()
    this.checkFirstRun()
    this.route('home')
    // 已配对：启动时拉取云端数据
    const data = Store.get()
    if (data.pairCode) {
      Store.pullSync().then(() => {
        if (App.currentTab === 'home') Pages.home.render()
      }).catch(() => {})
      // 每 60 秒自动拉取一次
      setInterval(() => Store.pullSync().then(() => {
        if (App.currentTab === 'home') Pages.home.render()
      }).catch(() => {}), 60000)
    }
  },

  bindEvents() {
    // 底部 tab 导航
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => this.route(t.dataset.tab))
    })
    // 浏览器后退
    window.addEventListener('popstate', () => {
      if (this.history.length > 0) {
        this.history.pop()
        const prev = this.history[this.history.length - 1] || 'home'
        this.route(prev, true)
      }
    })
  },

  checkFirstRun() {
    const data = Store.get()
    if (!data.togetherSince && !data.pairCode) {
      // 首次使用，延迟一下让首页先渲染
      setTimeout(() => Pages.home.showSetup(), 500)
    }
  },

  route(tab, skipHistory) {
    if (!skipHistory && this.currentTab !== tab) {
      this.history.push(this.currentTab)
    }
    this.currentTab = tab
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab)
    })
    // 滚动到顶
    document.getElementById('app').scrollTop = 0
    window.scrollTo(0, 0)
    // 渲染对应页面
    const page = Pages[tab]
    if (page) page.render()
  },

  // 弹层
  showSheet(html) {
    document.getElementById('sheet').innerHTML = html
    document.getElementById('mask').classList.add('show')
    document.getElementById('sheet').classList.add('show')
  },

  closeSheet() {
    document.getElementById('mask').classList.remove('show')
    document.getElementById('sheet').classList.remove('show')
  },

  // toast
  toast(msg) {
    const t = document.createElement('div')
    t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(74,63,63,0.85);color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;z-index:9999;pointer-events:none;'
    t.textContent = msg
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 1500)
  }
}

// ===== 页面对象 =====
const Pages = {}

// ---------- 首页 ----------
Pages.home = {
  render() {
    const d = Store.get()
    const greeting = this.getGreeting()

    // 头像（只认 data:image，防止同步占位符渲染成碎图）
    const avatarA = (d.avatarA && d.avatarA.startsWith('data:image')) ? `<img src="${d.avatarA}" class="hero-avatar-img">` : `<div class="hero-avatar-ph">${(d.partnerNameA || 'A')[0]}</div>`
    const avatarB = (d.avatarB && d.avatarB.startsWith('data:image')) ? `<img src="${d.avatarB}" class="hero-avatar-img">` : `<div class="hero-avatar-ph">${(d.partnerNameB || 'B')[0]}</div>`
    const nameA = d.partnerNameA || '我'
    const nameB = d.partnerNameB || '对方'

    // 主卡：头像 + 在一起天数
    let heroHtml
    if (d.togetherSince) {
      const days = daysSince(d.togetherSince)
      heroHtml = `<div class="hero-card float-in">
        <div class="hero-avatar" onclick="Pages.home.changeAvatar('A')">
          ${avatarA}<span class="hero-name">${nameA}</span>
        </div>
        <div class="hero-center" onclick="Pages.home.showSetup()">
          <span class="hero-days-prefix">在一起</span>
          <div class="hero-days-row"><span class="hero-days">${days}</span><span class="hero-days-unit">天</span></div>
        </div>
        <div class="hero-avatar" onclick="Pages.home.changeAvatar('B')">
          ${avatarB}<span class="hero-name">${nameB}</span>
        </div>
      </div>`
    } else {
      heroHtml = `<div class="hero-card float-in">
        <div class="hero-avatar" onclick="Pages.home.changeAvatar('A')">${avatarA}<span class="hero-name">${nameA}</span></div>
        <div class="hero-center" onclick="Pages.home.showSetup()">
          <span class="hero-set">设置在一起的日期 ›</span>
        </div>
        <div class="hero-avatar" onclick="Pages.home.changeAvatar('B')">${avatarB}<span class="hero-name">${nameB}</span></div>
      </div>`
    }

    // 倒计时小卡
    let cdCard
    if (d.nextMeet && d.nextMeet.date) {
      const days = Math.max(0, daysBetween(d.nextMeet.date))
      cdCard = `<div class="mini-card float-in" onclick="App.route('countdown')">
        <span class="mini-emoji">${days === 0 ? '🎉' : '⏳'}</span>
        <span class="mini-num">${days}<text class="mini-unit">天</text></span>
        <span class="mini-label">后见面</span>
      </div>`
    } else {
      cdCard = `<div class="mini-card float-in" onclick="App.route('countdown')">
        <span class="mini-emoji">🗓️</span>
        <span class="mini-label" style="margin-top:6px;">设定见面日期</span>
      </div>`
    }

    // 纪念日小卡
    const annis = (d.anniversaries || []).map(a => ({
      ...a,
      daysTo: a.repeat === 'yearly' ? daysBetween(nextAnniversaryDate(a)) : daysBetween(a.date)
    })).filter(a => a.daysTo >= 0).sort((a, b) => a.daysTo - b.daysTo)
    let anniCard
    if (annis.length > 0) {
      const a = annis[0]
      anniCard = `<div class="mini-card float-in" onclick="App.route('anniversary')">
        <span class="mini-emoji">${a.emoji || '💕'}</span>
        <span class="mini-num">${a.daysTo}<text class="mini-unit">天</text></span>
        <span class="mini-label">${a.title.length > 6 ? a.title.slice(0,6)+'…' : a.title}</span>
      </div>`
    } else {
      anniCard = `<div class="mini-card float-in" onclick="App.route('anniversary')">
        <span class="mini-emoji">🎂</span>
        <span class="mini-label" style="margin-top:6px;">添加纪念日</span>
      </div>`
    }

    // 快捷操作
    const wishes = (d.wishes || []).sort((a,b) => b.createdAt - a.createdAt)
    const moments = (d.moments || []).sort((a,b) => (b.date+b.createdAt).localeCompare(a.date+a.createdAt))

    let entriesHtml = `
      <div class="quick-row float-in">
        <div class="quick-item" onclick="Pages.wishes.openPicker()"><span class="quick-emoji">✨</span><span class="quick-label">送卡片</span></div>
        <div class="quick-item" onclick="App.route('food'); setTimeout(()=>Pages.food.roll(),350)"><span class="quick-emoji">🎲</span><span class="quick-label">吃啥</span></div>
        <div class="quick-item" onclick="Pages.moments.openEditor()"><span class="quick-emoji">📸</span><span class="quick-label">记瞬间</span></div>
        <div class="quick-item" onclick="Pages.home.showSetup()"><span class="quick-emoji">⚙️</span><span class="quick-label">设置</span></div>
      </div>`

    // 最新心愿卡
    let wishHtml = ''
    if (wishes[0]) {
      const w = wishes[0]
      wishHtml = `<div class="section float-in">
        <div class="section-header"><span class="section-title">最新心愿卡</span><span class="section-more" onclick="App.route('wishes')">全部 ${wishes.length} ›</span></div>
        <div class="wish-card" style="background:${w.color};" onclick="Pages.wishes.openDetail('${w.id}')">
          <div class="wish-card-top"><span class="wish-emoji">${w.emoji}</span><span class="wish-status ${w.received ? 'received' : ''}">${w.received ? '已收到' : '待领取'}</span></div>
          <span class="wish-title">${w.title}</span><span class="wish-desc">${w.desc}</span>
          <div class="wish-card-bottom"><span>${formatDateTime(w.createdAt)}</span><span>来自 ${w.from}</span></div>
        </div>
      </div>`
    }

    // 最新瞬间
    let momentHtml = ''
    if (moments[0]) {
      const m = moments[0]
      const cover = m.photos.length > 0
        ? `<img class="moment-cover" src="${m.photos[0]}">`
        : `<div class="moment-cover placeholder-cover"><span>📷</span></div>`
      momentHtml = `<div class="section float-in">
        <div class="section-header"><span class="section-title">最近一次见面</span><span class="section-more" onclick="App.route('moments')">全部 ${moments.length} 次 ›</span></div>
        <div class="latest-moment-card" onclick="Pages.moments.openDetail('${m.id}')">
          ${cover}
          <div class="moment-info">
            <span class="moment-title-sm">${m.title}</span>
            <div class="moment-meta"><span class="moment-date-sm">${m.date}</span><span class="moment-mood-sm">${m.mood} ${m.moodLabel}</span></div>
            ${m.place ? `<span class="moment-place-sm">📍 ${m.place}</span>` : ''}
            ${m.photos.length > 0 ? `<span class="moment-photos-count">${m.photos.length} 张照片</span>` : ''}
          </div>
        </div>
      </div>`
    }

    let welcomeHtml = ''
    if (!wishes[0] && !moments[0] && !d.togetherSince) {
      welcomeHtml = `<div class="welcome-hint float-in"><span class="hint-emoji">🌙</span><span class="hint-text">开始记录你们的故事\n送一张心愿卡，或记下第一次见面</span></div>`
    }

    document.getElementById('app').innerHTML = `
      <div class="container">
        <div class="header float-in">
          <span class="greeting">${greeting}，${nameA}</span>
          <div class="title-row"><span class="page-title">小c的心愿口袋</span></div>
        </div>

        ${heroHtml}

        <div class="mini-row">${cdCard}${anniCard}</div>

        ${entriesHtml}
        ${wishHtml}
        ${momentHtml}
        ${welcomeHtml}
      </div>`
  },

  getGreeting() {
    const h = new Date().getHours()
    if (h < 6) return '夜深了，记得早点休息'
    if (h < 11) return '早安，今天也要好好吃饭'
    if (h < 14) return '中午啦，想你了没'
    if (h < 18) return '下午好，距离见面又近一天'
    if (h < 22) return '晚上好，今天辛苦啦'
    return '睡前记得互道晚安'
  },

  // 设置/修改在一起日期 + 昵称 + 配对
  showSetup() {
    const d = Store.get()
    // 配对区
    let pairHtml = ''
    if (d.pairCode) {
      // 已配对
      pairHtml = `
        <div class="pair-status">
          <span class="label">双人同步</span>
          <div class="pair-box pair-connected">
            <span class="pair-icon">🔗</span>
            <div class="pair-info">
              <span class="pair-title">已连接 · ${d.pairId === 'A' ? 'A端' : 'B端'}</span>
              <span class="pair-code">${d.pairCode}</span>
            </div>
            <span class="pair-sync-btn" onclick="Pages.home.manualSync()">🔄</span>
          </div>
          <div style="font-size:12px;color:var(--color-text-light);margin-top:6px;">对方输入这个配对码即可连接，数据自动双向同步</div>
          <button class="btn-ghost" style="margin-top:8px;color:#E8807C;border-color:#FFD3D0;" onclick="Pages.home.unpair()">解绑</button>
        </div>`
    } else {
      // 未配对
      pairHtml = `
        <div class="pair-status">
          <span class="label">双人同步</span>
          <div class="pair-box">
            <span class="pair-icon">💭</span>
            <div class="pair-info">
              <span class="pair-title">未连接</span>
              <span class="pair-sub">连接后两台手机数据自动同步</span>
            </div>
          </div>
          <button class="btn-primary" onclick="Pages.home.createPair()">🔗 创建配对码</button>
          <div style="text-align:center;font-size:13px;color:var(--color-text-light);margin:8px 0;">—— 或 ——</div>
          <span class="label">输入对方的配对码加入</span>
          <div style="display:flex;gap:8px;">
            <input class="input" id="joinCode" placeholder="6位配对码" maxlength="6" style="text-transform:uppercase;flex:1;letter-spacing:2px;">
            <button class="btn-primary" style="width:auto;padding:0 16px;" onclick="Pages.home.joinPair()">加入</button>
          </div>
        </div>`
    }

    App.showSheet(`
      <div class="sheet-header"><span class="sheet-title">我们的信息</span><span class="sheet-close" onclick="App.closeSheet()">✕</span></div>
      <span class="label">在一起的日子</span>
      <input class="input" type="date" id="setupDate" value="${d.togetherSince || ''}">
      <span class="label">你的昵称</span>
      <input class="input" id="setupNameA" placeholder="比如：小明" value="${d.partnerNameA || ''}" maxlength="8">
      <span class="label">对方的昵称</span>
      <input class="input" id="setupNameB" placeholder="比如：小红" value="${d.partnerNameB || ''}" maxlength="8">
      <button class="btn-primary" onclick="Pages.home.saveSetup()">保存</button>
      ${pairHtml}
      <div class="pair-status" style="margin-top:18px;border-top:1px dashed var(--color-border);padding-top:16px;">
        <span class="label">📦 手动同步（无需联网，推荐）</span>
        <div style="display:flex;gap:8px;margin:8px 0;">
          <button class="btn-ghost" style="flex:1;" onclick="Pages.home.exportData()">📤 导出我的数据</button>
          <button class="btn-ghost" style="flex:1;" onclick="Pages.home.importData()">📥 导入对方数据</button>
        </div>
        <div style="font-size:11px;color:var(--color-text-light);line-height:1.5;">导出后通过微信把内容发给对方，对方粘贴到"导入"即可共享全部心愿、瞬间、倒计时和纪念日。头像和照片各自保留，不会互相覆盖。</div>
        <textarea id="syncBox" class="input" placeholder="把对方发来的数据粘贴到这里，再点一次「导入对方数据」" style="display:none;height:120px;margin-top:8px;font-size:12px;"></textarea>
      </div>
      <div class="pair-status" style="margin-top:16px;">
        <span class="label">🔧 同步服务器地址（可选 · 用于联网自动同步）</span>
        <input class="input" id="setupSyncServer" placeholder="https://你的worker子域.workers.dev" value="${d.syncServer || ''}" style="font-size:13px;">
        <div style="font-size:11px;color:var(--color-text-light);line-height:1.5;margin-top:6px;">留空则使用本站自带同步（需服务端 Functions 已部署）。若填入独立 Worker 地址，两人即可实时联网同步（创建配对码 / 加入 / 自动双向更新）。</div>
      </div>
    `)
  },

  // 创建配对码
  async createPair() {
    App.toast('生成配对码中...')
    try {
      const code = await Store.createPair()
      App.toast('配对码：' + code + ' ✓')
      this.showSetup()  // 刷新弹层显示配对码
    } catch (e) {
      App.toast(e.message || '创建失败')
    }
  },

  // 加入配对
  async joinPair() {
    const code = document.getElementById('joinCode').value.trim()
    if (!code) { App.toast('请输入配对码'); return }
    App.toast('连接中...')
    try {
      await Store.joinPair(code)
      App.toast('连接成功 ❤️')
      this.render()
      setTimeout(() => this.showSetup(), 100)
    } catch (e) {
      App.toast(e.message || '连接失败')
    }
  },

  // 手动同步
  async manualSync() {
    App.toast('同步中...')
    try {
      await Store.syncData()
      App.toast('已同步 ✓')
      this.render()
    } catch (e) {
      App.toast('同步失败')
    }
  },

  // 解绑
  unpair() {
    if (confirm('确定解绑？本地数据保留，但不再同步')) {
      Store.unpair()
      App.toast('已解绑')
      this.render()
      setTimeout(() => this.showSetup(), 100)
    }
  },

  // 导出数据（纯前端，无需联网/服务端）
  // 仅剥离头像与配对状态，避免互相覆盖；照片保留（前端已压缩很小）
  exportData() {
    try {
      const d = Store.get()
      const out = { ...d }
      delete out.avatarA; delete out.avatarB
      delete out.avatarAUpdatedAt; delete out.avatarBUpdatedAt
      delete out.pairCode; delete out.pairId
      const txt = JSON.stringify(out)
      const fallback = () => {
        const box = document.getElementById('syncBox')
        if (box) { box.style.display = 'block'; box.value = txt; box.focus(); box.select() }
        App.toast('已生成，长按上方文本框全选复制发给对方')
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(
          () => App.toast('已复制 ✓ 通过微信发给对方即可'),
          () => fallback()
        )
      } else {
        fallback()
      }
    } catch (e) {
      App.toast('导出失败')
    }
  },

  // 导入数据（纯前端，无需联网/服务端）
  // 第一次点：显示输入框；粘贴后第二次点：执行合并（保留本机头像、不带入对方配对状态）
  importData() {
    const box = document.getElementById('syncBox')
    if (!box) return
    if (box.style.display === 'none' || !box.value.trim()) {
      box.style.display = 'block'
      box.focus()
      App.toast('把对方发来的数据粘贴到这里，再点一次「导入对方数据」')
      return
    }
    const txt = box.value.trim()
    const localA = Store.get().avatarA
    const localB = Store.get().avatarB
    const ok = Store.import(txt)
    if (!ok) { App.toast('内容格式不对，检查下对方发来的数据'); return }
    // 保留本机头像；不带入对方的配对码/身份（这是"共享数据"不是"配对"）
    Store.update(d => ({ ...d, avatarA: localA, avatarB: localB, pairCode: '', pairId: '' }))
    App.toast('导入成功 ❤️ 数据已共享')
    this.render()
    setTimeout(() => this.showSetup(), 100)
  },

  saveSetup() {
    const date = document.getElementById('setupDate').value
    const nameA = document.getElementById('setupNameA').value.trim()
    const nameB = document.getElementById('setupNameB').value.trim()
    const syncServer = (document.getElementById('setupSyncServer')?.value || '').trim()
    Store.update(d => ({ ...d, togetherSince: date, partnerNameA: nameA, partnerNameB: nameB, syncServer }))
    App.closeSheet()
    App.toast('已保存 ❤️')
    this.render()
  },

  // 换头像
  changeAvatar(who) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        // 压缩到小尺寸
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const size = 120
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          // 居中裁剪
          const min = Math.min(img.width, img.height)
          const sx = (img.width - min) / 2
          const sy = (img.height - min) / 2
          ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
          Store.update(d => ({ ...d, [`avatar${who}`]: dataUrl, [`avatar${who}UpdatedAt`]: Date.now() }))
          this.render()
          App.toast('头像已更新')
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }
}

// ---------- 心愿池 ----------
Pages.wishes = {
  render() {
    const d = Store.get()
    const wishes = (d.wishes || []).sort((a,b) => b.createdAt - a.createdAt)
    let html = `<div class="container">
      <div class="header float-in"><div class="title-row"><span class="page-title">心愿池</span><span class="title-emoji">💌</span></div>
      <span class="page-subtitle">给对方一张小卡片，不用回复，收到就好</span></div>`

    if (wishes.length === 0) {
      html += `<div class="empty"><span class="empty-emoji">🌸</span><span class="empty-text">心愿池还是空的\n送出第一张卡片吧</span></div>`
    } else {
      wishes.forEach(w => {
        html += `<div class="wish-card float-in" style="background:${w.color};" onclick="Pages.wishes.openDetail('${w.id}')">
          <div class="wish-card-top"><span class="wish-emoji">${w.emoji}</span><span class="wish-status ${w.received ? 'received' : ''}">${w.received ? '已收到' : '待领取'}</span></div>
          <span class="wish-title">${w.title}</span><span class="wish-desc">${w.desc}</span>
          <div class="wish-card-bottom"><span>${formatDateTime(w.createdAt)}</span><span>来自 ${w.from}</span></div>
        </div>`
      })
    }
    html += `<div class="send-bar"><button class="btn-primary" onclick="Pages.wishes.openPicker()">✨ 送一张心愿卡</button></div></div>`
    document.getElementById('app').innerHTML = html
  },

  openPicker() {
    const d = Store.get()
    const all = [...cardTypes, ...(d.customCards || []).map(c => ({...c, isCustom: true}))]
    let items = all.map((c, i) => `<div class="picker-item" style="background:${c.color};" onclick="Pages.wishes.chooseType(${i})"><span class="picker-emoji">${c.emoji}</span><div class="picker-info"><span class="picker-item-title">${c.title}${c.isCustom ? ' ✦' : ''}</span><span class="picker-item-hint">${c.hint || c.desc}</span></div></div>`).join('')
    items += `<div class="picker-item custom-item" onclick="Pages.wishes.openCustom()"><span class="picker-emoji">✏️</span><div class="picker-info"><span class="picker-item-title">自定义一张卡</span><span class="picker-item-hint">专属你们的卡片</span></div></div>`
    App.showSheet(`<div class="sheet-header"><span class="sheet-title">选一张卡片</span><span class="sheet-close" onclick="App.closeSheet()">✕</span></div>${items}`)
  },

  chooseType(i) {
    const d = Store.get()
    const all = [...cardTypes, ...(d.customCards || []).map(c => ({...c, isCustom: true}))]
    this._chosen = all[i]
    this._from = 'me'
    this.openEditor()
  },

  openEditor() {
    const t = this._chosen
    const recipient = this._from === 'me' ? (Store.get().partnerNameB || '你') : (Store.get().partnerNameA || '我')
    App.showSheet(`<div class="sheet-header"><span class="sheet-close" onclick="App.closeSheet()">✕</span><span class="sheet-title">送给${recipient}</span></div>
      <div class="detail-card" style="background:${t.color};padding:24px 16px;margin-bottom:16px;"><span style="font-size:48px;display:block;margin-bottom:8px;">${t.emoji}</span><span style="display:block;font-size:18px;font-weight:700;margin-bottom:4px;">${t.title}</span><span style="display:block;font-size:13px;opacity:0.8;">${t.desc}</span></div>
      <textarea class="input textarea" id="msgInput" placeholder="想说点什么？（可不写）" maxlength="80"></textarea>
      <div style="display:flex;align-items:center;margin-bottom:16px;"><span style="font-size:14px;color:var(--color-text-light);margin-right:12px;">来自：</span><div style="display:flex;gap:8px;"><span id="fromMe" style="padding:6px 16px;border-radius:16px;background:var(--color-primary);color:#fff;font-size:13px;cursor:pointer;" onclick="Pages.wishes.switchFrom('me')">我</span><span id="fromYou" style="padding:6px 16px;border-radius:16px;background:var(--color-bg);color:var(--color-text-light);font-size:13px;cursor:pointer;" onclick="Pages.wishes.switchFrom('you')">对方</span></div></div>
      <button class="btn-primary" onclick="Pages.wishes.send()">送出 💌</button>`)
  },

  switchFrom(who) {
    this._from = who
    const d = Store.get()
    const recipient = who === 'me' ? (d.partnerNameB || '你') : (d.partnerNameA || '我')
    document.getElementById('fromMe').style.background = who === 'me' ? 'var(--color-primary)' : 'var(--color-bg)'
    document.getElementById('fromMe').style.color = who === 'me' ? '#fff' : 'var(--color-text-light)'
    document.getElementById('fromYou').style.background = who === 'you' ? 'var(--color-primary)' : 'var(--color-bg)'
    document.getElementById('fromYou').style.color = who === 'you' ? '#fff' : 'var(--color-text-light)'
    document.querySelector('.sheet-title').textContent = '送给' + recipient
  },

  send() {
    const msg = document.getElementById('msgInput').value
    const t = this._chosen
    const wish = {
      id: 'w_' + Date.now(), type: t.key, emoji: t.emoji, title: t.title, desc: t.desc,
      color: t.color, isCustom: !!t.isCustom, message: msg,
      from: this._from === 'me' ? '我' : '对方', received: false, createdAt: Date.now()
    }
    Store.update(d => ({ ...d, wishes: [...(d.wishes||[]), wish] }))
    App.closeSheet()
    App.toast('已送出 💌')
    Pages[App.currentTab].render()
  },

  _customEmoji: '🌟', _customTitle: '', _customDesc: '', _customColor: '#FFE0EC',

  openCustom() {
    this._customEmoji = '🌟'; this._customTitle = ''; this._customDesc = ''; this._customColor = '#FFE0EC'
    this.renderCustom()
  },

  renderCustom() {
    let emojiHtml = customEmojis.map(e => `<span class="emoji-cell ${this._customEmoji === e ? 'active' : ''}" onclick="Pages.wishes.pickEmoji('${e}')">${e}</span>`).join('')
    let colorHtml = customColors.map(c => `<div class="color-cell ${this._customColor === c ? 'active' : ''}" style="background:${c};" onclick="Pages.wishes.pickColor('${c}')"></div>`).join('')
    App.showSheet(`<div class="sheet-header"><span class="sheet-close" onclick="App.closeSheet()">✕</span><span class="sheet-title">自定义卡片</span></div>
      <div class="detail-card" id="customPreview" style="background:${this._customColor};padding:24px 16px;margin-bottom:16px;"><span style="font-size:48px;display:block;margin-bottom:8px;">${this._customEmoji}</span><span style="display:block;font-size:18px;font-weight:700;margin-bottom:4px;">${this._customTitle || '卡片名字'}</span><span style="display:block;font-size:13px;opacity:0.8;">${this._customDesc || '一句话描述'}</span></div>
      <span class="label">选个图标</span><div class="emoji-grid">${emojiHtml}</div>
      <span class="label">卡片名字</span><input class="input" id="customTitleInput" placeholder="比如：深夜煲电话粥卡" value="${this._customTitle}" maxlength="12" oninput="Pages.wishes._customTitle=this.value; Pages.wishes.updateCustomPreview()">
      <span class="label">描述（可不写）</span><textarea class="input textarea" id="customDescInput" placeholder="这张卡可以用来做什么" maxlength="40" oninput="Pages.wishes._customDesc=this.value; Pages.wishes.updateCustomPreview()">${this._customDesc}</textarea>
      <span class="label">选个颜色</span><div class="color-grid">${colorHtml}</div>
      <button class="btn-primary" onclick="Pages.wishes.saveCustom()">创建并送出 💌</button>`)
  },

  updateCustomPreview() {
    const p = document.getElementById('customPreview')
    if (p) {
      p.innerHTML = `<span style="font-size:48px;display:block;margin-bottom:8px;">${this._customEmoji}</span><span style="display:block;font-size:18px;font-weight:700;margin-bottom:4px;">${this._customTitle || '卡片名字'}</span><span style="display:block;font-size:13px;opacity:0.8;">${this._customDesc || '一句话描述'}</span>`
      p.style.background = this._customColor
    }
  },

  pickEmoji(e) { this._customEmoji = e; this.renderCustom() },
  pickColor(c) { this._customColor = c; this.renderCustom() },

  saveCustom() {
    if (!this._customTitle.trim()) { App.toast('给卡片起个名字吧'); return }
    const card = { key: 'custom_' + Date.now(), emoji: this._customEmoji, title: this._customTitle.trim(), desc: this._customDesc.trim() || '一张专属你们的卡片', color: this._customColor, isCustom: true }
    Store.update(d => ({ ...d, customCards: [...(d.customCards||[]), card] }))
    this._chosen = card; this._from = 'me'; this.openEditor()
  },

  _detailId: null,

  openDetail(id) {
    this._detailId = id
    App.history.push('wishes')
    this.renderDetail()
  },

  renderDetail() {
    const w = Store.get().wishes.find(x => x.id === this._detailId)
    if (!w) { App.route('wishes'); return }
    let html = `<div class="container"><div class="detail-card float-in" style="background:${w.color};"><span class="detail-emoji">${w.emoji}</span><span class="detail-title">${w.title}</span><span class="detail-desc">${w.desc}</span>`
    if (w.message) html += `<div class="detail-message"><span class="msg-text">${w.message}</span></div>`
    html += `<div class="detail-meta">来自 ${w.from} · ${formatDateTime(w.createdAt)}</div></div>`
    if (!w.received && w.from === '对方') html += `<div style="text-align:center;padding:16px;"><button class="btn-primary" onclick="Pages.wishes.receive()">收到 ❤️</button></div>`
    else if (w.received) html += `<div class="received-badge"><span class="badge-check">✓</span><br><span style="color:var(--color-primary);">已收到</span></div>`
    if (w.from === '我') html += `<span class="delete-link" onclick="Pages.wishes.delete()">删除这张卡</span>`
    html += `<div style="text-align:center;margin-top:16px;"><button class="btn-ghost" onclick="App.route('wishes')">返回心愿池</button></div></div>`
    document.getElementById('app').innerHTML = html
  },

  receive() {
    Store.update(d => ({ ...d, wishes: d.wishes.map(w => w.id === this._detailId ? { ...w, received: true } : w) }))
    App.toast('已收到 ❤️')
    this.renderDetail()
  },

  delete() {
    if (confirm('删除这张卡？')) {
      Store.update(d => ({ ...d, wishes: d.wishes.filter(w => w.id !== this._detailId) }))
      App.route('wishes')
    }
  }
}

// ---------- 倒计时 ----------
Pages.countdown = {
  render() {
    const d = Store.get()
    const nm = d.nextMeet
    let html = `<div class="container"><div class="header float-in"><span class="page-title">距离见面</span><span class="page-subtitle">把思念数成日子</span></div>`

    if (!nm || !nm.date) {
      html += `<div class="empty"><span class="empty-emoji">🗓️</span><span class="empty-text">还没有设定下次见面日期\n定一个，让等待有方向</span></div>`
      html += `<button class="btn-primary" onclick="Pages.countdown.editDate()">📅 设定见面日期</button>`
      html += this.renderLists()
      html += `</div>`
      document.getElementById('app').innerHTML = html
      return
    }

    const days = daysBetween(nm.date)
    let emoji = '🌙', gradient = 'linear-gradient(135deg, #F5B97A 0%, #E8807C 100%)', mood = '想你了，但日子总会到的 🌙'
    if (days <= 0) { emoji = '🎉'; gradient = 'linear-gradient(135deg, #E8807C 0%, #F5A882 100%)'; mood = '就是今天 🎉 见面吧！' }
    else if (days <= 3) { emoji = '🥺'; gradient = 'linear-gradient(135deg, #E8807C 0%, #FFD3D0 100%)'; mood = '马上就能抱到了 🥺' }
    else if (days <= 7) { emoji = '✨'; gradient = 'linear-gradient(135deg, #F5A882 0%, #F5B97A 100%)'; mood = '再坚持一下下 ✨' }
    const dt = new Date(nm.date)

    html += `<div class="cd-card float-in" style="background:${gradient};">
      <span class="cd-emoji">${emoji}</span>
      <div class="cd-days"><span class="cd-days-num">${Math.max(0,days)}</span><span class="cd-days-unit">天</span></div>
      <span class="cd-date">${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日</span>
      <span class="cd-mood">${mood}</span>
    </div>`

    html += this.renderLists()

    html += `<button class="btn-ghost" onclick="Pages.countdown.editDate()">修改见面日期</button>`
    if (days <= 0) html += `<button class="btn-ghost" style="color:var(--color-text-light);border-color:var(--color-border);" onclick="Pages.countdown.cancelMeet()">已经见面啦，标记完成</button>`
    html += `</div>`
    document.getElementById('app').innerHTML = html
  },

  renderLists() {
    const d = Store.get()
    return this.renderList('todo', '📝 见面想做的事', d.todoList || [], '比如：一起看日落')
         + this.renderList('food', '🍜 想一起吃的店', d.foodList || [], '比如：那家日料店')
  },

  renderList(type, title, list, placeholder) {
    const inputId = type + 'Input'
    let items = ''
    if (list.length > 0) {
      items = list.map(item => `
        <div class="list-item">
          <div class="check-box ${item.done ? 'checked' : ''}" onclick="Pages.countdown.toggle('${type}','${item.id}')">${item.done ? '<span class="check-mark">✓</span>' : ''}</div>
          <span class="list-item-text ${item.done ? 'done-text' : ''}" onclick="Pages.countdown.toggle('${type}','${item.id}')">${item.text}</span>
          <span class="list-delete" onclick="Pages.countdown.deleteItem('${type}','${item.id}')">✕</span>
        </div>`).join('')
    } else {
      items = `<div class="list-empty">还没有添加，点「+ 添加」开始记录</div>`
    }
    return `<div class="list-card float-in">
      <div class="list-header"><span class="list-title">${title}</span><span class="list-add-btn" onclick="Pages.countdown.toggleInput('${type}')">+ 添加</span></div>
      <div class="list-input-row" id="${type}InputRow" style="display:none;">
        <input class="list-input" id="${inputId}" placeholder="${placeholder}" maxlength="30" onkeydown="if(event.key==='Enter'){Pages.countdown.addItem('${type}');}">
        <span class="list-confirm" onclick="Pages.countdown.addItem('${type}')">确定</span>
      </div>
      ${items}
    </div>`
  },

  _showTodoInput: false, _showFoodInput: false,

  toggleInput(type) {
    if (type === 'todo') this._showTodoInput = !this._showTodoInput
    else this._showFoodInput = !this._showFoodInput
    this.render()
    setTimeout(() => {
      const el = document.getElementById(type + 'Input')
      const row = document.getElementById(type + 'InputRow')
      if (row) row.style.display = 'flex'
      if (el) el.focus()
    }, 50)
  },

  addItem(type) {
    const el = document.getElementById(type + 'Input')
    if (!el) return
    const text = el.value.trim()
    if (!text) return
    const item = { id: type[0] + '_' + Date.now(), text, done: false }
    Store.update(d => {
      const key = type === 'todo' ? 'todoList' : 'foodList'
      return { ...d, [key]: [...(d[key]||[]), item] }
    })
    this._showTodoInput = false; this._showFoodInput = false
    this.render()
  },

  toggle(type, id) {
    Store.update(d => {
      const key = type === 'todo' ? 'todoList' : 'foodList'
      return { ...d, [key]: (d[key]||[]).map(t => t.id === id ? { ...t, done: !t.done } : t) }
    })
    this.render()
  },

  deleteItem(type, id) {
    Store.update(d => {
      const key = type === 'todo' ? 'todoList' : 'foodList'
      return { ...d, [key]: (d[key]||[]).filter(t => t.id !== id) }
    })
    this.render()
  },

  editDate() {
    let opts = ''
    for (let i = 0; i <= 60; i++) {
      const dt = new Date(); dt.setDate(dt.getDate() + i)
      const ds = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
      const label = i === 0 ? '今天' : i === 1 ? '明天' : `${dt.getMonth()+1}月${dt.getDate()}日（${i}天后）`
      opts += `<div class="picker-item" style="background:var(--color-bg);" onclick="Pages.countdown.setDate('${ds}')"><span class="picker-emoji">📅</span><div class="picker-info"><span class="picker-item-title">${label}</span><span class="picker-item-hint">${ds}</span></div></div>`
    }
    App.showSheet(`<div class="sheet-header"><span class="sheet-title">选个日子</span><span class="sheet-close" onclick="App.closeSheet()">✕</span></div>${opts}`)
  },

  setDate(ds) {
    Store.update(d => ({ ...d, nextMeet: { date: ds } }))
    App.closeSheet()
    this.render()
  },

  cancelMeet() {
    if (confirm('标记见面完成？')) {
      Store.update(d => ({ ...d, nextMeet: null }))
      this.render()
    }
  }
}

// ---------- 约会瞬间 ----------
Pages.moments = {
  render() {
    const d = Store.get()
    const moments = [...(d.moments || [])].sort((a,b) => (b.date+b.createdAt).localeCompare(a.date+a.createdAt))
    let totalPhotos = moments.reduce((s, m) => s + (m.photos||[]).length, 0)

    let html = `<div class="container"><div class="header float-in"><div class="title-row"><span class="page-title">约会瞬间</span><span class="title-emoji">📷</span></div><span class="page-subtitle">记录每一次见面的碎片</span></div>`

    if (moments.length > 0) {
      html += `<div class="stats-bar float-in"><div class="stat-item"><span class="stat-num">${moments.length}</span><span class="stat-label">次记录</span></div><div class="stat-divider"></div><div class="stat-item"><span class="stat-num">${totalPhotos}</span><span class="stat-label">张照片</span></div></div>`

      const groups = {}
      moments.forEach(m => {
        const [y, mo] = m.date.split('-')
        const label = `${y}年${parseInt(mo)}月`
        if (!groups[label]) groups[label] = { label, items: [], photoCount: 0 }
        groups[label].items.push(m)
        groups[label].photoCount += (m.photos||[]).length
      })

      Object.values(groups).forEach(g => {
        html += `<div class="archive-group float-in"><div class="group-header"><span class="group-label">${g.label}</span><span class="group-count">${g.photoCount} 张照片</span></div>`
        if (g.photoCount > 0) {
          html += `<div class="photo-wall">`
          g.items.forEach(m => { (m.photos||[]).forEach(ph => { html += `<img class="archive-photo" src="${ph}" onclick="Pages.moments.preview('${ph}', [${m.photos.map(p=>`'${p}'`).join(',')}])">` }) })
          html += `</div>`
        }
        g.items.forEach(m => {
          const thumbs = (m.photos||[]).slice(0, 3)
          const more = (m.photos||[]).length - 3
          html += `<div class="moment-card" onclick="Pages.moments.openDetail('${m.id}')"><div class="moment-top"><span class="moment-date">${m.date}</span><span class="moment-mood">${m.mood} ${m.moodLabel}</span></div><span class="wish-title" style="font-size:16px;">${m.title}</span>`
          if (m.place) html += `<div class="moment-place"><span>📍 ${m.place}</span></div>`
          if ((m.photos||[]).length > 0) {
            html += `<div class="moment-photos">`
            thumbs.forEach(ph => { html += `<img class="moment-thumb" src="${ph}" onclick="event.stopPropagation();Pages.moments.preview('${ph}', [${m.photos.map(p=>`'${p}'`).join(',')}])">` })
            if (more > 0) html += `<div class="more-badge">+${more}</div>`
            html += `</div>`
          }
          html += `</div>`
        })
        html += `</div>`
      })
    } else {
      html += `<div class="empty"><span class="empty-emoji">📸</span><span class="empty-text">还没有约会记录\n记下你们的第一张瞬间</span></div>`
    }
    html += `<div class="send-bar"><button class="btn-primary" onclick="Pages.moments.openEditor()">✨ 记一个瞬间</button></div></div>`
    document.getElementById('app').innerHTML = html
  },

  _title: '', _place: '', _date: '', _moodIndex: 0, _photos: [],

  openEditor() {
    this._title = ''; this._place = ''; this._date = getToday(); this._moodIndex = 0; this._photos = []
    this.renderEditor()
  },

  renderEditor() {
    let moodHtml = moods.map((m, i) => `<div class="mood-cell ${this._moodIndex === i ? 'active' : ''}" onclick="Pages.moments.pickMood(${i})"><span class="mood-emoji">${m.emoji}</span><span class="mood-text">${m.label}</span></div>`).join('')
    let photoHtml = this._photos.map((p, i) => `<div class="photo-preview"><img class="photo-img" src="${p}"><span class="photo-remove" onclick="Pages.moments.removePhoto(${i})">✕</span></div>`).join('')
    if (this._photos.length < 9) photoHtml += `<div class="photo-add" onclick="Pages.moments.addPhoto()"><span class="add-icon">+</span><span class="add-text">添加</span></div>`
    App.showSheet(`<div class="sheet-header"><span class="sheet-close" onclick="App.closeSheet()">✕</span><span class="sheet-title">记一个瞬间</span></div>
      <span class="label">标题</span><input class="input" id="momTitle" placeholder="比如：七夕的第一顿饭" value="${this._title}" maxlength="20" oninput="Pages.moments._title=this.value">
      <span class="label">日期</span><input class="input" type="date" id="momDate" value="${this._date}" oninput="Pages.moments._date=this.value">
      <span class="label">地点（可不写）</span><input class="input" id="momPlace" placeholder="比如：杭州·西湖" value="${this._place}" maxlength="20" oninput="Pages.moments._place=this.value">
      <span class="label">心情</span><div class="mood-grid">${moodHtml}</div>
      <span class="label">照片（最多9张）</span><div class="photo-picker">${photoHtml}</div>
      <button class="btn-primary" onclick="Pages.moments.save()">记下来 ✨</button>`)
  },

  pickMood(i) { this._moodIndex = i; this.renderEditor() },

  addPhoto() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxW = 800
          const scale = Math.min(1, maxW / img.width)
          canvas.width = img.width * scale
          canvas.height = img.height * scale
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
          this._photos.push(dataUrl)
          this.renderEditor()
        }
        img.src = ev.target.result
      }
      reader.readAsDataURL(file)
    }
    input.click()
  },

  removePhoto(i) { this._photos.splice(i, 1); this.renderEditor() },

  save() {
    if (!this._title.trim()) { App.toast('记个标题吧'); return }
    const m = moods[this._moodIndex]
    const moment = {
      id: 'm_' + Date.now(), title: this._title.trim(), place: this._place.trim(),
      date: this._date, mood: m.emoji, moodLabel: m.label, photos: [...this._photos], createdAt: Date.now()
    }
    Store.update(d => ({ ...d, moments: [...(d.moments||[]), moment] }))
    App.closeSheet(); App.toast('已记录 ✨'); Pages[App.currentTab].render()
  },

  _detailId: null,

  openDetail(id) { this._detailId = id; App.history.push('moments'); this.renderDetail() },

  renderDetail() {
    const m = Store.get().moments.find(x => x.id === this._detailId)
    if (!m) { App.route('moments'); return }
    let html = `<div class="container"><div class="detail-header float-in"><span style="display:block;font-size:20px;font-weight:700;margin-bottom:12px;">${m.title}</span><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:13px;color:var(--color-text-light);">${m.date}</span><span class="detail-mood-tag">${m.mood} ${m.moodLabel}</span></div>`
    if (m.place) html += `<div style="font-size:14px;">📍 ${m.place}</div>`
    html += `</div>`
    if ((m.photos||[]).length > 0) { html += `<div>`; m.photos.forEach(ph => { html += `<img class="gallery-photo" src="${ph}" onclick="Pages.moments.preview('${ph}', [${m.photos.map(p=>`'${p}'`).join(',')}])">` }); html += `</div>` }
    html += `<span class="delete-link" onclick="Pages.moments.delete()">删除这条记录</span>`
    html += `<div style="text-align:center;margin-top:16px;"><button class="btn-ghost" onclick="App.route('moments')">返回瞬间</button></div></div>`
    document.getElementById('app').innerHTML = html
  },

  delete() {
    if (confirm('删除这条记录？')) {
      Store.update(d => ({ ...d, moments: d.moments.filter(x => x.id !== this._detailId) }))
      App.route('moments')
    }
  },

  preview(current, urls) {
    // 简单实现：新窗口打开
    window.open(current, '_blank')
  }
}

// ---------- 纪念日 ----------
Pages.anniversary = {
  render() {
    const d = Store.get()
    const annis = (d.anniversaries || []).map(a => {
      const daysTo = a.repeat === 'yearly' ? daysBetween(nextAnniversaryDate(a)) : daysBetween(a.date)
      return { ...a, daysTo }
    }).sort((a, b) => {
      // 未来的排前面（按天数升序），过期的排后面
      if (a.daysTo >= 0 && b.daysTo >= 0) return a.daysTo - b.daysTo
      if (a.daysTo < 0 && b.daysTo < 0) return b.daysTo - a.daysTo
      return a.daysTo >= 0 ? -1 : 1
    })

    let html = `<div class="container"><div class="header float-in"><div class="title-row"><span class="page-title">纪念日</span><span class="title-emoji">🎂</span></div><span class="page-subtitle">那些值得记住的日子</span></div>`

    if (annis.length === 0) {
      html += `<div class="empty"><span class="empty-emoji">🎂</span><span class="empty-text">还没有纪念日\n添加第一个吧</span></div>`
    } else {
      annis.forEach(a => {
        let badge, badgeColor
        if (a.daysTo === 0) { badge = '🎉 就是今天'; badgeColor = 'var(--color-primary)' }
        else if (a.daysTo > 0) { badge = `还有 ${a.daysTo} 天`; badgeColor = 'var(--color-accent)' }
        else { badge = `已过 ${Math.abs(a.daysTo)} 天`; badgeColor = 'var(--color-text-light)' }

        const dt = new Date(a.date)
        // 农历纪念日显示农历日期 + 今年公历对照
        let dateText
        if (a.calendar === 'lunar' && a.lunarMonth) {
          const nd = a.repeat === 'yearly' ? nextAnniversaryDate(a) : null
          dateText = `农历${Lunar.monthName(a.lunarMonth, a.isLeap)}${Lunar.dayName(a.lunarDay)}${a.repeat === 'yearly' ? ' · 每年' : ''}`
          if (nd) dateText += `（今年公历 ${nd.getFullYear()}年${nd.getMonth()+1}月${nd.getDate()}日）`
        } else {
          dateText = `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日${a.repeat === 'yearly' ? ' · 每年' : ''}`
        }
        html += `<div class="anni-card float-in" onclick="Pages.anniversary.openEditor('${a.id}')">
          <div class="anni-card-top">
            <span class="anni-card-emoji">${a.emoji || '💕'}</span>
            <span class="anni-card-badge" style="color:${badgeColor};">${badge}</span>
          </div>
          <span class="anni-card-title">${a.title}</span>
          <span class="anni-card-date">${dateText}</span>
          ${a.note ? `<span class="anni-card-note">${a.note}</span>` : ''}
        </div>`
      })
    }
    html += `<div class="send-bar"><button class="btn-primary" onclick="Pages.anniversary.openEditor()">➕ 添加纪念日</button></div></div>`
    document.getElementById('app').innerHTML = html
  },

  _editId: null, _emoji: '💕', _title: '', _date: '', _note: '', _repeat: 'yearly',
  _calendar: 'solar', _lunarMonth: 7, _lunarDay: 1,

  openEditor(id) {
    if (id) {
      const a = Store.get().anniversaries.find(x => x.id === id)
      if (!a) return
      this._editId = id
      this._emoji = a.emoji || '💕'
      this._title = a.title
      this._date = a.date
      this._note = a.note || ''
      this._repeat = a.repeat || 'yearly'
      this._calendar = a.calendar === 'lunar' ? 'lunar' : 'solar'
      this._lunarMonth = a.lunarMonth || 7
      this._lunarDay = a.lunarDay || 1
    } else {
      this._editId = null
      this._emoji = '💕'; this._title = ''; this._date = getToday(); this._note = ''; this._repeat = 'yearly'
      this._calendar = 'solar'; this._lunarMonth = 7; this._lunarDay = 1
    }
    this.renderEditor()
  },

  renderEditor() {
    let presetHtml = anniversaryPresets.map(p =>
      `<div class="mood-cell" onclick="Pages.anniversary.applyPreset('${p.title}','${p.repeat}','${p.calendar || 'solar'}')"><span class="mood-emoji">${p.emoji}</span><span class="mood-text">${p.title.replace('纪念日','')}</span></div>`
    ).join('')
    let emojiHtml = ['💕','🎂','💍','🏠','✈️','💋','🌹','🎉','🌟','🎁','🎀','🐣'].map(e =>
      `<span class="emoji-cell ${this._emoji === e ? 'active' : ''}" onclick="Pages.anniversary._emoji='${e}'; Pages.anniversary.renderEditor()">${e}</span>`
    ).join('')

    // 日期选择区：公历/农历切换
    const calTab = (val, label) => `<span style="padding:6px 16px;border-radius:16px;font-size:13px;cursor:pointer;${this._calendar===val?'background:var(--color-primary);color:#fff;':'background:var(--color-bg);color:var(--color-text-light);'}" onclick="Pages.anniversary._calendar='${val}'; Pages.anniversary.renderEditor()">${label}</span>`
    let dateInputHtml
    if (this._calendar === 'lunar') {
      const monthOpts = Lunar.monthNames.map((n, i) => `<option value="${i+1}" ${this._lunarMonth===i+1?'selected':''}>${n}</option>`).join('')
      const dayOpts = Array.from({length: 30}, (_, i) => `<option value="${i+1}" ${this._lunarDay===i+1?'selected':''}>${Lunar.dayNames[i]}</option>`).join('')
      // 实时预览：今年对应公历日期
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const cur = Lunar.solarToLunar(today)
      let preview = ''
      if (cur) {
        let solar = Lunar.lunarToSolar(cur.year, this._lunarMonth, this._lunarDay)
        if (!solar || solar < today) solar = Lunar.lunarToSolar(cur.year + 1, this._lunarMonth, this._lunarDay)
        preview = solar ? `今年是公历 ${solar.getFullYear()}年${solar.getMonth()+1}月${solar.getDate()}日 🌙` : '该农历日期不存在'
      }
      dateInputHtml = `
        <div style="display:flex;gap:8px;">
          <select class="input" style="flex:1;appearance:auto;" onchange="Pages.anniversary._lunarMonth=parseInt(this.value); Pages.anniversary.renderEditor()">${monthOpts}</select>
          <select class="input" style="flex:1;appearance:auto;" onchange="Pages.anniversary._lunarDay=parseInt(this.value); Pages.anniversary.renderEditor()">${dayOpts}</select>
        </div>
        <div style="font-size:12px;color:var(--color-text-light);margin-top:6px;">${preview}</div>`
    } else {
      dateInputHtml = `<input class="input" type="date" id="anniDate" value="${this._date}">`
    }

    App.showSheet(`<div class="sheet-header"><span class="sheet-close" onclick="App.closeSheet()">✕</span><span class="sheet-title">${this._editId ? '编辑纪念日' : '添加纪念日'}</span></div>
      <span class="label">快速选择</span><div class="mood-grid">${presetHtml}</div>
      <span class="label">图标</span><div class="emoji-grid">${emojiHtml}</div>
      <span class="label">标题</span><input class="input" id="anniTitle" placeholder="比如：在一起的纪念日" value="${this._title}" maxlength="15">
      <span class="label">日期</span>
      <div style="display:flex;gap:8px;margin-bottom:10px;">${calTab('solar','公历')}${calTab('lunar','农历')}</div>
      ${dateInputHtml}
      <span class="label">备注（可不写）</span><textarea class="input textarea" id="anniNote" placeholder="写点什么..." maxlength="50">${this._note}</textarea>
      <span class="label">重复</span>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <span class="sign-tab ${this._repeat === 'yearly' ? 'active' : ''}" style="padding:6px 16px;border-radius:16px;font-size:13px;cursor:pointer;${this._repeat === 'yearly' ? 'background:var(--color-primary);color:#fff;' : 'background:var(--color-bg);color:var(--color-text-light);'}" onclick="Pages.anniversary._repeat='yearly'; Pages.anniversary.renderEditor()">每年重复</span>
        <span class="sign-tab ${this._repeat === 'once' ? 'active' : ''}" style="padding:6px 16px;border-radius:16px;font-size:13px;cursor:pointer;${this._repeat === 'once' ? 'background:var(--color-primary);color:#fff;' : 'background:var(--color-bg);color:var(--color-text-light);'}" onclick="Pages.anniversary._repeat='once'; Pages.anniversary.renderEditor()">仅一次</span>
      </div>
      <button class="btn-primary" onclick="Pages.anniversary.save()">${this._editId ? '保存' : '添加'}</button>
      ${this._editId ? `<button class="btn-ghost" style="color:var(--color-text-light);border-color:var(--color-border);" onclick="Pages.anniversary.delete()">删除这个纪念日</button>` : ''}`)
  },

  applyPreset(title, repeat, calendar) {
    this._title = title
    this._repeat = repeat
    this._calendar = calendar === 'lunar' ? 'lunar' : 'solar'
    this.renderEditor()
  },

  save() {
    const title = document.getElementById('anniTitle').value.trim()
    const note = document.getElementById('anniNote').value.trim()
    if (!title) { App.toast('起个标题吧'); return }

    let date, lunarFields
    if (this._calendar === 'lunar') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const cur = Lunar.solarToLunar(today)
      if (!cur) { App.toast('农历换算失败，请重试'); return }
      let solar = Lunar.lunarToSolar(cur.year, this._lunarMonth, this._lunarDay)
      if (!solar || solar < today) solar = Lunar.lunarToSolar(cur.year + 1, this._lunarMonth, this._lunarDay)
      if (!solar) { App.toast('该农历日期不存在，请检查'); return }
      date = `${solar.getFullYear()}-${String(solar.getMonth()+1).padStart(2,'0')}-${String(solar.getDate()).padStart(2,'0')}`
      lunarFields = { calendar: 'lunar', lunarMonth: this._lunarMonth, lunarDay: this._lunarDay }
    } else {
      date = document.getElementById('anniDate').value
      if (!date) { App.toast('选个日期'); return }
      lunarFields = { calendar: 'solar', lunarMonth: null, lunarDay: null }
    }

    if (this._editId) {
      Store.update(d => ({
        ...d,
        anniversaries: (d.anniversaries||[]).map(a => a.id === this._editId ? { ...a, emoji: this._emoji, title, date, note, repeat: this._repeat, ...lunarFields } : a)
      }))
    } else {
      const item = { id: 'a_' + Date.now(), emoji: this._emoji, title, date, note, repeat: this._repeat, ...lunarFields }
      Store.update(d => ({ ...d, anniversaries: [...(d.anniversaries||[]), item] }))
    }
    App.closeSheet(); App.toast('已保存 ❤️'); Pages[App.currentTab].render()
  },

  delete() {
    if (confirm('删除这个纪念日？')) {
      Store.update(d => ({ ...d, anniversaries: d.anniversaries.filter(a => a.id !== this._editId) }))
      App.closeSheet(); Pages[App.currentTab].render()
    }
  }
}

// ---------- 随机美食 ----------
Pages.food = {
  _rolling: false,
  _current: null,   // {emoji, name}

  // 抽取池：内置美食 + 自定义选项 + 想吃的店清单
  pool() {
    const d = Store.get()
    const custom = (d.foodOptions || []).map(o => ({ emoji: '🍽️', name: o.text, custom: true }))
    const fromList = (d.foodList || []).map(f => ({ emoji: '🏪', name: f.text, fromList: true }))
    return [...foodPool, ...custom, ...fromList]
  },

  render() {
    const d = Store.get()
    const history = (d.foodHistory || []).slice(-5).reverse()

    let resultHtml
    if (this._current) {
      resultHtml = `<div class="food-result">${this._current.emoji}<span class="food-result-name">${this._current.name}</span></div>`
    } else {
      resultHtml = `<div class="food-result food-result-idle">🍽️<span class="food-result-name" style="font-size:15px;color:var(--color-text-light);">今晚吃啥？</span></div>`
    }

    let actionHtml
    if (this._rolling) {
      actionHtml = `<button class="btn-primary food-btn" disabled>抽取中…</button>`
    } else if (this._current) {
      actionHtml = `
        <button class="btn-primary food-btn" onclick="Pages.food.decide()">就吃这个 🎉</button>
        <button class="btn-ghost food-btn" onclick="Pages.food.roll()">不行，再来一次</button>`
    } else {
      actionHtml = `<button class="btn-primary food-btn" onclick="Pages.food.roll()">开始随机 🎲</button>`
    }

    let historyHtml = ''
    if (history.length > 0) {
      historyHtml = `<div class="food-history">
        <span class="food-history-title">已决定</span>
        ${history.map(h => `<span class="food-history-item">${h.emoji} ${h.name}</span>`).join('')}
      </div>`
    }

    document.getElementById('app').innerHTML = `
      <div class="container">
        <div class="header float-in">
          <div class="title-row"><span class="page-title">吃啥</span><span class="title-emoji">🎲</span></div>
          <span class="page-subtitle">治好你们的选择困难症</span>
        </div>

        <div class="food-stage float-in">
          ${resultHtml}
        </div>

        <div class="food-actions float-in">${actionHtml}</div>

        ${historyHtml}

        <div class="food-manage float-in">
          <div class="list-header"><span class="list-title">自定义选项</span><span class="list-add-btn" onclick="Pages.food.toggleInput()">+ 添加</span></div>
          <div class="list-input-row" id="foodOptInputRow" style="display:none;">
            <input class="list-input" id="foodOptInput" placeholder="比如：楼下那家麻辣烫" maxlength="15" onkeydown="if(event.key==='Enter'){Pages.food.addItem();}">
            <span class="list-confirm" onclick="Pages.food.addItem()">确定</span>
          </div>
          ${(Store.get().foodOptions || []).length > 0
            ? Store.get().foodOptions.map(o => `
              <div class="list-item">
                <span class="list-item-text">🍽️ ${o.text}</span>
                <span class="list-delete" onclick="Pages.food.deleteItem('${o.id}')">✕</span>
              </div>`).join('')
            : `<div class="list-empty">添加你们常吃的店，会被一起抽中</div>`}
        </div>
      </div>`
  },

  roll() {
    if (this._rolling) return
    const pool = this.pool()
    if (pool.length === 0) return

    this._rolling = true
    this._current = null
    this.render()

    const el = () => document.querySelector('.food-result')
    let count = 0
    const total = 18 + Math.floor(Math.random() * 8)  // 转多少下
    const timer = setInterval(() => {
      const item = pool[Math.floor(Math.random() * pool.length)]
      if (el()) {
        el().innerHTML = `${item.emoji}<span class="food-result-name">${item.name}</span>`
        el().classList.add('food-rolling')
      }
      count++
      if (count >= total) {
        clearInterval(timer)
        this._rolling = false
        this._current = item
        // 恢复非滚动态并显示按钮
        this.render()
        // 轻微震动反馈（如果支持）
        if (navigator.vibrate) navigator.vibrate(60)
      }
    }, 90)
  },

  decide() {
    if (!this._current) return
    const rec = {
      id: 'fh_' + Date.now(),
      name: this._current.name,
      emoji: this._current.emoji,
      decidedAt: Date.now()
    }
    Store.update(d => ({ ...d, foodHistory: [...(d.foodHistory||[]).slice(-9), rec] }))
    this._current = null
    App.toast('就吃这个！干饭去 🍚')
    this.render()
  },

  toggleInput() {
    const row = document.getElementById('foodOptInputRow')
    if (!row) return
    const show = row.style.display === 'none'
    row.style.display = show ? 'flex' : 'none'
    if (show) setTimeout(() => document.getElementById('foodOptInput')?.focus(), 50)
  },

  addItem() {
    const el = document.getElementById('foodOptInput')
    if (!el) return
    const text = el.value.trim()
    if (!text) return
    Store.update(d => ({ ...d, foodOptions: [...(d.foodOptions||[]), { id: 'fo_' + Date.now(), text }] }))
    this.render()
  },

  deleteItem(id) {
    Store.update(d => ({ ...d, foodOptions: d.foodOptions.filter(o => o.id !== id) }))
    this.render()
  }
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
  App.init()

  // 注册 Service Worker（PWA 离线支持）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  }
})
