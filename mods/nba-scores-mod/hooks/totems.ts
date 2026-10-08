// 各隊的小圖騰：照隊名畫的原創圖（熱火＝火焰），不是隊徽，也不是官方吉祥物。
// 可以參考隊徽的題材和構圖（老鷹是側臉、公牛是正面牛頭），但形狀要自己畫，
// 不能描隊徽、不能直接用隊徽的圖檔。
//
// 畫風統一成「雙色扁平」：20×20 的畫布、一個主色大形狀疊一個副色小形狀、
// 縮到 16 像素還要認得出來，所以形狀越簡單越好。字母和數字可以用（湖人的 L、
// 七六人的 76），但要自己畫成路徑，不要照抄隊徽的字型。
// 顏色要在深色和淺色主題都看得到：不要用純白、純黑、深藍黑。
//
// 代號用 NBA 官方三碼（NOP、NYK、GSW、SAS、UTA、WAS），跟設定檔的 team 一致。

export type Totem = {
  /** 給螢幕閱讀器的說明 */
  alt: string
  /** 徽章底色與字色（球隊主色，字色要在上面讀得清楚） */
  badgeBg: string
  badgeFg: string
  /** 20×20 viewBox 的 SVG 字串 */
  svg: string
}

export const TOTEM_SIZE = 16

const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TOTEM_SIZE}" height="${TOTEM_SIZE}" viewBox="0 0 20 20">${body}</svg>`

export const TOTEMS: Record<string, Totem> = {
  ATL: {
    alt: '鷹頭',
    badgeBg: '#C8102E',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<circle cx="10" cy="10" r="9.3" fill="#E03A3E"/><path d="M4.500 15C3.800 9.500 6 5 10.500 4.500c2-.2 3.500.8 4.500 2.300l2.600 3.300c.3.500 0 1-.6 1l-3.100-.1c-.6 1.300-1.600 2.300-2.900 3.100L9.500 16.800z" fill="#F1EFE8"/><path d="M9.800 7.300l3.600 1l-3 .9z" fill="#791F1F"/><path d="M14.200 8.200l3.200 2.200c.3.3.1.700-.4.700l-2.900-.1z" fill="#EF9F27"/>',
    ),
  },
  BOS: {
    alt: '三葉草',
    badgeBg: '#007A33',
    badgeFg: '#EAF3DE',
    svg: svg(
      '<circle cx="10" cy="6" r="3.6" fill="#12A150"/><circle cx="6" cy="11.5" r="3.6" fill="#12A150"/><circle cx="14" cy="11.5" r="3.6" fill="#12A150"/><path d="M9.2 11h1.6c0 3 1 5 3 7l-1.4 1c-2-2-3.2-5-3.2-8z" fill="#C9A45C"/>',
    ),
  },
  BKN: {
    alt: '籃框',
    badgeBg: '#444441',
    badgeFg: '#F1EFE8',
    svg: svg(
      '<path d="M4 7l3 11h6l3-11M4 7l7.500 11M16 7L8.500 18M8 7l6.200 7.500M12 7l-6.200 7.500M5.300 12h9.400" stroke="#B4B2A9" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="2.5" y="4" width="15" height="3.2" rx="1.6" fill="#D85A30"/>',
    ),
  },
  CHA: {
    alt: '黃蜂',
    badgeBg: '#00788C',
    badgeFg: '#E1F5EE',
    svg: svg(
      '<path d="M9 9.500L1.800 2.500c-.6 3.800 1.200 7 4.900 8.500z" fill="#9F8FE8"/><path d="M9 9.500L1.800 2.500c-.6 3.800 1.200 7 4.900 8.500z" transform="translate(20 0) scale(-1 1)" fill="#9F8FE8"/><path d="M8.600 4.800L7 1.300M11.400 4.800L13 1.300" stroke="#1DB5C4" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.300 7.800C6.300 5.500 7.900 4 10 4s3.700 1.500 3.700 3.800c0 2-1.600 3.900-3.700 3.900S6.300 9.800 6.300 7.800z" fill="#1DB5C4"/><path d="M7 6.600l2.400 1.500l-2 .7z" fill="#F1EFE8"/><path d="M7 6.600l2.400 1.500l-2 .7z" transform="translate(20 0) scale(-1 1)" fill="#F1EFE8"/><path d="M7.400 12h5.200c0 2.800-1 5.300-2.600 7.700C8.400 17.300 7.400 14.800 7.400 12z" fill="#1DB5C4"/><path d="M8.300 13.700h3.400M9 16.200h2" stroke="#26215C" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
  },
  CHI: {
    alt: '牛頭',
    badgeBg: '#CE1141',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<path d="M5.800 8.800C2.600 8.300.8 5.600 1 1.300C2.400 4 4.500 5.500 7.300 5.800z" fill="#B4B2A9"/><path d="M5.800 8.800C2.600 8.300.8 5.600 1 1.300C2.400 4 4.500 5.500 7.300 5.800z" transform="translate(20 0) scale(-1 1)" fill="#B4B2A9"/><path d="M4.800 7.600C6.400 6.500 8.200 6 10 6s3.600.5 5.200 1.600l-1 5.600c-.3 1.600-1 3-2.100 4.100L10 19.400l-2.100-2.100c-1.100-1.100-1.800-2.500-2.100-4.100z" fill="#E0314E"/><path d="M6.200 9.600l3.100 1.600l-2.700.5z" fill="#501313"/><path d="M6.200 9.600l3.100 1.600l-2.700.5z" transform="translate(20 0) scale(-1 1)" fill="#501313"/><circle cx="8.8" cy="15.8" r="0.8" fill="#501313"/><circle cx="11.2" cy="15.8" r="0.8" fill="#501313"/>',
    ),
  },
  CLE: {
    alt: '劍',
    badgeBg: '#860038',
    badgeFg: '#FDBB30',
    svg: svg(
      '<path d="M10 0.5l1.8 3V12H8.2V3.5z" fill="#C4CED4"/><rect x="4.5" y="12" width="11" height="2.2" rx="1" fill="#FDBB30"/><rect x="9" y="14" width="2" height="4" rx="0" fill="#B0204F"/><circle cx="10" cy="18.3" r="1.5" fill="#FDBB30"/>',
    ),
  },
  DAL: {
    alt: '牛仔帽',
    badgeBg: '#00538C',
    badgeFg: '#E6F1FB',
    svg: svg(
      '<path d="M6 12.500c0-5.500 1-8.500 2.500-8.500c.8 0 1 .8 1.500.8s.7-.8 1.500-.8c1.500 0 2.500 3 2.500 8.500z" fill="#2F7FD9"/><path d="M0.800 10.500c2.500 3.500 6 3.500 9.200 3.500s6.700 0 9.200-3.500c-.5 4.500-4.500 6.500-9.200 6.500s-8.700-2-9.200-6.500z" fill="#2F7FD9"/><path d="M6.100 10.500h7.800l.1 2H6z" fill="#C4CED4"/>',
    ),
  },
  DEN: {
    alt: '礦鎬',
    badgeBg: '#1A3A6B',
    badgeFg: '#FEC524',
    svg: svg(
      '<rect x="9" y="5" width="2" height="14.5" rx="1" fill="#5BA4E6"/><path d="M1.5 8c5-6 12-6 17 0l-2 1.2c-4-3.5-9-3.5-13 0z" fill="#FEC524"/>',
    ),
  },
  DET: {
    alt: '籃球徽章',
    badgeBg: '#1D42BA',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<circle cx="10" cy="10" r="9.3" fill="#3F7FE0"/><circle cx="10" cy="10" r="6.8" fill="#E03A3E"/><path d="M3.600 10h12.800M10 3.600v12.800M5.600 5.200c1.900 2.800 1.900 6.800 0 9.600M14.400 5.200c-1.900 2.800-1.900 6.800 0 9.600" stroke="#F1EFE8" stroke-width="0.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    ),
  },
  GSW: {
    alt: '大橋',
    badgeBg: '#1D428A',
    badgeFg: '#FFC72C',
    svg: svg(
      '<path d="M1 12.5C4 12 5.2 7 6 3c1 4 2.6 7.5 4 7.5S13 7 14 3c.8 4 2 9 5 9.5v1.2H1z" fill="#3F7FE0"/><rect x="5" y="2.5" width="2" height="15.5" rx="0" fill="#FFC72C"/><rect x="13" y="2.5" width="2" height="15.5" rx="0" fill="#FFC72C"/><rect x="1" y="13" width="18" height="2" rx="0" fill="#FFC72C"/>',
    ),
  },
  HOU: {
    alt: '火箭',
    badgeBg: '#CE1141',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<path d="M8 12.5h4l-2 6.5z" fill="#EF9F27"/><path d="M10 1c3 3 4 6 4 11H6c0-5 1-8 4-11zM6 9l-3.5 5H6zM14 9l3.5 5H14z" fill="#E03A3E"/><circle cx="10" cy="7" r="1.6" fill="#FCEBEB"/>',
    ),
  },
  IND: {
    alt: 'P',
    badgeBg: '#1A3A6B',
    badgeFg: '#FDBB30',
    svg: svg(
      '<path d="M5 1.700h6.300a5 5 0 0 1 0 10H9.500V17H5zM9.500 5.600v2.200h1.500a1.100 1.100 0 0 0 0-2.200z" transform="translate(1.5 1.5)" fill="#3F7FE0" fill-rule="evenodd"/><path d="M5 1.700h6.300a5 5 0 0 1 0 10H9.500V17H5zM9.500 5.600v2.200h1.500a1.100 1.100 0 0 0 0-2.200z" transform="translate(0 0)" fill="#FDBB30" fill-rule="evenodd"/>',
    ),
  },
  LAC: {
    alt: '帆船',
    badgeBg: '#C8102E',
    badgeFg: '#E6F1FB',
    svg: svg(
      '<path d="M10 1.5V13H3z" fill="#E03A3E"/><path d="M11.2 5V13H17zM2 14.2h16l-3 4.3H5z" fill="#3F7FE0"/>',
    ),
  },
  LAL: {
    alt: 'L',
    badgeBg: '#552583',
    badgeFg: '#FDB927',
    svg: svg(
      '<path d="M6.500 3.200h4.500v10.800h6.500v4.500h-11z" fill="#8A5FD6"/><path d="M5 1.700h4.500v10.800H16V17H5z" fill="#FDB927"/>',
    ),
  },
  MEM: {
    alt: '熊掌',
    badgeBg: '#5D76A9',
    badgeFg: '#F1EFE8',
    svg: svg(
      '<ellipse cx="3.6" cy="8.8" rx="1.9" ry="2.6" transform="rotate(-28 3.6 8.8)" fill="#FFC72C"/><ellipse cx="7.6" cy="4.3" rx="1.9" ry="2.7" transform="rotate(-8 7.6 4.3)" fill="#FFC72C"/><ellipse cx="12.4" cy="4.3" rx="1.9" ry="2.7" transform="rotate(8 12.4 4.3)" fill="#FFC72C"/><ellipse cx="16.4" cy="8.8" rx="1.9" ry="2.6" transform="rotate(28 16.4 8.8)" fill="#FFC72C"/><path d="M10 9.500c3.300 0 5.800 2.500 5.800 5.300c0 2-1.400 3.500-3.300 3.500c-1 0-1.700-.5-2.500-.5s-1.500.5-2.500.5c-1.900 0-3.300-1.500-3.300-3.500c0-2.800 2.500-5.300 5.800-5.300z" fill="#7FA6E0"/>',
    ),
  },
  MIA: {
    alt: '火焰',
    badgeBg: '#98002E',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<path d="M10 1c1 4 6 6 6 11a6 6 0 0 1-12 0c0-2 1-4 2-5c0 2 1 3 2 3c0-3-1-5 2-9z" fill="#E24B4A"/><path d="M10 9c1 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5z" fill="#EF9F27"/>',
    ),
  },
  MIL: {
    alt: '鹿頭',
    badgeBg: '#0F6E3B',
    badgeFg: '#EEE1C6',
    svg: svg(
      '<path d="M8.300 9.300C5 8.800 3 6.800 2.300 3.600l1.700 1.300L3.600 1l1.900 3.200l.5-3l1.200 4l.7-2.200l1 4.800z" fill="#CDB98A"/><path d="M8.300 9.300C5 8.800 3 6.800 2.300 3.600l1.700 1.300L3.600 1l1.900 3.200l.5-3l1.200 4l.7-2.200l1 4.800z" transform="translate(20 0) scale(-1 1)" fill="#CDB98A"/><path d="M7.200 9.600L3.300 10.200l3.300 2.200z" fill="#2E9E5B"/><path d="M7.200 9.600L3.300 10.200l3.300 2.200z" transform="translate(20 0) scale(-1 1)" fill="#2E9E5B"/><path d="M7 9.600l3-1l3 1l-.8 5.600L10 19.300l-2.200-4.100z" fill="#2E9E5B"/><path d="M7.800 11.800l1.700.8l-1.500.4z" fill="#04342C"/><path d="M7.800 11.800l1.700.8l-1.500.4z" transform="translate(20 0) scale(-1 1)" fill="#04342C"/><path d="M9 16.300h2l-1 1.600z" fill="#CDB98A"/>',
    ),
  },
  MIN: {
    alt: '狼頭',
    badgeBg: '#1F4A7A',
    badgeFg: '#C0DD97',
    svg: svg(
      '<path d="M3 1.5l4 5h6l4-5l-.8 9.5L10 19l-6.2-8z" fill="#3F82D0"/><path d="M5.5 9.5l3.3 1.2l-2.3 1.2zM14.5 9.5l-3.3 1.2l2.3 1.2z" fill="#8FD43A"/>',
    ),
  },
  NOP: {
    alt: '鵜鶘',
    badgeBg: '#1F3F6E',
    badgeFg: '#E0B458',
    svg: svg(
      '<path d="M6.300 7c0 3-1.600 4.300-1.600 6.800c0 1.500.8 2.800 2 3.700" stroke="#4A7FC8" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.500 13.500c3.500-1.500 8-.5 11.500 3c-2.500 2.500-7 3.500-11 2.300z" fill="#4A7FC8"/><path d="M8.700 8.300L19.500 7.700c-1.200 4-4.600 6.300-8.100 5.200c-1.600-.5-2.500-2.400-2.700-4.600z" fill="#E0B458"/><path d="M8.800 4L19.500 7.700L8.700 8.400z" fill="#B8862E"/><circle cx="6.3" cy="5.6" r="3.6" fill="#4A7FC8"/><circle cx="7" cy="5" r="0.9" fill="#F1EFE8"/>',
    ),
  },
  NYK: {
    alt: '自由女神火炬',
    badgeBg: '#006BB6',
    badgeFg: '#FAEEDA',
    svg: svg(
      '<path d="M10 0.800c.8 2.700 3.700 3.700 3.700 6.200c0 .9-.4 1.500-.4 1.500H6.700s-.4-.6-.4-1.500C6.300 4.500 9.200 3.500 10 .8z" fill="#F58426"/><path d="M5 8.500h10v2.500H5zM7.300 11h5.400l-1.500 8.200H8.800z" fill="#2F7FD9"/>',
    ),
  },
  OKC: {
    alt: '閃電',
    badgeBg: '#007AC1',
    badgeFg: '#E6F1FB',
    svg: svg(
      '<path d="M5 10.5a4 4 0 0 1 .8-7.9a5 5 0 0 1 9.2.9a3.6 3.6 0 0 1 0 7z" fill="#2B8FD6"/><path d="M11.5 8l-4.5 6.5h3l-1 5L14 12.5h-3l1.2-4.5z" fill="#FDBB30"/>',
    ),
  },
  ORL: {
    alt: '魔法星',
    badgeBg: '#0077C0',
    badgeFg: '#E6F1FB',
    svg: svg(
      '<path d="M9.0 3.0L10.8 9.2L17.0 11.0L10.8 12.8L9.0 19.0L7.2 12.8L1.0 11.0L7.2 9.2z" fill="#2F8FE0"/><path d="M16.0 0.6L16.8 3.2L19.4 4.0L16.8 4.8L16.0 7.4L15.2 4.8L12.6 4.0L15.2 3.2z" fill="#C4CED4"/>',
    ),
  },
  PHI: {
    alt: '76',
    badgeBg: '#006BB6',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<path d="M1.500 3h7.300v2.600L5.300 17.500H2.300L5.700 6H1.500z" fill="#2F7FD9"/><path d="M16 3h-2.300C11 3 9.300 5.800 9.300 9.800v3.700a4.600 4.600 0 1 0 4.600-4.600c-.6 0-1.200.1-1.700.3c.3-2 1-3.400 2.200-3.400H16zM13.900 11.400a2.100 2.100 0 1 1 0 4.200a2.100 2.100 0 0 1 0-4.200z" fill="#ED174C" fill-rule="evenodd"/>',
    ),
  },
  PHX: {
    alt: '太陽',
    badgeBg: '#3A2A8A',
    badgeFg: '#FAC775',
    svg: svg(
      '<path d="M16.5 10.0L19.5 10.0" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><path d="M14.6 14.6L16.7 16.7" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><path d="M10.0 16.5L10.0 19.5" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><path d="M5.4 14.6L3.3 16.7" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><path d="M3.5 10.0L0.5 10.0" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><path d="M5.4 5.4L3.3 3.3" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><path d="M10.0 3.5L10.0 0.5" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><path d="M14.6 5.4L16.7 3.3" stroke="#F9AD1B" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="10" r="4.8" fill="#E56020"/>',
    ),
  },
  POR: {
    alt: '開路斧',
    badgeBg: '#C8102E',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<path d="M3.200 17.300L12.300 4l1.900 1.300L5.100 18.600z" fill="#B4B2A9"/><path d="M10.500 2.300l5.500 3.700c1.700 1.200 2.700 3.300 2.200 5.500c-1.600-1.600-3.800-2.200-6-1.600L8.700 7.500z" fill="#E03A3E"/>',
    ),
  },
  SAC: {
    alt: '皇冠',
    badgeBg: '#5A2D81',
    badgeFg: '#F1EFE8',
    svg: svg(
      '<path d="M2.2 14.5L1 5l5 4.5l4-7l4 7L19 5l-1.2 9.5z" fill="#8A5FD6"/><rect x="2.2" y="15.5" width="15.6" height="3" rx="1" fill="#C4CED4"/>',
    ),
  },
  SAS: {
    alt: '馬刺',
    badgeBg: '#444441',
    badgeFg: '#F1EFE8',
    svg: svg(
      '<path d="M2 3.500h5.500a6.500 6.500 0 0 1 0 13H2v-2.800h5.500a3.700 3.700 0 0 0 0-7.400H2z" fill="#B4B2A9"/><path d="M15.3 5.5L16.4 8.2L19.2 7.8L17.4 10.0L19.2 12.2L16.4 11.8L15.3 14.5L14.3 11.8L11.4 12.2L13.2 10.0L11.4 7.8L14.2 8.2z" fill="#888780"/>',
    ),
  },
  TOR: {
    alt: '暴龍頭',
    badgeBg: '#CE1141',
    badgeFg: '#F1EFE8',
    svg: svg(
      '<path d="M1.500 6.500C3 3.800 5.800 2.200 9 2.200c1 0 1.700.5 2.600.5c2.700 0 5.500 1 7 2.800c.9 1.100.9 2.900.2 4L9.300 10.900l8.200 3.300c.3 1-.2 2.200-1.300 2.600L9 17.400c-1.500.2-2.600.9-3.500 2.300h-4z" fill="#E0314E"/><path d="M10.800 10.700l1 1.900l1-2.100zM13.800 10.400l1 1.900l.9-2.200zM16.600 10l.8 1.700l.9-2zM11.200 11.700l.5-1.500l1.300 2.200zM14.200 12.900l.5-1.500l1.300 2.200z" fill="#B4B2A9"/><path d="M8 4.500l3.500.3l-2.800 1.400z" fill="#501313"/><circle cx="17.3" cy="6.2" r="0.6" fill="#501313"/>',
    ),
  },
  UTA: {
    alt: '音符',
    badgeBg: '#5A3A9E',
    badgeFg: '#F9D74C',
    svg: svg(
      '<path d="M11.5 2.5c4.5 1 6.5 3.5 5.5 8.5c-1-3-3-4.2-5.5-4.5z" fill="#F9D74C"/><ellipse cx="7" cy="15" rx="4.2" ry="3.2" fill="#9F7FE8"/><rect x="9.5" y="2.5" width="2" height="12.5" rx="0" fill="#9F7FE8"/>',
    ),
  },
  WAS: {
    alt: '巫師帽',
    badgeBg: '#1F3F7A',
    badgeFg: '#FCEBEB',
    svg: svg(
      '<ellipse cx="10" cy="15.5" rx="9" ry="2.8" fill="#4A7FD8"/><path d="M10 0.5l5 14H5z" fill="#4A7FD8"/><path d="M6.4 11h7.2l1 2.8H5.4z" fill="#E31837"/>',
    ),
  },
}

/** 查不到的代號回 null，帶子就維持原本的紅色徽章 */
export const totemFor = (team: string): Totem | null => TOTEMS[team] ?? null
