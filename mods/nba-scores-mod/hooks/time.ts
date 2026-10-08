// 時間換算。NBA 的「比賽日」跟台灣人的「今天」不是同一件事，這個檔案處理那個落差。
//
// NBA 的比賽幾乎都在美東時間晚上 7 點到隔天凌晨 1 點之間打完，對台灣就是
// 早上 7 點到中午。如果直接問 ESPN「今天有哪些比賽」，台灣的下午到晚上會拿到
// 「美國那邊即將開打的那一批」——也就是台灣人明天早上才看得到的比賽，
// 而不是他今天早上錯過的那一批。

/** 比賽日的分界線：美東時間早上 11 點。那時昨晚的比賽全打完、今晚的還沒開始 */
const ROLLOVER_HOURS = 11

const ymd = (ms: number, timeZone: string): string =>
  // en-CA 的日期格式就是 YYYY-MM-DD，不用自己拼
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))

/**
 * 現在該看哪一個「NBA 比賽日」，回傳 ESPN 要的 YYYYMMDD。
 *
 * 做法是把時間往回推 11 小時再取美東日期，等於把換日線挪到美東早上 11 點。
 * 於是台灣的整個白天到深夜，都還算在「今天早上那批比賽」的那一天。
 */
export const nbaGameDay = (nowMs: number): string =>
  ymd(nowMs - ROLLOVER_HOURS * 3_600_000, 'America/New_York').replace(/-/g, '')

/**
 * 把 ESPN 給的開賽時間（ISO 字串）換成使用者當地時間的「10/04 07:00」。
 * timeZone 不給就用電腦的時區；測試會指定，結果才不會跟著跑測試的電腦變。
 * 拿不到就回空字串，讓呼叫端退回用 ESPN 自己那句英文。
 */
export const localStart = (iso: string, timeZone?: string): string => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(t))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const [mo, d, h, mi] = [get('month'), get('day'), get('hour'), get('minute')]
  if (!mo || !d || !h || !mi) return ''
  return `${mo}/${d} ${h}:${mi}`
}

/** 紀錄檔用的當地時間，精確到秒：「10/06 07:00:15」 */
export const localStamp = (ms: number): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '??'
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

/**
 * 下一次「NBA 比賽日」換日的時刻（毫秒）。今天的比賽都打完之後，在這之前
 * 比分板不會再有任何變化，所以不用抓。用五分鐘一格往後找，最多找兩天。
 */
export const nextGameDayAt = (nowMs: number): number => {
  const today = nbaGameDay(nowMs)
  const STEP = 5 * 60_000
  for (let t = nowMs + STEP; t <= nowMs + 48 * 3_600_000; t += STEP) {
    if (nbaGameDay(t) !== today) return t
  }
  return nowMs + 24 * 3_600_000
}
