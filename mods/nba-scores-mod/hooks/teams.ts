// 30 隊的代號與隊名（英文，設定選單的選項沒辦法跟著語言切換）。代號用 NBA 官方三碼（NOP、NYK、GSW、SAS、UTA、WAS）。
//
// 設定選單（plugin.json 的 userConfig.team）的選項就是「代號 隊名」這個字串，
// 兩邊要一致：改這裡也要改 plugin.json，測試會比對。

import { officialAbbr } from './espn.ts'

export const TEAM_NAMES: Record<string, string> = {
  ATL: 'Hawks',
  BOS: 'Celtics',
  BKN: 'Nets',
  CHA: 'Hornets',
  CHI: 'Bulls',
  CLE: 'Cavaliers',
  DAL: 'Mavericks',
  DEN: 'Nuggets',
  DET: 'Pistons',
  GSW: 'Warriors',
  HOU: 'Rockets',
  IND: 'Pacers',
  LAC: 'Clippers',
  LAL: 'Lakers',
  MEM: 'Grizzlies',
  MIA: 'Heat',
  MIL: 'Bucks',
  MIN: 'Timberwolves',
  NOP: 'Pelicans',
  NYK: 'Knicks',
  OKC: 'Thunder',
  ORL: 'Magic',
  PHI: '76ers',
  PHX: 'Suns',
  POR: 'Trail Blazers',
  SAC: 'Kings',
  SAS: 'Spurs',
  TOR: 'Raptors',
  UTA: 'Jazz',
  WAS: 'Wizards',
}

/** 選單裡代表「沒選球隊」的那一項，也是預設值 */
export const NO_TEAM = 'None'

/** 設定選單與帶子上下拉選單共用的選項文字，例如「MIA Heat」 */
export const teamOption = (abbr: string): string => `${abbr} ${TEAM_NAMES[abbr]}`

export const TEAM_OPTIONS: string[] = [NO_TEAM, ...Object.keys(TEAM_NAMES).map(teamOption)]

/** 把選單的值轉回代號；沒選、或值不認得就回空字串 */
export const teamFromOption = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  // 只看第一個詞，所以舊版的「MIA 熱火」「NO 鵜鶘」也認得
  const abbr = officialAbbr(value.split(' ')[0] ?? '')
  return abbr in TEAM_NAMES ? abbr : ''
}
