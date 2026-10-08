// 紀錄檔：每抓一次 ESPN 就記一行，事後可以回頭看「幾點切成 LIVE、比分多久跳一次、
// 哪個時間點抓壞了」。預設關閉，在 ~/.claude/nba-scores-mod.json 設 "log": true 才會寫。
//
// mod 的檔案 API 只有「整份覆寫」沒有「接在後面寫」，所以每個 session 寫自己的一份
// （檔名帶開啟時間），兩個視窗同時開也不會互相蓋掉。

import type { Game, Slate, SlateMode } from './espn.ts'
import { localStamp } from './time.ts'

/** 最多留幾行。一場比賽日開整天大約 700 行，超過就丟掉最舊的 */
export const LOG_MAX_LINES = 3000

/** 這個 session 的紀錄檔路徑。startedAt 是模組載入的時間（毫秒） */
export const logPath = (home: string, startedAt: number): string =>
  `${home}/.claude/nba-scores-mod.${localStamp(startedAt).replace(/[/:]/g, '').replace(' ', '-')}.log`

const gameText = (g: Game): string => {
  const where = g.state === 'pre' ? 'not started' : g.detail
  return `${g.away.abbr} ${g.away.score}-${g.home.score} ${g.home.abbr} (${where})`
}

/** 抓成功的一行：時間、畫面標題的狀態、每場比分、多久後再抓 */
export const okLine = (
  now: number,
  mode: SlateMode,
  isNext: boolean,
  slate: Slate,
  everyMs: number,
): string =>
  [
    localStamp(now),
    (isNext ? 'next' : mode).padEnd(8),
    slate.games.map(gameText).join(' | ') || '(no games)',
    `next in ${Math.round(everyMs / 1000)}s`,
  ].join('  ')

/** 抓失敗的一行。畫面這時沿用舊資料並標示警告，紀錄裡要看得出是哪一刻開始壞的 */
export const errorLine = (now: number, error: string, everyMs: number): string =>
  [localStamp(now), 'ERROR   ', error, `next in ${Math.round(everyMs / 1000)}s`].join('  ')
