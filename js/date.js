// 日期工具

function daysBetween(target) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  return Math.round((t - today) / 86400000)
}

function daysSince(date) {
  return -daysBetween(date)
}

function formatDate(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`
}

function formatDateTime(ts) {
  const dt = new Date(ts)
  const m = dt.getMonth() + 1
  const d = dt.getDate()
  const h = String(dt.getHours()).padStart(2, '0')
  const min = String(dt.getMinutes()).padStart(2, '0')
  return `${m}/${d} ${h}:${min}`
}

function getToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getDateString(daysAdd) {
  const d = new Date()
  d.setDate(d.getDate() + daysAdd)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// 计算下一个纪念日（每年重复的）
// 兼容两种传参：字符串日期 或 纪念日对象（支持农历）
function nextAnniversaryDate(a) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 农历纪念日：按农历年推算今年/明年的公历日期
  if (typeof a === 'object' && a !== null && a.calendar === 'lunar' && a.lunarMonth && a.lunarDay) {
    const cur = Lunar.solarToLunar(today)
    let next = cur ? Lunar.lunarToSolar(cur.year, a.lunarMonth, a.lunarDay, a.isLeap) : null
    if (!next || next < today) {
      next = Lunar.lunarToSolar((cur ? cur.year : today.getFullYear()) + 1, a.lunarMonth, a.lunarDay, a.isLeap)
    }
    if (next) return next
    // 兜底：农历换算失败按公历字段算
  }

  const dateStr = typeof a === 'string' ? a : a.date
  const d = new Date(dateStr)
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
  if (next < today) {
    next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
  }
  return next
}
