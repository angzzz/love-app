/**
 * 农历工具 —— 基于浏览器原生 Intl 农历日历（ICU 官方数据，1900-2100 准确）
 * 无需自维护农历数据表，离线可用（PWA 友好）
 *
 * 用法：
 *   Lunar.solarToLunar(new Date())       → { year:2026, month:7, day:7, isLeap:false }
 *   Lunar.lunarToSolar(2026, 7, 15)      → Date（农历2026年七月十五的公历日期）
 *   Lunar.monthName(7, false)            → '七月'
 *   Lunar.dayName(15)                    → '十五'
 */
const Lunar = (() => {
  let fmt = null
  function getFmt() {
    if (!fmt) fmt = new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric', month: 'numeric', day: 'numeric' })
    return fmt
  }

  // 公历 Date → 农历 { year, month(1-12), day(1-30), isLeap }
  function solarToLunar(date) {
    try {
      const parts = getFmt().formatToParts(date)
      const out = { year: 0, month: 0, day: 0, isLeap: false }
      for (const p of parts) {
        if (p.type === 'month') {
          if (p.value.endsWith('bis')) { out.isLeap = true; out.month = parseInt(p.value, 10) }
          else out.month = parseInt(p.value, 10)
        } else if (p.type === 'day') {
          out.day = parseInt(p.value, 10)
        } else if (p.type === 'relatedYear') {
          out.year = parseInt(p.value, 10)
        }
      }
      return out
    } catch (e) {
      return null
    }
  }

  // 农历 → 公历 Date。闰月需传 isLeap=true。该年无此日（如无闰月）返回 null
  // 原理：农历年 lunarYear 跨公历 [lunarYear-01, (lunarYear+1)-02]，逐日换算比对
  function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap) {
    const start = new Date(lunarYear, 0, 1)   // 公历1月1日起搜（春节最早1月21日，安全）
    const end = new Date(lunarYear + 1, 2, 1) // 搜到次年3月（春节最晚2月20日，留余量）
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const l = solarToLunar(d)
      if (l && l.year === lunarYear && l.month === lunarMonth && l.day === lunarDay && l.isLeap === !!isLeap) {
        const hit = new Date(d)
        hit.setHours(0, 0, 0, 0)
        return hit
      }
    }
    return null
  }

  const monthNames = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
  const dayNames = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
  ]

  function monthName(m, isLeap) {
    return (isLeap ? '闰' : '') + (monthNames[m - 1] || (m + '月'))
  }
  function dayName(d) {
    return dayNames[d - 1] || (d + '日')
  }

  // 农历时辰问候用不到，但保留月份天数查询能力（判断某农历月是大月30还是小月29）
  function lunarMonthDays(lunarYear, lunarMonth, isLeap) {
    const d1 = lunarToSolar(lunarYear, lunarMonth, 1, isLeap)
    if (!d1) return 0
    const d30 = lunarToSolar(lunarYear, lunarMonth, 30, isLeap)
    return d30 ? 30 : 29
  }

  return { solarToLunar, lunarToSolar, monthName, dayName, monthNames, dayNames, lunarMonthDays }
})()
