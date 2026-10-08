import { expect, mock, test } from 'claude-code/testing'
import { TEAM_OPTIONS } from '../hooks/teams.ts'
import { TOTEMS } from '../hooks/totems.ts'
import { LANG_OPTIONS, langFromOption } from '../hooks/i18n.ts'
import { localStart } from '../hooks/time.ts'

// 桌面版拒收一棵畫面樹的時候，整條帶會直接消失而且沒有任何錯誤訊息
// （2026-10-05 踩過：連上面別的 mod 都一起不見）。這支測試在本機把帶子
// 掛到 desktop 和 terminal 上，被拒收就會紅，不用靠截圖才知道。

const side = (homeAway: string, abbr: string, score: string, periods: number[]) => ({
  homeAway,
  score,
  team: { abbreviation: abbr, displayName: abbr, color: '98002e', alternateColor: 'f9a01b' },
  linescores: periods.map(value => ({ value })),
})

const event = (id: string, state: string, detail: string, away: any, home: any) => ({
  id,
  date: '2026-10-06T23:00Z',
  competitions: [
    {
      status: { period: 4, displayClock: '2:31', type: { state, shortDetail: detail } },
      competitors: [home, away],
    },
  ],
})

const SCOREBOARD = {
  events: [
    event('1', 'post', 'Final', side('away', 'UTAH', '109', [36, 27, 25, 21]), side('home', 'DEN', '97', [26, 26, 25, 20])),
    event('2', 'in', 'Q4 2:31', side('away', 'NO', '95', [20, 25, 30, 20]), side('home', 'MIA', '98', [28, 22, 26, 22])),
    event('3', 'pre', '10/6 - 10:00 PM EDT', side('away', 'LAL', '0', []), side('home', 'SAC', '0', [])),
  ],
}

const PROPS = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 }

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}：帶子畫得出來，沒有被拒收`, { options: { team: 'MIA Heat' } }, async ($, on) => {
    // 測試裡沒有真的引擎，mod 會呼叫的東西都要有人回答（格式是 { value }）
    on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
    on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
    on('clock.every', () => ({ value: undefined }))
    on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
    on('fs.read', () => ({ deny: 'no config file' }))
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    // 帶子最底層引擎自己不畫東西，這裡用一個空框代表
    on('ui.render', () => ({ type: 'Box' }))

    on('session.start', () => ({ cwd: '/tmp' }))
    on('ui.log', () => ({ value: undefined }))
    // mod 是在 session.start 才去抓比賽資料的
    await $.session.start({ cwd: '/tmp', surface, isInteractive: true } as any)

    const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface, component: 'AbovePrompt', props: PROPS })
    // drawn() 在畫面樹被這個介面拒收時會 reject，並帶著原因
    const tree = await ui.drawn()
    expect(tree).toMatchObject({ type: 'Box' })
    // 有抓到比賽資料才會出現「收起」，確認不是停在「讀取中」
    expect(await ui.find({ key: 'nba-scores-mod:collapse' })).toBeDefined()
    // 選了熱火：桌面版要有火焰圖騰，徽章換成熱火的顏色，而且不再出現選隊選單
    if (surface === 'desktop') {
      expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: '火焰' } })
      expect(await ui.find({ type: 'Text', text: 'NBA' })).toMatchObject({ props: { color: '#FCEBEB' } })
      expect(await ui.find({ key: 'nba-scores-mod:pick-team' })).toBeUndefined()
    }

    // 收起來也要畫得出來，而且會換成「展開」
    await ui.press({ key: 'nba-scores-mod:collapse' })
    expect(await ui.drawn()).toMatchObject({ type: 'Box' })
    if (!(await ui.find({ key: 'nba-scores-mod:expand' }))) {
      throw new Error('收起後找不到展開鈕：' + JSON.stringify(await ui.drawn()).slice(0, 500))
    }
    await ui.press({ key: 'nba-scores-mod:expand' })

    // 每節比分＋球員數據只有桌面版有
    if (surface === 'desktop') {
      // 左右翻：往後翻之後才會出現往前翻的按鈕
      expect(await ui.find({ key: 'nba-scores-mod:prev' })).toBeUndefined()
      await ui.press({ key: 'nba-scores-mod:next' })
      expect(await ui.drawn()).toMatchObject({ type: 'Box' })
      await ui.press({ key: 'nba-scores-mod:prev' })
      expect(await ui.find({ key: 'nba-scores-mod:prev' })).toBeUndefined()

      await ui.press({ key: 'nba-scores-mod:open:1' })
      expect(await ui.drawn()).toMatchObject({ type: 'Box' })
      expect(await ui.find({ type: 'Text', text: 'Q1' })).toBeDefined()
    }
  })
}

test('desktop：比分變動時先顯示舊比分 +N，再換成新比分亮幾秒，最後退掉', async ($, on) => {
  // 第二次抓的時候 MIA 多 3 分
  let calls = 0
  const later = JSON.parse(JSON.stringify(SCOREBOARD))
  later.events[1].competitions[0].competitors[0].score = '101'
  on('http.fetch', () => ({
    value: { ok: true, status: 200, text: JSON.stringify(calls++ === 0 ? SCOREBOARD : later) },
  }))
  const clock = mock.clock(on, { now: Date.parse('2026-10-06T23:30Z') })
  on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)

  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ type: 'Text', text: '+3' })).toBeUndefined()

  // 有比賽在打＝30 秒後再抓一次；多走 1 秒讓「每秒重畫」那個計時器也跑到
  await clock.advance(31_000)
  expect(await ui.drawn()).toMatchObject({ type: 'Box' })
  expect(await ui.find({ type: 'Text', text: '+3' })).toBeDefined()

  // 前幾秒是「舊比分 +3」：98 還在、101 還沒出現，不然 101 +3 會被讀成 104
  expect(await ui.find({ type: 'Text', text: '98' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '101' })).toBeUndefined()

  // 接著 +3 收掉、換成新比分並亮幾秒；沒變的那一邊不上色
  await clock.advance(3_000)
  expect(await ui.find({ type: 'Text', text: '+3' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '101' })).toMatchObject({ props: { color: '#EF9F27' } })
  expect((await ui.find({ type: 'Text', text: '95' }))?.props?.color).toBeUndefined()

  // 亮色也不能一直留著
  await clock.advance(10_000)
  expect(await ui.find({ type: 'Text', text: '+3' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: '101' }))?.props?.color).toBeUndefined()
})

test('有比賽在打時連續抓失敗，恢復連線後一分鐘內就要抓到新比分', async ($, on) => {
  // 第 1 次成功，接著 6 次失敗（電腦睡著沒網路），之後恢復
  let calls = 0
  const later = JSON.parse(JSON.stringify(SCOREBOARD))
  later.events[1].competitions[0].competitors[0].score = '101'
  on('http.fetch', () => {
    const n = calls++
    if (n === 0) return { value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }
    if (n <= 6) return { deny: 'ENOTFOUND' }
    return { value: { ok: true, status: 200, text: JSON.stringify(later) } }
  })
  const clock = mock.clock(on, { now: Date.parse('2026-10-06T23:30Z') })
  on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })

  // 失敗 6 次：間隔 30 秒、之後每次最多 60 秒，約 5 分鐘內就會試完
  for (let i = 0; i < 21; i++) await clock.advance(15_000)
  expect(calls).toBe(7)
  // 再過一分鐘多一點，新比分就要出現
  for (let i = 0; i < 5; i++) await clock.advance(15_000)
  expect(await ui.find({ type: 'Text', text: '101' })).toBeDefined()
})

test('30 隊都有圖騰，而且是合法的 SVG', () => {
  expect(Object.keys(TOTEMS).length).toBe(30)
  for (const [team, t] of Object.entries(TOTEMS) as [string, any][]) {
    if (!t.svg.startsWith('<svg ') || !t.svg.endsWith('</svg>')) throw new Error(`${team} 的 SVG 不完整`)
    if (!/^#[0-9A-F]{6}$/i.test(t.badgeBg) || !/^#[0-9A-F]{6}$/i.test(t.badgeFg)) throw new Error(`${team} 的徽章顏色壞了`)
  }
})

// 沒指定語言時會看電腦時區（Auto），這條要比對文字所以明確指定英文
test('desktop：還沒選球隊時沒有圖騰，並出現選隊選單；選了就寫進設定', { options: { language: 'English' } }, async ($, on) => {
  on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  const saved: unknown[] = []
  on('config.set', (_$, e) => {
    saved.push([e.key, e.value])
    return { value: e.value }
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })

  expect(await ui.drawn()).toMatchObject({ type: 'Box' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'NBA' })).toMatchObject({ props: { color: '#FCEBEB' } })
  expect(await ui.find({ key: 'nba-scores-mod:pick-team' })).toMatchObject({ props: { label: 'Pick your team' } })

  await ui.select({ key: 'nba-scores-mod:pick-team', value: 'MIA Heat' })
  expect(saved).toEqual([['nba-scores-mod.team', 'MIA Heat']])
})

test('設定選單的選項就是 30 隊加 None', () => {
  expect(TEAM_OPTIONS.length).toBe(31)
  expect(TEAM_OPTIONS[0]).toBe('None')
  expect(TEAM_OPTIONS).toContain('MIA Heat')
})

for (const [name, options, expected] of [
  ['只有設定檔寫了球隊：照設定檔', undefined, 'L'],
  ['設定檔和選單都有：選單優先', { team: 'MIA Heat' }, '火焰'],
] as const) {
  test(`球隊來源，${name}`, options ? { options } : {}, async ($, on) => {
    on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
    on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
    on('clock.every', () => ({ value: undefined }))
    on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
    on('fs.read', () => ({ value: JSON.stringify({ team: 'LAL' }) }))
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.render', () => ({ type: 'Box' }))
    on('session.start', () => ({ cwd: '/tmp' }))
    on('ui.log', () => ({ value: undefined }))
    await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
    const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
    expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: expected } })
    expect(await ui.find({ key: 'nba-scores-mod:pick-team' })).toBeUndefined()
  })
}

test('desktop：別的 mod 畫的東西排在 NBA 帶上面，不管誰先裝', { options: { team: 'MIA Heat' } }, async ($, on) => {
  on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  // 假裝底下還有另一個 mod 畫了一塊
  on('ui.render', () => ({ type: 'Box', props: { key: 'other-mod' } }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  const flat = JSON.stringify(await ui.drawn())
  const other = flat.indexOf('other-mod')
  const mine = flat.indexOf('nba-scores-mod:collapse')
  if (other < 0 || mine < 0) throw new Error('找不到其中一塊：' + flat.slice(0, 300))
  expect(other).toBeLessThan(mine)
})

test('球隊代號顯示 NBA 官方三碼（鵜鶘是 NOP 不是 NO），設定檔寫舊的 NO 也認得', async ($, on) => {
  on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
  on('fs.read', () => ({ value: JSON.stringify({ team: 'NO' }) }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  // 假資料裡 ESPN 給的是 NO 和 UTAH
  expect(await ui.find({ type: 'Text', text: 'NOP' })).toBeDefined()
  // find 是比對「包含」，NOP 也會被 NO 找到，所以直接看整棵畫面樹裡有沒有單獨的 NO、UTAH
  const flat = JSON.stringify(await ui.drawn())
  if (/"NO"|"UTAH"/.test(flat)) throw new Error('畫面上還有 ESPN 的舊代號')
  expect(await ui.find({ type: 'Text', text: 'UTA' })).toBeDefined()
  expect(await ui.find({ type: 'Svg' })).toMatchObject({ props: { alt: '鵜鶘' } })
  expect(TEAM_OPTIONS).toContain('NOP Pelicans')
})

// ---- 終端機：一行橫排 ----

/** 終端機測試共用的假引擎回應。scoreboard 可以是函式，讓第二次抓拿到不同比分 */
const terminalSetup = async ($: any, on: any, scoreboard: () => unknown, columns: number) => {
  on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(scoreboard()) } }))
  on('env.get', () => ({ value: '/tmp/nba-scores-mod-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  return $.ui.mount({
    plugin: 'nba-scores-mod',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { ...PROPS, bodyColumns: columns },
  })
}

test('terminal：徽章固定 NBA 紅、沒有舊的標題句、點開看得到每節比分', { options: { team: 'MIA Heat' } }, async ($, on) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  const ui = await terminalSetup($, on, () => SCOREBOARD, 120)
  const tree = JSON.stringify(await ui.drawn())
  // 選了熱火，徽章還是 NBA 紅，不跟著球隊換色
  expect(await ui.find({ type: 'Text', text: 'NBA' })).toMatchObject({
    props: { backgroundColor: '#A32D2D', color: '#FCEBEB' },
  })
  // 舊版的「今日戰報／LIVE N 場／N 分鐘前更新」都不要了
  for (const gone of ['戰報', '已結束', '前更新', '剛更新']) expect(tree.includes(gone)).toBe(false)
  // 正在打的那場（熱火）排最前面：它的 ● 出現在打完那場的 Final 之前
  expect(tree.indexOf('Q4 2:31')).toBeLessThan(tree.indexOf('Final'))
  // 夠寬：三場都在，不需要翻頁
  expect(await ui.find({ key: 'nba-scores-mod:next' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'LAL' })).toBeDefined()

  await ui.press({ key: 'nba-scores-mod:open:1' })
  expect(await ui.drawn()).toMatchObject({ type: 'Box' })
  expect(await ui.find({ type: 'Text', text: 'Q1' })).toBeDefined()
})

test('terminal：視窗窄的時候放不下的場次收到下一頁，用 ‹ › 翻', { options: { team: 'MIA Heat' } }, async ($, on) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  const ui = await terminalSetup($, on, () => SCOREBOARD, 60)
  // 60 格只放得下第一場（熱火那場）
  expect(await ui.find({ type: 'Text', text: 'MIA' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'LAL' })).toBeUndefined()
  expect(await ui.find({ key: 'nba-scores-mod:prev' })).toBeUndefined()
  await ui.press({ key: 'nba-scores-mod:next' })
  expect(await ui.find({ type: 'Text', text: 'MIA' })).toBeUndefined()
  expect(await ui.find({ key: 'nba-scores-mod:prev' })).toBeDefined()
  await ui.press({ key: 'nba-scores-mod:prev' })
  expect(await ui.find({ type: 'Text', text: 'MIA' })).toBeDefined()
})

test('terminal：得分時先顯示舊比分 +N，再換成新比分', { options: { team: 'MIA Heat' } }, async ($, on) => {
  let calls = 0
  const later = JSON.parse(JSON.stringify(SCOREBOARD))
  later.events[1].competitions[0].competitors[0].score = '101'
  const clock = mock.clock(on, { now: Date.parse('2026-10-06T23:30Z') })
  const ui = await terminalSetup($, on, () => (calls++ === 0 ? SCOREBOARD : later), 120)
  await clock.advance(31_000)
  expect(await ui.find({ type: 'Text', text: '+3' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '98' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '101' })).toBeUndefined()
  await clock.advance(3_000)
  expect(await ui.find({ type: 'Text', text: '+3' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '101' })).toMatchObject({ props: { color: '#EF9F27' } })
})

test('terminal：沒選球隊也不出現選隊選單', async ($, on) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  const ui = await terminalSetup($, on, () => SCOREBOARD, 120)
  expect(await ui.find({ key: 'nba-scores-mod:collapse' })).toBeDefined()
  expect(await ui.find({ key: 'nba-scores-mod:pick-team' })).toBeUndefined()
})

// ---- 語言 ----

for (const [label, options, collapse, pick] of [
  ['明確選 English', { language: 'English' }, 'Hide', 'Pick your team'],
  ['語言選繁體中文', { language: '繁體中文' }, '收起', '選你的球隊'],
] as const) {
  test(`畫面文字，${label}`, { options }, async ($, on) => {
    on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
    on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
    on('clock.every', () => ({ value: undefined }))
    on('env.get', () => ({ value: '/tmp/nba-band-test-home' }))
    on('fs.read', () => ({ deny: 'no config file' }))
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.render', () => ({ type: 'Box' }))
    on('session.start', () => ({ cwd: '/tmp' }))
    on('ui.log', () => ({ value: undefined }))
    await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
    const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
    expect(await ui.find({ key: 'nba-scores-mod:collapse' })).toMatchObject({ props: { label: collapse } })
    expect(await ui.find({ key: 'nba-scores-mod:pick-team' })).toMatchObject({ props: { label: pick } })
    // 英文版畫面上不能漏出中文
    if (collapse === 'Hide') expect(/[一-鿿]/.test(JSON.stringify(await ui.drawn()))).toBe(false)
  })
}

test('語言 Auto：時區在台灣用繁體中文，其他地方用英文；明確選了就照選的', () => {
  expect(LANG_OPTIONS).toEqual(['Auto', 'English', '繁體中文'])
  expect(langFromOption('Auto', 'Asia/Taipei')).toBe('zh')
  expect(langFromOption(undefined, 'Asia/Taipei')).toBe('zh')
  expect(langFromOption('Auto', 'America/New_York')).toBe('en')
  expect(langFromOption(undefined, '')).toBe('en')
  expect(langFromOption('English', 'Asia/Taipei')).toBe('en')
  expect(langFromOption('繁體中文', 'America/New_York')).toBe('zh')
})

test('開賽時間跟著使用者的時區走', () => {
  expect(localStart('2026-10-06T23:00Z', 'Asia/Taipei')).toBe('10/07 07:00')
  expect(localStart('2026-10-06T23:00Z', 'America/New_York')).toBe('10/06 19:00')
})

for (const [label, options, collapse] of [
  ['English', { language: 'English' }, 'Hide'],
  ['繁體中文', { language: '繁體中文' }, '收起'],
] as const) {
  test(`terminal：畫面文字也跟著語言設定走（${label}）`, { options }, async ($, on) => {
    on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
    on('clock.every', () => ({ value: undefined }))
    const ui = await terminalSetup($, on, () => SCOREBOARD, 120)
    expect(await ui.find({ key: 'nba-scores-mod:collapse' })).toMatchObject({ props: { label: collapse } })
    await ui.press({ key: 'nba-scores-mod:open:1' })
    expect(await ui.find({ type: 'Text', text: collapse === 'Hide' ? 'Total' : '總分' })).toBeDefined()
    if (collapse === 'Hide') expect(/[一-鿿]/.test(JSON.stringify(await ui.drawn()))).toBe(false)
  })
}

// ---- 單場明細的球員名字 ----

const athlete = (name: string, pts: number) => ({ athlete: { shortName: name }, stats: [String(pts), '3', '2'] })
const SUMMARY = {
  boxscore: {
    players: [
      {
        team: { abbreviation: 'UTAH' },
        statistics: [{ labels: ['PTS', 'REB', 'AST'], athletes: [athlete('S. Gilgeous-Alexander', 30), athlete('J. Jaquez Jr.', 12)] }],
      },
      {
        team: { abbreviation: 'DEN' },
        statistics: [{ labels: ['PTS', 'REB', 'AST'], athletes: [athlete('N. Jokic', 28)] }],
      },
    ],
  },
}

test('desktop：球員名字太長會截短，名字和數字的行數才對得上', { options: { language: 'English' } }, async ($, on) => {
  on('http.fetch', (_$: unknown, e: any) => ({
    value: { ok: true, status: 200, text: JSON.stringify(String(e.url).includes('summary') ? SUMMARY : SCOREBOARD) },
  }))
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/tmp/nba-band-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  await ui.press({ key: 'nba-scores-mod:open:1' })
  // 等球員數據抓回來重畫
  await new Promise(resolve => setTimeout(resolve, 50))
  const tree = JSON.stringify(await ui.drawn())
  expect(tree.includes('PTS')).toBe(true)
  expect(tree.includes('J. Jaquez Jr.')).toBe(true)
  expect(tree.includes('S. Gilgeous-Alexander')).toBe(false)
  expect(tree.includes('S. Gilgeous-Ale…')).toBe(true)
  // 名字那一欄不准縮，縮了就會折行
  expect(await ui.find({ key: 'names:UTA' })).toMatchObject({ props: { flexShrink: 0 } })
})

// ---- 防雷模式 ----

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}：防雷模式遮住打完的比分，點了才顯示；正在打的不遮`, { options: { spoilerFree: 'On', language: 'English' } }, async ($, on) => {
    on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
    on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
    on('clock.every', () => ({ value: undefined }))
    on('env.get', () => ({ value: '/tmp/nba-band-test-home' }))
    on('fs.read', () => ({ deny: 'no config file' }))
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('ui.render', () => ({ type: 'Box' }))
    on('session.start', () => ({ cwd: '/tmp' }))
    on('ui.log', () => ({ value: undefined }))
    await $.session.start({ cwd: '/tmp', surface, isInteractive: true } as any)
    const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface, component: 'AbovePrompt', props: PROPS })
    // 打完的那場（UTA 109 – DEN 97）看不到比分，也不能點開明細（明細會洩漏）
    expect(await ui.find({ type: 'Text', text: '109' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '97' })).toBeUndefined()
    expect(await ui.find({ key: 'nba-scores-mod:open:1' })).toBeUndefined()
    // 正在打的那場照常顯示
    expect(await ui.find({ type: 'Text', text: '98' })).toBeDefined()
    // 點那一場的 Reveal 就顯示，按鈕消失
    await ui.press({ key: 'nba-scores-mod:reveal:1' })
    expect(await ui.find({ type: 'Text', text: '109' })).toBeDefined()
    expect(await ui.find({ key: 'nba-scores-mod:reveal:1' })).toBeUndefined()
    expect(await ui.find({ key: 'nba-scores-mod:reveal-all' })).toBeUndefined()
  })
}

test('防雷模式沒開時，打完的比分直接顯示', { options: { language: 'English' } }, async ($, on) => {
  on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/tmp/nba-band-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ type: 'Text', text: '109' })).toBeDefined()
  expect(await ui.find({ key: 'nba-scores-mod:reveal:1' })).toBeUndefined()
})

// ---- 桌面版的設定入口（齒輪） ----

test('desktop：齒輪點開才出現球隊／語言／防雷三個下拉，選了就寫進設定', { options: { team: 'MIA Heat', language: 'English' } }, async ($, on) => {
  on('http.fetch', () => ({ value: { ok: true, status: 200, text: JSON.stringify(SCOREBOARD) } }))
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/tmp/nba-band-test-home' }))
  on('fs.read', () => ({ deny: 'no config file' }))
  on('store.get', () => ({ value: undefined }))
  const stored: unknown[] = []
  on('store.set', (_$: unknown, e: any) => {
    stored.push([e.key, e.value])
    return { value: undefined }
  })
  on('ui.render', () => ({ type: 'Box' }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('ui.log', () => ({ value: undefined }))
  const saved: unknown[] = []
  on('config.set', (_$: unknown, e: any) => {
    saved.push([e.key, e.value])
    return { value: e.value }
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as any)
  const ui = await $.ui.mount({ plugin: 'nba-scores-mod', surface: 'desktop', component: 'AbovePrompt', props: PROPS })

  // 平常只有齒輪，三個下拉不在
  expect(await ui.find({ key: 'nba-scores-mod:settings' })).toMatchObject({ props: { label: '⚙ Settings' } })
  expect(await ui.find({ key: 'nba-scores-mod:setting:team' })).toBeUndefined()

  await ui.press({ key: 'nba-scores-mod:settings' })
  expect(await ui.drawn()).toMatchObject({ type: 'Box' })
  // 下拉顯示目前的值
  expect(await ui.find({ key: 'nba-scores-mod:setting:team' })).toMatchObject({ props: { value: 'MIA Heat', label: 'Team' } })
  expect(await ui.find({ key: 'nba-scores-mod:setting:language' })).toMatchObject({ props: { value: 'English' } })
  expect(await ui.find({ key: 'nba-scores-mod:setting:spoilerFree' })).toMatchObject({ props: { value: 'Off' } })
  // 開關狀態有存起來，改設定重新載入後才不會自己關掉
  expect(stored).toContainEqual(['settingsOpen', true])

  await ui.select({ key: 'nba-scores-mod:setting:spoilerFree', value: 'On' })
  await ui.select({ key: 'nba-scores-mod:setting:language', value: '繁體中文' })
  await ui.select({ key: 'nba-scores-mod:setting:team', value: 'LAL Lakers' })
  expect(saved).toEqual([
    ['nba-scores-mod.spoilerFree', 'On'],
    ['nba-scores-mod.language', '繁體中文'],
    ['nba-scores-mod.team', 'LAL Lakers'],
  ])

  // 再點一次收回去
  await ui.press({ key: 'nba-scores-mod:settings' })
  expect(await ui.find({ key: 'nba-scores-mod:setting:team' })).toBeUndefined()
})

test('terminal：沒有齒輪，設定走 /config', async ($, on) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-06T23:30Z') }))
  on('clock.every', () => ({ value: undefined }))
  const ui = await terminalSetup($, on, () => SCOREBOARD, 120)
  expect(await ui.find({ key: 'nba-scores-mod:collapse' })).toBeDefined()
  expect(await ui.find({ key: 'nba-scores-mod:settings' })).toBeUndefined()
})
