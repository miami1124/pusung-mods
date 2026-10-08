// ESPN 公開端點的抓取與解析。這個檔案不畫任何東西，只負責「把 ESPN 的 JSON
// 變成我們自己的資料結構」，畫面邏輯在 register.tsx。
//
// 端點免金鑰、免帳號，但不是官方文件化的 API，所以欄位有可能無預警變動。
// 因此解析失敗一律丟錯（讓上層在畫面上明示），絕不回傳半套資料當成事實。

export const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'

// ESPN 擋掉大部分的 User-Agent，而且只看「第一個詞」。2026-09-18 實測：
//   curl / python-requests / Go-http-client / okhttp  → 200
//   不送 UA / Mozilla（連完整 Chrome UA）/ node / wget → 403
//   「curl/8.7.1 nba-scores-mod/0.1.0」→ 200，順序倒過來 → 403
// 所以第一個詞必須是它認得的客戶端，後面接上我們自己的身分標示。
// 這是白名單制，ESPN 改名單我們就會壞——所以抓不到時畫面一定要明講。
const USER_AGENT = 'curl/8.7.1 nba-scores-mod (+https://github.com/miami1124/pusung-mods)'

/** 打 ESPN 要帶的 header。抽出來是因為之後 v2 加單場端點時共用同一份。 */
export const espnHeaders = (): Record<string, string> => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
})

/** 組出要打的網址。date 是 YYYYMMDD，留空就是今天 */
export const scoreboardUrl = (date: string): string =>
  date === '' ? SCOREBOARD_URL : `${SCOREBOARD_URL}?dates=${date}`

/** pre = 還沒開打、in = 進行中、post = 已結束 */
export type GameState = 'pre' | 'in' | 'post'

export type Side = {
  abbr: string
  name: string
  score: number
  /** ESPN 給的球隊代表色，六碼十六進位（不含 #） */
  color: string
  /** ESPN 給的第二代表色。主色太暗、在深色畫面上看不見時拿它頂替 */
  altColor: string
  /** 每一節各得幾分，延長賽接在後面。還沒開打是空陣列 */
  periods: number[]
}

export type Game = {
  id: string
  state: GameState
  /** ESPN 自己排好的一句話：「Q3 4:32」「Final」「10/3 - 7:00 PM EDT」 */
  detail: string
  period: number
  clock: string
  /** 開賽時間，ISO 字串 */
  startsAt: string
  home: Side
  away: Side
}

export type Slate = {
  games: Game[]
  /** 這份資料抓下來的時間（毫秒） */
  fetchedAt: number
}

const asState = (raw: unknown): GameState => {
  if (raw === 'pre' || raw === 'in' || raw === 'post') return raw
  throw new Error(`unknown game state: ${String(raw)}`)
}

const parseSide = (raw: any): Side => {
  const team = raw?.team
  if (!team?.abbreviation) throw new Error('competitor is missing team.abbreviation')
  return {
    abbr: officialAbbr(String(team.abbreviation)),
    name: String(team.displayName ?? team.abbreviation),
    // 還沒開打時 ESPN 給 '0'，偶爾整個欄位不存在
    score: Number(raw?.score ?? 0),
    color: String(team.color ?? '888888'),
    altColor: String(team.alternateColor ?? team.color ?? '888888'),
    // 這是比分板順便給的，不用另外抓單場資料
    periods: Array.isArray(raw?.linescores)
      ? raw.linescores.map((l: any) => Number(l?.value ?? 0))
      : [],
  }
}

/**
 * 把 scoreboard 端點的 JSON 變成一份 Slate。
 * 欄位對不上就丟錯——寧可讓畫面顯示「資料格式異常」，也不要安靜地少幾場。
 */
export const parseScoreboard = (json: any, now: number): Slate => {
  const events = json?.events
  if (!Array.isArray(events)) throw new Error('scoreboard payload has no events array')

  const games = events.map((e: any): Game => {
    const comp = e?.competitions?.[0]
    if (!comp) throw new Error(`event ${e?.id} has no competition`)

    const status = comp.status ?? {}
    const sides: any[] = comp.competitors ?? []
    const home = sides.find(s => s?.homeAway === 'home')
    const away = sides.find(s => s?.homeAway === 'away')
    if (!home || !away) throw new Error(`event ${e?.id} is missing a home or away side`)

    return {
      id: String(e.id),
      state: asState(status?.type?.state),
      detail: String(status?.type?.shortDetail ?? ''),
      period: Number(status?.period ?? 0),
      clock: String(status?.displayClock ?? ''),
      startsAt: String(e.date ?? ''),
      home: parseSide(home),
      away: parseSide(away),
    }
  })

  return { games, fetchedAt: now }
}

/** 有任何一場正在打，就代表該用「即時」的更新頻率 */
export const hasLiveGame = (slate: Slate): boolean => slate.games.some(g => g.state === 'in')

/** 進行中的排最前面，再來是還沒打的，已結束的放最後 */
const STATE_ORDER: Record<GameState, number> = { in: 0, pre: 1, post: 2 }

/**
 * ESPN 有六隊的代號跟 NBA 官方的三碼不一樣（鵜鶘寫 NO、官方是 NOP）。
 * 資料一進來就轉成官方寫法，畫面、設定、圖騰全部只認官方三碼。
 */
const OFFICIAL_ABBR: Record<string, string> = {
  NO: 'NOP',
  NY: 'NYK',
  GS: 'GSW',
  SA: 'SAS',
  UTAH: 'UTA',
  WSH: 'WAS',
}

/** 把代號轉成 NBA 官方三碼；本來就是官方寫法的原樣回傳 */
export const officialAbbr = (abbr: string): string => OFFICIAL_ABBR[abbr] ?? abbr

/** 這場有沒有你支持的球隊 */
export const involves = (g: Game, team: string): boolean =>
  team !== '' && (g.home.abbr === team || g.away.abbr === team)

/**
 * 排序：自家隊永遠置頂，其餘按「進行中 → 未開打 → 已結束」，同組內按開賽時間。
 * 回傳新陣列，不動原本的。
 */
export const sortGames = (games: Game[], team: string): Game[] =>
  [...games].sort((a, b) => {
    const mine = Number(involves(b, team)) - Number(involves(a, team))
    if (mine !== 0) return mine
    const state = STATE_ORDER[a.state] - STATE_ORDER[b.state]
    if (state !== 0) return state
    return a.startsAt.localeCompare(b.startsAt)
  })

/**
 * 桌面版小卡的排序：正在打的永遠最前面、打完的最後面，自家隊只在同一組裡往前排。
 * 跟 sortGames 的差別是「狀態」贏過「自家隊」——橫排小卡是由左讀到右，
 * 最左邊該是現在看得到變化的那幾場。
 */
export const sortLiveFirst = (games: Game[], team: string): Game[] =>
  [...games].sort((a, b) => {
    const state = STATE_ORDER[a.state] - STATE_ORDER[b.state]
    if (state !== 0) return state
    const mine = Number(involves(b, team)) - Number(involves(a, team))
    if (mine !== 0) return mine
    return a.startsAt.localeCompare(b.startsAt)
  })

/** 這批比賽現在是什麼狀態，決定帶子的標題怎麼寫 */
export type SlateMode =
  | 'live' // 有比賽正在打
  | 'recap' // 全部打完了 → 今日戰報
  | 'upcoming' // 都還沒開打
  | 'empty' // 這天沒有比賽

export const slateMode = (slate: Slate): SlateMode => {
  if (slate.games.length === 0) return 'empty'
  if (slate.games.some(g => g.state === 'in')) return 'live'
  if (slate.games.every(g => g.state === 'post')) return 'recap'
  return 'upcoming'
}

/** 六碼色的亮度，0（黑）到 255（白）。壞掉的色碼當成中間值 */
const luminance = (hex: string): number => {
  const n = Number.parseInt(hex, 16)
  if (hex.length !== 6 || !Number.isFinite(n)) return 128
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
}

/**
 * 畫隊色時用哪個顏色（含 #）。很多球隊主色是深藍或黑，在深色畫面上等於隱形，
 * 那種就改用第二代表色；兩個都太暗就用主色，至少是對的顏色。
 */
export const teamColor = (side: Side): string => {
  if (luminance(side.color) >= 60) return `#${side.color}`
  return luminance(side.altColor) >= 60 ? `#${side.altColor}` : `#${side.color}`
}

// ---- 單場球員數據 ----
// 比分板不含球員數據，要另外打 summary 端點（一場約 400 KB）。
// 所以只在使用者點開某一場時才抓，不跟著比分板一起輪詢。

export const summaryUrl = (gameId: string): string =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`

export type PlayerLine = { name: string; pts: number; reb: number; ast: number }
export type TeamBox = { abbr: string; players: PlayerLine[] }

/** 每隊列出得分前幾名 */
const TOP_PLAYERS = 5

/**
 * 把 summary 端點的 JSON 變成兩隊各自的球員數據（依得分排序、取前幾名）。
 * 欄位位置用 ESPN 給的 labels 查，不寫死第幾格——它偶爾會加欄位。
 */
export const parseBoxscore = (json: any): TeamBox[] => {
  const teams = json?.boxscore?.players
  if (!Array.isArray(teams)) throw new Error('summary payload has no boxscore.players')

  return teams.map((t: any): TeamBox => {
    const abbr = t?.team?.abbreviation
    const stat = t?.statistics?.[0]
    if (!abbr || !Array.isArray(stat?.labels) || !Array.isArray(stat?.athletes)) {
      throw new Error('boxscore team is missing labels or athletes')
    }
    const at = (label: string) => {
      const i = stat.labels.indexOf(label)
      if (i < 0) throw new Error(`boxscore has no ${label} column`)
      return i
    }
    const [pts, reb, ast] = [at('PTS'), at('REB'), at('AST')]
    const players = stat.athletes
      // 沒上場的球員 stats 是空陣列
      .filter((a: any) => Array.isArray(a?.stats) && a.stats.length > 0)
      .map((a: any): PlayerLine => ({
        name: String(a?.athlete?.shortName ?? a?.athlete?.displayName ?? '?'),
        pts: Number(a.stats[pts] ?? 0),
        reb: Number(a.stats[reb] ?? 0),
        ast: Number(a.stats[ast] ?? 0),
      }))
      .sort((a: PlayerLine, b: PlayerLine) => b.pts - a.pts)
      .slice(0, TOP_PLAYERS)
    return { abbr: officialAbbr(String(abbr)), players }
  })
}
