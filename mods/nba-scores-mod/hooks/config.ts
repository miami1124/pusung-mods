import { officialAbbr } from './espn.ts'

// 使用者設定：~/.claude/nba-scores-mod.json
//
// 刻意放在「個人層」而不是專案的 .claude/ 底下——專案那份會被 git 追蹤，
// 而球隊偏好是每個人自己的事，不該跟著別人的 repo 走。

export type Config = {
  /** 支持的球隊，NBA 官方三碼（MIA / LAL / NOP…），寫 ESPN 的 NO 也認得。空字串代表不置頂任何隊 */
  team: string
  /** 防雷模式：已結束的比賽比分打碼，點擊才揭曉 */
  spoilerFree: boolean
  /**
   * 固定看某一天，格式 YYYYMMDD。空字串＝看今天（正常用法）。
   * 主要用途是休賽期開發時拿過去的比賽當素材，一般使用者不用設。
   */
  date: string
  /**
   * 把每次抓到的比分寫一行到 ~/.claude/nba-scores-mod.<開啟時間>.log。
   * 用來事後檢查「幾點切成 LIVE、比分多久跳一次」，平常不用開。
   */
  log: boolean
}

export const DEFAULTS: Config = {
  team: '',
  spoilerFree: false,
  date: '',
  log: false,
}

/** 設定檔相對於家目錄的位置 */
export const CONFIG_REL = '.claude/nba-scores-mod.json'

/**
 * 把讀到的 JSON 文字併進預設值。
 * 單一欄位壞掉不該讓整份設定失效——壞的用預設值，其他照用，並回報哪裡壞了。
 */
export const parseConfig = (text: string): { config: Config; problems: string[] } => {
  const problems: string[] = []
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch (err) {
    return { config: { ...DEFAULTS }, problems: [`not valid JSON: ${String(err)}`] }
  }

  const config = { ...DEFAULTS }

  if (raw?.team !== undefined) {
    if (typeof raw.team === 'string') config.team = officialAbbr(raw.team.trim().toUpperCase())
    else problems.push('team must be a string, e.g. "MIA"')
  }
  if (raw?.date !== undefined) {
    const d = String(raw.date).trim()
    if (d === '' || /^\d{8}$/.test(d)) config.date = d
    else problems.push('date must be 8 digits (YYYYMMDD), or empty for today')
  }
  if (raw?.spoilerFree !== undefined) {
    if (typeof raw.spoilerFree === 'boolean') config.spoilerFree = raw.spoilerFree
    else problems.push('spoilerFree must be true or false')
  }
  if (raw?.log !== undefined) {
    if (typeof raw.log === 'boolean') config.log = raw.log
    else problems.push('log must be true or false')
  }

  return { config, problems }
}
