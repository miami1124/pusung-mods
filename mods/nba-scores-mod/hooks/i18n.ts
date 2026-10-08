// 畫面上的字。設定選單的 Language 預設是 Auto：電腦時區在台灣就用繁體中文，
// 其他地方用英文。用時區猜是因為 mod 讀不到電腦的語言設定（一律回 en-US）。
// 紀錄檔和設定檔的錯誤訊息是給排查問題用的，固定英文，不在這裡。

export type Lang = 'en' | 'zh'

export const LANG_OPTIONS = ['Auto', 'English', '繁體中文']

/** 這個時區的使用者預設看繁體中文 */
const ZH_TIME_ZONES = ['Asia/Taipei']

const systemTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return ''
  }
}

/**
 * 把設定選單的值轉成語言。明確選了就照選的；Auto、沒設、或值不認得就看時區。
 * timeZone 不給就用電腦的；測試會指定。
 */
export const langFromOption = (value: unknown, timeZone: string = systemTimeZone()): Lang => {
  if (value === '繁體中文') return 'zh'
  if (value === 'English') return 'en'
  return ZH_TIME_ZONES.includes(timeZone) ? 'zh' : 'en'
}

export type Strings = {
  loading: string
  fetchFailed: (error: string) => string
  expand: string
  collapse: string
  next: string
  noGames: string
  pinnedDate: (date: string) => string
  stale: (minutes: number) => string
  configProblem: (problem: string) => string
  reveal: string
  revealAll: (count: number) => string
  pickTeam: string
  settings: string
  settingTeam: string
  settingLanguage: string
  settingSpoilerFree: string
  maskedAlt: string
  pts: string
  reb: string
  ast: string
  total: string
  boxLoading: string
  boxFailed: (error: string) => string
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    loading: 'NBA  Loading…',
    fetchFailed: error => `NBA  ⚠ Couldn't load scores: ${error}`,
    expand: 'Show',
    collapse: 'Hide',
    next: 'Next up',
    noGames: 'No games today',
    pinnedDate: date => `[pinned to ${date}]`,
    stale: minutes => `⚠ Scores not updating (last fetched ${minutes} min ago)`,
    configProblem: problem => `⚠ Config: ${problem}`,
    reveal: 'Reveal',
    revealAll: count => `Reveal all (${count})`,
    pickTeam: 'Pick your team',
    settings: '⚙ Settings',
    settingTeam: 'Team',
    settingLanguage: 'Language',
    settingSpoilerFree: 'Spoiler-free',
    maskedAlt: 'Score hidden',
    pts: 'PTS',
    reb: 'REB',
    ast: 'AST',
    total: 'Total',
    boxLoading: 'Loading player stats…',
    boxFailed: error => `⚠ Couldn't load player stats: ${error}`,
  },
  zh: {
    loading: 'NBA  讀取中…',
    fetchFailed: error => `NBA  ⚠ 抓不到資料：${error}`,
    expand: '展開',
    collapse: '收起',
    next: '下一場',
    noGames: '今天沒有比賽',
    pinnedDate: date => `[固定看 ${date}]`,
    stale: minutes => `⚠ 資料未更新（${minutes} 分鐘前抓的）`,
    configProblem: problem => `⚠ 設定檔：${problem}`,
    reveal: '看結果',
    revealAll: count => `揭曉全部 (${count})`,
    pickTeam: '選你的球隊',
    settings: '⚙ 設定',
    settingTeam: '球隊',
    settingLanguage: '語言',
    settingSpoilerFree: '防雷',
    maskedAlt: '比分已遮住',
    pts: '得分',
    reb: '籃板',
    ast: '助攻',
    total: '總分',
    boxLoading: '球員數據讀取中…',
    boxFailed: error => `⚠ 球員數據抓不到：${error}`,
  },
}
