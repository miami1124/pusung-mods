/* @jsx h */
import type { EngineInterface, Register } from 'claude-code'
import {
  espnHeaders,
  hasLiveGame,
  involves,
  parseBoxscore,
  parseScoreboard,
  scoreboardUrl,
  slateMode,
  sortLiveFirst,
  summaryUrl,
  SCOREBOARD_URL,
  teamColor,
  type Game,
  type Slate,
  type TeamBox,
} from './espn.ts'
import { NO_TEAM, TEAM_OPTIONS, teamFromOption } from './teams.ts'
import { TOTEM_SIZE, totemFor } from './totems.ts'
import { nbaGameDay, nextGameDayAt, localStart } from './time.ts'
import { LANG_OPTIONS, langFromOption, STRINGS, type Strings } from './i18n.ts'
import { errorLine, LOG_MAX_LINES, logPath, okLine } from './log.ts'
import { CONFIG_REL, DEFAULTS, parseConfig, type Config } from './config.ts'

// nba-scores-mod：把今日 NBA 比分畫在輸入框上方。
//
// 這支模組永遠不呼叫 $.model.*，也不碰使用者的 prompt——它只是讀 ESPN 的
// 公開端點、算出畫面該長什麼樣，然後畫出來。所以它不消耗任何 model token。
//
// 桌面版畫橫排小卡，終端機畫一行橫排；兩邊共用同一份資料、排序與防雷狀態。

const LIVE_EVERY_MS = 30_000
/** 比分剛變動時的提示：先亮色＋顯示加了幾分，再只留亮色，然後恢復原狀 */
const FLASH_STRONG_MS = 3_000
const FLASH_MS = 6_000
const FLASH_COLOR = '#EF9F27'
type Flash = { delta: number; at: number }
type Which = 'away' | 'home'

/** 表定時間過了但還沒開打（延後開賽很常見）時，多久再看一次 */
const LATE_TIPOFF_MS = 60_000
/** 抓失敗後隔多久重試，一次比一次久；最後一格是上限 */
const RETRY_MS = [30_000, 60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000]
/**
 * 有比賽正在打的時候，重試最久只隔這麼久。
 * 電腦睡著時會連續失敗把間隔拉到 10 分鐘，醒來後比分就要等那麼久才動。
 */
const RETRY_LIVE_MAX_MS = 60_000
/**
 * ESPN 明確拒絕（403 被擋、429 太頻繁）時，至少隔這麼久才再試，有比賽在打也一樣。
 * 對方說不要的時候就退開，不要一直敲。
 */
const REJECTED_STATUS = [403, 429]
const RETRY_REJECTED_MIN_MS = 5 * 60_000

/**
 * 下一次該什麼時候抓。原則：比分板不會變的時候就不抓。
 * - 有比賽在打：每 30 秒
 * - 都還沒打：等到最早那場的表定開賽時間才抓（過了還沒開打就每分鐘看一次）
 * - 全部打完、今天沒比賽、或顯示的是「下一場」：等到比賽日換日
 */
const nextFetchDelay = (slate: Slate, isNext: boolean, now: number): number => {
  if (hasLiveGame(slate)) return LIVE_EVERY_MS
  const untilNextDay = nextGameDayAt(now) + 60_000 - now
  if (isNext) return untilNextDay
  const tipoffs = slate.games
    .filter(g => g.state === 'pre')
    .map(g => Date.parse(g.startsAt))
    .filter(t => Number.isFinite(t))
  if (tipoffs.length === 0) return untilNextDay
  const first = Math.min(...tipoffs)
  return first > now ? Math.min(first - now, untilNextDay) : LATE_TIPOFF_MS
}
const TICK_MS = 15_000
/** 設定檔不存在時，每讀幾次才重試一次——否則每次輪詢都會在 debug log 留一筆錯誤 */
const CONFIG_MISS_EVERY = 10
/** 終端機寬度不到這麼多格時，點開單場的球員數據改放到每節比分下面 */
const DETAIL_WIDE_COLUMNS = 96
/** 終端機：整條帶子離左邊空幾格，徽章才不會貼著視窗邊 */
const TERM_INDENT = 1
/** 終端機：決定「設定」要不要寫全名時，替得分的 +N 留的餘裕（一個 +3 的寬度） */
const FLASH_SLACK = 3
/** 終端機：兩場之間空幾格（每場自己有灰底，不再用 │ 隔開） */
const CHIP_GAP = 2
/**
 * 終端機的灰底：比賽一種、設定按鈕一種，跟桌面版「比賽是框、設定是實心灰塊」一樣分得出來。
 * 字用終端機預設色，所以底色要跟著 Claude Code 的深色／淺色主題換，不然淺色終端機會看不到字。
 */
const TERM_BG = {
  dark: { chip: '#2b2b2b', button: '#454545' },
  light: { chip: '#eeeeee', button: '#d4d4d4' },
}
const BADGE_TEXT = ' NBA '

/** 這段字在終端機佔幾格：中文和全形符號算兩格，其餘一格 */
const textWidth = (s: string): number => {
  let n = 0
  for (const ch of s) n += (ch.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1
  return n
}

/** 防雷時比分變成這個。用實心方塊而不是 ??? ，一眼就看得出是「被遮住」不是「沒資料」 */
const MASK = '███'

/** 這場現在該不該遮。只遮已結束的——正在打的當然要讓你看比分 */
const isMasked = (g: Game, spoilerFree: boolean, revealed: Set<string>): boolean =>
  spoilerFree && g.state === 'post' && !revealed.has(g.id)

/** 桌面版防雷時蓋住比分的灰塊。桌面版不是等寬字，用 ███ 寬度會亂跳 */
const MASK_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="12" viewBox="0 0 22 12">` +
  `<rect width="22" height="12" rx="2" fill="rgba(128,128,128,0.45)"/></svg>`

/** 桌面版小卡上的狀態字：還沒開打只寫幾點（卡片很窄），其餘照 ESPN 那句 */
const chipDetail = (g: Game, isNext: boolean): string => {
  if (g.state !== 'pre') return g.detail
  const t = localStart(g.startsAt)
  if (t === '') return g.detail
  // 「下一場」可能是好幾天後，那時候日期不能省
  return isNext ? t : t.slice(6)
}

/**
 * 桌面版最上面那條分隔線，把 NBA 這排跟上方其他 mod（例如用量帶）隔開。
 * 桌面版的框不能只畫一邊、太細的 SVG 又畫不出來，所以用一長串橫線字元，
 * 畫得比任何視窗都長，交給外層裁掉。
 */
const RULE = '─'.repeat(400)

/** 桌面版的點綴色：NBA 徽章的底、進行中的時間。之後可以改成跟著使用者選的球隊走 */
const ACCENT = '#E24B4A'
const BADGE_BG = '#A32D2D'
const BADGE_FG = '#FCEBEB'
/** 還沒開打的開賽時間用的顏色。跟打完的灰色 Final 分開，不然一眼分不出來 */
const UPCOMING = '#85B7EB'

/** 收合狀態存在 $.store 的這個 key，下次開 Claude Code 還記得 */
const COLLAPSED_KEY = 'collapsed'
/** 桌面版的設定那一排有沒有打開。改設定會讓 mod 重新載入，存起來才不會每改一項就自己關掉 */
const SETTINGS_OPEN_KEY = 'settingsOpen'
const SPOILER_OPTIONS = ['Off', 'On']
/**
 * 帶子上改的設定寫不進設定選單時，改存在 $.store 的這個 key。
 * 有些執行方式下引擎不給 mod 的設定欄位（$.config.set 會直接失敗），不留這條路的話
 * 下拉選了就完全沒反應。
 */
const OVERRIDES_KEY = 'overrides'
const FIELDS = ['team', 'language', 'spoilerFree'] as const
type Field = (typeof FIELDS)[number]

/** 帶子上改了、但寫不進設定選單的那幾項（有值就蓋過設定選單），以及連這份都存不進去的旗號 */
type Held = { overrides: Partial<Record<Field, string>>; saveProblem: boolean }

/**
 * 帶子上的下拉選了一項。先照正常路寫進設定選單（寫得進去，引擎會帶著新設定重新載入）；
 * 寫不進去就自己記在 $.store，當場套用。
 */
async function saveSetting($: EngineInterface, held: Held, field: Field, value: string, apply: () => void) {
  let saved = false
  try {
    const res = await $.config.set({ key: `nba-scores-mod.${field}`, value })
    saved = res.deny === undefined
    if (!saved) $.ui.log(`nba-scores-mod: could not save ${field} ${String(res.deny)}`)
  } catch (err) {
    $.ui.log(`nba-scores-mod: could not save ${field} ${String(err)}`)
  }
  // 寫得進設定選單就以它為準，舊的那份不能留著蓋過它
  if (saved && !(field in held.overrides)) return
  if (saved) delete held.overrides[field]
  else held.overrides[field] = value
  try {
    await $.store.set(OVERRIDES_KEY, held.overrides)
    held.saveProblem = false
  } catch {
    // 這次看得到，重開就還原，要讓畫面講出來
    held.saveProblem = !saved
  }
  apply()
  $.ui.invalidate('ui.render')
}

/** 點開那一場的球員數據。id 是「這份資料屬於哪一場」，跟目前點開的不同就不畫 */
type BoxState = { id?: string; teams?: TeamBox[]; error?: string; at: number; seq: number }

/**
 * ESPN 明確拒絕之後，到 until 這個時間點之前所有請求都不發（比分、下一批賽程、球員數據共用）。
 * 只有比分退開、球員數據照敲，等於沒退。
 */
type Backoff = { until: number; reason: string }

/**
 * 抓一場的球員數據寫進 state，然後重畫。成功失敗都會寫——失敗要讓畫面講出來，
 * 不能安靜地留著上一場的數據。
 */
async function refreshBox(
  $: EngineInterface,
  state: BoxState,
  gameId: string,
  isStillOpen: () => boolean,
  backoff: Backoff,
): Promise<void> {
  // 每次請求一個流水號，回來時不是最新那次就丟掉（見下面）
  state.seq += 1
  const mine = state.seq
  let teams: TeamBox[] | undefined
  let error: string | undefined
  const startedAt = await $.clock.now()
  if (startedAt < backoff.until) {
    // 還在退開的期間：不發請求，直接讓畫面講原因
    error = backoff.reason
  } else {
    try {
      const res = await $.http.fetch(summaryUrl(gameId), { headers: espnHeaders() })
      if (REJECTED_STATUS.includes(res.status)) {
        backoff.until = startedAt + RETRY_REJECTED_MIN_MS
        backoff.reason = `Error: ESPN responded ${res.status}`
      }
      if (!res.ok) throw new Error(`ESPN responded ${res.status}`)
      teams = parseBoxscore(JSON.parse(res.text))
    } catch (err) {
      error = String(err)
    }
  }
  // 等回應的期間使用者可能已經點開別場，或點開別場又點回來。慢回來的舊回應不能蓋掉
  // 新的資料：只比對場次不夠（A → B → A 時第一次 A 的回應場次是對的，但資料是舊的），
  // 所以還要是最新那次請求才收。
  if (state.seq !== mine || !isStillOpen()) return
  state.teams = teams
  state.error = error
  state.id = gameId
  state.at = await $.clock.now()
  $.ui.invalidate('ui.render')
}

/**
 * 點開的那一場：每節比分＋兩隊得分前幾名。桌面版和終端機共用。
 * 一欄一個 Box：桌面版不是等寬字，靠空白對不齊，要靠欄位本身對齊。
 * wide 為 false（終端機太窄）時球員數據改放到每節比分下面。
 */
/** 球員名字最多幾個字。太長會把那一欄撐到折行，名字和數字就對不上了 */
const PLAYER_NAME_MAX = 16
const shortName = (name: string): string =>
  name.length <= PLAYER_NAME_MAX ? name : name.slice(0, PLAYER_NAME_MAX - 1) + '…'

const renderDetail = (
  ui: { Box: any; Text: any },
  g: Game,
  boxState: BoxState,
  opts: { wide: boolean; gapTop: number; t: Strings },
) => {
  const { Box, Text } = ui
  const count = Math.max(g.away.periods.length, g.home.periods.length)
  const awayLost = g.state === 'post' && g.away.score < g.home.score
  const homeLost = g.state === 'post' && g.home.score < g.away.score
  const column = (id: string, title: string, away: string, home: string, strong: boolean) => (
    <Box key={id} flexDirection="column" alignItems="flex-end" marginRight={2}>
      <Text dimColor>{title}</Text>
      <Text bold={strong && !awayLost} dimColor={awayLost}>
        {away}
      </Text>
      <Text bold={strong && !homeLost} dimColor={homeLost}>
        {home}
      </Text>
    </Box>
  )
  // 右邊：兩隊各自得分前幾名。資料屬於別場（剛換場、還在抓）就先說讀取中
  const mineBox = boxState.id === g.id
  const teamBlock = (abbr: string) => {
    const team = boxState.teams?.find(t => t.abbr === abbr)
    if (!team) return null
    const stat = (id: string, title: string, pick: (p: TeamBox['players'][number]) => number) => (
      <Box key={id} flexDirection="column" alignItems="flex-end" marginRight={2} flexShrink={0}>
        <Text dimColor>{title}</Text>
        {team.players.map((p, i) => (
          <Text key={`${id}${i}`}>{String(pick(p))}</Text>
        ))}
      </Box>
    )
    return (
      // 每一欄都不准縮：空間不夠時寧可右邊被裁掉，也不能讓名字折行害數字對不上
      <Box key={abbr} flexDirection="row" marginLeft={3} flexShrink={0}>
        <Box key={`names:${abbr}`} flexDirection="column" marginRight={2} flexShrink={0}>
          <Text bold>{abbr}</Text>
          {team.players.map((p, i) => (
            <Text key={`n${i}`} dimColor>
              {shortName(p.name)}
            </Text>
          ))}
        </Box>
        {stat('pts', opts.t.pts, p => p.pts)}
        {stat('reb', opts.t.reb, p => p.reb)}
        {stat('ast', opts.t.ast, p => p.ast)}
      </Box>
    )
  }
  return (
    <Box flexDirection={opts.wide ? 'row' : 'column'} marginTop={opts.gapTop}>
      <Box flexDirection="row">
        <Box flexDirection="column" marginRight={2}>
          <Text dimColor> </Text>
          <Text bold={!awayLost} dimColor={awayLost}>
            {g.away.abbr}
          </Text>
          <Text bold={!homeLost} dimColor={homeLost}>
            {g.home.abbr}
          </Text>
        </Box>
        {Array.from({ length: count }, (_, i) =>
          column(
            `p${i}`,
            i < 4 ? `Q${i + 1}` : `OT${i - 3}`,
            String(g.away.periods[i] ?? '-'),
            String(g.home.periods[i] ?? '-'),
            false,
          ),
        )}
        {column('total', opts.t.total, String(g.away.score), String(g.home.score), true)}
      </Box>
      <Box flexDirection="row">
        {!mineBox ? (
          <Box marginLeft={3}>
            <Text dimColor>{opts.t.boxLoading}</Text>
          </Box>
        ) : boxState.error !== undefined ? (
          <Box marginLeft={3}>
            <Text color="#d97706">{opts.t.boxFailed(boxState.error)}</Text>
          </Box>
        ) : (
          [teamBlock(g.away.abbr), teamBlock(g.home.abbr)]
        )}
      </Box>
    </Box>
  )
}

export const register: Register = (on, options) => {
  const held: Held = { overrides: {}, saveProblem: false }
  const option = (field: Field): unknown => held.overrides[field] ?? options[field]
  // 球隊可以從兩個地方來：設定選單（優先）和 ~/.claude/nba-scores-mod.json（舊做法，繼續有效）
  let menuTeam = teamFromOption(option('team'))
  let t = STRINGS[langFromOption(option('language'))]
  // 防雷模式：設定選單選 On 就開；選 Off 或沒設時看設定檔（舊做法，繼續有效）
  let menuSpoilerFree = option('spoilerFree') === 'On'
  const spoilerFree = () => menuSpoilerFree || config.spoilerFree
  /** 設定檔讀到的內容，還沒跟設定選單的球隊合併 */
  let fileConfig: Config = { ...DEFAULTS }
  const applyOptions = () => {
    menuTeam = teamFromOption(option('team'))
    t = STRINGS[langFromOption(option('language'))]
    menuSpoilerFree = option('spoilerFree') === 'On'
    config = menuTeam === '' ? fileConfig : { ...fileConfig, team: menuTeam }
  }
  // 使用者自己在 /config 改了某一項，就以他改的為準：帶子上留的那份要丟掉，不然會一直蓋過它
  /** 丟掉帶子上留的那一項；真的有丟才回 true */
  const dropOverride = (field: Field): boolean => {
    if (!(field in held.overrides)) return false
    delete held.overrides[field]
    applyOptions()
    return true
  }
  // 這幾個 hook 只是旁聽，自己出錯時不能擋住使用者改設定（.catch 會照原樣放行）
  on('config.set', { key: 'nba-scores-mod.team' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && dropOverride('team')) await $.store.set(OVERRIDES_KEY, held.overrides)
    return r
  }).catch(($, e, next) => next(e))
  on('config.set', { key: 'nba-scores-mod.language' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && dropOverride('language')) await $.store.set(OVERRIDES_KEY, held.overrides)
    return r
  }).catch(($, e, next) => next(e))
  on('config.set', { key: 'nba-scores-mod.spoilerFree' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && dropOverride('spoilerFree')) await $.store.set(OVERRIDES_KEY, held.overrides)
    return r
  }).catch(($, e, next) => next(e))
  // 這些狀態只活在記憶體裡：一個新 session 從零開始
  let slate: Slate | undefined
  let lastError: string | undefined
  let config: Config = { ...DEFAULTS, team: menuTeam }
  let configProblems: string[] = []
  let nextFetchAt = 0
  let configMisses = 0
  /** 今天沒比賽、退回顯示「下一場」時為 true */
  let showingNext = false
  /**
   * 防雷模式下已經揭曉的場次 id。刻意只放記憶體——關掉 Claude Code 再打開，
   * 就該回到打碼狀態，不然「防雷」只防得了第一次。
   */
  const revealed = new Set<string>()
  /** 紀錄檔的內容（設定 log: true 才會用到）。整份留在記憶體，因為寫檔只能整份覆寫 */
  const logLines: string[] = []
  let logFile = ''
  let logBroken = false
  /** 整條收起來只剩一行。會寫進 $.store，所以跨 session 記得 */
  let collapsed = false
  /** 桌面版：設定那一排（球隊／語言／防雷）有沒有打開 */
  let settingsOpen = false
  /** 終端機用深色還是淺色的灰底，看 Claude Code 的主題 */
  let termBg = TERM_BG.dark
  /** 桌面版：設定那一排底下的 30 隊按鈕有沒有展開。只放記憶體，選完就收 */
  let teamOpen = false
  /** 那一排從第幾場開始畫（按 ‹ › 左右翻） */
  let offset = 0
  /** 連續抓失敗幾次了，決定下次隔多久重試；成功就歸零 */
  let failStreak = 0
  /** 剛得分的那一邊，key 是「場次 id:away／home」。只放記憶體，幾秒後自己消失 */
  const flashes = new Map<string, Flash>()
  /** 這一邊現在該怎麼畫：undefined＝沒事；strong＝剛變（顯示 +N）；否則只留亮色 */
  const flashOf = (gameId: string, which: Which, now: number) => {
    const f = flashes.get(`${gameId}:${which}`)
    if (!f || now - f.at >= FLASH_MS) return undefined
    return { delta: f.delta, strong: now - f.at < FLASH_STRONG_MS }
  }
  /** 目前點開看每節比分的那一場。只放記憶體，重開就收回去 */
  let openId: string | undefined
  const boxState: BoxState = { at: 0, seq: 0 }
  const backoff: Backoff = { until: 0, reason: '' }

  on('session.start', async ($, e, next) => {
    const r = await next(e)

    // 這裡不能用 isInteractive 或 surface 來判斷要不要抓：桌面版 app 啟動時回報的值
    // 跟終端機不一樣（v0.8.0 加了這個判斷，結果桌面版整條帶卡在「讀取中」）。
    // 寧可在不會畫帶子的執行方式多抓幾次，也不能讓會畫的地方抓不到。

    collapsed = (await $.store.get(COLLAPSED_KEY)) === true
    settingsOpen = (await $.store.get(SETTINGS_OPEN_KEY)) === true
    try {
      const theme = (await $.config.list()).find(row => row.key === 'theme')?.value
      if (typeof theme === 'string' && theme.startsWith('light')) termBg = TERM_BG.light
    } catch {
      // 讀不到主題就當深色，深色終端機是大多數
    }
    const kept = await $.store.get(OVERRIDES_KEY)
    if (kept !== null && typeof kept === 'object') {
      for (const field of FIELDS) {
        const v = (kept as Record<string, unknown>)[field]
        if (typeof v === 'string') held.overrides[field] = v
      }
      applyOptions()
    }

    const home = (await $.env.get('HOME')) ?? ''
    const configPath = home ? `${home}/${CONFIG_REL}` : ''

    const loadConfig = async () => {
      if (!configPath) return
      // 大部分使用者沒有設定檔，而每次失敗的 fs.read 都會寫一筆 ERROR 到 debug
      // log。沒讀到就隔幾輪再試，讀到了就恢復每輪都讀（改設定不用重開）。
      if (configMisses > 0 && configMisses % CONFIG_MISS_EVERY !== 0) {
        configMisses += 1
        return
      }
      try {
        const parsed = parseConfig(await $.fs.read(configPath))
        fileConfig = parsed.config
        config = menuTeam === '' ? fileConfig : { ...fileConfig, team: menuTeam }
        configProblems = parsed.problems
        configMisses = 0
      } catch {
        // 沒有設定檔是正常的，用預設值就好
        configMisses += 1
      }
    }

    const fetchSlate = async () => {
      const now = await $.clock.now()
      let fetchFailed = true
      let rejected = false
      try {
        // 沒指定日期就用算出來的「NBA 比賽日」，不要讓 ESPN 用美國的今天決定
        const day = config.date === '' ? nbaGameDay(now) : config.date
        const res = await $.http.fetch(scoreboardUrl(day), { headers: espnHeaders() })
        rejected = REJECTED_STATUS.includes(res.status)
        if (!res.ok) throw new Error(`ESPN responded ${res.status}`)
        let fetched = parseScoreboard(JSON.parse(res.text), now)
        showingNext = false
        // 這天沒有比賽（休賽期、全明星週末）就問 ESPN 下一批是什麼
        if (fetched.games.length === 0 && config.date === '') {
          const fb = await $.http.fetch(SCOREBOARD_URL, { headers: espnHeaders() })
          // 這一次失敗也是失敗：要記下來、被拒絕也要退開，不能當成「今天沒比賽」帶過
          rejected = REJECTED_STATUS.includes(fb.status)
          if (!fb.ok) throw new Error(`ESPN responded ${fb.status}`)
          const parsed = parseScoreboard(JSON.parse(fb.text), now)
          if (parsed.games.length > 0) {
            fetched = parsed
            showingNext = true
          }
        }
        // 跟上一次抓到的比，哪一邊分數變多了就記下來，畫面會亮幾秒
        if (slate) {
          for (const g of fetched.games) {
            const before = slate.games.find(old => old.id === g.id)
            if (!before || g.state !== 'in') continue
            for (const which of ['away', 'home'] as const) {
              const delta = g[which].score - before[which].score
              if (delta > 0) flashes.set(`${g.id}:${which}`, { delta, at: now })
            }
          }
        }
        slate = fetched
        lastError = undefined
        fetchFailed = false
      } catch (err) {
        // 抓壞了就記下來讓畫面明講。舊資料留著沒關係，但畫面會標示它是舊的，
        // 絕不能安靜地把過期資料當成即時比分。
        lastError = String(err)
        // 斷網時會連續失敗很多次，只在第一次講，不要洗版
        if (failStreak === 0) $.ui.log(`nba-scores-mod: fetch failed ${lastError}`)
      }
      failStreak = fetchFailed ? failStreak + 1 : 0
      const every =
        fetchFailed || !slate
          ? rejected
            ? Math.max(RETRY_MS[Math.min(failStreak, RETRY_MS.length) - 1], RETRY_REJECTED_MIN_MS)
            : Math.min(
                RETRY_MS[Math.min(failStreak, RETRY_MS.length) - 1],
                slate && hasLiveGame(slate) ? RETRY_LIVE_MAX_MS : Infinity,
              )
          : nextFetchDelay(slate, showingNext, now)
      nextFetchAt = now + every
      if (rejected) {
        backoff.until = now + every
        backoff.reason = lastError ?? ''
      }

      if (!config.log || !home) return
      if (logFile === '') logFile = logPath(home, now)
      logLines.push(
        fetchFailed || !slate
          ? errorLine(now, lastError ?? 'unknown error', every)
          : okLine(now, slateMode(slate), showingNext, slate, every),
      )
      if (logLines.length > LOG_MAX_LINES) logLines.splice(0, logLines.length - LOG_MAX_LINES)
      try {
        await $.fs.write(logFile, logLines.join('\n') + '\n')
        logBroken = false
      } catch (err) {
        // 寫不進去只講一次，不要每 30 秒洗一行
        if (!logBroken) $.ui.log(`nba-scores-mod: could not write log ${String(err)}`)
        logBroken = true
      }
    }

    await loadConfig()
    await fetchSlate()
    // 亮色提示要自己退掉：有提示在的時候每秒重畫一次，沒有就什麼都不做
    $.clock.every(1_000, async () => {
      if (flashes.size === 0) return
      const now = await $.clock.now()
      for (const [key, f] of flashes) if (now - f.at >= FLASH_MS) flashes.delete(key)
      $.ui.invalidate('ui.render')
    })
    $.clock.every(TICK_MS, async () => {
      const now = await $.clock.now()
      // ESPN 剛拒絕過：這段時間什麼都不抓
      if (now < backoff.until) return
      // 比分先抓，球員數據排後面：比分才是主角，不能被明細的請求拖住或害它重新退開
      if (now >= nextFetchAt) {
        await loadConfig()
        await fetchSlate()
        // 抓完就重畫，不然新比分要等到別的東西觸發重畫才會出現
        $.ui.invalidate('ui.render')
      }
      // 點開的那場如果正在打，球員數據跟著比分的頻率更新；打完的抓一次就夠。
      // 整條收起來時看不到明細，就不要抓。
      const openGame = slate?.games.find(g => g.id === openId)
      if (
        !collapsed &&
        now >= backoff.until &&
        openGame?.state === 'in' &&
        boxState.id === openGame.id &&
        now - boxState.at >= LIVE_EVERY_MS
      ) {
        await refreshBox($, boxState, openGame.id, () => openId === openGame.id, backoff)
      }
    })

    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // 只有終端機和桌面版有這條區域。手機、VS Code、claude -p 都沒有
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    // 問卷佔用同一塊位置時讓位，不要疊在一起
    if (e.props.hasSurvey) return next(e)

    const setCollapsed = (value: boolean) => {
      collapsed = value
      void $.store.set(COLLAPSED_KEY, value)
      $.ui.invalidate('ui.render')
    }

    // ---- 桌面版：橫排小卡 ----
    if (e.surface === 'desktop') {
      const { Box, Button, Svg, Text } = $.ui.resolve(e)
      const nowMs = await $.clock.now()
      // 別的 mod（例如用量帶）畫的東西一律放在自己上面。兩個 mod 誰包誰是看安裝
      // 順序，不這樣固定的話，裝的順序不同上下就會顛倒。
      const below = await next(e)
      // 有畫圖騰的球隊：圖騰＋隊色的徽章。其他球隊維持原本的紅徽章
      const totem = totemFor(config.team)
      const badge = (
        <Box flexDirection="row" alignItems="center" gap={1}>
          {totem ? <Svg source={totem.svg} alt={totem.alt} width={TOTEM_SIZE} height={TOTEM_SIZE} /> : null}
          <Box backgroundColor={totem?.badgeBg ?? BADGE_BG} paddingX={1}>
            <Text bold color={totem?.badgeFg ?? BADGE_FG}>
              NBA
            </Text>
          </Box>
        </Box>
      )
      const rule = (
        // truncate 會在尾巴加「…」、wrap 會折成兩行。所以包一層不准縮的框：
        // 字維持一整行、撐出去的部分由外框裁掉
        <Box flexDirection="row" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text dimColor>{RULE}</Text>
          </Box>
        </Box>
      )

      if (!slate) {
        return (
          <Box flexDirection="column">
            {below}
            <Text dimColor>{lastError ? t.fetchFailed(lastError) : t.loading}</Text>
          </Box>
        )
      }

      // 收起來時只留「有沒有比賽正在打」這一件事，其他都不講
      const live = slateMode(slate) === 'live'
      const all = sortLiveFirst(slate.games, config.team)

      if (collapsed) {
        return (
          <Box flexDirection="column">
            {below}
            {rule}
            <Box flexDirection="row" alignItems="center" gap={1}>
              {badge}
              {live ? <Text color={ACCENT}>● LIVE</Text> : null}
              <Box key="nba-scores-mod:expand-area">
                <Button
                  key="nba-scores-mod:expand"
                  plain
                  label={t.expand}
                  hover={{ color: ACCENT }}
                  onPress={() => setCollapsed(false)}
                />
              </Box>
            </Box>
          </Box>
        )
      }

      // 場次變少時（隔天換一批）原本翻到的位置可能已經不存在
      const start = Math.min(offset, Math.max(0, all.length - 1))
      const visible = all.slice(start)
      const hidden = all.filter(g => isMasked(g, spoilerFree(), revealed)).length
      const age = Math.floor((nowMs - slate.fetchedAt) / 60_000)

      const chip = (g: Game) => {
        const mine = involves(g, config.team)
        const masked = isMasked(g, spoilerFree(), revealed)
        const started = g.state !== 'pre'
        // 打完的比賽：贏的那邊亮、輸的那邊暗，一眼看得出誰贏。遮住時不能洩漏
        const decided = g.state === 'post' && !masked && g.away.score !== g.home.score
        const side = (which: Which) => {
          const team = g[which]
          const other = which === 'away' ? g.home : g.away
          const lost = decided && team.score < other.score
          const flash = flashOf(g.id, which, nowMs)
          return (
            <Box flexDirection="row" alignItems="center" gap={1}>
              {mine ? <Text color={teamColor(team)}>▍</Text> : null}
              <Text bold={mine} dimColor={lost}>
                {team.abbr}
              </Text>
              {!started ? null : masked ? (
                <Svg source={MASK_SVG} alt={t.maskedAlt} width={22} height={12} />
              ) : (
                // 剛得分的前幾秒顯示「舊比分 +N」，之後才換成新比分。直接寫「新比分 +N」
                // 會被讀成還要再加 N 分（100 +2 看起來像 102）。
                <Text bold={!lost} dimColor={lost} color={flash && !flash.strong ? FLASH_COLOR : undefined}>
                  {String(flash?.strong ? team.score - flash.delta : team.score)}
                </Text>
              )}
              {flash?.strong && !masked ? <Text color={FLASH_COLOR}>+{String(flash.delta)}</Text> : null}
            </Box>
          )
        }
        return (
          <Box
            key={g.id}
            flexDirection="row"
            alignItems="center"
            gap={1}
            paddingX={1}
            flexShrink={0}
            borderStyle="round"
            borderDimColor={!mine && g.id !== openId}
          >
            {g.state === 'in' ? <Text color={ACCENT}>●</Text> : null}
            {side('away')}
            <Text dimColor>{started ? '–' : '@'}</Text>
            {side('home')}
            {g.state === 'in' ? (
              <Text color={ACCENT}>{chipDetail(g, showingNext)}</Text>
            ) : g.state === 'pre' ? (
              <Text color={UPCOMING}>{chipDetail(g, showingNext)}</Text>
            ) : (
              <Text dimColor>{chipDetail(g, showingNext)}</Text>
            )}
            {started && !masked ? (
              <Button
                key={`nba-scores-mod:open:${g.id}`}
                plain
                label={g.id === openId ? '▴' : '▾'}
                onPress={() => {
                  openId = g.id === openId ? undefined : g.id
                  $.ui.invalidate('ui.render')
                  if (openId !== undefined && (boxState.id !== openId || boxState.error !== undefined)) {
                    const picked = openId
                    void refreshBox($, boxState, picked, () => openId === picked, backoff)
                  }
                }}
              />
            ) : null}
            {masked ? (
              <Button
                key={`nba-scores-mod:reveal:${g.id}`}
                plain
                label={t.reveal}
                onPress={() => {
                  revealed.add(g.id)
                  $.ui.invalidate('ui.render')
                }}
              />
            ) : null}
          </Box>
        )
      }

      // 防雷遮住的那場不能畫明細：點開時還在打、後來打完了，明細會把最終比分洩漏出來
      const opened = all.find(g => g.id === openId && g.state !== 'pre' && !isMasked(g, spoilerFree(), revealed))

      // 設定那一排全部用按鈕，不用下拉：桌面版不接 Select 的選取（2026-10-13 實測，
      // 紀錄寫 ui_select not handled），按鈕才確定會動。
      // 語言、防雷選項少，點一下換下一個；選了就寫進設定
      const cycle = (field: Field, label: string, choices: string[], value: string) => (
        <Button
          key={`nba-scores-mod:setting:${field}`}
          label={t.settingValue(label, value)}
          onPress={() =>
            saveSetting($, held, field, choices[(choices.indexOf(value) + 1) % choices.length], applyOptions)
          }
        />
      )
      // 球隊有 30 個，一顆一顆列出來，點哪隊就選哪隊
      const teamButton = (value: string, label: string) => (
        <Button
          key={`nba-scores-mod:team:${value === NO_TEAM ? 'none' : label}`}
          // 目前選的那隊用打勾標出來。不用 variant：舊一點的 Claude Code 不認得，整棵樹會被拒收
          label={value === currentTeamOption ? `✓ ${label}` : label}
          onPress={() => {
            teamOpen = false
            $.ui.invalidate('ui.render')
            return saveSetting($, held, 'team', value, applyOptions)
          }}
        />
      )
      const currentOption = (value: unknown, choices: string[]) =>
        typeof value === 'string' && choices.includes(value) ? value : choices[0]
      // 球隊也可能是從設定檔來的，那時要換算成選單上的那一項
      const currentTeamOption =
        TEAM_OPTIONS.find(o => teamFromOption(o) === config.team && config.team !== '') ?? NO_TEAM

      // 一整排、不換行：左邊固定（徽章、往前翻），中間是小卡（放不下的由右邊裁掉），
      // 右邊固定（往後翻、警告、收起）。桌面版的框不能真的用手滑，所以用 ‹ › 按鈕翻。
      // 「幾場、幾分鐘前更新」不放——只有資料真的過期時才出聲。
      const STEP = 2
      return (
        <Box flexDirection="column">
          {below}
          {rule}
          <Box flexDirection="row" alignItems="center" gap={1} width="100%">
            <Box flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
              {badge}
              {showingNext ? <Text dimColor>{t.next}</Text> : null}
              {config.date !== '' ? <Text color="#d97706">{t.pinnedDate(config.date)}</Text> : null}
              {start > 0 ? (
                <Button
                  key="nba-scores-mod:prev"
                  plain
                  label="‹"
                  onPress={() => {
                    offset = Math.max(0, start - STEP)
                    $.ui.invalidate('ui.render')
                  }}
                />
              ) : null}
            </Box>
            <Box flexDirection="row" alignItems="center" gap={1} flexGrow={1} flexShrink={1} overflow="hidden">
              {all.length === 0 ? <Text dimColor>{t.noGames}</Text> : visible.map(chip)}
            </Box>
            <Box flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
              {start < all.length - 1 ? (
                <Button
                  key="nba-scores-mod:next"
                  plain
                  label="›"
                  onPress={() => {
                    offset = Math.min(all.length - 1, start + STEP)
                    $.ui.invalidate('ui.render')
                  }}
                />
              ) : null}
              {lastError !== undefined ? <Text color="#d97706">{t.stale(age)}</Text> : null}
              {configProblems.length > 0 ? <Text color="#d97706">{t.configProblem(configProblems[0])}</Text> : null}
              {hidden > 0 ? (
                <Button
                  key="nba-scores-mod:reveal-all"
                  plain
                  label={t.revealAll(hidden)}
                  onPress={() => {
                    for (const g of all) revealed.add(g.id)
                    $.ui.invalidate('ui.render')
                  }}
                />
              ) : null}
              {/* 還沒選球隊才出現：點了直接把 30 隊攤開。選了隊這顆就消失 */}
              {config.team === '' && !teamOpen ? (
                <Button
                  key="nba-scores-mod:pick-team"
                  plain
                  label={t.pickTeam}
                  onPress={() => {
                    settingsOpen = true
                    teamOpen = true
                    void $.store.set(SETTINGS_OPEN_KEY, settingsOpen)
                    $.ui.invalidate('ui.render')
                  }}
                />
              ) : null}
              {/* 桌面版沒有 /config 選單，設定只能從帶子上改，所以給一個常駐的入口。
                  只放齒輪符號太小不明顯，所以符號後面加字 */}
              <Button
                key="nba-scores-mod:settings"
                plain
                label={t.settings}
                onPress={() => {
                  settingsOpen = !settingsOpen
                  teamOpen = false
                  void $.store.set(SETTINGS_OPEN_KEY, settingsOpen)
                  $.ui.invalidate('ui.render')
                }}
              />
              {/* hover 要有一個帶 key 的 Box 當範圍，沒有的話整棵樹會被桌面版拒收 */}
              <Box key="nba-scores-mod:collapse-area">
                <Button
                  key="nba-scores-mod:collapse"
                  plain
                  label={t.collapse}
                  hover={{ color: ACCENT }}
                  onPress={() => setCollapsed(true)}
                />
              </Box>
            </Box>
          </Box>
          {settingsOpen ? (
            <Box flexDirection="row" alignItems="center" gap={2} marginTop={1}>
              <Button
                key="nba-scores-mod:setting:team"
                label={`${t.settingValue(t.settingTeam, config.team === '' ? t.noTeam : config.team)} ${teamOpen ? '▴' : '▾'}`}
                onPress={() => {
                  teamOpen = !teamOpen
                  $.ui.invalidate('ui.render')
                }}
              />
              {cycle('language', t.settingLanguage, LANG_OPTIONS, currentOption(option('language'), LANG_OPTIONS))}
              {cycle(
                'spoilerFree',
                t.settingSpoilerFree,
                SPOILER_OPTIONS,
                currentOption(option('spoilerFree'), SPOILER_OPTIONS),
              )}
              {held.saveProblem ? <Text color="#d97706">{t.settingsNotSaved}</Text> : null}
            </Box>
          ) : null}
          {settingsOpen && teamOpen ? (
            <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
              {TEAM_OPTIONS.map(o => teamButton(o, o === NO_TEAM ? t.noTeam : teamFromOption(o)))}
            </Box>
          ) : null}
          {opened ? renderDetail({ Box, Text }, opened, boxState, { wide: true, gapTop: 1, t }) : null}
        </Box>
      )
    }

    // ---- 終端機：一行橫排，內容和操作跟桌面版一樣 ----
    // 終端機畫不了圖騰（只能排字）。選了球隊的話，徽章換成隊色、自己球隊那場兩邊
    // 各加一條隊色，顏色跟桌面版是同一套；那一場照樣排最前面。
    // 設定跟桌面版一樣從帶子上的「⚙ 設定」改：/config 也改得到，但很少人知道要去那裡找。

    const { Box, Button, Text } = await $.ui.resolve(e)
    const now = await $.clock.now()
    const columns = (e.props.bodyColumns ?? e.viewport?.columns ?? 80) - TERM_INDENT
    const below = await next(e)
    const totem = totemFor(config.team)
    const badge = (
      <Text bold color={totem?.badgeFg ?? BADGE_FG} backgroundColor={totem?.badgeBg ?? BADGE_BG}>
        {BADGE_TEXT}
      </Text>
    )

    if (!slate) {
      return (
        <Box flexDirection="column">
          {below}
          <Box paddingLeft={TERM_INDENT}>
            <Text dimColor>{lastError ? t.fetchFailed(lastError) : t.loading}</Text>
          </Box>
        </Box>
      )
    }

    if (collapsed) {
      return (
        <Box flexDirection="column">
          {below}
          <Box flexDirection="row" gap={2} paddingLeft={TERM_INDENT}>
            {badge}
            {slateMode(slate) === 'live' ? <Text color={ACCENT}>● LIVE</Text> : null}
            <Button key="nba-scores-mod:expand" plain dimColor label={t.expand} onPress={() => setCollapsed(false)} />
          </Box>
        </Box>
      )
    }

    const all = sortLiveFirst(slate.games, config.team)
    const start = Math.min(offset, Math.max(0, all.length - 1))
    const hiddenCount = all.filter(g => isMasked(g, spoilerFree(), revealed)).length
    const ageMin = Math.floor((now - slate.fetchedAt) / 60_000)

    // 每一塊的字先列出來：一份拿去畫，一份拿去量寬度（決定這一行放得下幾場）
    const dateNote = config.date !== '' ? t.pinnedDate(config.date) : ''
    const staleNote = lastError !== undefined ? t.stale(ageMin) : ''
    const configNote = configProblems.length > 0 ? t.configProblem(configProblems[0]) : ''
    const revealAll = hiddenCount > 0 ? t.revealAll(hiddenCount) : ''
    const widthOf = (parts: string[], gap: number) => {
      const used = parts.filter(s => s !== '')
      return used.reduce((n, s) => n + textWidth(s), 0) + Math.max(0, used.length - 1) * gap
    }
    const leftWidth = widthOf([BADGE_TEXT, showingNext ? t.next : '', dateNote, start > 0 ? '‹' : ''], 2)
    // 右邊那幾顆佔多寬，看兩件事：要不要留 › 的位置、「設定」寫全名還是只放齒輪
    const SETTINGS_SHORT = '⚙'
    const rightWidthOf = (settingsLabel: string, withNext: boolean) =>
      widthOf([withNext ? '›' : '', staleNote, configNote, revealAll, settingsLabel, t.collapse], 2)
    const chipWidth = (g: Game, reserveFlash = true) => {
      const started = g.state !== 'pre'
      const masked = isMasked(g, spoilerFree(), revealed)
      const score = (n: number) => (!started ? '' : masked ? MASK : String(n))
      const bar = involves(g, config.team) ? '▍' : ''
      // 灰底左右各留一格
      return (
        2 +
        widthOf(
          [
            g.state === 'in' ? '●' : '',
            bar,
            g.away.abbr,
            score(g.away.score),
            '–',
            bar,
            g.home.abbr,
            score(g.home.score),
            chipDetail(g, showingNext),
            masked ? t.reveal : started ? '▾' : '',
            // 得分時會多出「+3」，先留位置，不然一得分整排就重排
            reserveFlash && g.state === 'in' ? '+3' : '',
          ],
          1,
        )
      )
    }
    const rest = all.slice(start)
    const fit = (rightWidth: number): Game[] => {
      const room = columns - leftWidth - rightWidth - 2 * 2
      const fits: Game[] = []
      let used = 0
      for (const g of rest) {
        const w = chipWidth(g) + (fits.length > 0 ? CHIP_GAP : 0)
        // 再窄也至少畫一場
        if (fits.length > 0 && used + w > room) break
        fits.push(g)
        used += w
      }
      return fits
    }
    // 比賽優先：能多放一場就多放一場，「設定」兩個字是第一個讓位的。
    // 剩下的場次全放得下時不需要 ›，那個位置也拿來用；放不下才留 › 的位置（免得它出現時擠掉一場）。
    let settingsLabel = t.settings
    let shown = fit(rightWidthOf(t.settings, false))
    if (shown.length < rest.length) {
      shown = fit(rightWidthOf(SETTINGS_SHORT, false))
      settingsLabel = SETTINGS_SHORT
      if (shown.length < rest.length) {
        const wide = fit(rightWidthOf(t.settings, true))
        shown = fit(rightWidthOf(SETTINGS_SHORT, true))
        if (wide.length === shown.length) settingsLabel = t.settings
      }
    }
    const hasMore = start + shown.length < all.length
    // 上面算場數時，每場進行中的比賽都預留了 +N 的位置，所以畫出來常常還有空。
    // 縮成齒輪之後，如果實際寬度留一點得分的餘裕還放得下全名，就寫回全名。
    // 很多場同時得分時最右邊可能被裁掉幾秒，比為了這個一直只放齒輪划算。
    if (settingsLabel === SETTINGS_SHORT) {
      const actual = shown.reduce((n, g, i) => n + chipWidth(g, false) + (i > 0 ? CHIP_GAP : 0), 0)
      const fullRoom = columns - leftWidth - rightWidthOf(t.settings, hasMore) - 2 * 2
      if (actual + FLASH_SLACK <= fullRoom) settingsLabel = t.settings
    }

    const chip = (g: Game) => {
      const mine = involves(g, config.team)
      const masked = isMasked(g, spoilerFree(), revealed)
      const started = g.state !== 'pre'
      // 打完的比賽：贏的那邊亮、輸的那邊暗。遮住時不能洩漏
      const decided = g.state === 'post' && !masked && g.away.score !== g.home.score
      const side = (which: Which) => {
        const team = g[which]
        const other = which === 'away' ? g.home : g.away
        const lost = decided && team.score < other.score
        const flash = flashOf(g.id, which, now)
        return (
          <Box flexDirection="row" gap={1}>
            {mine ? <Text color={teamColor(team)}>▍</Text> : null}
            <Text bold={!lost} dimColor={lost}>
              {team.abbr}
            </Text>
            {!started ? null : masked ? (
              <Text dimColor>{MASK}</Text>
            ) : (
              // 先「舊比分 +N」再換新比分，理由同桌面版
              <Text bold={!lost} dimColor={lost} color={flash && !flash.strong ? FLASH_COLOR : undefined}>
                {String(flash?.strong ? team.score - flash.delta : team.score)}
              </Text>
            )}
            {flash?.strong && !masked ? <Text color={FLASH_COLOR}>+{String(flash.delta)}</Text> : null}
          </Box>
        )
      }
      return (
        <Box key={g.id} flexDirection="row" gap={1} paddingX={1} backgroundColor={termBg.chip}>
          {g.state === 'in' ? <Text color={ACCENT}>●</Text> : null}
          {side('away')}
          <Text dimColor>{started ? '–' : '@'}</Text>
          {side('home')}
          {g.state === 'in' ? (
            <Text color={ACCENT}>{chipDetail(g, showingNext)}</Text>
          ) : g.state === 'pre' ? (
            <Text color={UPCOMING}>{chipDetail(g, showingNext)}</Text>
          ) : (
            <Text dimColor>{chipDetail(g, showingNext)}</Text>
          )}
          {started && !masked ? (
            <Button
              key={`nba-scores-mod:open:${g.id}`}
              plain
              label={g.id === openId ? '▴' : '▾'}
              onPress={() => {
                openId = g.id === openId ? undefined : g.id
                $.ui.invalidate('ui.render')
                if (openId !== undefined && (boxState.id !== openId || boxState.error !== undefined)) {
                  const picked = openId
                  void refreshBox($, boxState, picked, () => openId === picked, backoff)
                }
              }}
            />
          ) : null}
          {masked ? (
            <Button
              key={`nba-scores-mod:reveal:${g.id}`}
              plain
              label={t.reveal}
              onPress={() => {
                revealed.add(g.id)
                $.ui.invalidate('ui.render')
              }}
            />
          ) : null}
        </Box>
      )
    }

    // 防雷遮住的那場不能畫明細：點開時還在打、後來打完了，明細會把最終比分洩漏出來
    const opened = all.find(g => g.id === openId && g.state !== 'pre' && !isMasked(g, spoilerFree(), revealed))
    // 語言、防雷：點一下換下一個選項
    const cycle = (field: Field, label: string, choices: string[]) => {
      const raw = option(field)
      const value = typeof raw === 'string' && choices.includes(raw) ? raw : choices[0]
      return (
        <Box paddingX={1} backgroundColor={termBg.button}>
          <Button
            key={`nba-scores-mod:setting:${field}`}
            plain
            label={t.settingValue(label, value)}
            onPress={() =>
              saveSetting($, held, field, choices[(choices.indexOf(value) + 1) % choices.length], applyOptions)
            }
          />
        </Box>
      )
    }
    // 30 隊照視窗寬度排成幾行（終端機的一行放不下就會被裁掉，不會自己換行）
    const TEAM_GAP = 2
    const teamRows: string[][] = [[]]
    let rowWidth = 0
    for (const o of TEAM_OPTIONS) {
      // 每顆都留打勾的位置，選了之後不會整排重排
      const w = textWidth(`✓ ${o === NO_TEAM ? t.noTeam : teamFromOption(o)}`) + 2 + TEAM_GAP
      if (rowWidth + w > columns && teamRows[teamRows.length - 1].length > 0) {
        teamRows.push([])
        rowWidth = 0
      }
      teamRows[teamRows.length - 1].push(o)
      rowWidth += w
    }
    return (
      <Box flexDirection="column">
        {below}
        <Box flexDirection="column" paddingLeft={TERM_INDENT}>
          <Box flexDirection="row" gap={2}>
            {badge}
            {showingNext ? <Text dimColor>{t.next}</Text> : null}
            {dateNote !== '' ? <Text color="#d97706">{dateNote}</Text> : null}
            {start > 0 ? (
              <Button
                key="nba-scores-mod:prev"
                plain
                label="‹"
                onPress={() => {
                  // 往回翻一頁的場數跟現在這頁一樣多（每場寬度差不多）
                  offset = Math.max(0, start - Math.max(1, shown.length))
                  $.ui.invalidate('ui.render')
                }}
              />
            ) : null}
            {all.length === 0 ? <Text dimColor>{t.noGames}</Text> : null}
            {shown.map(g => chip(g))}
            {hasMore ? (
              <Button
                key="nba-scores-mod:next"
                plain
                label="›"
                onPress={() => {
                  offset = start + shown.length
                  $.ui.invalidate('ui.render')
                }}
              />
            ) : null}
            {staleNote !== '' ? <Text color="#d97706">{staleNote}</Text> : null}
            {configNote !== '' ? <Text color="#d97706">{configNote}</Text> : null}
            {revealAll !== '' ? (
              <Button
                key="nba-scores-mod:reveal-all"
                plain
                label={revealAll}
                onPress={() => {
                  for (const g of all) revealed.add(g.id)
                  $.ui.invalidate('ui.render')
                }}
              />
            ) : null}
            <Button
              key="nba-scores-mod:settings"
              plain
              dimColor
              label={settingsLabel}
              onPress={() => {
                settingsOpen = !settingsOpen
                teamOpen = false
                void $.store.set(SETTINGS_OPEN_KEY, settingsOpen)
                $.ui.invalidate('ui.render')
              }}
            />
            <Button
              key="nba-scores-mod:collapse"
              plain
              dimColor
              label={t.collapse}
              onPress={() => setCollapsed(true)}
            />
          </Box>
          {settingsOpen ? (
            // 跟上面的比賽空一行，不然黏在一起
            <Box flexDirection="row" gap={2} marginTop={1}>
              <Box paddingX={1} backgroundColor={termBg.button}>
                <Button
                  key="nba-scores-mod:setting:team"
                  plain
                  label={`${t.settingValue(t.settingTeam, config.team === '' ? t.noTeam : config.team)} ${teamOpen ? '▴' : '▾'}`}
                  onPress={() => {
                    teamOpen = !teamOpen
                    $.ui.invalidate('ui.render')
                  }}
                />
              </Box>
              {cycle('language', t.settingLanguage, LANG_OPTIONS)}
              {cycle('spoilerFree', t.settingSpoilerFree, SPOILER_OPTIONS)}
              {held.saveProblem ? <Text color="#d97706">{t.settingsNotSaved}</Text> : null}
            </Box>
          ) : null}
          {settingsOpen && teamOpen
            ? teamRows.map((row, i) => (
                <Box key={`nba-scores-mod:team-row:${String(i)}`} flexDirection="row" gap={TEAM_GAP} marginTop={1}>
                  {row.map(o => {
                    const label = o === NO_TEAM ? t.noTeam : teamFromOption(o)
                    return (
                      <Box key={`nba-scores-mod:team-pill:${label}`} paddingX={1} backgroundColor={termBg.button}>
                        <Button
                          key={`nba-scores-mod:team:${o === NO_TEAM ? 'none' : label}`}
                          plain
                          label={teamFromOption(o) === config.team ? `✓ ${label}` : label}
                          onPress={() => {
                            teamOpen = false
                            $.ui.invalidate('ui.render')
                            return saveSetting($, held, 'team', o, applyOptions)
                          }}
                        />
                      </Box>
                    )
                  })}
                </Box>
              ))
            : null}
          {opened
            ? renderDetail({ Box, Text }, opened, boxState, { wide: columns >= DETAIL_WIDE_COLUMNS, gapTop: 0, t })
            : null}
        </Box>
      </Box>
    )
  })
}
