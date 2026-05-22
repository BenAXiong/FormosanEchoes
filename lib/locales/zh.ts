import type { Locale } from './en';

const zh: Locale = {
  // App
  appName: 'Formosan Echoes',
  goHome: '回首頁',

  // Lang toggle
  langToggleLabel: 'Switch to English',

  // Search
  searchPlaceholder: '搜尋…',
  searchOverlayPlaceholder: '搜尋歌曲、歌手…',
  searchModeSongs: '歌曲',
  searchModeLyrics: '歌詞',
  recentSearches: '最近搜尋',
  startTypingToSearch: '輸入關鍵字搜尋',
  noResults: '找不到結果',
  searchingLyrics: '搜尋歌詞中…',
  noLyricsMatches: '找不到符合的歌詞',
  lyricsMatches: '歌詞符合',
  searchingIndicator: '搜尋中…',
  back: '返回',
  clearSearch: '清除',

  // Toolbar filters
  filterHasLyrics: '篩選：有歌詞',
  filterByGenre: '依曲風篩選',
  clearGenreFilter: '清除曲風篩選',
  library: '收藏庫',
  toggleCompactView: '切換顯示模式',
  switchToGridView: '切換為方格檢視',
  switchToCompactView: '切換為緊湊檢視',
  displaySettings: '顯示設定',

  // Settings panel
  display: '顯示',
  songChineseNames: '歌曲中文名稱',
  artistChineseNames: '歌手中文名稱',
  autoplay: '自動播放',

  // Library / bookmark dropdown
  favoriteSongs: '最愛歌曲',
  signInToCreatePlaylists: '登入以建立播放清單',
  noPlaylistsYet: '尚無播放清單',
  deletePlaylistConfirm: '刪除「{name}」？',
  yes: '確定',
  no: '取消',
  deletePlaylistAriaLabel: '刪除播放清單 {name}',

  // Empty states
  noArtistsMatch: '找不到符合的歌手',
  noSongsMatch: '找不到符合的歌曲',
  selectArtist: '選擇歌手以查看詳細資料',
  selectSong: '從音樂庫選擇一首歌曲，探索其歷史與歌詞',

  // Actions
  clear: '清除',
  clearAll: '清除全部',

  // Song context menu
  share: '分享',
  like: '加入最愛',
  unlike: '移除最愛',
  addToPlaylist: '加入播放清單',
  openArtist: '開啟歌手頁面',
  songInfo: '歌曲資訊',
  newPlaylist: '新播放清單',

  // Player bar
  noSongSelected: '未選擇歌曲',
  addToPlaylistHeader: '加入播放清單',
  newPlaylistPlaceholder: '新播放清單…',
  addButton: '新增',
  addedToPlaylist: '已加入「{name}」',
  createdPlaylist: '已建立「{name}」',
  exitKaraokeMode: '退出卡拉OK模式',
  enterKaraokeMode: '進入卡拉OK模式',

  // User profile
  signInWithGoogle: '以 Google 帳號登入',
  signIn: '登入',
  saveFavorites: '儲存最愛',
  account: '帳號',
  signOut: '登出',

  // Sidebar tabs
  tabSongs: '歌曲',
  tabArtists: '歌手',

  // Sidebar filters
  searchArtistsPlaceholder: '搜尋歌手…',
  language: '語言',
  languages: '語言',
  setDefaultLanguage: '設定預設語言',
  defaultLanguageTitle: '預設：{language}',
  allLanguages: '所有語言',
  opensWith: '開啟時預設',
  artists: '歌手',
  languageFilterLabel: '— {language}',
  noArtistsYet: '尚無歌手',
  format: '格式',
  showLess: '↑ 顯示較少',
  moreLanguages: '更多語言',
  otherLanguages: '其他語言',
  moreArtists: '更多歌手',
  moreTypes: '更多類型',
  all: '全部',
};

export default zh;
