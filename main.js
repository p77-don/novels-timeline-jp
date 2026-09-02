/*
 * Novels Timeline JP
 * Obsidian Plugin
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NovelsTimelinePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

// src/settings/PluginSettings.ts
var DEFAULT_CALENDAR = {
  name: "\u897F\u66A6",
  months: [
    { month: 1, name: "", days: 31 },
    { month: 2, name: "", days: 28 },
    { month: 3, name: "", days: 31 },
    { month: 4, name: "", days: 30 },
    { month: 5, name: "", days: 31 },
    { month: 6, name: "", days: 30 },
    { month: 7, name: "", days: 31 },
    { month: 8, name: "", days: 31 },
    { month: 9, name: "", days: 30 },
    { month: 10, name: "", days: 31 },
    { month: 11, name: "", days: 30 },
    { month: 12, name: "", days: 31 }
  ]
};
var BOARD_ZOOM_MIN = 50;
var BOARD_ZOOM_MAX = 200;
var BOARD_ZOOM_DEFAULT = 100;
var BOARD_ZOOM_STEP = 10;
var GAP_THRESHOLD_MIN = 3;
var GAP_THRESHOLD_MAX = 30;
var GAP_THRESHOLD_DEFAULT = 30;
var GAP_THRESHOLD_STEP = 1;
var LANE_COUNT_MIN = 1;
var LANE_COUNT_MAX = 20;
var LANE_COUNT_DEFAULT = 10;
var LANE_COUNT_STEP = 1;
var DEFAULT_SETTINGS = {
  newEventFolder: "",
  excludedFolders: [],
  boardZoom: 100,
  gapCompression: true,
  gapThreshold: GAP_THRESHOLD_DEFAULT,
  laneCount: LANE_COUNT_DEFAULT,
  calendar: DEFAULT_CALENDAR,
  relationColor: "#808080",
  relationStyle: "solid",
  relationWidth: 2,
  relationArrowStyle: "arrow",
  relationOpacity: 0.6,
  relationCurveStrength: 50,
  virtualRendering: true,
  renderBuffer: 1500,
  relationDisplayMode: "selected",
  debugMode: false
};
function calcYearDays(calendar) {
  return calendar.months.reduce((sum, m) => sum + m.days, 0);
}
function calcCumulativeDaysBeforeMonth(calendar, monthNum) {
  let days = 0;
  for (const m of calendar.months) {
    if (m.month >= monthNum) break;
    days += m.days;
  }
  return days;
}
function getMonthDef(calendar, monthNum) {
  return calendar.months.find((m) => m.month === monthNum);
}

// src/view/TimelineView.ts
var import_obsidian4 = require("obsidian");

// src/store/EventStore.ts
var EventStore = class {
  constructor() {
    /** イベントID → TimelineEvent */
    this.store = /* @__PURE__ */ new Map();
  }
  // ----------------------------------------------------------
  // 読み取り
  // ----------------------------------------------------------
  getAll() {
    return Array.from(this.store.values());
  }
  getById(id) {
    return this.store.get(id);
  }
  getByFilePath(filePath) {
    for (const event of this.store.values()) {
      if (event.filePath === filePath) return event;
    }
    return void 0;
  }
  count() {
    return this.store.size;
  }
  // ----------------------------------------------------------
  // 書き込み（差分更新）
  // ----------------------------------------------------------
  /** イベントを追加または上書き */
  upsert(event) {
    this.store.set(event.id, event);
  }
  /** イベントIDで削除 */
  deleteById(id) {
    this.store.delete(id);
  }
  /** ファイルパスで削除 */
  deleteByFilePath(filePath) {
    for (const [id, event] of this.store) {
      if (event.filePath === filePath) {
        this.store.delete(id);
        return;
      }
    }
  }
  /** 全削除（リビルド時） */
  clear() {
    this.store.clear();
  }
  // ----------------------------------------------------------
  // フィルタ済みリストを返す（FilterEngine から使用）
  // ----------------------------------------------------------
  getFiltered(predicate) {
    return this.getAll().filter(predicate);
  }
  // ----------------------------------------------------------
  // timelineOrder 順にソートして返す
  // ----------------------------------------------------------
  getAllSorted() {
    return this.getAll().sort((a, b) => a.timelineOrder - b.timelineOrder);
  }
};

// src/store/CacheStore.ts
var CACHE_PATH = ".obsidian/plugins/novels-timeline-jp/timeline-cache.json";
var CacheStore = class {
  constructor(app) {
    this.cache = { generatedAt: 0, entries: {} };
    this.app = app;
  }
  async load() {
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(CACHE_PATH)) {
        const raw = await adapter.read(CACHE_PATH);
        this.cache = JSON.parse(raw);
      }
    } catch (e) {
      this.cache = { generatedAt: 0, entries: {} };
    }
  }
  async save() {
    try {
      const adapter = this.app.vault.adapter;
      const dir = CACHE_PATH.split("/").slice(0, -1).join("/");
      if (!await adapter.exists(dir)) {
        await adapter.mkdir(dir);
      }
      this.cache.generatedAt = Date.now();
      await adapter.write(CACHE_PATH, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      console.warn("[NovelsTimelineJP] \u30AD\u30E3\u30C3\u30B7\u30E5\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", e);
    }
  }
  getEntry(id) {
    return this.cache.entries[id];
  }
  setEntry(id, entry) {
    this.cache.entries[id] = entry;
  }
  deleteEntry(id) {
    delete this.cache.entries[id];
  }
  async clearAll() {
    this.cache = { generatedAt: 0, entries: {} };
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(CACHE_PATH)) {
        await adapter.remove(CACHE_PATH);
      }
    } catch (e) {
      console.warn("[NovelsTimelineJP] \u30AD\u30E3\u30C3\u30B7\u30E5\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", e);
    }
  }
};

// src/engine/DiscoveryEngine.ts
var import_obsidian = require("obsidian");

// src/parser/DateParser.ts
var DATE_PATTERNS = [
  // 「年・月・日」漢字区切り
  /(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/,
  // ハイフン区切り
  /(\d{1,6})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
  // スペース区切り
  /(\d+)\s+(\d{1,2})\s+(\d{1,2})/
];
var PREFIX_PATTERN = /^([^\d]*)/;
var DateParser = class {
  constructor(calendar) {
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }
  /**
   * 暦設定が変わったときに呼ぶ
   */
  updateCalendar(calendar) {
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }
  // ----------------------------------------------------------
  // パブリック API
  // ----------------------------------------------------------
  /**
   * date 文字列をパースし timelineOrder を返す
   *
   * @param dateStr  timelineブロックの date フィールド値
   * @returns        DateParseOutcome
   */
  parse(dateStr) {
    if (!dateStr || dateStr.trim() === "") {
      return this.buildResult({ year: 1, month: 1, day: 1, calendarPrefix: "" });
    }
    const trimmed = dateStr.trim();
    const prefixMatch = PREFIX_PATTERN.exec(trimmed);
    const calendarPrefix = prefixMatch ? prefixMatch[1].trim() : "";
    for (const pattern of DATE_PATTERNS) {
      const m = pattern.exec(trimmed);
      if (m) {
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const day = parseInt(m[3], 10);
        const validationError = this.validateComponents(year, month, day);
        if (validationError) {
          return { ok: false, reason: validationError };
        }
        return this.buildResult({ year, month, day, calendarPrefix });
      }
    }
    return { ok: false, reason: `\u65E5\u4ED8\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8\u3092\u8A8D\u8B58\u3067\u304D\u307E\u305B\u3093: "${dateStr}"` };
  }
  /**
   * timelineOrder から ParsedDate を逆算する（D. 座標→日付変換に使用）
   *
   * @param order  timelineOrder 値
   * @returns      ParsedDate（calendarPrefix は空文字）
   */
  orderToDate(order) {
    const yearDays = this.yearDays;
    if (yearDays === 0) {
      return { year: 1, month: 1, day: 1, calendarPrefix: "" };
    }
    const year = Math.floor(order / yearDays) + 1;
    let remainder = order - (year - 1) * yearDays;
    let month = 1;
    let day = 1;
    for (const monthDef of this.calendar.months) {
      if (remainder < monthDef.days) {
        month = monthDef.month;
        day = remainder + 1;
        break;
      }
      remainder -= monthDef.days;
      month = monthDef.month + 1;
      day = 1;
    }
    if (month > this.calendar.months.length) {
      month = this.calendar.months.length;
      const lastMonthDef = this.calendar.months[this.calendar.months.length - 1];
      day = lastMonthDef ? lastMonthDef.days : 1;
    }
    return { year, month, day, calendarPrefix: "" };
  }
  /**
   * ParsedDate を表示用文字列に変換する
   * 月名が設定されていれば「〇月」部分を月名に置換する
   *
   * @param parsed         ParsedDate
   * @param withPrefix     プレフィックスを付けるか
   * @returns              例: "帝国暦1345年五月12日" / "1345年5月12日"
   */
  format(parsed, withPrefix = true) {
    const monthDef = getMonthDef(this.calendar, parsed.month);
    const monthLabel = monthDef && monthDef.name.trim() !== "" ? monthDef.name : `${parsed.month}\u6708`;
    const prefix = withPrefix && parsed.calendarPrefix ? parsed.calendarPrefix : "";
    return `${prefix}${parsed.year}\u5E74${monthLabel}${parsed.day}\u65E5`;
  }
  /**
   * ParsedDate を「年/月/日」スラッシュ形式に変換する（UI入力・保存用）
   * 例: { year:1345, month:5, day:12 } → "1345/5/12"
   */
  formatSlash(parsed) {
    return `${parsed.year}/${parsed.month}/${parsed.day}`;
  }
  /**
   * 全角数字を半角数字に正規化する（入力補助）
   */
  static normalizeFullWidth(str) {
    return str.replace(
      /[０-９]/g,
      (c) => String.fromCharCode(c.charCodeAt(0) - 65296 + 48)
    );
  }
  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------
  buildResult(parsed) {
    return {
      ok: true,
      parsed,
      timelineOrder: this.calcOrder(parsed.year, parsed.month, parsed.day)
    };
  }
  /**
   * timelineOrder の算出
   *
   *   order = (year - 1) * yearDays
   *         + cumulativeDaysBeforeMonth(month)
   *         + (day - 1)
   *
   * 例（西暦互換12か月の場合）:
   *   1345年5月12日
   *   → (1344) * 365 + (31+28+31+30) + 11
   *   → 491,568 + 120 + 11 = 491,699
   */
  calcOrder(year, month, day) {
    const yearOffset = (year - 1) * this.yearDays;
    const monthOffset = calcCumulativeDaysBeforeMonth(this.calendar, month);
    const dayOffset = day - 1;
    return yearOffset + monthOffset + dayOffset;
  }
  /**
   * 年月日の妥当性チェック
   * 月数・日数は CalendarSettings を使って検証する
   */
  validateComponents(year, month, day) {
    if (!Number.isInteger(year) || year < 1) {
      return `\u5E74\u304C\u4E0D\u6B63\u3067\u3059: ${year}`;
    }
    const monthCount = this.calendar.months.length;
    if (month < 1 || month > monthCount) {
      return `\u6708\u304C\u4E0D\u6B63\u3067\u3059: ${month}\uFF08\u3053\u306E\u66A6\u306F1\u301C${monthCount}\u6708\uFF09`;
    }
    const monthDef = getMonthDef(this.calendar, month);
    if (!monthDef) {
      return `\u6708\u306E\u5B9A\u7FA9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${month}\u6708`;
    }
    if (day < 1 || day > monthDef.days) {
      return `\u65E5\u304C\u4E0D\u6B63\u3067\u3059: ${day}\uFF08${month}\u6708\u306F1\u301C${monthDef.days}\u65E5\uFF09`;
    }
    return null;
  }
};

// src/parser/TimelineParser.ts
var NTJP_KEYS = {
  eventTitle: "NTJP_event_title",
  date: "NTJP_date",
  lane: "NTJP_lane",
  node: "NTJP_node",
  colors: "NTJP_colors",
  characters: "NTJP_characters",
  locations: "NTJP_locations",
  links: "NTJP_links",
  summary: "NTJP_summary"
};
function extractWikilinkTarget(raw) {
  const m = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/.exec(raw.trim());
  return m ? m[1].trim() : raw.trim();
}
function parseFileName(filePath) {
  var _a;
  const fileName = (_a = filePath.split("/").pop()) != null ? _a : filePath;
  const baseName = fileName.replace(/\.md$/i, "");
  const legacyDisplayTitle = baseName.replace(/^\d+-/, "");
  return { id: baseName, legacyDisplayTitle };
}
var TimelineParser = class {
  constructor(calendar) {
    this.dateParser = new DateParser(calendar);
  }
  updateCalendar(calendar) {
    this.dateParser.updateCalendar(calendar);
  }
  // ----------------------------------------------------------
  // メインエントリ
  // ----------------------------------------------------------
  /**
   * フロントマターオブジェクトを受け取り、TimelineEvent を構築する。
   * 呼び出し側（DiscoveryEngine）は、あらかじめ NTJP_date キーの有無で
   * 「このファイルはイベントか」を判定してから呼び出すこと。
   *
   * @param frontmatter  app.metadataCache.getFileCache(file)?.frontmatter
   * @param filePath     Vault相対パス
   */
  parse(frontmatter, filePath) {
    if (!frontmatter || typeof frontmatter !== "object") {
      return {
        ok: false,
        error: "missing_required_field",
        message: "\u30D5\u30ED\u30F3\u30C8\u30DE\u30BF\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      };
    }
    const missingFields = [];
    for (const field of [NTJP_KEYS.date, NTJP_KEYS.lane, NTJP_KEYS.node, NTJP_KEYS.colors]) {
      const v = frontmatter[field];
      if (v === void 0 || v === null || v === "") {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      return {
        ok: false,
        error: "missing_required_field",
        message: `\u5FC5\u9808\u30D5\u30A3\u30FC\u30EB\u30C9\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059: ${missingFields.join(", ")}`
      };
    }
    const { id, legacyDisplayTitle } = parseFileName(filePath);
    const dateStr = String(frontmatter[NTJP_KEYS.date]).trim();
    const dateResult = this.dateParser.parse(dateStr);
    if (!dateResult.ok) {
      const event2 = this.buildEvent({
        id,
        legacyDisplayTitle,
        filePath,
        frontmatter,
        date: dateStr,
        timelineOrder: 0,
        error: "invalid_date"
      });
      return { ok: true, event: event2 };
    }
    const event = this.buildEvent({
      id,
      legacyDisplayTitle,
      filePath,
      frontmatter,
      date: dateStr,
      timelineOrder: dateResult.timelineOrder,
      error: void 0
    });
    return { ok: true, event };
  }
  // ----------------------------------------------------------
  // イベントオブジェクト構築
  // ----------------------------------------------------------
  buildEvent(params) {
    const { id, legacyDisplayTitle, filePath, frontmatter, date, timelineOrder, error } = params;
    return {
      id,
      displayTitle: this.parseTitleField(frontmatter[NTJP_KEYS.eventTitle], legacyDisplayTitle),
      date,
      timelineOrder,
      // レーン数（laneCount）は設定で可変のため、ここでは異常値のみ弾く安全上限とする。
      // 実効的な上限クランプは描画時（LayoutEngine.findFreeLane）が設定値で行う。
      lane: this.parseIntField(frontmatter[NTJP_KEYS.lane], 1, 1, 9999),
      size: this.parseSizeField(frontmatter[NTJP_KEYS.node]),
      color: this.parseColorField(frontmatter[NTJP_KEYS.colors]),
      characters: this.parseStringArray(frontmatter[NTJP_KEYS.characters]),
      locations: this.parseStringArray(frontmatter[NTJP_KEYS.locations]),
      summary: this.parseOptionalString(frontmatter[NTJP_KEYS.summary]),
      links: this.parseLinks(frontmatter[NTJP_KEYS.links]),
      filePath,
      error
    };
  }
  // ----------------------------------------------------------
  // フィールドパースヘルパー
  // ----------------------------------------------------------
  parseIntField(value, defaultVal, min, max) {
    if (value === void 0 || value === null) return defaultVal;
    const n = Number(value);
    if (!Number.isFinite(n)) return defaultVal;
    return Math.max(min, Math.min(max, Math.round(n)));
  }
  /**
   * NTJP_event_title を優先し、未設定・空の場合のみ
   * ファイル名から番号部分を除いた文字列にフォールバックする
   * （NTJP_event_title 導入前の古いノートとの後方互換）。
   */
  parseTitleField(value, legacyDisplayTitle) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return legacyDisplayTitle;
  }
  parseSizeField(value) {
    if (value === "small" || value === "medium" || value === "big") return value;
    return "medium";
  }
  /**
   * NTJP_colors フィールドを解釈する。
   * 通常は配色セットのID（例: "preset-1735500000-1234"）を保持するが、
   * 配色セット導入前の古いノートに残る生のHEXコード（例: "#4A90E2"）も
   * そのまま許容する（実色解決は ColorPresetStore.resolve() が行う）。
   * 空・不正な値の場合のみ既定値にフォールバックする。
   */
  parseColorField(value, defaultVal = "#808080") {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return defaultVal;
  }
  parseStringArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.filter((v) => v !== null && v !== void 0).map((v) => String(v).trim()).filter((v) => v !== "");
    }
    if (typeof value === "string" && value.trim() !== "") {
      return [value.trim()];
    }
    return [];
  }
  parseOptionalString(value) {
    if (value === void 0 || value === null || value === "") return void 0;
    return String(value).trim() || void 0;
  }
  parseLinks(value) {
    const raw = this.parseStringArray(value);
    return raw.map(extractWikilinkTarget).filter((v) => v !== "");
  }
};

// src/engine/DiscoveryEngine.ts
var DiscoveryEngine = class _DiscoveryEngine {
  constructor(app, calendar, excludedFolders = []) {
    this.app = app;
    this.parser = new TimelineParser(calendar);
    this.excludedFolders = _DiscoveryEngine.normalizeFolders(excludedFolders);
  }
  updateCalendar(calendar) {
    this.parser.updateCalendar(calendar);
  }
  updateExcludedFolders(folders) {
    this.excludedFolders = _DiscoveryEngine.normalizeFolders(folders);
  }
  /**
   * data.json を直接編集した場合など、設定タブを経由しない値が
   * 渡されるケースに備え、ここでも normalizePath() を掛けておく。
   */
  static normalizeFolders(folders) {
    return folders.map((f) => f.trim()).filter((f) => f !== "").map((f) => (0, import_obsidian.normalizePath)(f));
  }
  // ----------------------------------------------------------
  // Vault全体を探索して全イベントを返す
  // ----------------------------------------------------------
  async discoverAll() {
    const files = this.app.vault.getMarkdownFiles();
    const targetFiles = files.filter((f) => !this.isExcluded(f.path));
    const events = [];
    const errors = [];
    for (const file of targetFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const result = this.processFrontmatter(file, cache);
      if (result === null) continue;
      if (result.ok) {
        events.push(result.event);
      } else {
        errors.push({ filePath: file.path, message: result.message });
      }
    }
    return { events, errors };
  }
  // ----------------------------------------------------------
  // 単一ファイルを再解析して返す（rename・初回検出時などに使用）
  // ----------------------------------------------------------
  async discoverFile(file) {
    if (this.isExcluded(file.path)) return null;
    const cache = this.app.metadataCache.getFileCache(file);
    const result = this.processFrontmatter(file, cache);
    return result && result.ok ? result.event : null;
  }
  // ----------------------------------------------------------
  // metadataCache "changed" イベントで渡されるcacheをそのまま使う版
  // （再取得不要・常に最新のフロントマターが保証される）
  // ----------------------------------------------------------
  buildEventFromCache(file, cache) {
    if (this.isExcluded(file.path)) return null;
    const result = this.processFrontmatter(file, cache);
    return result && result.ok ? result.event : null;
  }
  // ----------------------------------------------------------
  // ファイルがイベント用フロントマターを持つか（NTJP_date の有無で判定）
  // ----------------------------------------------------------
  hasEventFrontmatter(file) {
    var _a;
    const fm = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
    return !!fm && fm[NTJP_KEYS.date] !== void 0;
  }
  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------
  processFrontmatter(file, cache) {
    const fm = cache == null ? void 0 : cache.frontmatter;
    if (!fm || fm[NTJP_KEYS.date] === void 0) return null;
    const result = this.parser.parse(fm, file.path);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    return { ok: true, event: result.event };
  }
  isExcluded(filePath) {
    return this.excludedFolders.some(
      (folder) => filePath === folder || filePath.startsWith(folder + "/")
    );
  }
};

// src/engine/LayoutEngine.ts
var LANE_MIN = 1;
var LANE_COL_W = 60;
var HEADER_H = 36;
var YEAR_COL_W = 64;
var MONTH_COL_W = 64;
var GAP_COL_W = 80;
var LANES_START_X = YEAR_COL_W + MONTH_COL_W + GAP_COL_W;
var AXIS_X = YEAR_COL_W + MONTH_COL_W;
var SIZE_MULTIPLIER = {
  small: 1,
  medium: 1.5,
  big: 2
};
var BASE_UNIT_HALF_HEIGHT = 8;
var START_Y = HEADER_H + 20;
var MIN_Y_GAP = 46;
var Y_SCALE = 4;
var NODE_EDGE_PADDING = 30;
var GAP_MIN_DAYS = 3;
var GAP_SLOT_HEIGHT = Math.max(MIN_Y_GAP, GAP_MIN_DAYS * Y_SCALE) * 1.5;
var EXPANDED_PX_PER_DAY = 20;
var EXPANDED_MIN_HEIGHT = 120;
var LEAD_DAYS_BEFORE_FIRST = 3;
function dayLabelForEvent(event) {
  const match = /\/([0-9]+)$/.exec(event.date);
  const day = match ? match[1] : "?";
  return `${day}\u65E5`;
}
function estimateNodeFontSize(radius) {
  return Math.max(9, Math.min(22, radius * 1.15));
}
function estimateNodePillWidth(event, radius) {
  const text = dayLabelForEvent(event);
  const fontSize = estimateNodeFontSize(radius);
  return text.length * fontSize * 0.62 + fontSize * 0.9;
}
var LayoutEngine = class {
  constructor(calendar) {
    this.dateParser = new DateParser(calendar);
  }
  updateCalendar(calendar) {
    this.dateParser.updateCalendar(calendar);
  }
  // ----------------------------------------------------------
  // メイン：イベント一覧 → LayoutNode 一覧
  // ----------------------------------------------------------
  buildLayout(sortedEvents, laneCount, gaps, gapCompression) {
    var _a;
    if (sortedEvents.length === 0) return [];
    const dayGroups = this.groupByDay(sortedEvents);
    const yByOrder = this.calcYByDayGroup(dayGroups, gaps, gapCompression);
    const nodes = [];
    for (const group of dayGroups) {
      const y = (_a = yByOrder.get(group.order)) != null ? _a : 0;
      this.resolveGroupLayout(group.events, y, laneCount, nodes);
    }
    return nodes;
  }
  // ----------------------------------------------------------
  // ① 同日グループ化
  // ----------------------------------------------------------
  groupByDay(sortedEvents) {
    const groups = [];
    let current = null;
    for (const event of sortedEvents) {
      if (!current || current.order !== event.timelineOrder) {
        current = { order: event.timelineOrder, events: [] };
        groups.push(current);
      }
      current.events.push(event);
    }
    return groups;
  }
  // ----------------------------------------------------------
  // ② 日付グループ単位でY座標を計算（1日 = 1行）
  // ----------------------------------------------------------
  calcYByDayGroup(groups, gaps, gapCompression) {
    const yMap = /* @__PURE__ */ new Map();
    if (groups.length === 0) return yMap;
    let currentY = START_Y;
    currentY += Math.max(MIN_Y_GAP, LEAD_DAYS_BEFORE_FIRST * Y_SCALE);
    yMap.set(groups[0].order, currentY);
    let prevGroupMaxHeight = this.groupMaxNodeHeight(groups[0].events);
    for (let i = 1; i < groups.length; i++) {
      const prev = groups[i - 1];
      const cur = groups[i];
      const orderDiff = cur.order - prev.order;
      const minHeightAwareGap = prevGroupMaxHeight + NODE_EDGE_PADDING;
      if (gapCompression) {
        const matchingGap = gaps.find(
          (g) => g.fromOrder === prev.order && g.toOrder === cur.order
        );
        if (matchingGap) {
          const gapHeight = matchingGap.expanded ? Math.max(EXPANDED_MIN_HEIGHT, orderDiff * EXPANDED_PX_PER_DAY) : GAP_SLOT_HEIGHT;
          currentY += Math.max(gapHeight, minHeightAwareGap);
        } else {
          currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE, minHeightAwareGap);
        }
      } else {
        currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE, minHeightAwareGap);
      }
      yMap.set(cur.order, currentY);
      prevGroupMaxHeight = this.groupMaxNodeHeight(cur.events);
    }
    return yMap;
  }
  /** グループ内イベントのうち、最も時間軸方向の占有幅(radius*2)が大きいノードの値(px)を返す */
  groupMaxNodeHeight(events) {
    let maxHeight = 0;
    for (const event of events) {
      const height = this.calcRadius(event.size) * 2;
      if (height > maxHeight) maxHeight = height;
    }
    return maxHeight;
  }
  // ----------------------------------------------------------
  // ③ グループ内レイアウト
  //    - 同laneの衝突はlaneをずらして回避（1〜laneCountの範囲内）
  // ----------------------------------------------------------
  resolveGroupLayout(events, y, laneCount, out) {
    const usedLanes = /* @__PURE__ */ new Set();
    const resolved = [];
    for (const event of events) {
      const lane = this.findFreeLane(event.lane, usedLanes, laneCount);
      usedLanes.add(lane);
      resolved.push({ event, effectiveLane: lane });
    }
    for (const { event, effectiveLane } of resolved) {
      const x = this.calcX(effectiveLane, laneCount);
      const radius = this.calcRadius(event.size);
      out.push({ event, x, y, radius });
    }
  }
  /**
   * 指定laneから最も近い未使用laneを探す（1〜laneCountの範囲のみ）。
   * 範囲外に押し出された場合は、範囲内で最初に見つかった空きlaneを使う。
   * 全レーンが埋まっている場合は指定laneをそのまま返す（重なりを許容）。
   */
  findFreeLane(startLane, usedLanes, laneCount) {
    const laneMax = Math.max(LANE_MIN, laneCount);
    const clampedStart = Math.max(LANE_MIN, Math.min(laneMax, startLane));
    if (!usedLanes.has(clampedStart)) return clampedStart;
    for (let delta = 1; delta < laneMax; delta++) {
      for (const candidate of [clampedStart + delta, clampedStart - delta]) {
        if (candidate < LANE_MIN || candidate > laneMax) continue;
        if (!usedLanes.has(candidate)) return candidate;
      }
    }
    return clampedStart;
  }
  // ----------------------------------------------------------
  // Y座標マップ（GapEngine・orderFromViewportY 用の公開API）
  // ----------------------------------------------------------
  /**
   * GapEngineに渡すための「イベントID → Y座標」マップを返す。
   * buildLayout より前に呼ばれるため、Gap情報なしで算出する暫定版。
   */
  calcYPositions(sortedEvents, gaps, gapCompression) {
    var _a;
    const groups = this.groupByDay(sortedEvents);
    const yByOrder = this.calcYByDayGroup(groups, gaps, gapCompression);
    const yMap = /* @__PURE__ */ new Map();
    for (const group of groups) {
      const y = (_a = yByOrder.get(group.order)) != null ? _a : 0;
      for (const event of group.events) {
        yMap.set(event.id, y);
      }
    }
    return yMap;
  }
  /** SVG全体の幅(px)。レーン数（設定値）にのみ依存し、イベント数では変化しない固定値。 */
  calcTotalWidth(laneCount) {
    return LANES_START_X + Math.max(LANE_MIN, laneCount) * LANE_COL_W + 24;
  }
  /** SVG全体の高さ(px)。イベントの時間軸方向の配置に応じて動的に変化する。 */
  calcTotalHeight(nodes) {
    if (nodes.length === 0) return 600;
    return Math.max(...nodes.map((n) => n.y)) + 140;
  }
  /** レーン番号(1〜laneCount) → SVG X座標（列の中心） */
  calcX(lane, laneCount) {
    const laneMax = Math.max(LANE_MIN, laneCount);
    const clamped = Math.max(LANE_MIN, Math.min(laneMax, lane));
    return LANES_START_X + (clamped - LANE_MIN) * LANE_COL_W + LANE_COL_W / 2;
  }
  calcRadius(size) {
    var _a;
    const multiplier = (_a = SIZE_MULTIPLIER[size]) != null ? _a : SIZE_MULTIPLIER["medium"];
    return BASE_UNIT_HALF_HEIGHT * multiplier;
  }
  /**
   * クリック位置(ビューポートY)から日付文字列を逆算する。
   *
   * 【設計方針】
   * - nodes[i].y は calcYByDayGroup が生成した SVGユーザー座標（実際の描画Y、ノード上端）。
   * - クリック位置 svgY は TimelineRenderer.clientYToSvgY() で変換済みの
   *   SVGユーザー座標（ボードズームを考慮済み）を渡すこと。
   * - Gap展開/折りたたみ状態に関係なく、nodes の y 値は常に正しい描画位置を示す。
   * - 区間ごとの px/日 定数で orderDiff を復元し、最初のイベントの order を基点に加算する。
   */
  orderFromViewportY(svgY, nodes, gaps, gapCompression, calendarPrefix = "") {
    if (nodes.length === 0) {
      return this.orderToDateString(0, calendarPrefix);
    }
    const seen = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      if (!seen.has(node.event.timelineOrder)) {
        seen.set(node.event.timelineOrder, node.y);
      }
    }
    const entries = Array.from(seen.entries()).map(([order, y]) => ({ order, vy: y })).sort((a, b) => a.vy - b.vy);
    const first = entries[0];
    const last = entries[entries.length - 1];
    if (svgY <= first.vy) {
      return this.orderToDateString(Math.max(0, first.order - 1), calendarPrefix);
    }
    if (svgY >= last.vy) {
      return this.orderToDateString(last.order + 1, calendarPrefix);
    }
    for (let i = 0; i < entries.length - 1; i++) {
      const cur = entries[i];
      const next = entries[i + 1];
      if (svgY < cur.vy || svgY > next.vy) continue;
      const segH = next.vy - cur.vy;
      if (segH <= 0) {
        return this.orderToDateString(cur.order, calendarPrefix);
      }
      const dy = svgY - cur.vy;
      const orderDiff = next.order - cur.order;
      const t = dy / segH;
      const rawOrder = Math.round(cur.order + t * orderDiff);
      const estimatedOrder = Math.max(cur.order, Math.min(next.order, rawOrder));
      return this.orderToDateString(estimatedOrder, calendarPrefix);
    }
    let nearest = entries[0];
    let minDist = Math.abs(svgY - entries[0].vy);
    for (const e of entries) {
      const d = Math.abs(svgY - e.vy);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
    return this.orderToDateString(nearest.order, calendarPrefix);
  }
  /**
   * timelineOrder → date 文字列（スラッシュ形式）
   * 例: "1345/5/12"（暦名なし・UIの入力形式と一致させる）
   */
  orderToDateString(order, _calendarPrefix) {
    const parsed = this.dateParser.orderToDate(Math.max(0, order));
    return this.dateParser.formatSlash(parsed);
  }
};

// src/engine/RelationEngine.ts
var RelationEngine = class {
  /**
   * EventStore の全イベントと LayoutNode 一覧から
   * 有効な RelationEdge 一覧を生成する
   *
   * links フィールドはファイル名一致で解決する
   */
  buildEdges(events, nodes) {
    const nodeMap = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      nodeMap.set(node.event.id, node);
    }
    const edges = [];
    for (const event of events) {
      const fromNode = nodeMap.get(event.id);
      if (!fromNode) continue;
      for (const linkId of event.links) {
        const toNode = nodeMap.get(linkId);
        if (!toNode) continue;
        const alreadyExists = edges.some(
          (e) => e.fromId === event.id && e.toId === linkId || e.fromId === linkId && e.toId === event.id
        );
        if (alreadyExists) continue;
        edges.push({
          fromId: event.id,
          toId: linkId,
          fromNode,
          toNode
        });
      }
    }
    return edges;
  }
  /**
   * 選択中のイベントIDに関連するエッジのみを返す
   */
  filterBySelected(edges, selectedId) {
    return edges.filter(
      (e) => e.fromId === selectedId || e.toId === selectedId
    );
  }
};

// src/engine/GapEngine.ts
var GapEngine = class {
  constructor(calendar) {
    /** 展開中のGapのキー（"fromOrder_toOrder"） */
    this.expandedKeys = /* @__PURE__ */ new Set();
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }
  updateCalendar(calendar) {
    this.calendar = calendar;
    this.yearDays = calcYearDays(calendar);
  }
  // ----------------------------------------------------------
  // Gap一覧を生成する
  // ----------------------------------------------------------
  /**
   * ソート済みイベント一覧と各イベントのY座標から Gap を生成する
   *
   * @param sortedEvents  timelineOrder 昇順でソート済みのイベント
   * @param yPositions    イベントID → SVG Y座標（時間軸位置）のマップ
   * @param threshold     Gap生成条件（日数相当値）
   */
  buildGaps(sortedEvents, yPositions, threshold) {
    var _a, _b;
    const gaps = [];
    const effectiveThreshold = Math.max(GAP_MIN_DAYS, threshold);
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const before = sortedEvents[i];
      const after = sortedEvents[i + 1];
      const diff = after.timelineOrder - before.timelineOrder;
      const gapDays = Math.max(0, diff - 1);
      if (gapDays < effectiveThreshold) continue;
      const yBefore = (_a = yPositions.get(before.id)) != null ? _a : 0;
      const yAfter = (_b = yPositions.get(after.id)) != null ? _b : 0;
      gaps.push(this.buildGap({ before, after, yBefore, yAfter }));
    }
    return gaps;
  }
  // ----------------------------------------------------------
  // Gap の位置（時間軸Y座標）をノードの実描画位置で更新する
  // ----------------------------------------------------------
  /**
   * buildGaps() 後、LayoutEngine.buildLayout() で確定した LayoutNode 一覧を使って
   * 各 Gap の表示位置（Y座標）を更新する。
   *
   * ノードは「上端(node.y)が時間軸の日付起点、radius分だけ上下に占有」となるよう
   * 描画されるため、Gapの中心は
   *   前イベントノードの【下端】(y + radius) 〜 後イベントノードの【上端】(y - radius)
   * の中間点として算出する。単純に両ノードの y（上端同士）の中間点を取ると、
   * 前イベントノードの描画範囲にGapが重なって見えてしまうため注意する。
   */
  updateGapYPositions(gaps, nodes) {
    const orderToNode = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      if (!orderToNode.has(node.event.timelineOrder)) {
        orderToNode.set(node.event.timelineOrder, node);
      }
    }
    for (const gap of gaps) {
      const fromNode = orderToNode.get(gap.fromOrder);
      const toNode = orderToNode.get(gap.toOrder);
      if (!fromNode || !toNode) continue;
      const fromBottomEdge = fromNode.y + fromNode.radius;
      const toTopEdge = toNode.y - toNode.radius;
      gap.y = (fromBottomEdge + toTopEdge) / 2;
    }
  }
  // ----------------------------------------------------------
  // Gap の展開/収縮
  // ----------------------------------------------------------
  toggleExpand(gap) {
    const key = this.gapKey(gap);
    if (this.expandedKeys.has(key)) {
      this.expandedKeys.delete(key);
      gap.expanded = false;
    } else {
      this.expandedKeys.add(key);
      gap.expanded = true;
    }
  }
  collapseAll() {
    this.expandedKeys.clear();
  }
  /**
   * 現在のGapリストをすべて展開する。
   * buildGaps() で生成済みの GapSegment を受け取り、
   * 各 Gap の key を expandedKeys に登録する。
   */
  expandAll(gaps) {
    for (const gap of gaps) {
      this.expandedKeys.add(this.gapKeyFromOrders(gap.fromOrder, gap.toOrder));
    }
  }
  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------
  buildGap(input) {
    const { before, after, yBefore, yAfter } = input;
    const diff = after.timelineOrder - before.timelineOrder;
    const key = this.gapKeyFromOrders(before.timelineOrder, after.timelineOrder);
    const gapDays = Math.max(0, diff - 1);
    return {
      fromOrder: before.timelineOrder,
      toOrder: after.timelineOrder,
      y: (yBefore + yAfter) / 2,
      label: this.formatDiff(gapDays),
      expanded: this.expandedKeys.has(key)
    };
  }
  /**
   * timelineOrder の差分を「年・月・日」の自然言語ラベルに変換する
   *
   * 変換ルール:
   *   diff ÷ yearDays → 年数
   *   残り ÷ 月ごとの日数 → 月数（最大月から順に引き算）
   *   残り → 日数
   *
   * 例（西暦12か月の場合 yearDays=365）:
   *   diff=1   → "1日"
   *   diff=60  → "2か月"
   *   diff=400 → "1年1か月"
   *   diff=730 → "2年"
   */
  formatDiff(diff) {
    if (this.yearDays <= 0 || diff <= 0) return `${diff}\u65E5`;
    let remainder = diff;
    const years = Math.floor(remainder / this.yearDays);
    remainder -= years * this.yearDays;
    let months = 0;
    for (const monthDef of this.calendar.months) {
      if (remainder >= monthDef.days) {
        remainder -= monthDef.days;
        months++;
      } else {
        break;
      }
    }
    const days = remainder;
    const parts = [];
    if (years > 0) parts.push(`${years}\u5E74`);
    if (months > 0) parts.push(`${months}\u304B\u6708`);
    if (days > 0) parts.push(`${days}\u65E5`);
    return parts.length > 0 ? parts.join("") : "0\u65E5";
  }
  gapKey(gap) {
    return this.gapKeyFromOrders(gap.fromOrder, gap.toOrder);
  }
  gapKeyFromOrders(from, to) {
    return `${from}_${to}`;
  }
};

// node_modules/fuse.js/dist/fuse.mjs
function isArray(value) {
  return !Array.isArray ? getTag(value) === "[object Array]" : Array.isArray(value);
}
function baseToString(value) {
  if (typeof value == "string") return value;
  if (typeof value === "bigint") return value.toString();
  const result = value + "";
  return result == "0" && 1 / value == -Infinity ? "-0" : result;
}
function toString(value) {
  return value == null ? "" : baseToString(value);
}
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number";
}
function isBoolean(value) {
  return value === true || value === false || isObjectLike(value) && getTag(value) == "[object Boolean]";
}
function isObject(value) {
  return typeof value === "object";
}
function isObjectLike(value) {
  return isObject(value) && value !== null;
}
function isDefined(value) {
  return value !== void 0 && value !== null;
}
function isBlank(value) {
  return !value.trim().length;
}
function getTag(value) {
  return value == null ? value === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(value);
}
var INCORRECT_INDEX_TYPE = "Incorrect 'index' type";
var INVALID_DOC_INDEX = "Invalid doc index: must be a non-negative integer within the bounds of the docs array";
var LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) => `Invalid value for key ${key}`;
var PATTERN_LENGTH_TOO_LARGE = (max) => `Pattern length exceeds max of ${max}.`;
var MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;
var INVALID_KEY_WEIGHT_VALUE = (key) => `Property 'weight' in key '${key}' must be a positive integer`;
var FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED = "Fuse.match does not support useTokenSearch: token search requires corpus-level statistics (df, fieldCount) that a one-off string comparison does not have. Use new Fuse(...).search(...) instead.";
var hasOwn = Object.prototype.hasOwnProperty;
var KeyStore = class {
  constructor(keys) {
    this._keys = [];
    this._keyMap = {};
    let totalWeight = 0;
    keys.forEach((key) => {
      const obj = createKey(key);
      this._keys.push(obj);
      this._keyMap[obj.id] = obj;
      totalWeight += obj.weight;
    });
    this._keys.forEach((key) => {
      key.weight /= totalWeight;
    });
  }
  get(keyId) {
    return this._keyMap[keyId];
  }
  keys() {
    return this._keys;
  }
  toJSON() {
    return JSON.stringify(this._keys);
  }
};
function createKey(key) {
  var _a;
  let path = null;
  let id = null;
  let src = null;
  let weight = 1;
  let getFn = null;
  if (isString(key) || isArray(key)) {
    src = key;
    path = createKeyPath(key);
    id = createKeyId(key);
  } else {
    if (!hasOwn.call(key, "name")) throw new Error(MISSING_KEY_PROPERTY("name"));
    const name = key.name;
    src = name;
    if (hasOwn.call(key, "weight") && key.weight !== void 0) {
      weight = key.weight;
      if (weight <= 0) throw new Error(INVALID_KEY_WEIGHT_VALUE(createKeyId(name)));
    }
    path = createKeyPath(name);
    id = createKeyId(name);
    getFn = (_a = key.getFn) != null ? _a : null;
  }
  return {
    path,
    id,
    weight,
    src,
    getFn
  };
}
function createKeyPath(key) {
  return isArray(key) ? key : key.split(".");
}
function createKeyId(key) {
  return isArray(key) ? key.join(".") : key;
}
function get(obj, path) {
  const list = [];
  let arr = false;
  const deepGet = (obj2, path2, index, arrayIndex) => {
    if (!isDefined(obj2)) return;
    if (!path2[index]) list.push(arrayIndex !== void 0 ? {
      v: obj2,
      i: arrayIndex
    } : obj2);
    else {
      const value = obj2[path2[index]];
      if (!isDefined(value)) return;
      if (index === path2.length - 1 && (isString(value) || isNumber(value) || isBoolean(value) || typeof value === "bigint")) list.push(arrayIndex !== void 0 ? {
        v: toString(value),
        i: arrayIndex
      } : toString(value));
      else if (isArray(value)) {
        arr = true;
        for (let i = 0, len = value.length; i < len; i += 1) deepGet(value[i], path2, index + 1, i);
      } else if (path2.length) deepGet(value, path2, index + 1, arrayIndex);
    }
  };
  deepGet(obj, isString(path) ? path.split(".") : path, 0);
  return arr ? list : list[0];
}
var MatchOptions = {
  includeMatches: false,
  findAllMatches: false,
  minMatchCharLength: 1
};
var BasicOptions = {
  isCaseSensitive: false,
  ignoreDiacritics: false,
  includeScore: false,
  keys: [],
  shouldSort: true,
  sortFn: (a, b) => a.score === b.score ? a.idx < b.idx ? -1 : 1 : a.score < b.score ? -1 : 1
};
var FuzzyOptions = {
  location: 0,
  threshold: 0.6,
  distance: 100
};
var AdvancedOptions = {
  useExtendedSearch: false,
  useTokenSearch: false,
  tokenize: void 0,
  tokenMatch: "any",
  getFn: get,
  ignoreLocation: false,
  ignoreFieldNorm: false,
  fieldNormWeight: 1
};
var Config = Object.freeze({
  ...BasicOptions,
  ...MatchOptions,
  ...FuzzyOptions,
  ...AdvancedOptions
});
function norm(weight = 1, mantissa = 3) {
  const cache = /* @__PURE__ */ new Map();
  const m = Math.pow(10, mantissa);
  return {
    get(value) {
      let numTokens = 1;
      let inSpace = false;
      for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 32) {
        if (!inSpace) {
          numTokens++;
          inSpace = true;
        }
      } else inSpace = false;
      if (cache.has(numTokens)) return cache.get(numTokens);
      const n = Math.round(m / Math.pow(numTokens, 0.5 * weight)) / m;
      cache.set(numTokens, n);
      return n;
    },
    clear() {
      cache.clear();
    }
  };
}
var FuseIndex = class {
  constructor({ getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
    this.norm = norm(fieldNormWeight, 3);
    this.getFn = getFn;
    this.isCreated = false;
    this.docs = [];
    this.keys = [];
    this._keysMap = {};
    this.setIndexRecords();
  }
  setSources(docs = []) {
    this.docs = docs;
  }
  setIndexRecords(records = []) {
    this.records = records;
  }
  setKeys(keys = []) {
    this.keys = keys;
    this._keysMap = {};
    keys.forEach((key, idx) => {
      this._keysMap[key.id] = idx;
    });
  }
  create() {
    if (this.isCreated || !this.docs.length) return;
    this.isCreated = true;
    const len = this.docs.length;
    this.records = new Array(len);
    let recordCount = 0;
    if (isString(this.docs[0])) for (let i = 0; i < len; i++) {
      const record = this._createStringRecord(this.docs[i], i);
      if (record) this.records[recordCount++] = record;
    }
    else for (let i = 0; i < len; i++) this.records[recordCount++] = this._createObjectRecord(this.docs[i], i);
    this.records.length = recordCount;
    this.norm.clear();
  }
  add(doc, docIndex) {
    if (!Number.isInteger(docIndex) || docIndex < 0) throw new Error(INVALID_DOC_INDEX);
    if (isString(doc)) {
      const record2 = this._createStringRecord(doc, docIndex);
      if (record2) this.records.push(record2);
      return record2;
    }
    const record = this._createObjectRecord(doc, docIndex);
    this.records.push(record);
    return record;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0) throw new Error(INVALID_DOC_INDEX);
    for (let i = 0, len = this.records.length; i < len; i += 1) if (this.records[i].i === idx) {
      this.records.splice(i, 1);
      break;
    }
    for (let i = 0, len = this.records.length; i < len; i += 1) if (this.records[i].i > idx) this.records[i].i -= 1;
  }
  removeAll(indices) {
    const toRemove = /* @__PURE__ */ new Set();
    for (const v of indices) if (Number.isInteger(v) && v >= 0) toRemove.add(v);
    if (toRemove.size === 0) return;
    this.records = this.records.filter((r) => !toRemove.has(r.i));
    const sorted = Array.from(toRemove).sort((a, b) => a - b);
    for (const record of this.records) {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (sorted[mid] < record.i) lo = mid + 1;
        else hi = mid;
      }
      record.i -= lo;
    }
  }
  getValueForItemAtKeyId(item, keyId) {
    return item[this._keysMap[keyId]];
  }
  size() {
    return this.records.length;
  }
  _createStringRecord(doc, docIndex) {
    if (!isDefined(doc) || isBlank(doc)) return null;
    return {
      v: doc,
      i: docIndex,
      n: this.norm.get(doc)
    };
  }
  _createObjectRecord(doc, docIndex) {
    const record = {
      i: docIndex,
      $: {}
    };
    for (let keyIndex = 0, keyLen = this.keys.length; keyIndex < keyLen; keyIndex++) {
      const key = this.keys[keyIndex];
      const value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);
      if (!isDefined(value)) continue;
      if (isArray(value)) {
        const subRecords = [];
        for (let i = 0, len = value.length; i < len; i += 1) {
          const item = value[i];
          if (!isDefined(item)) continue;
          if (isString(item)) {
            if (!isBlank(item)) {
              const subRecord = {
                v: item,
                i,
                n: this.norm.get(item)
              };
              subRecords.push(subRecord);
            }
          } else if (isDefined(item.v)) {
            const text = isString(item.v) ? item.v : toString(item.v);
            if (!isBlank(text)) {
              const subRecord = {
                v: text,
                i: item.i,
                n: this.norm.get(text)
              };
              subRecords.push(subRecord);
            }
          }
        }
        record.$[keyIndex] = subRecords;
      } else if (isString(value) && !isBlank(value)) {
        const subRecord = {
          v: value,
          n: this.norm.get(value)
        };
        record.$[keyIndex] = subRecord;
      }
    }
    return record;
  }
  toJSON() {
    return {
      keys: this.keys.map(({ getFn, ...key }) => key),
      records: this.records
    };
  }
};
function createIndex(keys, docs, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys.map(createKey));
  myIndex.setSources(docs);
  myIndex.create();
  return myIndex;
}
function parseIndex(data, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const { keys, records } = data;
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys);
  myIndex.setIndexRecords(records);
  return myIndex;
}
function convertMaskToIndices(matchmask = [], minMatchCharLength = Config.minMatchCharLength) {
  const indices = [];
  let start = -1;
  let end = -1;
  let i = 0;
  for (let len = matchmask.length; i < len; i += 1) {
    const match = matchmask[i];
    if (match && start === -1) start = i;
    else if (!match && start !== -1) {
      end = i - 1;
      if (end - start + 1 >= minMatchCharLength) indices.push([start, end]);
      start = -1;
    }
  }
  if (matchmask[i - 1] && i - start >= minMatchCharLength) indices.push([start, i - 1]);
  return indices;
}
function search(text, pattern, patternAlphabet, { location = Config.location, distance = Config.distance, threshold = Config.threshold, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, includeMatches = Config.includeMatches, ignoreLocation = Config.ignoreLocation } = {}) {
  if (pattern.length > 32) throw new Error(PATTERN_LENGTH_TOO_LARGE(32));
  const patternLen = pattern.length;
  const textLen = text.length;
  const expectedLocation = Math.max(0, Math.min(location, textLen));
  let currentThreshold = threshold;
  let bestLocation = expectedLocation;
  const calcScore = (errors, currentLocation) => {
    const accuracy = errors / patternLen;
    if (ignoreLocation) return accuracy;
    const proximity = Math.abs(expectedLocation - currentLocation);
    if (!distance) return proximity ? 1 : accuracy;
    return accuracy + proximity / distance;
  };
  const computeMatches = minMatchCharLength > 1 || includeMatches;
  const matchMask = computeMatches ? Array(textLen) : [];
  let index;
  while ((index = text.indexOf(pattern, bestLocation)) > -1) {
    const score = calcScore(0, index);
    currentThreshold = Math.min(score, currentThreshold);
    bestLocation = index + patternLen;
    if (computeMatches) {
      let i = 0;
      while (i < patternLen) {
        matchMask[index + i] = 1;
        i += 1;
      }
    }
  }
  bestLocation = -1;
  let lastBitArr = [];
  let finalScore = 1;
  let bestErrors = 0;
  let binMax = patternLen + textLen;
  const mask = 1 << patternLen - 1;
  for (let i = 0; i < patternLen; i += 1) {
    let binMin = 0;
    let binMid = binMax;
    while (binMin < binMid) {
      if (calcScore(i, expectedLocation + binMid) <= currentThreshold) binMin = binMid;
      else binMax = binMid;
      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }
    binMax = binMid;
    let start = Math.max(1, expectedLocation - binMid + 1);
    const finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen;
    const bitArr = Array(finish + 2);
    bitArr[finish + 1] = (1 << i) - 1;
    for (let j = finish; j >= start; j -= 1) {
      const currentLocation = j - 1;
      const charMatch = patternAlphabet[text[currentLocation]];
      bitArr[j] = (bitArr[j + 1] << 1 | 1) & charMatch;
      if (i) bitArr[j] |= (lastBitArr[j + 1] | lastBitArr[j]) << 1 | 1 | lastBitArr[j + 1];
      if (bitArr[j] & mask) {
        finalScore = calcScore(i, currentLocation);
        if (finalScore <= currentThreshold) {
          currentThreshold = finalScore;
          bestLocation = currentLocation;
          bestErrors = i;
          if (bestLocation <= expectedLocation) break;
          start = Math.max(1, 2 * expectedLocation - bestLocation);
        }
      }
    }
    if (calcScore(i + 1, expectedLocation) > currentThreshold) break;
    lastBitArr = bitArr;
  }
  if (computeMatches && bestLocation >= 0) {
    const matchEnd = Math.min(textLen - 1, bestLocation + patternLen - 1 + bestErrors);
    for (let k = bestLocation; k <= matchEnd; k += 1) if (patternAlphabet[text[k]]) matchMask[k] = 1;
  }
  const result = {
    isMatch: bestLocation >= 0,
    score: Math.max(1e-3, finalScore)
  };
  if (computeMatches) {
    const indices = convertMaskToIndices(matchMask, minMatchCharLength);
    if (!indices.length) result.isMatch = false;
    else if (includeMatches) result.indices = indices;
  }
  return result;
}
function createPatternAlphabet(pattern) {
  const mask = {};
  for (let i = 0, len = pattern.length; i < len; i += 1) {
    const char = pattern.charAt(i);
    mask[char] = (mask[char] || 0) | 1 << len - i - 1;
  }
  return mask;
}
function mergeIndices(indices) {
  if (indices.length <= 1) return indices;
  indices.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [indices[0]];
  for (let i = 1, len = indices.length; i < len; i += 1) {
    const last = merged[merged.length - 1];
    const curr = indices[i];
    if (curr[0] <= last[1] + 1) last[1] = Math.max(last[1], curr[1]);
    else merged.push(curr);
  }
  return merged;
}
var NON_DECOMPOSABLE_MAP = {
  "\u0142": "l",
  "\u0141": "L",
  "\u0111": "d",
  "\u0110": "D",
  "\xF8": "o",
  "\xD8": "O",
  "\u0127": "h",
  "\u0126": "H",
  "\u0167": "t",
  "\u0166": "T",
  "\u0131": "i",
  "\xDF": "ss"
};
var NON_DECOMPOSABLE_RE = new RegExp("[" + Object.keys(NON_DECOMPOSABLE_MAP).join("") + "]", "g");
var stripDiacritics = typeof String.prototype.normalize === "function" ? (str) => str.normalize("NFD").replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, "").replace(NON_DECOMPOSABLE_RE, (ch) => NON_DECOMPOSABLE_MAP[ch]) : (str) => str;
var BitapSearch = class {
  constructor(pattern, { location = Config.location, threshold = Config.threshold, distance = Config.distance, includeMatches = Config.includeMatches, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, ignoreLocation = Config.ignoreLocation } = {}) {
    this.options = {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    };
    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.chunks = [];
    if (!this.pattern.length) return;
    const addChunk = (pattern2, startIndex) => {
      this.chunks.push({
        pattern: pattern2,
        alphabet: createPatternAlphabet(pattern2),
        startIndex
      });
    };
    const len = this.pattern.length;
    if (len > 32) {
      let i = 0;
      const remainder = len % 32;
      const end = len - remainder;
      while (i < end) {
        addChunk(this.pattern.substr(i, 32), i);
        i += 32;
      }
      if (remainder) {
        const startIndex = len - 32;
        addChunk(this.pattern.substr(startIndex), startIndex);
      }
    } else addChunk(this.pattern, 0);
  }
  searchIn(text) {
    const { isCaseSensitive, ignoreDiacritics, includeMatches } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    if (this.pattern === text) {
      const result2 = {
        isMatch: true,
        score: 0
      };
      if (includeMatches) result2.indices = [[0, text.length - 1]];
      return result2;
    }
    const { location, distance, threshold, findAllMatches, minMatchCharLength, ignoreLocation } = this.options;
    const allIndices = [];
    let totalScore = 0;
    let hasMatches = false;
    this.chunks.forEach(({ pattern, alphabet, startIndex }) => {
      const { isMatch, score, indices } = search(text, pattern, alphabet, {
        location: location + startIndex,
        distance,
        threshold,
        findAllMatches,
        minMatchCharLength,
        includeMatches,
        ignoreLocation
      });
      if (isMatch) hasMatches = true;
      totalScore += score;
      if (isMatch && indices) allIndices.push(...indices);
    });
    const result = {
      isMatch: hasMatches,
      score: hasMatches ? totalScore / this.chunks.length : 1
    };
    if (hasMatches && includeMatches) result.indices = mergeIndices(allIndices);
    return result;
  }
};
var MULTI_MATCH_TYPES = /* @__PURE__ */ new Set(["fuzzy", "include"]);
function isInverse(type) {
  return type.startsWith("inverse");
}
var matchers = [
  {
    type: "exact",
    multiRegex: /^="(.*)"$/,
    singleRegex: /^=(.*)$/,
    create: (pattern) => ({
      type: "exact",
      search(text) {
        const isMatch = text === pattern;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, pattern.length - 1]
        };
      }
    })
  },
  {
    type: "include",
    multiRegex: /^'"(.*)"$/,
    singleRegex: /^'(.*)$/,
    create: (pattern) => ({
      type: "include",
      search(text) {
        let location = 0;
        let index;
        const indices = [];
        const patternLen = pattern.length;
        while ((index = text.indexOf(pattern, location)) > -1) {
          location = index + patternLen;
          indices.push([index, location - 1]);
        }
        const isMatch = !!indices.length;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices
        };
      }
    })
  },
  {
    type: "prefix-exact",
    multiRegex: /^\^"(.*)"$/,
    singleRegex: /^\^(.*)$/,
    create: (pattern) => ({
      type: "prefix-exact",
      search(text) {
        const isMatch = text.startsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, pattern.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-prefix-exact",
    multiRegex: /^!\^"(.*)"$/,
    singleRegex: /^!\^(.*)$/,
    create: (pattern) => ({
      type: "inverse-prefix-exact",
      search(text) {
        const isMatch = !text.startsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-suffix-exact",
    multiRegex: /^!"(.*)"\$$/,
    singleRegex: /^!(.*)\$$/,
    create: (pattern) => ({
      type: "inverse-suffix-exact",
      search(text) {
        const isMatch = !text.endsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "suffix-exact",
    multiRegex: /^"(.*)"\$$/,
    singleRegex: /^(.*)\$$/,
    create: (pattern) => ({
      type: "suffix-exact",
      search(text) {
        const isMatch = text.endsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [text.length - pattern.length, text.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-exact",
    multiRegex: /^!"(.*)"$/,
    singleRegex: /^!(.*)$/,
    create: (pattern) => ({
      type: "inverse-exact",
      search(text) {
        const isMatch = text.indexOf(pattern) === -1;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "fuzzy",
    multiRegex: /^"(.*)"$/,
    singleRegex: /^(.*)$/,
    create: (pattern, options = {}) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const bitap = new BitapSearch(pattern, {
        location: (_a = options.location) != null ? _a : Config.location,
        threshold: (_b = options.threshold) != null ? _b : Config.threshold,
        distance: (_c = options.distance) != null ? _c : Config.distance,
        includeMatches: (_d = options.includeMatches) != null ? _d : Config.includeMatches,
        findAllMatches: (_e = options.findAllMatches) != null ? _e : Config.findAllMatches,
        minMatchCharLength: (_f = options.minMatchCharLength) != null ? _f : Config.minMatchCharLength,
        isCaseSensitive: (_g = options.isCaseSensitive) != null ? _g : Config.isCaseSensitive,
        ignoreDiacritics: (_h = options.ignoreDiacritics) != null ? _h : Config.ignoreDiacritics,
        ignoreLocation: (_i = options.ignoreLocation) != null ? _i : Config.ignoreLocation
      });
      return {
        type: "fuzzy",
        search(text) {
          return bitap.searchIn(text);
        }
      };
    }
  }
];
var matchersLen = matchers.length;
var ESCAPED_PIPE = "\0";
var OR_TOKEN = "|";
function tokenize(pattern) {
  const tokens = [];
  const len = pattern.length;
  let i = 0;
  while (i < len) {
    while (i < len && pattern[i] === " ") i++;
    if (i >= len) break;
    let j = i;
    while (j < len && pattern[j] !== " " && pattern[j] !== '"') j++;
    if (j < len && pattern[j] === '"') {
      j++;
      while (j < len) {
        if (pattern[j] === '"') {
          const next = j + 1;
          if (next >= len || pattern[next] === " ") {
            j++;
            break;
          }
          if (pattern[next] === "$" && (next + 1 >= len || pattern[next + 1] === " ")) {
            j += 2;
            break;
          }
        }
        j++;
      }
      tokens.push(pattern.substring(i, j));
      i = j;
    } else {
      while (j < len && pattern[j] !== " ") j++;
      tokens.push(pattern.substring(i, j));
      i = j;
    }
  }
  return tokens;
}
function getMatch(pattern, exp) {
  const matches = pattern.match(exp);
  return matches ? matches[1] : null;
}
function parseQuery(pattern, options = {}) {
  return pattern.replace(/\\\|/g, ESCAPED_PIPE).split(OR_TOKEN).map((item) => {
    const query = tokenize(item.replace(/\u0000/g, "|").trim()).filter((item2) => item2 && !!item2.trim());
    const results = [];
    for (let i = 0, len = query.length; i < len; i += 1) {
      const queryItem = query[i];
      let found = false;
      let idx = -1;
      while (!found && ++idx < matchersLen) {
        const def = matchers[idx];
        const token = getMatch(queryItem, def.multiRegex);
        if (token) {
          results.push(def.create(token, options));
          found = true;
        }
      }
      if (found) continue;
      idx = -1;
      while (++idx < matchersLen) {
        const def = matchers[idx];
        const token = getMatch(queryItem, def.singleRegex);
        if (token) {
          results.push(def.create(token, options));
          break;
        }
      }
    }
    return results;
  });
}
var ExtendedSearch = class {
  constructor(pattern, { isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, includeMatches = Config.includeMatches, minMatchCharLength = Config.minMatchCharLength, ignoreLocation = Config.ignoreLocation, findAllMatches = Config.findAllMatches, location = Config.location, threshold = Config.threshold, distance = Config.distance } = {}) {
    this.query = null;
    this.options = {
      isCaseSensitive,
      ignoreDiacritics,
      includeMatches,
      minMatchCharLength,
      findAllMatches,
      ignoreLocation,
      location,
      threshold,
      distance
    };
    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.query = parseQuery(this.pattern, this.options);
  }
  static condition(_, options) {
    return options.useExtendedSearch;
  }
  searchIn(text) {
    const query = this.query;
    if (!query) return {
      isMatch: false,
      score: 1
    };
    const { includeMatches, isCaseSensitive, ignoreDiacritics } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    let numMatches = 0;
    const allIndices = [];
    let totalScore = 0;
    let hasInverse = false;
    for (let i = 0, qLen = query.length; i < qLen; i += 1) {
      const searchers = query[i];
      allIndices.length = 0;
      numMatches = 0;
      hasInverse = false;
      for (let j = 0, pLen = searchers.length; j < pLen; j += 1) {
        const matcher = searchers[j];
        const { isMatch, indices, score } = matcher.search(text);
        if (isMatch) {
          numMatches += 1;
          totalScore += score;
          if (isInverse(matcher.type)) hasInverse = true;
          if (includeMatches) if (MULTI_MATCH_TYPES.has(matcher.type)) allIndices.push(...indices);
          else allIndices.push(indices);
        } else {
          totalScore = 0;
          numMatches = 0;
          allIndices.length = 0;
          hasInverse = false;
          break;
        }
      }
      if (numMatches) {
        const result = {
          isMatch: true,
          score: totalScore / numMatches
        };
        if (hasInverse) result.hasInverse = true;
        if (includeMatches) result.indices = mergeIndices(allIndices);
        return result;
      }
    }
    return {
      isMatch: false,
      score: 1
    };
  }
};
var registeredSearchers = [];
function register(...args) {
  registeredSearchers.push(...args);
}
function createSearcher(pattern, options) {
  for (let i = 0, len = registeredSearchers.length; i < len; i += 1) {
    const searcherClass = registeredSearchers[i];
    if (searcherClass.condition(pattern, options)) return new searcherClass(pattern, options);
  }
  return new BitapSearch(pattern, options);
}
var LogicalOperator = {
  AND: "$and",
  OR: "$or"
};
var KeyType = {
  PATH: "$path",
  PATTERN: "$val"
};
var isExpression = (query) => !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);
var isPath = (query) => !!query[KeyType.PATH];
var isLeaf = (query) => !isArray(query) && isObject(query) && !isExpression(query);
var convertToExplicit = (query) => ({ [LogicalOperator.AND]: Object.keys(query).map((key) => ({ [key]: query[key] })) });
function parse(query, options, { auto = true } = {}) {
  const next = (query2) => {
    if (isString(query2)) {
      const obj = {
        keyId: null,
        pattern: query2
      };
      if (auto) obj.searcher = createSearcher(query2, options);
      return obj;
    }
    const keys = Object.keys(query2);
    const isQueryPath = isPath(query2);
    if (!isQueryPath && keys.length > 1 && !isExpression(query2)) return next(convertToExplicit(query2));
    if (isLeaf(query2)) {
      const key = isQueryPath ? query2[KeyType.PATH] : keys[0];
      const pattern = isQueryPath ? query2[KeyType.PATTERN] : query2[key];
      if (!isString(pattern)) throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key));
      const obj = {
        keyId: createKeyId(key),
        pattern
      };
      if (auto) obj.searcher = createSearcher(pattern, options);
      return obj;
    }
    const node = {
      children: [],
      operator: keys[0]
    };
    keys.forEach((key) => {
      const value = query2[key];
      if (isArray(value)) value.forEach((item) => {
        node.children.push(next(item));
      });
    });
    return node;
  };
  if (!isExpression(query)) query = convertToExplicit(query);
  return next(query);
}
function computeScoreSingle(matches, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  let totalScore = 1;
  matches.forEach(({ key, norm: norm2, score }) => {
    const weight = key ? key.weight : null;
    totalScore *= Math.pow(score === 0 && weight ? Number.EPSILON : score, (weight || 1) * (ignoreFieldNorm ? 1 : norm2));
  });
  return totalScore;
}
function computeScore(results, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  results.forEach((result) => {
    result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
  });
}
var MaxHeap = class {
  constructor(limit) {
    this.limit = limit;
    this.heap = [];
  }
  get size() {
    return this.heap.length;
  }
  shouldInsert(score) {
    return this.size < this.limit || score < this.heap[0].score;
  }
  insert(item) {
    if (this.size < this.limit) {
      this.heap.push(item);
      this._bubbleUp(this.size - 1);
    } else if (item.score < this.heap[0].score) {
      this.heap[0] = item;
      this._sinkDown(0);
    }
  }
  extractSorted(sortFn) {
    return this.heap.sort(sortFn);
  }
  _bubbleUp(i) {
    const heap = this.heap;
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (heap[i].score <= heap[parent].score) break;
      const tmp = heap[i];
      heap[i] = heap[parent];
      heap[parent] = tmp;
      i = parent;
    }
  }
  _sinkDown(i) {
    const heap = this.heap;
    const len = heap.length;
    let largest = i;
    do {
      i = largest;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < len && heap[left].score > heap[largest].score) largest = left;
      if (right < len && heap[right].score > heap[largest].score) largest = right;
      if (largest !== i) {
        const tmp = heap[i];
        heap[i] = heap[largest];
        heap[largest] = tmp;
      }
    } while (largest !== i);
  }
};
function formatMatches(result) {
  const matches = [];
  result.matches.forEach((match) => {
    if (!isDefined(match.indices) || !match.indices.length) return;
    const obj = {
      indices: match.indices,
      value: match.value
    };
    if (match.key) obj.key = match.key.id;
    if (match.idx > -1) obj.refIndex = match.idx;
    matches.push(obj);
  });
  return matches;
}
function format(results, docs, { includeMatches = Config.includeMatches, includeScore = Config.includeScore } = {}) {
  return results.map((result) => {
    const { idx } = result;
    const data = {
      item: docs[idx],
      refIndex: idx
    };
    if (includeMatches) data.matches = formatMatches(result);
    if (includeScore) data.score = result.score;
    return data;
  });
}
var DEFAULT_TOKEN = /[\p{L}\p{M}\p{N}_]+/gu;
var warned = /* @__PURE__ */ new WeakSet();
function warnNonGlobal(regex) {
  if (!warned.has(regex)) {
    warned.add(regex);
    console.warn(`[Fuse] tokenize regex ${regex} lacks the global flag; only the first match per text will be returned. Add the 'g' flag.`);
  }
}
function resolveTokenize(tokenize2) {
  if (typeof tokenize2 === "function") {
    let validated = false;
    return (text) => {
      const result = tokenize2(text);
      if (!validated) {
        validated = true;
        if (!Array.isArray(result) || result.some((t) => typeof t !== "string")) throw new Error(`[Fuse] tokenize function must return string[]; received ${Array.isArray(result) ? "array containing non-strings" : typeof result}.`);
      }
      return result;
    };
  }
  if (tokenize2 instanceof RegExp) {
    if (!tokenize2.global) warnNonGlobal(tokenize2);
    return (text) => text.match(tokenize2) || [];
  }
  return (text) => text.match(DEFAULT_TOKEN) || [];
}
function createAnalyzer({ isCaseSensitive = false, ignoreDiacritics = false, tokenize: tokenize2 } = {}) {
  const tokenizeFn = resolveTokenize(tokenize2);
  return { tokenize(text) {
    if (!isCaseSensitive) text = text.toLowerCase();
    if (ignoreDiacritics) text = stripDiacritics(text);
    return tokenizeFn(text);
  } };
}
var TokenSearch = class {
  static condition(_, options) {
    return options.useTokenSearch;
  }
  constructor(pattern, options) {
    this.options = options;
    this.analyzer = createAnalyzer({
      isCaseSensitive: options.isCaseSensitive,
      ignoreDiacritics: options.ignoreDiacritics,
      tokenize: options.tokenize
    });
    const queryTerms = this.analyzer.tokenize(pattern);
    const { df, fieldCount } = options._invertedIndex;
    this.termSearchers = [];
    this.idfWeights = [];
    for (const term of queryTerms) {
      this.termSearchers.push(new BitapSearch(term, {
        location: options.location,
        threshold: options.threshold,
        distance: options.distance,
        includeMatches: options.includeMatches,
        findAllMatches: options.findAllMatches,
        minMatchCharLength: options.minMatchCharLength,
        isCaseSensitive: options.isCaseSensitive,
        ignoreDiacritics: options.ignoreDiacritics,
        ignoreLocation: true
      }));
      const docFreq = df.get(term) || 0;
      const idf = Math.log(1 + (fieldCount - docFreq + 0.5) / (docFreq + 0.5));
      this.idfWeights.push(idf);
    }
    this.combineAll = options.tokenMatch === "all";
    this.numTerms = this.termSearchers.length;
    this.useMask = this.numTerms <= 31;
  }
  searchIn(text) {
    if (!this.termSearchers.length) return {
      isMatch: false,
      score: 1
    };
    const allIndices = [];
    let weightedScore = 0;
    let maxPossibleScore = 0;
    let matchedCount = 0;
    let matchedMask = 0;
    const matchedTerms = this.combineAll && !this.useMask ? /* @__PURE__ */ new Set() : null;
    for (let i = 0; i < this.termSearchers.length; i++) {
      const result = this.termSearchers[i].searchIn(text);
      const idf = this.idfWeights[i];
      maxPossibleScore += idf;
      if (result.isMatch) {
        matchedCount++;
        weightedScore += idf * (1 - result.score);
        if (result.indices) allIndices.push(...result.indices);
        if (this.combineAll) if (this.useMask) matchedMask |= 1 << i;
        else matchedTerms.add(i);
      }
    }
    if (matchedCount === 0) return {
      isMatch: false,
      score: 1
    };
    const normalized = maxPossibleScore > 0 ? 1 - weightedScore / maxPossibleScore : 0;
    const searchResult = {
      isMatch: true,
      score: Math.max(1e-3, normalized)
    };
    if (this.options.includeMatches && allIndices.length) searchResult.indices = mergeIndices(allIndices);
    if (this.combineAll) {
      if (this.useMask) searchResult.matchedMask = matchedMask;
      else searchResult.matchedTerms = matchedTerms;
      searchResult.termCount = this.numTerms;
    }
    return searchResult;
  }
};
function addField(index, text, docIdx, analyzer) {
  const tokens = analyzer.tokenize(text);
  if (!tokens.length) return;
  index.fieldCount++;
  index.docFieldCount.set(docIdx, (index.docFieldCount.get(docIdx) || 0) + 1);
  const distinctTerms = new Set(tokens);
  let perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms) {
    perDocTerms = /* @__PURE__ */ new Map();
    index.docTermFieldHits.set(docIdx, perDocTerms);
  }
  for (const term of distinctTerms) {
    perDocTerms.set(term, (perDocTerms.get(term) || 0) + 1);
    index.df.set(term, (index.df.get(term) || 0) + 1);
  }
}
function ingestRecord(index, record, keyCount, analyzer) {
  const { i: docIdx, v, $: fields } = record;
  if (v !== void 0) {
    addField(index, v, docIdx, analyzer);
    return;
  }
  if (!fields) return;
  for (let keyIdx = 0; keyIdx < keyCount; keyIdx++) {
    const value = fields[keyIdx];
    if (!value) continue;
    if (Array.isArray(value)) for (const sub of value) addField(index, sub.v, docIdx, analyzer);
    else addField(index, value.v, docIdx, analyzer);
  }
}
function buildInvertedIndex(records, keyCount, analyzer) {
  const index = {
    fieldCount: 0,
    df: /* @__PURE__ */ new Map(),
    docFieldCount: /* @__PURE__ */ new Map(),
    docTermFieldHits: /* @__PURE__ */ new Map()
  };
  for (const record of records) ingestRecord(index, record, keyCount, analyzer);
  return index;
}
function addToInvertedIndex(index, record, keyCount, analyzer) {
  ingestRecord(index, record, keyCount, analyzer);
}
function removeFromInvertedIndex(index, docIdx) {
  const fieldCount = index.docFieldCount.get(docIdx);
  if (fieldCount === void 0) return;
  index.fieldCount -= fieldCount;
  index.docFieldCount.delete(docIdx);
  const perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms) return;
  for (const [term, hits] of perDocTerms) {
    const next = (index.df.get(term) || 0) - hits;
    if (next <= 0) index.df.delete(term);
    else index.df.set(term, next);
  }
  index.docTermFieldHits.delete(docIdx);
}
function removeAndShiftInvertedIndex(index, removedIndices) {
  if (removedIndices.length === 0) return;
  const sorted = Array.from(new Set(removedIndices)).sort((a, b) => a - b);
  for (const idx of sorted) removeFromInvertedIndex(index, idx);
  const shift = (oldIdx) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (sorted[mid] < oldIdx) lo = mid + 1;
      else hi = mid;
    }
    return oldIdx - lo;
  };
  const firstRemoved = sorted[0];
  const shiftedDocFieldCount = /* @__PURE__ */ new Map();
  for (const [oldKey, count] of index.docFieldCount) shiftedDocFieldCount.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, count);
  index.docFieldCount = shiftedDocFieldCount;
  const shiftedDocTermFieldHits = /* @__PURE__ */ new Map();
  for (const [oldKey, terms] of index.docTermFieldHits) shiftedDocTermFieldHits.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, terms);
  index.docTermFieldHits = shiftedDocTermFieldHits;
}
var Fuse = class {
  constructor(docs, options, index) {
    this.options = {
      ...Config,
      ...options
    };
    if (this.options.useExtendedSearch && false) ;
    if (this.options.useTokenSearch && false) ;
    this._keyStore = new KeyStore(this.options.keys);
    this._docs = docs;
    this._myIndex = null;
    this._invertedIndex = null;
    this.setCollection(docs, index);
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  _getSearcher(query) {
    if (this._lastQuery === query) return this._lastSearcher;
    const searcher = createSearcher(query, this._invertedIndex ? {
      ...this.options,
      _invertedIndex: this._invertedIndex
    } : this.options);
    this._lastQuery = query;
    this._lastSearcher = searcher;
    return searcher;
  }
  setCollection(docs, index) {
    this._docs = docs;
    if (index && !(index instanceof FuseIndex)) throw new Error(INCORRECT_INDEX_TYPE);
    this._myIndex = index || createIndex(this.options.keys, this._docs, {
      getFn: this.options.getFn,
      fieldNormWeight: this.options.fieldNormWeight
    });
    if (this.options.useTokenSearch) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      this._invertedIndex = buildInvertedIndex(this._myIndex.records, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  add(doc) {
    if (!isDefined(doc)) return;
    this._docs.push(doc);
    const record = this._myIndex.add(doc, this._docs.length - 1);
    if (this._invertedIndex && record) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      addToInvertedIndex(this._invertedIndex, record, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  remove(predicate = () => false) {
    const results = [];
    const indicesToRemove = [];
    for (let i = 0, len = this._docs.length; i < len; i += 1) if (predicate(this._docs[i], i)) {
      results.push(this._docs[i]);
      indicesToRemove.push(i);
    }
    if (indicesToRemove.length) {
      if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, indicesToRemove);
      const toRemove = new Set(indicesToRemove);
      this._docs = this._docs.filter((_, i) => !toRemove.has(i));
      this._myIndex.removeAll(indicesToRemove);
      this._invalidateSearcherCache();
    }
    return results;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this._docs.length) throw new Error(INVALID_DOC_INDEX);
    if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, [idx]);
    const doc = this._docs.splice(idx, 1)[0];
    this._myIndex.removeAt(idx);
    this._invalidateSearcherCache();
    return doc;
  }
  _invalidateSearcherCache() {
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  getIndex() {
    return this._myIndex;
  }
  search(query, options) {
    const { limit = -1 } = options || {};
    const { includeMatches, includeScore, shouldSort, sortFn, ignoreFieldNorm } = this.options;
    if (isString(query) && !query.trim()) {
      let docs = this._docs.map((item, idx) => ({
        item,
        refIndex: idx
      }));
      if (isNumber(limit) && limit > -1) docs = docs.slice(0, limit);
      return docs;
    }
    const useHeap = isNumber(limit) && limit > 0 && isString(query);
    let results;
    if (useHeap) {
      const heap = new MaxHeap(limit);
      if (isString(this._docs[0])) this._searchStringList(query, {
        heap,
        ignoreFieldNorm
      });
      else this._searchObjectList(query, {
        heap,
        ignoreFieldNorm
      });
      results = heap.extractSorted(sortFn);
    } else {
      results = isString(query) ? isString(this._docs[0]) ? this._searchStringList(query) : this._searchObjectList(query) : this._searchLogical(query);
      computeScore(results, { ignoreFieldNorm });
      if (shouldSort) results.sort(sortFn);
      if (isNumber(limit) && limit > -1) results = results.slice(0, limit);
    }
    return format(results, this._docs, {
      includeMatches,
      includeScore
    });
  }
  _searchStringList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { records } = this._myIndex;
    const results = heap ? null : [];
    records.forEach(({ v: text, i: idx, n: norm2 }) => {
      if (!isDefined(text)) return;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          value: text,
          norm: norm2,
          indices: searchResult.indices
        };
        if (requireAllTokens) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        const matches = [match];
        if (!requireAllTokens || this._coversAllTokens(matches)) {
          const result = {
            item: text,
            idx,
            matches
          };
          if (heap) {
            result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
            if (heap.shouldInsert(result.score)) heap.insert(result);
          } else results.push(result);
        }
      }
    });
    return results;
  }
  _searchLogical(query) {
    const expression = parse(query, this.options);
    const evaluate = (node, item, idx) => {
      if (!("children" in node)) {
        const { keyId, searcher } = node;
        let matches;
        if (keyId === null) {
          matches = [];
          this._myIndex.keys.forEach((key, keyIndex) => {
            matches.push(...this._findMatches({
              key,
              value: item[keyIndex],
              searcher
            }));
          });
        } else matches = this._findMatches({
          key: this._keyStore.get(keyId),
          value: this._myIndex.getValueForItemAtKeyId(item, keyId),
          searcher
        });
        if (matches && matches.length) return [{
          idx,
          item,
          matches
        }];
        return [];
      }
      const { children, operator } = node;
      const res = [];
      for (let i = 0, len = children.length; i < len; i += 1) {
        const child = children[i];
        const result = evaluate(child, item, idx);
        if (result.length) res.push(...result);
        else if (operator === LogicalOperator.AND) return [];
      }
      return res;
    };
    const records = this._myIndex.records;
    const resultMap = /* @__PURE__ */ new Map();
    const results = [];
    records.forEach(({ $: item, i: idx }) => {
      if (isDefined(item)) {
        const expResults = evaluate(expression, item, idx);
        if (expResults.length) {
          if (!resultMap.has(idx)) {
            resultMap.set(idx, {
              idx,
              item,
              matches: []
            });
            results.push(resultMap.get(idx));
          }
          expResults.forEach(({ matches }) => {
            resultMap.get(idx).matches.push(...matches);
          });
        }
      }
    });
    return results;
  }
  _searchObjectList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { keys, records } = this._myIndex;
    const results = heap ? null : [];
    records.forEach(({ $: item, i: idx }) => {
      if (!isDefined(item)) return;
      const matches = [];
      let anyKeyFailed = false;
      let hasInverse = false;
      keys.forEach((key, keyIndex) => {
        const keyMatches = this._findMatches({
          key,
          value: item[keyIndex],
          searcher
        });
        if (keyMatches.length) {
          matches.push(...keyMatches);
          if (keyMatches[0].hasInverse) hasInverse = true;
        } else anyKeyFailed = true;
      });
      if (hasInverse && anyKeyFailed) return;
      if (matches.length && (!requireAllTokens || this._coversAllTokens(matches))) {
        const result = {
          idx,
          item,
          matches
        };
        if (heap) {
          result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
          if (heap.shouldInsert(result.score)) heap.insert(result);
        } else results.push(result);
      }
    });
    return results;
  }
  _findMatches({ key, value, searcher }) {
    if (!isDefined(value)) return [];
    const matches = [];
    if (isArray(value)) value.forEach(({ v: text, i: idx, n: norm2 }) => {
      if (!isDefined(text)) return;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          key,
          value: text,
          idx,
          norm: norm2,
          indices: searchResult.indices,
          hasInverse: searchResult.hasInverse
        };
        if (searchResult.termCount !== void 0) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        matches.push(match);
      }
    });
    else {
      const { v: text, n: norm2 } = value;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          key,
          value: text,
          norm: norm2,
          indices: searchResult.indices,
          hasInverse: searchResult.hasInverse
        };
        if (searchResult.termCount !== void 0) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        matches.push(match);
      }
    }
    return matches;
  }
  _coversAllTokens(matches) {
    const termCount = matches.length ? matches[0].termCount : void 0;
    if (termCount === void 0) return true;
    if (termCount <= 31) {
      let coverage2 = 0;
      for (let i = 0; i < matches.length; i++) coverage2 |= matches[i].matchedMask || 0;
      return coverage2 === 2 ** termCount - 1;
    }
    const coverage = /* @__PURE__ */ new Set();
    for (let i = 0; i < matches.length; i++) {
      const terms = matches[i].matchedTerms;
      if (terms) for (const t of terms) coverage.add(t);
    }
    return coverage.size === termCount;
  }
};
Fuse.version = "7.4.2";
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;
Fuse.match = function(pattern, text, options) {
  if (options && options.useTokenSearch) throw new Error(FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED);
  return createSearcher(pattern, {
    ...Config,
    ...options
  }).searchIn(text);
};
Fuse.parseQuery = parse;
register(ExtendedSearch);
register(TokenSearch);
Fuse.use = function(...plugins) {
  plugins.forEach((plugin) => register(plugin));
};
var entry_default = Fuse;

// src/engine/FilterEngine.ts
var FilterEngine = class {
  constructor() {
    this.fuse = null;
  }
  // ----------------------------------------------------------
  // インデックス更新
  // ----------------------------------------------------------
  buildIndex(events) {
    this.fuse = new entry_default(events, {
      keys: ["displayTitle", "summary"],
      threshold: 0.4,
      // 曖昧さの許容度（0=完全一致, 1=何でも一致）
      distance: 200,
      includeScore: false,
      useExtendedSearch: false
    });
  }
  // ----------------------------------------------------------
  // フィルタ適用
  // ----------------------------------------------------------
  /**
   * FilterState に基づいてイベント一覧を絞り込む
   *
   * 条件:
   *   - searchQuery:    displayTitle または summary に曖昧一致
   *   - characters:     選択された人物のいずれかが含まれる（OR）
   *   - locations:      選択された場所のいずれかが含まれる（OR）
   *   - カテゴリ間:      AND
   */
  apply(events, filter) {
    let result = events;
    if (filter.searchQuery.trim() !== "" && this.fuse) {
      const searchResults = this.fuse.search(filter.searchQuery.trim());
      const matchedIds = new Set(searchResults.map((r) => r.item.id));
      result = result.filter((e) => matchedIds.has(e.id));
    }
    if (filter.characters.size > 0) {
      result = result.filter(
        (e) => e.characters.some((c) => filter.characters.has(c))
      );
    }
    if (filter.locations.size > 0) {
      result = result.filter(
        (e) => e.locations.some((l) => filter.locations.has(l))
      );
    }
    return result;
  }
  // ----------------------------------------------------------
  // フィルタ選択肢一覧の生成
  // ----------------------------------------------------------
  /** 全イベントから登場人物の重複なし一覧を返す */
  allCharacters(events) {
    const set = /* @__PURE__ */ new Set();
    for (const e of events) {
      for (const c of e.characters) set.add(c);
    }
    return Array.from(set).sort();
  }
  /** 全イベントから場所の重複なし一覧を返す */
  allLocations(events) {
    const set = /* @__PURE__ */ new Set();
    for (const e of events) {
      for (const l of e.locations) set.add(l);
    }
    return Array.from(set).sort();
  }
};

// src/view/Tooltip.ts
var Tooltip = class {
  constructor(_container) {
    this.el = document.body.createDiv({ cls: "ntj-tooltip" });
  }
  show(event, nodeColor, mouseX, mouseY) {
    this.el.empty();
    this.el.style.borderLeft = `3px solid ${nodeColor || "var(--interactive-accent)"}`;
    this.el.createEl("div", { cls: "ntj-tooltip-title", text: event.displayTitle });
    const dateRow = this.el.createEl("div", { cls: "ntj-tooltip-row" });
    dateRow.createSpan({ cls: "ntj-tooltip-icon", text: "\u{1F4C5}" });
    dateRow.createSpan({ text: event.date || "\u4E0D\u660E" });
    if (event.characters.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-icon", text: "\u{1F464}" });
      row.createSpan({ text: event.characters.length > 1 ? `${event.characters[0]}\u2026\u4ED6` : event.characters[0] });
    }
    if (event.locations.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-icon", text: "\u{1F4CD}" });
      row.createSpan({ text: event.locations.length > 1 ? `${event.locations[0]}\u2026\u4ED6` : event.locations[0] });
    }
    if (event.summary) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row ntj-tooltip-summary" });
      row.createSpan({ cls: "ntj-tooltip-icon", text: "\u{1F4DD}" });
      row.createSpan({
        cls: "ntj-tooltip-summary-text",
        text: event.summary.replace(/_LineBreak_/g, "\n")
      });
    }
    this.el.style.left = `${mouseX}px`;
    this.el.style.top = `${mouseY}px`;
    this.el.toggleClass("is-visible", true);
  }
  move(mouseX, mouseY) {
    if (!this.el.hasClass("is-visible")) return;
    this.el.style.left = `${mouseX}px`;
    this.el.style.top = `${mouseY}px`;
  }
  hide() {
    this.el.toggleClass("is-visible", false);
  }
  /** プラグインアンロード時に DOM を片付ける */
  destroy() {
    this.el.remove();
  }
};

// src/view/GapRenderer.ts
var import_obsidian2 = require("obsidian");
var SVG_NS = "http://www.w3.org/2000/svg";
var GapRenderer = class {
  /**
   * @param gap        Gapセグメント（gap.y は時間軸上のSVG Y座標）
   * @param axisX      時間軸（垂直線）のSVG X座標
   * @param gapColW    GAP専用列の幅（axisXから右に確保された帯の幅）
   * @param slotHeight このGapに割り当てられた縦幅（Layout側の配置高さと一致させる）。
   *                   カードの縦幅はこの範囲を超えないようにする（GAP同士の重なり防止）。
   *                   カードの横幅は常にGAP列の幅に収まるようクランプし、
   *                   文字が収まらない場合はフォントサイズを縮小して対応する。
   */
  render(gap, axisX, gapColW, slotHeight) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "ntj-gap");
    const y = gap.y;
    const cardX = axisX + gapColW / 2 + 4;
    const iconId = gap.expanded ? "chevrons-down-up" : "chevrons-up-down";
    const labelText = gap.label;
    const PADDING = 10;
    const ICON_SIZE = 12;
    const ICON_GAP = 3;
    const minFont = 7;
    const maxFont = 11;
    const labelW = Math.max(28, gapColW - 8);
    const charWidthRatio = 0.62;
    let fontSize = Math.min(
      maxFont,
      (labelW - PADDING - ICON_SIZE - ICON_GAP) / Math.max(1, labelText.length) / charWidthRatio
    );
    fontSize = Math.max(minFont, fontSize);
    const labelH = Math.min(22, Math.max(14, slotHeight - 4));
    const nodeR = 5;
    const dx = nodeR;
    const dy = nodeR;
    const diamond = document.createElementNS(SVG_NS, "polygon");
    const pts = [
      `${axisX},${y - dy}`,
      `${axisX + dx},${y}`,
      `${axisX},${y + dy}`,
      `${axisX - dx},${y}`
    ].join(" ");
    diamond.setAttribute("points", pts);
    diamond.setAttribute("fill", "var(--background-secondary)");
    diamond.setAttribute("stroke", "var(--text-muted)");
    diamond.setAttribute("stroke-width", "1.5");
    g.appendChild(diamond);
    const lineX1 = axisX + dx;
    const lineX2 = cardX - labelW / 2;
    const connector = document.createElementNS(SVG_NS, "line");
    connector.setAttribute("x1", String(lineX1));
    connector.setAttribute("y1", String(y));
    connector.setAttribute("x2", String(lineX2));
    connector.setAttribute("y2", String(y));
    connector.setAttribute("stroke", "var(--text-muted)");
    connector.setAttribute("stroke-width", "1");
    g.appendChild(connector);
    const shadow = document.createElementNS(SVG_NS, "rect");
    shadow.setAttribute("x", String(cardX - labelW / 2 + 2));
    shadow.setAttribute("y", String(y - labelH / 2 + 2));
    shadow.setAttribute("width", String(labelW));
    shadow.setAttribute("height", String(labelH));
    shadow.setAttribute("rx", "6");
    shadow.setAttribute("fill", "rgba(0,0,0,0.18)");
    g.appendChild(shadow);
    const card = document.createElementNS(SVG_NS, "rect");
    card.setAttribute("x", String(cardX - labelW / 2));
    card.setAttribute("y", String(y - labelH / 2));
    card.setAttribute("width", String(labelW));
    card.setAttribute("height", String(labelH));
    card.setAttribute("rx", "6");
    card.setAttribute("fill", "var(--background-secondary)");
    card.setAttribute("stroke", "var(--background-modifier-border)");
    card.setAttribute("stroke-width", "0.8");
    g.appendChild(card);
    const highlight = document.createElementNS(SVG_NS, "rect");
    highlight.setAttribute("x", String(cardX - labelW / 2 + 2));
    highlight.setAttribute("y", String(y - labelH / 2 + 1));
    highlight.setAttribute("width", String(labelW - 4));
    highlight.setAttribute("height", "1");
    highlight.setAttribute("rx", "1");
    highlight.setAttribute("fill", "var(--background-primary)");
    highlight.setAttribute("fill-opacity", "0.5");
    g.appendChild(highlight);
    const textWidthEstimate = labelText.length * fontSize * charWidthRatio;
    const groupWidth = ICON_SIZE + ICON_GAP + textWidthEstimate;
    const groupStartX = cardX - groupWidth / 2;
    const icon = (0, import_obsidian2.getIcon)(iconId);
    if (icon) {
      icon.setAttribute("width", String(ICON_SIZE));
      icon.setAttribute("height", String(ICON_SIZE));
      icon.setAttribute("x", String(groupStartX));
      icon.setAttribute("y", String(y - ICON_SIZE / 2));
      icon.setAttribute("stroke", "var(--text-muted)");
      g.appendChild(icon);
    }
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(groupStartX + ICON_SIZE + ICON_GAP));
    text.setAttribute("y", String(y));
    text.setAttribute("text-anchor", "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", String(fontSize.toFixed(1)));
    text.setAttribute("font-weight", "500");
    text.setAttribute("fill", "var(--text-muted)");
    text.textContent = labelText;
    g.appendChild(text);
    return g;
  }
};

// src/view/TimelineRenderer.ts
var SVG_NS2 = "http://www.w3.org/2000/svg";
var COLOR = {
  nodeStroke: "var(--text-normal)",
  nodeFiltered: "var(--background-modifier-border)",
  nodeTextLight: "#ffffff",
  errorIcon: "var(--text-error)",
  calendarHeader: "var(--text-accent)"
};
var TimelineRenderer = class {
  constructor(container) {
    this._lastLaneCount = 10;
    // render() で更新、drag時に参照
    this.dragState = { active: false, eventId: "", startX: 0, circle: null, originalLane: 1 };
    this.container = container;
    this.svg = document.createElementNS(SVG_NS2, "svg");
    this.svg.setAttribute("xmlns", SVG_NS2);
    container.appendChild(this.svg);
    this.tooltip = new Tooltip(container);
    this.gapRenderer = new GapRenderer();
  }
  // ----------------------------------------------------------
  // メイン描画
  // ----------------------------------------------------------
  render(ctx) {
    var _a;
    const { settings, totalWidth, totalHeight, virtualWindow } = ctx;
    this.tooltip.hide();
    const laneCount = Math.max(LANE_MIN, settings.laneCount);
    const headerH = HEADER_H;
    const gapColW = GAP_COL_W;
    const lanesStartX = LANES_START_X;
    const colW = LANE_COL_W;
    const axisX = AXIS_X;
    this._lastLaneCount = laneCount;
    this.svg.setAttribute("viewBox", `0 0 ${totalWidth} ${totalHeight}`);
    this.svg.setAttribute("width", String(totalWidth));
    this.svg.setAttribute("height", String(totalHeight));
    this.svg.style.minWidth = `${totalWidth}px`;
    this.svg.style.minHeight = `${totalHeight}px`;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const buffer = settings.virtualRendering ? virtualWindow.buffer : Infinity;
    const visTop = virtualWindow.scrollTop - buffer;
    const visBottom = virtualWindow.scrollTop + virtualWindow.viewportHeight + buffer;
    const visLeft = virtualWindow.scrollLeft - buffer;
    const visRight = virtualWindow.scrollLeft + virtualWindow.viewportWidth + buffer;
    const defs = document.createElementNS(SVG_NS2, "defs");
    this.svg.appendChild(defs);
    this.drawLaneColumns(totalHeight, lanesStartX, colW, laneCount);
    this.drawGapColumnBackground(totalHeight, axisX, gapColW);
    this.drawTimeAxis(axisX, totalHeight);
    if (settings.gapCompression) {
      this.drawGaps(ctx, visTop, visBottom, axisX, gapColW);
    }
    this.drawRelations(ctx, visTop, visBottom);
    this.drawNodes(ctx, visTop, visBottom, visLeft, visRight);
    this.drawDateColumn(ctx, visTop, visBottom, virtualWindow.scrollLeft);
    this.drawLaneHeaderRow(lanesStartX, colW, laneCount, headerH, virtualWindow.scrollTop);
    this.drawCornerHeader(virtualWindow.scrollLeft, virtualWindow.scrollTop, headerH, (_a = settings.calendar.name) != null ? _a : "");
    this.svg.oncontextmenu = (e) => {
      e.preventDefault();
      const svgX = this.clientXToSvgX(e.clientX);
      const lane = this.svgXToLane(svgX, laneCount);
      ctx.onContextMenu(this.clientYToSvgY(e.clientY), e.clientX, e.clientY, lane);
    };
    this.svg.onmousemove = (e) => {
      this.tooltip.move(e.clientX, e.clientY);
      this.onDragMove(e, ctx);
    };
    this.svg.onmouseup = (e) => this.onDragEnd(e, ctx);
  }
  // ----------------------------------------------------------
  // GAP専用列の背景（時間軸とレーン列の間の帯）
  // ----------------------------------------------------------
  drawGapColumnBackground(totalHeight, axisX, gapColW) {
    const bg = document.createElementNS(SVG_NS2, "rect");
    bg.setAttribute("x", String(axisX));
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(gapColW));
    bg.setAttribute("height", String(totalHeight));
    bg.setAttribute("fill", "var(--background-secondary-alt)");
    bg.setAttribute("fill-opacity", "0.4");
    this.svg.appendChild(bg);
    const rightLine = document.createElementNS(SVG_NS2, "line");
    rightLine.setAttribute("x1", String(axisX + gapColW));
    rightLine.setAttribute("y1", "0");
    rightLine.setAttribute("x2", String(axisX + gapColW));
    rightLine.setAttribute("y2", String(totalHeight));
    rightLine.setAttribute("stroke", "var(--background-modifier-border)");
    rightLine.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(rightLine);
  }
  // ----------------------------------------------------------
  // レーン列の背景（縞模様）と区切り線
  // ----------------------------------------------------------
  drawLaneColumns(totalHeight, lanesStartX, colW, lanes) {
    for (let i = 0; i < lanes; i++) {
      const x = lanesStartX + i * colW;
      if (i % 2 === 1) {
        const bg = document.createElementNS(SVG_NS2, "rect");
        bg.setAttribute("x", String(x));
        bg.setAttribute("y", "0");
        bg.setAttribute("width", String(colW));
        bg.setAttribute("height", String(totalHeight));
        bg.setAttribute("fill", "var(--background-secondary)");
        bg.setAttribute("fill-opacity", "0.5");
        this.svg.appendChild(bg);
      }
      const line = document.createElementNS(SVG_NS2, "line");
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", "0");
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(totalHeight));
      line.setAttribute("stroke", "var(--background-modifier-border)");
      line.setAttribute("stroke-width", "0.5");
      this.svg.appendChild(line);
    }
    const rightX = lanesStartX + lanes * colW;
    const rightLine = document.createElementNS(SVG_NS2, "line");
    rightLine.setAttribute("x1", String(rightX));
    rightLine.setAttribute("y1", "0");
    rightLine.setAttribute("x2", String(rightX));
    rightLine.setAttribute("y2", String(totalHeight));
    rightLine.setAttribute("stroke", "var(--background-modifier-border)");
    rightLine.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(rightLine);
  }
  // ----------------------------------------------------------
  // 時間軸（垂直線）— 帯背景 + 中央線
  // ----------------------------------------------------------
  drawTimeAxis(axisX, totalHeight) {
    let defs = this.svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(SVG_NS2, "defs");
      this.svg.insertBefore(defs, this.svg.firstChild);
    }
    const gradId = "ntj-axis-grad";
    if (!defs.querySelector(`#${gradId}`)) {
      const grad = document.createElementNS(SVG_NS2, "linearGradient");
      grad.setAttribute("id", gradId);
      grad.setAttribute("x1", "0%");
      grad.setAttribute("y1", "0%");
      grad.setAttribute("x2", "100%");
      grad.setAttribute("y2", "0%");
      for (const [offset, opacity] of [["0%", "0"], ["50%", "0.12"], ["100%", "0"]]) {
        const stop = document.createElementNS(SVG_NS2, "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", "var(--interactive-accent)");
        stop.setAttribute("stop-opacity", opacity);
        grad.appendChild(stop);
      }
      defs.appendChild(grad);
    }
    const band = document.createElementNS(SVG_NS2, "rect");
    band.setAttribute("x", String(axisX - 8));
    band.setAttribute("y", "0");
    band.setAttribute("width", "16");
    band.setAttribute("height", String(totalHeight));
    band.setAttribute("fill", `url(#${gradId})`);
    this.svg.appendChild(band);
    const line = document.createElementNS(SVG_NS2, "line");
    line.setAttribute("x1", String(axisX));
    line.setAttribute("y1", "0");
    line.setAttribute("x2", String(axisX));
    line.setAttribute("y2", String(totalHeight));
    line.setAttribute("stroke", "var(--interactive-accent)");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-opacity", "0.5");
    this.svg.appendChild(line);
  }
  // ----------------------------------------------------------
  // 年・月ラベル（左側固定列。スクロール追従で常に左端固定表示）
  // ----------------------------------------------------------
  drawDateColumn(ctx, visTop, visBottom, scrollLeft) {
    const { dateRows, virtualWindow } = ctx;
    const bg = document.createElementNS(SVG_NS2, "rect");
    bg.setAttribute("x", String(scrollLeft));
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(YEAR_COL_W + MONTH_COL_W));
    bg.setAttribute("height", String(ctx.totalHeight));
    bg.setAttribute("fill", "var(--background-primary-alt)");
    this.svg.appendChild(bg);
    if (dateRows.length === 0) return;
    const stickyX = scrollLeft;
    void virtualWindow;
    let prevYear = -1;
    let prevMonth = -1;
    for (const row of dateRows) {
      if (row.y < visTop - 60 || row.y > visBottom + 60) {
        prevYear = row.year;
        prevMonth = row.month;
        continue;
      }
      if (row.year !== prevYear) {
        this.drawYearCell(row.year, row.y, stickyX);
        prevYear = row.year;
        prevMonth = -1;
      }
      if (row.month !== prevMonth) {
        this.drawMonthCell(row.monthLabel, row.y, stickyX);
        prevMonth = row.month;
      }
    }
  }
  /** 年表示（枠なし・年列の幅ぶんだけ区切り線を引く） */
  drawYearCell(year, y, stickyX) {
    const label = `${year}\u5E74`;
    const line = document.createElementNS(SVG_NS2, "line");
    line.setAttribute("x1", String(stickyX + 4));
    line.setAttribute("y1", String(y));
    line.setAttribute("x2", String(stickyX + YEAR_COL_W));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "var(--text-muted)");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-opacity", "0.4");
    this.svg.appendChild(line);
    const text = document.createElementNS(SVG_NS2, "text");
    text.setAttribute("x", String(stickyX + 5));
    text.setAttribute("y", String(y - 6));
    text.setAttribute("text-anchor", "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-weight", "700");
    text.setAttribute("fill", "var(--text-normal)");
    text.textContent = label;
    this.svg.appendChild(text);
  }
  /** 月表示（枠なし・月列の幅ぶんだけ区切り線を引く） */
  drawMonthCell(monthLabel, y, stickyX) {
    const colX = stickyX + YEAR_COL_W;
    const line = document.createElementNS(SVG_NS2, "line");
    line.setAttribute("x1", String(colX));
    line.setAttribute("y1", String(y));
    line.setAttribute("x2", String(colX + MONTH_COL_W));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "var(--text-muted)");
    line.setAttribute("stroke-width", "0.6");
    line.setAttribute("stroke-opacity", "0.25");
    line.setAttribute("stroke-dasharray", "3 4");
    this.svg.appendChild(line);
    const text = document.createElementNS(SVG_NS2, "text");
    text.setAttribute("x", String(colX + 5));
    text.setAttribute("y", String(y - 6));
    text.setAttribute("text-anchor", "start");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-weight", "500");
    text.setAttribute("fill", "var(--text-muted)");
    text.textContent = monthLabel;
    this.svg.appendChild(text);
  }
  // ----------------------------------------------------------
  // レーン番号ヘッダー行（上部固定。スクロール追従で常に上端固定表示）
  // ----------------------------------------------------------
  drawLaneHeaderRow(lanesStartX, colW, lanes, headerH, scrollTop) {
    const rowY = scrollTop;
    const bg = document.createElementNS(SVG_NS2, "rect");
    bg.setAttribute("x", String(lanesStartX));
    bg.setAttribute("y", String(rowY));
    bg.setAttribute("width", String(lanes * colW));
    bg.setAttribute("height", String(headerH));
    bg.setAttribute("fill", "var(--background-primary-alt)");
    this.svg.appendChild(bg);
    for (let i = 0; i < lanes; i++) {
      const lane = LANE_MIN + i;
      const x = lanesStartX + i * colW + colW / 2;
      const text = document.createElementNS(SVG_NS2, "text");
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(rowY + headerH / 2));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("font-size", "12");
      text.setAttribute("fill", "var(--text-muted)");
      text.textContent = `\u30EC\u30FC\u30F3${lane}`;
      this.svg.appendChild(text);
    }
    const bline = document.createElementNS(SVG_NS2, "line");
    bline.setAttribute("x1", String(lanesStartX));
    bline.setAttribute("y1", String(rowY + headerH));
    bline.setAttribute("x2", String(lanesStartX + lanes * colW));
    bline.setAttribute("y2", String(rowY + headerH));
    bline.setAttribute("stroke", "var(--background-modifier-border)");
    bline.setAttribute("stroke-width", "1");
    this.svg.appendChild(bline);
  }
  /**
   * 左上コーナー（年・月・GAP列の見出しを表示。
   * 上下左右どちらのスクロールにも追従して固定表示する）
   */
  drawCornerHeader(scrollLeft, scrollTop, headerH, calendarName) {
    const bg = document.createElementNS(SVG_NS2, "rect");
    bg.setAttribute("x", String(scrollLeft));
    bg.setAttribute("y", String(scrollTop));
    bg.setAttribute("width", String(LANES_START_X));
    bg.setAttribute("height", String(headerH));
    bg.setAttribute("fill", "var(--background-primary-alt)");
    this.svg.appendChild(bg);
    if (calendarName) {
      const title = document.createElementNS(SVG_NS2, "title");
      title.textContent = calendarName;
      bg.appendChild(title);
    }
    const cells = [
      { label: "\u5E74", x: scrollLeft, w: YEAR_COL_W },
      { label: "\u6708", x: scrollLeft + YEAR_COL_W, w: MONTH_COL_W },
      { label: "GAP", x: scrollLeft + YEAR_COL_W + MONTH_COL_W, w: GAP_COL_W }
    ];
    for (const cell of cells) {
      const text = document.createElementNS(SVG_NS2, "text");
      text.setAttribute("x", String(cell.x + cell.w / 2));
      text.setAttribute("y", String(scrollTop + headerH / 2));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("font-size", "10");
      text.setAttribute("font-weight", "600");
      text.setAttribute("fill", "var(--text-muted)");
      text.setAttribute("letter-spacing", "0.5");
      text.textContent = cell.label;
      this.svg.appendChild(text);
      const divider = document.createElementNS(SVG_NS2, "line");
      divider.setAttribute("x1", String(cell.x));
      divider.setAttribute("y1", String(scrollTop));
      divider.setAttribute("x2", String(cell.x));
      divider.setAttribute("y2", String(scrollTop + headerH));
      divider.setAttribute("stroke", "var(--background-modifier-border)");
      divider.setAttribute("stroke-width", "0.6");
      this.svg.appendChild(divider);
    }
    const bline = document.createElementNS(SVG_NS2, "line");
    bline.setAttribute("x1", String(scrollLeft));
    bline.setAttribute("y1", String(scrollTop + headerH));
    bline.setAttribute("x2", String(scrollLeft + LANES_START_X));
    bline.setAttribute("y2", String(scrollTop + headerH));
    bline.setAttribute("stroke", "var(--background-modifier-border)");
    bline.setAttribute("stroke-width", "1");
    this.svg.appendChild(bline);
    const rline = document.createElementNS(SVG_NS2, "line");
    rline.setAttribute("x1", String(scrollLeft + LANES_START_X));
    rline.setAttribute("y1", String(scrollTop));
    rline.setAttribute("x2", String(scrollLeft + LANES_START_X));
    rline.setAttribute("y2", String(scrollTop + headerH));
    rline.setAttribute("stroke", "var(--background-modifier-border)");
    rline.setAttribute("stroke-width", "1");
    this.svg.appendChild(rline);
  }
  // ----------------------------------------------------------
  // ノード描画（日にちバッジ）
  // ----------------------------------------------------------
  drawNodes(ctx, visTop, visBottom, visLeft, visRight) {
    for (const node of ctx.nodes) {
      const w = this.estimateClampedPillWidth(node);
      const h = node.radius * 2;
      if (node.y + h < visTop || node.y > visBottom) continue;
      if (node.x + w / 2 < visLeft || node.x - w / 2 > visRight) continue;
      const isFiltered = ctx.filteredIds !== null && !ctx.filteredIds.has(node.event.id);
      const isSelected = node.event.id === ctx.selectedId;
      this.drawNode(node, isFiltered, isSelected, ctx);
    }
  }
  /** ノードに表示する日にちテキスト（例: "12日"） */
  dayLabel(node) {
    return dayLabelForEvent(node.event);
  }
  estimateFontSize(node) {
    return estimateNodeFontSize(node.radius);
  }
  /** レーン列幅にクランプしたノード横幅(px) */
  estimateClampedPillWidth(node) {
    const raw = estimateNodePillWidth(node.event, node.radius);
    const maxW = LANE_COL_W - 8;
    return Math.min(raw, Math.max(16, maxW));
  }
  /** ノードの視覚上の中心Y座標（関係線・ホバー基準などに使用） */
  nodeCenterY(node) {
    return node.y + node.radius;
  }
  /**
   * サイズ別のノード形状を生成する（縦軸方向に長さを持つ）。
   *   小 (small)  : 長方形
   *   中 (medium) : 楕円形
   *   大 (big)    : 横長の六角形（左右が尖る）
   *
   * @param cx      ノード中心のSVG X座標（レーン列の中心）
   * @param topY    ノード上端のSVG Y座標（時間軸上の日付起点）
   * @param w       ノード全体の幅(px)
   * @param h       ノード全体の高さ(px)
   */
  buildNodeShape(size, cx, topY, w, h, fill, fillOpacity, stroke, strokeWidth) {
    const halfW = w / 2;
    if (size === "small") {
      const rect = document.createElementNS(SVG_NS2, "rect");
      rect.setAttribute("x", String(cx - halfW));
      rect.setAttribute("y", String(topY));
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", String(h));
      rect.setAttribute("rx", "1.5");
      this.applyShapeStyle(rect, fill, fillOpacity, stroke, strokeWidth);
      return rect;
    }
    if (size === "big") {
      const halfH = h / 2;
      const midY = topY + halfH;
      const notch = Math.min(halfH * 0.7, w / 3);
      const points = [
        `${cx - halfW + notch},${topY}`,
        `${cx + halfW - notch},${topY}`,
        `${cx + halfW},${midY}`,
        `${cx + halfW - notch},${topY + h}`,
        `${cx - halfW + notch},${topY + h}`,
        `${cx - halfW},${midY}`
      ].join(" ");
      const hex = document.createElementNS(SVG_NS2, "polygon");
      hex.setAttribute("points", points);
      this.applyShapeStyle(hex, fill, fillOpacity, stroke, strokeWidth);
      return hex;
    }
    const ellipse = document.createElementNS(SVG_NS2, "ellipse");
    ellipse.setAttribute("cx", String(cx));
    ellipse.setAttribute("cy", String(topY + h / 2));
    ellipse.setAttribute("rx", String(halfW));
    ellipse.setAttribute("ry", String(h / 2));
    this.applyShapeStyle(ellipse, fill, fillOpacity, stroke, strokeWidth);
    return ellipse;
  }
  applyShapeStyle(el, fill, fillOpacity, stroke, strokeWidth) {
    el.setAttribute("fill", fill);
    el.setAttribute("fill-opacity", fillOpacity);
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", strokeWidth);
  }
  drawNode(node, isFiltered, isSelected, ctx) {
    const g = document.createElementNS(SVG_NS2, "g");
    g.setAttribute("class", "ntj-node");
    const text = this.dayLabel(node);
    const fontSize = this.estimateFontSize(node);
    const w = this.estimateClampedPillWidth(node);
    const h = node.radius * 2;
    const centerY = node.y + h / 2;
    const colors = ctx.resolveNodeColors(node.event);
    const shape = this.buildNodeShape(
      node.event.size,
      node.x,
      node.y,
      w,
      h,
      isFiltered ? COLOR.nodeFiltered : colors.nodeColor,
      isFiltered ? "0.25" : "1",
      isSelected ? COLOR.nodeStroke : "none",
      isSelected ? "2.5" : "0"
    );
    g.appendChild(shape);
    if (!isFiltered) {
      const label = document.createElementNS(SVG_NS2, "text");
      label.setAttribute("class", "ntj-node-label");
      label.setAttribute("x", String(node.x));
      label.setAttribute("y", String(centerY));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "central");
      label.setAttribute("font-size", String(fontSize));
      label.setAttribute("font-weight", "600");
      label.setAttribute("fill", colors.textColor || COLOR.nodeTextLight);
      label.textContent = text;
      g.appendChild(label);
    }
    if (node.event.error) {
      const warn = document.createElementNS(SVG_NS2, "text");
      warn.setAttribute("x", String(node.x + w / 2 - 2));
      warn.setAttribute("y", String(node.y + 2));
      warn.setAttribute("font-size", "10");
      warn.setAttribute("dominant-baseline", "auto");
      warn.setAttribute("fill", COLOR.errorIcon);
      warn.textContent = "\u26A0";
      g.appendChild(warn);
    }
    g.addEventListener("mouseenter", (e) => {
      this.tooltip.show(node.event, colors.nodeColor, e.clientX, e.clientY);
      ctx.onNodeHover(node.event, node, e.clientX, e.clientY);
    });
    g.addEventListener("mouseleave", () => {
      this.tooltip.hide();
      ctx.onNodeLeave();
    });
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      this.tooltip.hide();
      ctx.onNodeClick(node.event, node, e.clientX, e.clientY);
    });
    g.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.startDrag(e, node, g);
    });
    this.svg.appendChild(g);
  }
  // ----------------------------------------------------------
  // 関係線描画
  // ----------------------------------------------------------
  drawRelations(ctx, visTop, visBottom) {
    const { edges, selectedId, settings } = ctx;
    const mode = settings.relationDisplayMode;
    if (mode === "hidden") return;
    for (const edge of edges) {
      if (mode === "selected") {
        if (edge.fromId !== selectedId && edge.toId !== selectedId) continue;
      }
      const fromInView = edge.fromNode.y >= visTop && edge.fromNode.y <= visBottom;
      const toInView = edge.toNode.y >= visTop && edge.toNode.y <= visBottom;
      if (!fromInView && !toInView) continue;
      this.drawBezierEdge(edge, settings);
    }
  }
  drawBezierEdge(edge, settings) {
    const { fromNode, toNode } = edge;
    const strength = settings.relationCurveStrength;
    const fromX = fromNode.x;
    const toX = toNode.x;
    const fromY = this.nodeCenterY(fromNode);
    const toY = this.nodeCenterY(toNode);
    const dy = toY - fromY;
    const cpOffset = strength / 100 * Math.max(40, Math.abs(dy) * 0.4);
    const d = `M ${fromX} ${fromY} C ${fromX + cpOffset} ${fromY + dy * 0.3}, ${toX - cpOffset} ${toY - dy * 0.3}, ${toX} ${toY}`;
    const path = document.createElementNS(SVG_NS2, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", settings.relationColor);
    path.setAttribute("stroke-width", String(settings.relationWidth));
    path.setAttribute("stroke-opacity", String(settings.relationOpacity));
    if (settings.relationStyle === "dashed") path.setAttribute("stroke-dasharray", "6 4");
    else if (settings.relationStyle === "dotted") path.setAttribute("stroke-dasharray", "2 4");
    this.svg.appendChild(path);
    if (settings.relationArrowStyle !== "none") {
      this.drawMidArrow(path, settings);
    }
  }
  /**
   * SVGパスの50%地点の座標・接線方向を求め、矢印ポリゴンを配置する
   */
  drawMidArrow(path, settings) {
    let len;
    try {
      len = path.getTotalLength();
    } catch (e) {
      return;
    }
    if (!len || len < 2) return;
    const mid = path.getPointAtLength(len * 0.5);
    const next = path.getPointAtLength(len * 0.5 + 1);
    const angle = Math.atan2(next.y - mid.y, next.x - mid.x) * 180 / Math.PI;
    const style = settings.relationArrowStyle;
    const color = settings.relationColor;
    const opacity = settings.relationOpacity;
    const sw = settings.relationWidth;
    if (style === "triangle") {
      const size = 5 + sw;
      const tri = document.createElementNS(SVG_NS2, "polygon");
      tri.setAttribute("points", `${size},0 ${-size * 0.6},${-size * 0.5} ${-size * 0.6},${size * 0.5}`);
      tri.setAttribute("fill", color);
      tri.setAttribute("fill-opacity", String(opacity));
      tri.setAttribute("stroke", "none");
      tri.setAttribute("transform", `translate(${mid.x},${mid.y}) rotate(${angle})`);
      this.svg.appendChild(tri);
    } else {
      const size = 5 + sw * 0.8;
      const arr = document.createElementNS(SVG_NS2, "path");
      arr.setAttribute("d", `M${-size},${-size} L0,0 L${-size},${size}`);
      arr.setAttribute("fill", "none");
      arr.setAttribute("stroke", color);
      arr.setAttribute("stroke-width", String(Math.max(1.2, sw * 0.8)));
      arr.setAttribute("stroke-opacity", String(opacity));
      arr.setAttribute("stroke-linecap", "round");
      arr.setAttribute("stroke-linejoin", "round");
      arr.setAttribute("transform", `translate(${mid.x},${mid.y}) rotate(${angle})`);
      this.svg.appendChild(arr);
    }
  }
  // ----------------------------------------------------------
  // Gap 描画
  // ----------------------------------------------------------
  drawGaps(ctx, visTop, visBottom, axisX, gapColW) {
    for (const gap of ctx.gaps) {
      if (gap.y < visTop || gap.y > visBottom) continue;
      const gapDays = Math.max(0, gap.toOrder - gap.fromOrder - 1);
      const slotHeight = gap.expanded ? Math.max(EXPANDED_MIN_HEIGHT, gapDays * EXPANDED_PX_PER_DAY) : GAP_SLOT_HEIGHT;
      const el = this.gapRenderer.render(gap, axisX, gapColW, slotHeight);
      el.addEventListener("click", () => ctx.onGapClick(gap));
      this.svg.appendChild(el);
    }
  }
  // ----------------------------------------------------------
  // Drag & Drop（レーン変更のみ・横方向にドラッグする）
  // ----------------------------------------------------------
  startDrag(e, node, g) {
    this.dragState = {
      active: true,
      eventId: node.event.id,
      startX: e.clientX,
      circle: g,
      originalLane: node.event.lane
    };
    g.addClass("is-dragging");
  }
  onDragMove(e, _ctx) {
    if (!this.dragState.active || !this.dragState.circle) return;
    const totalClientDx = e.clientX - this.dragState.startX;
    const totalSvgDx = this.clientDxToSvgDx(totalClientDx);
    this.dragState.circle.setAttribute("transform", `translate(${totalSvgDx}, 0)`);
  }
  onDragEnd(e, ctx) {
    if (!this.dragState.active) return;
    const totalClientDx = e.clientX - this.dragState.startX;
    const totalSvgDx = this.clientDxToSvgDx(totalClientDx);
    const originX = this.laneToSvgX(this.dragState.originalLane, this._lastLaneCount);
    const droppedX = originX + totalSvgDx;
    const targetLane = this.svgXToLane(droppedX, this._lastLaneCount);
    ctx.onLaneDrop(this.dragState.eventId, targetLane);
    if (this.dragState.circle) {
      this.dragState.circle.removeClass("is-dragging");
      this.dragState.circle.removeAttribute("transform");
    }
    this.dragState.active = false;
  }
  /** lane番号(1〜laneCount) → SVG X座標（LayoutEngine.calcX と同じ式） */
  laneToSvgX(lane, laneCount) {
    const laneMax = Math.max(LANE_MIN, laneCount);
    const clamped = Math.max(LANE_MIN, Math.min(laneMax, lane));
    return LANES_START_X + (clamped - LANE_MIN) * LANE_COL_W + LANE_COL_W / 2;
  }
  /** SVG X座標 → 最近傍のlane番号（1〜laneCount） */
  svgXToLane(x, laneCount) {
    const laneMax = Math.max(LANE_MIN, laneCount);
    let bestLane = LANE_MIN;
    let bestDist = Infinity;
    for (let lane = LANE_MIN; lane <= laneMax; lane++) {
      const lx = this.laneToSvgX(lane, laneCount);
      const dist = Math.abs(x - lx);
      if (dist < bestDist) {
        bestDist = dist;
        bestLane = lane;
      }
    }
    return bestLane;
  }
  /** クライアントpx差分 → SVGユーザー座標差分（X方向） */
  clientDxToSvgDx(clientDx) {
    var _a;
    const ctm = this.svg.getScreenCTM();
    if (ctm && ctm.a !== 0) return clientDx / ctm.a;
    const rect = this.svg.getBoundingClientRect();
    const totalW = parseFloat((_a = this.svg.getAttribute("width")) != null ? _a : "600");
    return clientDx * (totalW / (rect.width || totalW));
  }
  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------
  clientXToSvgX(clientX) {
    var _a;
    const ctm = this.svg.getScreenCTM();
    if (ctm) {
      return (clientX - ctm.e) / ctm.a;
    }
    const rect = this.svg.getBoundingClientRect();
    const totalW = parseFloat((_a = this.svg.getAttribute("width")) != null ? _a : "1");
    return (clientX - rect.left + this.container.scrollLeft) * (totalW / (rect.width || 1));
  }
  /** クライアントY座標 → SVGユーザー座標（ボードズーム込み） */
  clientYToSvgY(clientY) {
    var _a;
    const ctm = this.svg.getScreenCTM();
    if (ctm && ctm.d !== 0) {
      return (clientY - ctm.f) / ctm.d;
    }
    const rect = this.svg.getBoundingClientRect();
    const totalH = parseFloat((_a = this.svg.getAttribute("height")) != null ? _a : "1");
    return (clientY - rect.top + this.container.scrollTop) * (totalH / (rect.height || 1));
  }
  getSvgElement() {
    return this.svg;
  }
  destroy() {
    this.tooltip.hide();
    this.tooltip.destroy();
    if (this.container.contains(this.svg)) this.container.removeChild(this.svg);
  }
};

// src/view/TableView.ts
var TableView = class {
  constructor(containerEl) {
    this.highlightTimer = null;
    this.containerEl = containerEl;
  }
  /**
   * @param onOpenFile     タイトルクリック時: ファイルを開く
   * @param onSelectLink   関連イベントクリック時: そのイベントの行へスクロールする
   * @param onSelectChar   登場人物クリック時: 人物フィルタへ反映する
   * @param onSelectLoc    場所クリック時: 場所フィルタへ反映する
   */
  render(events, onOpenFile, onSelectLink, onSelectChar, onSelectLoc) {
    this.containerEl.empty();
    if (events.length === 0) {
      const empty = this.containerEl.createDiv({ cls: "ntj-table-empty" });
      empty.textContent = "\u30A4\u30D9\u30F3\u30C8\u304C\u3042\u308A\u307E\u305B\u3093";
      return;
    }
    const wrapper = this.containerEl.createDiv({ cls: "ntj-table-wrapper" });
    const table = wrapper.createEl("table", { cls: "ntj-table" });
    const thead = table.createEl("thead");
    const hrow = thead.createEl("tr");
    const headers = ["\u30BF\u30A4\u30C8\u30EB", "\u65E5\u4ED8", "\u767B\u5834\u4EBA\u7269", "\u5834\u6240", "\u6982\u8981", "\u95A2\u9023\u30A4\u30D9\u30F3\u30C8"];
    for (const h of headers) {
      hrow.createEl("th", { text: h, cls: "ntj-th" });
    }
    const tbody = table.createEl("tbody");
    for (const event of events) {
      const row = tbody.createEl("tr", { cls: "ntj-tr" });
      row.setAttribute("data-event-id", event.id);
      const titleTd = row.createEl("td", { cls: "ntj-td ntj-td-title" });
      const titleLink = titleTd.createEl("span", {
        cls: "ntj-table-link",
        text: event.displayTitle
      });
      titleLink.addEventListener("click", () => onOpenFile(event.filePath));
      row.createEl("td", {
        cls: "ntj-td ntj-td-date",
        text: event.date || "\u2014"
      });
      const charTd = row.createEl("td", { cls: "ntj-td ntj-td-chars" });
      if (event.characters && event.characters.length > 0) {
        for (const c of event.characters) {
          const tag = charTd.createEl("span", { cls: "ntj-table-tag ntj-table-tag-clickable", text: c });
          tag.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectChar(c);
          });
        }
      } else {
        charTd.textContent = "\u2014";
      }
      const locTd = row.createEl("td", { cls: "ntj-td ntj-td-locs" });
      if (event.locations && event.locations.length > 0) {
        for (const l of event.locations) {
          const tag = locTd.createEl("span", { cls: "ntj-table-tag ntj-table-tag-clickable", text: l });
          tag.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectLoc(l);
          });
        }
      } else {
        locTd.textContent = "\u2014";
      }
      const summaryTd = row.createEl("td", { cls: "ntj-td ntj-td-summary" });
      summaryTd.textContent = event.summary ? event.summary.replace(/_LineBreak_/g, "\n") : "\u2014";
      const linkTd = row.createEl("td", { cls: "ntj-td ntj-td-links" });
      if (event.links && event.links.length > 0) {
        for (const link of event.links) {
          const targetId = link.replace(/^\[\[/, "").replace(/\]\]$/, "");
          const tag = linkTd.createEl("span", { cls: "ntj-table-tag ntj-table-link-tag", text: targetId });
          tag.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!this.scrollToRow(targetId)) onSelectLink(targetId);
          });
        }
      } else {
        linkTd.textContent = "\u2014";
      }
    }
    this.tableEl = wrapper;
  }
  /**
   * 指定イベントIDの行までスクロールし、一瞬ハイライトして視認しやすくする。
   * @returns 該当行が見つかった場合は true
   */
  scrollToRow(eventId) {
    const target = this.containerEl.querySelector(
      `tr[data-event-id="${CSS.escape(eventId)}"]`
    );
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    target.removeClass("is-highlighted");
    void target.offsetWidth;
    target.addClass("is-highlighted");
    this.highlightTimer = setTimeout(() => {
      target.removeClass("is-highlighted");
      this.highlightTimer = null;
    }, 1600);
    return true;
  }
  destroy() {
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.containerEl.empty();
  }
};

// src/view/MeasureModal.ts
var import_obsidian3 = require("obsidian");
var MeasureModal = class extends import_obsidian3.Modal {
  constructor(app, result) {
    super(app);
    this.result = result;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ntj-measure-modal");
    contentEl.createEl("h2", { text: "\u30CE\u30FC\u30C9\u9593\u65E5\u6570\u8A08\u6E2C" });
    const isBackward = this.result.diffDays < 0;
    const absDays = Math.abs(this.result.diffDays);
    const table = contentEl.createDiv({ cls: "ntj-measure-table" });
    this.buildRow(table, "\u59CB\u70B9", this.result.startTitle, this.result.startDateLabel);
    this.buildRow(table, "\u7D42\u70B9", this.result.endTitle, this.result.endDateLabel);
    contentEl.createEl("hr");
    const resultEl = contentEl.createDiv({ cls: "ntj-measure-result" });
    resultEl.createDiv({ cls: "ntj-measure-days", text: `${absDays}\u65E5` });
    resultEl.createDiv({ cls: "ntj-measure-sub", text: this.result.diffLabel });
    if (isBackward) {
      resultEl.createDiv({
        cls: "ntj-measure-note",
        text: "\u203B \u7D42\u70B9\u306F\u59CB\u70B9\u3088\u308A\u904E\u53BB\u306E\u65E5\u4ED8\u3067\u3059"
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
  buildRow(parent, label, title, dateLabel) {
    const row = parent.createDiv({ cls: "ntj-measure-row" });
    row.createDiv({ cls: "ntj-measure-label", text: label });
    const value = row.createDiv({ cls: "ntj-measure-value" });
    value.createDiv({ cls: "ntj-measure-title", text: title });
    value.createDiv({ cls: "ntj-measure-date", text: dateLabel });
  }
};

// src/view/TimelineView.ts
var TIMELINE_VIEW_TYPE = "novels-timeline-jp";
var TimelineView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.nodes = [];
    this.gaps = [];
    this.selectedId = null;
    // ノード間日数計測モード
    this.measureMode = false;
    this.measureStartEvent = null;
    this.filterState = {
      characters: /* @__PURE__ */ new Set(),
      locations: /* @__PURE__ */ new Set(),
      searchQuery: ""
    };
    this.viewMode = "timeline";
    // タイマーID
    this.renderTimer = null;
    this.zoomSaveTimer = null;
    // ドラッグパン状態
    this.pan = { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 };
    this.plugin = plugin;
    const { app, settings } = plugin;
    this.eventStore = new EventStore();
    this.cacheStore = new CacheStore(app);
    this.discovery = new DiscoveryEngine(app, settings.calendar, settings.excludedFolders);
    this.layoutEngine = new LayoutEngine(settings.calendar);
    this.relationEngine = new RelationEngine();
    this.gapEngine = new GapEngine(settings.calendar);
    this.filterEngine = new FilterEngine();
  }
  getViewType() {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText() {
    var _a;
    const calendarName = (_a = this.plugin.settings.calendar.name) == null ? void 0 : _a.trim();
    return calendarName ? `${calendarName} - Novels Timeline JP` : "Novels Timeline JP";
  }
  getIcon() {
    return "timeline";
  }
  /**
   * タブのタイトル表示を最新の getDisplayText() で更新する。
   * Obsidian は暦名変更のような内部状態変化を自動検知しないため、
   * 明示的に呼び出してタブヘッダーを再描画させる必要がある。
   * updateHeader() は型定義に含まれないランタイムAPIのため any 経由で呼ぶ。
   */
  updateTabTitle() {
    var _a, _b;
    (_b = (_a = this.leaf).updateHeader) == null ? void 0 : _b.call(_a);
  }
  /** 現在保持している全イベントを返す（EventSidebarView の関連イベント選択などから使用） */
  getAllEvents() {
    return this.eventStore.getAll();
  }
  async onOpen() {
    await this.buildUI();
    await this.loadAll();
    this.registerFileWatcher();
    this.updateTabTitle();
  }
  async onClose() {
    var _a;
    if (this.renderTimer) clearTimeout(this.renderTimer);
    if (this.zoomSaveTimer) clearTimeout(this.zoomSaveTimer);
    (_a = this.renderer) == null ? void 0 : _a.destroy();
  }
  // ----------------------------------------------------------
  // UI 構築
  // ----------------------------------------------------------
  async buildUI() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("ntj-view");
    this.toolbarEl = root.createDiv({ cls: "ntj-toolbar" });
    this.buildToolbar();
    this.timelineEl = root.createDiv({ cls: "ntj-timeline" });
    this.zoomWrapperEl = this.timelineEl.createDiv({ cls: "ntj-timeline-zoom-wrapper" });
    this.renderer = new TimelineRenderer(this.zoomWrapperEl);
    this.applyBoardZoom();
    this.tableContainerEl = root.createDiv({ cls: "ntj-table-container" });
    this.tableView = new TableView(this.tableContainerEl);
    this.debugOverlay = this.timelineEl.createDiv({ cls: "ntj-debug-overlay" });
    this.timelineEl.addEventListener("scroll", () => this.scheduleRender());
    this.timelineEl.addEventListener("dblclick", (e) => {
      const target = e.target;
      if (target && target.tagName === "circle") return;
      if (this.selectedId !== null) {
        this.selectedId = null;
        this.scheduleRender();
      }
    });
    this.timelineEl.addEventListener("wheel", (e) => {
      if (e.shiftKey) {
        e.preventDefault();
        this.adjustBoardZoom(e.deltaY < 0 ? BOARD_ZOOM_STEP : -BOARD_ZOOM_STEP);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 60 : -60;
      this.timelineEl.scrollLeft += delta;
    }, { passive: false });
    this.registerPanEvents();
    this.registerDomEvent(document, "keydown", (e) => {
      if (e.key === "Escape" && this.measureMode) {
        this.cancelMeasureMode();
      }
    });
  }
  // ----------------------------------------------------------
  // ボードズーム（タイムラインボード全体の拡大縮小）
  // ノード単体の倍率ではなく、スクロール可能なボード全体を
  // CSS zoom で拡大縮小する。範囲: 50%〜200%、既定値: 100%
  // ----------------------------------------------------------
  /** 現在の設定値を zoomWrapperEl に反映する */
  applyBoardZoom() {
    const zoom = this.plugin.settings.boardZoom;
    this.zoomWrapperEl.style.zoom = `${zoom / 100}`;
    if (this.zoomIndicatorEl) this.zoomIndicatorEl.textContent = `${zoom}%`;
  }
  /** ズーム値を絶対値で設定する（ズームパネルのスライダー用） */
  setBoardZoom(newZoomAbsolute) {
    const settings = this.plugin.settings;
    const newZoom = Math.max(
      BOARD_ZOOM_MIN,
      Math.min(BOARD_ZOOM_MAX, Math.round(newZoomAbsolute))
    );
    if (newZoom === settings.boardZoom) return;
    settings.boardZoom = newZoom;
    this.applyBoardZoom();
    this.scheduleRender();
    if (this.zoomSaveTimer) clearTimeout(this.zoomSaveTimer);
    this.zoomSaveTimer = setTimeout(() => {
      void this.plugin.saveSettings();
    }, 400);
  }
  /**
   * ホイール操作等でズーム値を段階的に変更する。
   * ★ 設定の保存(saveSettings)は高頻度イベントから直接呼ばない
   *   （wheel連打→保存の連鎖でフリーズする恐れがあるため、デバウンスする）。
   */
  adjustBoardZoom(deltaPercent) {
    this.setBoardZoom(this.plugin.settings.boardZoom + deltaPercent);
  }
  /** ズーム値を既定値(100%)にリセットする */
  resetBoardZoom() {
    if (this.plugin.settings.boardZoom === 100) return;
    this.plugin.settings.boardZoom = 100;
    this.applyBoardZoom();
    this.scheduleRender();
    void this.plugin.saveSettings();
  }
  registerPanEvents() {
    const el = this.timelineEl;
    el.addEventListener("mousedown", (e) => {
      if (e.target.closest(".ntj-node")) return;
      if (e.button !== 0) return;
      e.preventDefault();
      this.pan = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop
      };
      el.toggleClass("is-panning", true);
    });
    el.addEventListener("mousemove", (e) => {
      if (!this.pan.active) return;
      const dx = e.clientX - this.pan.startX;
      const dy = e.clientY - this.pan.startY;
      el.scrollLeft = this.pan.scrollLeft - dx;
      el.scrollTop = this.pan.scrollTop - dy;
    });
    const endPan = () => {
      if (!this.pan.active) return;
      this.pan.active = false;
      el.toggleClass("is-panning", false);
    };
    el.addEventListener("mouseup", endPan);
    el.addEventListener("mouseleave", endPan);
  }
  buildToolbar() {
    var _a;
    const searchWrapper = this.toolbarEl.createDiv({ cls: "ntj-search-wrapper" });
    this.searchInput = searchWrapper.createEl("input", {
      type: "text",
      cls: "ntj-search",
      placeholder: "\u691C\u7D22..."
    });
    this.searchInput.addEventListener("input", () => {
      this.filterState.searchQuery = this.searchInput.value;
      clearBtn.toggleClass("is-visible", !!this.searchInput.value);
      this.scheduleRender();
    });
    const clearBtn = searchWrapper.createEl("button", { cls: "ntj-search-clear", text: "\u2715" });
    clearBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.filterState.searchQuery = "";
      clearBtn.toggleClass("is-visible", false);
      this.scheduleRender();
      this.searchInput.focus();
    });
    this.characterFilterApi = this.buildFilterPanel("ntj-filter-characters", "\u767B\u5834\u4EBA\u7269 \u25BC", "characters");
    this.locationFilterApi = this.buildFilterPanel("ntj-filter-locations", "\u5834\u6240 \u25BC", "locations");
    const modeLabels = {
      selected: "\u95A2\u4FC2\u7DDA:\u9078\u629E",
      always: "\u95A2\u4FC2\u7DDA:\u5168\u8868\u793A",
      hidden: "\u95A2\u4FC2\u7DDA:\u975E\u8868\u793A"
    };
    const relationBtn = this.toolbarEl.createEl("button", {
      cls: "ntj-btn",
      text: (_a = modeLabels[this.plugin.settings.relationDisplayMode]) != null ? _a : "\u95A2\u4FC2\u7DDA"
    });
    relationBtn.addEventListener("click", () => {
      const modes = ["selected", "always", "hidden"];
      const current = this.plugin.settings.relationDisplayMode;
      const next = modes[(modes.indexOf(current) + 1) % modes.length];
      this.plugin.settings.relationDisplayMode = next;
      relationBtn.textContent = modeLabels[next];
      this.plugin.saveSettings();
      this.scheduleRender();
    });
    this.viewModeBtn = this.toolbarEl.createEl("button", {
      cls: "ntj-btn ntj-view-mode-btn",
      text: "\u30C6\u30FC\u30D6\u30EB\u8868\u793A"
    });
    this.viewModeBtn.addEventListener("click", () => {
      this.toggleViewMode();
    });
    const zoomWrapper = this.toolbarEl.createDiv({ cls: "ntj-zoom-wrapper" });
    this.zoomIndicatorEl = zoomWrapper.createEl("button", {
      cls: "ntj-btn ntj-zoom-indicator",
      text: `${this.plugin.settings.boardZoom}%`,
      title: `\u30AF\u30EA\u30C3\u30AF\u3067\u30B9\u30E9\u30A4\u30C0\u30FC\u3092\u8868\u793A\uFF08${BOARD_ZOOM_MIN}\u301C${BOARD_ZOOM_MAX}%\u3001${BOARD_ZOOM_STEP}%\u523B\u307F\uFF09
\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u4E0A\u3067 Shift+\u30DB\u30A4\u30FC\u30EB\u3067\u3082\u5909\u66F4\u3067\u304D\u307E\u3059`
    });
    const zoomPanel = zoomWrapper.createDiv({ cls: "ntj-zoom-panel" });
    const zoomSlider = zoomPanel.createEl("input", { cls: "ntj-zoom-slider" });
    zoomSlider.type = "range";
    zoomSlider.min = String(BOARD_ZOOM_MIN);
    zoomSlider.max = String(BOARD_ZOOM_MAX);
    zoomSlider.step = String(BOARD_ZOOM_STEP);
    zoomSlider.value = String(this.plugin.settings.boardZoom);
    const zoomValueLabel = zoomPanel.createSpan({
      cls: "ntj-zoom-panel-value",
      text: `${this.plugin.settings.boardZoom}%`
    });
    const zoomResetBtn = zoomPanel.createEl("button", {
      cls: "ntj-zoom-panel-reset",
      text: "\u30EA\u30BB\u30C3\u30C8",
      title: `${BOARD_ZOOM_DEFAULT}%\u306B\u623B\u3059`
    });
    zoomSlider.addEventListener("input", () => {
      const v = parseInt(zoomSlider.value, 10);
      this.setBoardZoom(v);
      zoomValueLabel.textContent = `${this.plugin.settings.boardZoom}%`;
    });
    zoomResetBtn.addEventListener("click", () => {
      this.resetBoardZoom();
      zoomSlider.value = String(this.plugin.settings.boardZoom);
      zoomValueLabel.textContent = `${this.plugin.settings.boardZoom}%`;
    });
    let zoomPanelOpen = false;
    const openZoomPanel = () => {
      zoomPanelOpen = true;
      zoomSlider.value = String(this.plugin.settings.boardZoom);
      zoomValueLabel.textContent = `${this.plugin.settings.boardZoom}%`;
      zoomPanel.toggleClass("is-visible", true);
    };
    const closeZoomPanel = () => {
      zoomPanelOpen = false;
      zoomPanel.toggleClass("is-visible", false);
    };
    this.zoomIndicatorEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (zoomPanelOpen) closeZoomPanel();
      else openZoomPanel();
    });
    this.registerDomEvent(document, "click", (e) => {
      if (!zoomWrapper.contains(e.target)) closeZoomPanel();
    });
  }
  /**
   * フィルタパネル（独自ドロップダウン）
   * Obsidian Menu は選択で即閉じるため、複数選択できる独自実装にする
   */
  buildFilterPanel(cls, label, key) {
    const wrapper = this.toolbarEl.createDiv({ cls: "ntj-filter-wrapper" });
    const btn = wrapper.createEl("button", { cls: `ntj-btn ${cls}`, text: label });
    const panel = wrapper.createDiv({ cls: "ntj-filter-panel" });
    let isOpen = false;
    const openPanel = () => {
      isOpen = true;
      panel.empty();
      const allValues = key === "characters" ? this.filterEngine.allCharacters(this.eventStore.getAll()) : this.filterEngine.allLocations(this.eventStore.getAll());
      if (allValues.length === 0) {
        panel.createEl("div", { cls: "ntj-filter-empty", text: "\uFF08\u306A\u3057\uFF09" });
      } else {
        for (const value of allValues) {
          const item = panel.createDiv({ cls: "ntj-filter-item" });
          const set = this.filterState[key];
          const cb = item.createEl("input", { type: "checkbox" });
          cb.checked = set.has(value);
          item.createSpan({ text: value });
          cb.addEventListener("change", () => {
            if (cb.checked) set.add(value);
            else set.delete(value);
            btn.toggleClass("is-active", set.size > 0);
            this.scheduleRender();
          });
          item.addEventListener("click", (e) => {
            if (e.target === cb) return;
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event("change"));
          });
        }
        const clearRow = panel.createDiv({ cls: "ntj-filter-clear-row" });
        const clearBtn = clearRow.createEl("button", { cls: "ntj-sf-btn", text: "\u30AF\u30EA\u30A2" });
        clearBtn.addEventListener("click", () => {
          this.filterState[key].clear();
          btn.removeClass("is-active");
          this.scheduleRender();
          openPanel();
        });
      }
      panel.toggleClass("is-visible", true);
    };
    const closePanel = () => {
      isOpen = false;
      panel.toggleClass("is-visible", false);
    };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });
    this.registerDomEvent(document, "click", (e) => {
      if (!wrapper.contains(e.target)) closePanel();
    });
    const addValue = (value) => {
      const set = this.filterState[key];
      if (!set.has(value)) {
        set.add(value);
        btn.toggleClass("is-active", set.size > 0);
        this.scheduleRender();
      }
      if (isOpen) openPanel();
    };
    return { addValue };
  }
  // ----------------------------------------------------------
  // 初回ロード
  // ----------------------------------------------------------
  async loadAll() {
    await this.cacheStore.load();
    const result = await this.discovery.discoverAll();
    this.eventStore.clear();
    for (const event of result.events) {
      this.eventStore.upsert(event);
      this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
    }
    await this.cacheStore.save();
    this.filterEngine.buildIndex(this.eventStore.getAll());
    this.scheduleRender();
    requestAnimationFrame(() => {
      this.timelineEl.scrollLeft = 0;
      this.timelineEl.scrollTop = 0;
    });
  }
  // ----------------------------------------------------------
  // File Watch（差分更新）
  // ----------------------------------------------------------
  registerFileWatcher() {
    const vault = this.plugin.app.vault;
    const metadataCache = this.plugin.app.metadataCache;
    this.registerEvent(metadataCache.on("changed", (file, _data, cache) => {
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") return;
      const event = this.discovery.buildEventFromCache(file, cache);
      if (event) {
        this.eventStore.upsert(event);
        this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
      } else {
        this.eventStore.deleteByFilePath(file.path);
      }
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));
    this.registerEvent(vault.on("rename", async (file, oldPath) => {
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") return;
      this.eventStore.deleteByFilePath(oldPath);
      const event = await this.discovery.discoverFile(file);
      if (event) {
        this.eventStore.upsert(event);
        this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
      }
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));
    this.registerEvent(vault.on("delete", (file) => {
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") return;
      this.eventStore.deleteByFilePath(file.path);
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));
  }
  // ----------------------------------------------------------
  // 描画スケジューラ
  // ★ デバウンス 50ms（16ms は短すぎてホイール連打で詰まる）
  // ----------------------------------------------------------
  scheduleRender() {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.doRender(), 50);
  }
  doRender() {
    const t0 = performance.now();
    const settings = this.plugin.settings;
    const allEvents = this.eventStore.getAllSorted();
    const validEvents = allEvents.filter((e) => !e.error);
    const filtered = this.filterEngine.apply(validEvents, this.filterState);
    const filteredIds = filtered.length < validEvents.length ? new Set(filtered.map((e) => e.id)) : null;
    const tempYMap = this.layoutEngine.calcYPositions(
      validEvents,
      [],
      settings.gapCompression
    );
    this.gaps = settings.gapCompression ? this.gapEngine.buildGaps(validEvents, tempYMap, settings.gapThreshold) : [];
    this.nodes = this.layoutEngine.buildLayout(
      validEvents,
      settings.laneCount,
      this.gaps,
      settings.gapCompression
    );
    this.gapEngine.updateGapYPositions(this.gaps, this.nodes);
    const totalWidth = this.layoutEngine.calcTotalWidth(settings.laneCount);
    const totalHeight = this.layoutEngine.calcTotalHeight(this.nodes);
    const edges = this.relationEngine.buildEdges(validEvents, this.nodes);
    const zoomFactor = this.plugin.settings.boardZoom / 100;
    const virtualWindow = {
      scrollTop: this.timelineEl.scrollTop / zoomFactor,
      scrollLeft: this.timelineEl.scrollLeft / zoomFactor,
      viewportHeight: this.timelineEl.clientHeight / zoomFactor,
      viewportWidth: this.timelineEl.clientWidth / zoomFactor,
      buffer: settings.renderBuffer / zoomFactor
    };
    this.renderer.render({
      nodes: this.nodes,
      gaps: this.gaps,
      edges,
      filteredIds,
      selectedId: this.selectedId,
      settings,
      totalWidth,
      totalHeight,
      virtualWindow,
      dateRows: this.buildDateRows(validEvents, this.nodes),
      onNodeClick: (event, _node, mx, my) => {
        void this.handleNodeClick(event, mx, my);
      },
      onNodeHover: () => {
      },
      onNodeLeave: () => {
      },
      onGapClick: (gap) => this.handleGapClick(gap),
      onContextMenu: (svgY, mx, my, lane) => this.handleContextMenu(svgY, mx, my, lane),
      onLaneDrop: (eventId, targetLane) => this.handleLaneDrop(eventId, targetLane),
      resolveNodeColors: (event) => this.plugin.colorPresetStore.resolve(event.color)
    });
    const tableEvents = filtered.length < validEvents.length ? filtered : validEvents;
    this.tableView.render(
      tableEvents,
      (filePath) => {
        const file = this.plugin.app.vault.getFileByPath(filePath);
        if (file) this.plugin.app.workspace.getLeaf(false).openFile(file);
      },
      (eventId) => this.handleTableLinkClick(eventId),
      (name) => this.characterFilterApi.addValue(name),
      (name) => this.locationFilterApi.addValue(name)
    );
    const t1 = performance.now();
    this.updateDebugOverlay(validEvents.length, this.nodes.length, this.gaps.length, t1 - t0);
  }
  // ----------------------------------------------------------
  // デバッグオーバーレイ
  // ----------------------------------------------------------
  updateDebugOverlay(eventCount, nodeCount, gapCount, renderMs) {
    const isDebug = this.plugin.settings.debugMode;
    this.debugOverlay.toggleClass("is-visible", isDebug);
    if (!isDebug) return;
    const lines = [
      `events:  ${eventCount}`,
      `nodes:   ${nodeCount}`,
      `gaps:    ${gapCount}`,
      `render:  ${renderMs.toFixed(1)}ms`,
      `scroll:  ${this.timelineEl.scrollTop.toFixed(0)}px`,
      `zoom:    ${this.plugin.settings.boardZoom}%`
    ];
    this.debugOverlay.empty();
    for (const line of lines) {
      this.debugOverlay.createDiv({ text: line });
    }
  }
  // ----------------------------------------------------------
  // ビューモード切替（タイムライン ↔ テーブル）
  // ----------------------------------------------------------
  toggleViewMode() {
    if (this.viewMode === "timeline") {
      this.viewMode = "table";
      this.timelineEl.toggleClass("is-hidden", true);
      this.tableContainerEl.toggleClass("is-visible", true);
      this.viewModeBtn.textContent = "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u8868\u793A";
      this.viewModeBtn.addClass("is-active");
    } else {
      this.viewMode = "timeline";
      this.timelineEl.toggleClass("is-hidden", false);
      this.tableContainerEl.toggleClass("is-visible", false);
      this.viewModeBtn.textContent = "\u30C6\u30FC\u30D6\u30EB\u8868\u793A";
      this.viewModeBtn.removeClass("is-active");
    }
  }
  // ----------------------------------------------------------
  // インタラクション
  // ----------------------------------------------------------
  async handleNodeClick(event, _mouseX, _mouseY) {
    if (this.measureMode) {
      this.handleMeasureNodeClick(event);
      return;
    }
    this.selectedId = this.selectedId === event.id ? null : event.id;
    this.scheduleRender();
    const sidebar = await this.plugin.getOrOpenSidebarView();
    sidebar == null ? void 0 : sidebar.showViewEdit(event);
  }
  /**
   * テーブル表示の「関連イベント」タグをクリックした際、
   * 対象行がテーブル内に見つからなかった場合（絞り込みで除外されている等）の
   * フォールバック処理。行スクロール自体は TableView 内で完結する。
   */
  handleTableLinkClick(eventId) {
    new import_obsidian4.Notice(`\u300C${eventId}\u300D\u306F\u73FE\u5728\u306E\u7D5E\u308A\u8FBC\u307F\u6761\u4EF6\u306B\u3088\u308A\u4E00\u89A7\u306B\u8868\u793A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002`);
  }
  // ----------------------------------------------------------
  // ノード間日数計測
  // ----------------------------------------------------------
  /** 計測モードを開始する（始点ノード待ち状態にする） */
  startMeasureMode() {
    this.measureMode = true;
    this.measureStartEvent = null;
    this.selectedId = null;
    this.timelineEl.addClass("is-measuring");
    this.scheduleRender();
    new import_obsidian4.Notice("\u30CE\u30FC\u30C9\u9593\u65E5\u6570\u8A08\u6E2C: \u59CB\u70B9\u30CE\u30FC\u30C9\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u304F\u3060\u3055\u3044\uFF08Esc\u3067\u4E2D\u6B62\uFF09");
  }
  /** 計測モードを中止し、通常状態へ戻す */
  cancelMeasureMode() {
    this.measureMode = false;
    this.measureStartEvent = null;
    this.selectedId = null;
    this.timelineEl.removeClass("is-measuring");
    this.scheduleRender();
    new import_obsidian4.Notice("\u30CE\u30FC\u30C9\u9593\u65E5\u6570\u8A08\u6E2C\u3092\u4E2D\u6B62\u3057\u307E\u3057\u305F");
  }
  /**
   * 計測モード中のノードクリックを処理する。
   * 1回目のクリック → 始点として記録し、終点待ちにする。
   * 2回目のクリック → 終点として確定し、結果モーダルを表示する。
   */
  handleMeasureNodeClick(event) {
    if (!this.measureStartEvent) {
      this.measureStartEvent = event;
      this.selectedId = event.id;
      this.scheduleRender();
      new import_obsidian4.Notice(`\u59CB\u70B9: ${event.displayTitle} \u2014 \u7D42\u70B9\u30CE\u30FC\u30C9\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u304F\u3060\u3055\u3044\uFF08Esc\u3067\u4E2D\u6B62\uFF09`);
      return;
    }
    if (event.id === this.measureStartEvent.id) {
      new import_obsidian4.Notice("\u59CB\u70B9\u3068\u540C\u3058\u30CE\u30FC\u30C9\u3067\u3059\u3002\u5225\u306E\u30CE\u30FC\u30C9\u3092\u7D42\u70B9\u3068\u3057\u3066\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    const startEvent = this.measureStartEvent;
    const endEvent = event;
    this.measureMode = false;
    this.measureStartEvent = null;
    this.selectedId = null;
    this.timelineEl.removeClass("is-measuring");
    this.scheduleRender();
    this.showMeasureResult(startEvent, endEvent);
  }
  /** 2イベント間の日数を算出し、結果モーダルを表示する */
  showMeasureResult(startEvent, endEvent) {
    const dateParser = new DateParser(this.plugin.settings.calendar);
    const startParsed = dateParser.parse(startEvent.date);
    const endParsed = dateParser.parse(endEvent.date);
    const startDateLabel = startParsed.ok ? dateParser.format(startParsed.parsed) : startEvent.date;
    const endDateLabel = endParsed.ok ? dateParser.format(endParsed.parsed) : endEvent.date;
    const diffDays = endEvent.timelineOrder - startEvent.timelineOrder;
    const diffLabel = this.gapEngine.formatDiff(Math.abs(diffDays));
    new MeasureModal(this.app, {
      startTitle: startEvent.displayTitle,
      startDateLabel,
      endTitle: endEvent.displayTitle,
      endDateLabel,
      diffDays,
      diffLabel
    }).open();
  }
  handleGapClick(gap) {
    this.gapEngine.toggleExpand(gap);
    this.scheduleRender();
  }
  handleContextMenu(svgY, mouseX, mouseY, lane) {
    const settings = this.plugin.settings;
    const dateStr = this.layoutEngine.orderFromViewportY(
      svgY,
      this.nodes,
      this.gaps,
      settings.gapCompression,
      ""
    );
    const menu = new import_obsidian4.Menu();
    menu.addItem((item) => {
      item.setTitle("\u65B0\u898F\u30A4\u30D9\u30F3\u30C8\u3092\u4F5C\u6210");
      item.setIcon("file-plus");
      item.onClick(async () => {
        const sidebar = await this.plugin.getOrOpenSidebarView();
        sidebar == null ? void 0 : sidebar.showCreate(dateStr, lane);
      });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle("\u30CE\u30FC\u30C9\u9593\u65E5\u6570\u8A08\u6E2C");
      item.setIcon("ruler");
      item.onClick(() => {
        this.startMeasureMode();
      });
    });
    if (settings.gapCompression && this.gaps.length > 0) {
      menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle("Gap\u3092\u3059\u3079\u3066\u5C55\u958B");
        item.setIcon("chevrons-down-up");
        item.onClick(() => {
          this.gapEngine.expandAll(this.gaps);
          this.scheduleRender();
        });
      });
      menu.addItem((item) => {
        item.setTitle("Gap\u3092\u3059\u3079\u3066\u6298\u308A\u305F\u305F\u3080");
        item.setIcon("chevrons-up-down");
        item.onClick(() => {
          this.gapEngine.collapseAll();
          this.scheduleRender();
        });
      });
    }
    menu.showAtPosition({ x: mouseX, y: mouseY });
  }
  async handleLaneDrop(eventId, targetLane) {
    const event = this.eventStore.getById(eventId);
    if (!event) return;
    const laneMax = this.plugin.settings.laneCount;
    const newLane = Math.max(LANE_MIN, Math.min(laneMax, targetLane));
    if (newLane === event.lane) return;
    const updated = { ...event, lane: newLane };
    this.eventStore.upsert(updated);
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (file) {
      try {
        await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
          fm[NTJP_KEYS.lane] = newLane;
        });
      } catch (e) {
        new import_obsidian4.Notice(`lane\u306E\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
      }
    }
    this.scheduleRender();
  }
  // ----------------------------------------------------------
  // 外部 API
  // ----------------------------------------------------------
  /**
   * 時間軸に描画する日付行リストを生成する。
   * 同日のノードが複数あっても1行にまとめる。
   * 年・月・日・暦プレフィックスをパースして DateRow を返す。
   */
  buildDateRows(sortedEvents, nodes) {
    var _a, _b;
    if (sortedEvents.length === 0) return [];
    const dateParser = new DateParser(this.plugin.settings.calendar);
    const nodeYMap = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      nodeYMap.set(node.event.id, node.y);
    }
    const seenOrders = /* @__PURE__ */ new Map();
    const calendarPrefix = (_a = this.plugin.settings.calendar.name) != null ? _a : "";
    for (const event of sortedEvents) {
      if (seenOrders.has(event.timelineOrder)) continue;
      const result = dateParser.parse(event.date);
      if (!result.ok) continue;
      const { year, month, day } = result.parsed;
      const monthDef = getMonthDef(this.plugin.settings.calendar, month);
      const monthLabel = monthDef && monthDef.name.trim() !== "" ? monthDef.name : `${month}\u6708`;
      const y = (_b = nodeYMap.get(event.id)) != null ? _b : 0;
      seenOrders.set(event.timelineOrder, {
        y,
        year,
        month,
        day,
        monthLabel,
        calendarPrefix
      });
    }
    return Array.from(seenOrders.values()).sort((a, b) => a.y - b.y);
  }
  async rebuildAll() {
    await this.cacheStore.clearAll();
    await this.loadAll();
  }
  refreshSettings() {
    const { settings } = this.plugin;
    this.discovery.updateCalendar(settings.calendar);
    this.discovery.updateExcludedFolders(settings.excludedFolders);
    this.layoutEngine.updateCalendar(settings.calendar);
    this.gapEngine.updateCalendar(settings.calendar);
    this.updateTabTitle();
    this.scheduleRender();
  }
};

// src/view/EventSidebarView.ts
var import_obsidian6 = require("obsidian");

// src/view/ColorPresetModal.ts
var import_obsidian5 = require("obsidian");

// src/store/ColorPresetStore.ts
var PRESET_PATH = ".obsidian/plugins/novels-timeline-jp/color-presets.json";
var DEFAULT_PRESETS = [
  { id: "default-blue", name: "\u9752", nodeColor: "#4A90E2", textColor: "#ffffff" },
  { id: "default-orange", name: "\u30AA\u30EC\u30F3\u30B8", nodeColor: "#FFAA00", textColor: "#ffffff" },
  { id: "default-red", name: "\u8D64", nodeColor: "#CC4455", textColor: "#ffffff" },
  { id: "default-green", name: "\u7DD1", nodeColor: "#3FA76E", textColor: "#ffffff" },
  { id: "default-purple", name: "\u7D2B", nodeColor: "#8E6FCE", textColor: "#ffffff" },
  { id: "default-gray", name: "\u30B0\u30EC\u30FC\uFF08\u65E2\u5B9A\uFF09", nodeColor: "#808080", textColor: "#ffffff" }
];
var ColorPresetStore = class {
  constructor(app) {
    this.presets = [];
    this.app = app;
  }
  async load() {
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(PRESET_PATH)) {
        const raw = await adapter.read(PRESET_PATH);
        const parsed = JSON.parse(raw);
        this.presets = Array.isArray(parsed.presets) ? parsed.presets : [];
      } else {
        this.presets = DEFAULT_PRESETS.slice();
        await this.save();
      }
    } catch (e) {
      console.warn("[NovelsTimelineJP] \u914D\u8272\u30BB\u30C3\u30C8\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", e);
      this.presets = DEFAULT_PRESETS.slice();
    }
  }
  async save() {
    try {
      const adapter = this.app.vault.adapter;
      const dir = PRESET_PATH.split("/").slice(0, -1).join("/");
      if (!await adapter.exists(dir)) {
        await adapter.mkdir(dir);
      }
      const data = { presets: this.presets };
      await adapter.write(PRESET_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn("[NovelsTimelineJP] \u914D\u8272\u30BB\u30C3\u30C8\u306E\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", e);
    }
  }
  getAll() {
    return this.presets.slice();
  }
  getById(id) {
    return this.presets.find((p) => p.id === id);
  }
  /**
   * イベントの color フィールド値（配色セットIDまたはレガシーな生HEX値）を
   * 実際の描画色（ノード色・文字色）に解決する。
   *   1. 配色セットIDと一致すれば、そのセットの色を返す。
   *   2. HEXカラーコードとして解釈できれば、それをノード色とし、文字色は白とする
   *      （配色セット導入前のノート・カスタム値への後方互換）。
   *   3. どちらでもなければ既定のグレーにフォールバックする。
   */
  resolve(colorField) {
    const preset = this.getById(colorField);
    if (preset) return { nodeColor: preset.nodeColor, textColor: preset.textColor };
    if (/^#[0-9A-Fa-f]{3,8}$/.test(colorField)) {
      return { nodeColor: colorField, textColor: "#ffffff" };
    }
    return { nodeColor: "#808080", textColor: "#ffffff" };
  }
  /** 追加または更新（同一IDが存在すれば上書き）。保存はしない。 */
  upsert(preset) {
    const idx = this.presets.findIndex((p) => p.id === preset.id);
    if (idx >= 0) {
      this.presets[idx] = preset;
    } else {
      this.presets.push(preset);
    }
  }
  /** 削除。保存はしない。 */
  remove(id) {
    this.presets = this.presets.filter((p) => p.id !== id);
  }
  /** 全件を丸ごと置き換える。保存はしない。 */
  replaceAll(presets) {
    this.presets = presets.slice();
  }
  /** 新規ID生成（作成時刻ベース） */
  static generateId() {
    return `preset-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  }
};

// src/view/ColorPresetModal.ts
var HEX_RE = /^#[0-9A-Fa-f]{6}$/;
var ColorPresetModal = class extends import_obsidian5.Modal {
  constructor(app, store, onChange) {
    super(app);
    this.dirty = false;
    this.store = store;
    this.onChange = onChange;
  }
  onOpen() {
    this.render();
  }
  onClose() {
    this.contentEl.empty();
    if (this.dirty) this.onChange();
  }
  // ----------------------------------------------------------
  // 描画
  // ----------------------------------------------------------
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ntj-preset-modal");
    contentEl.createEl("h2", { text: "\u914D\u8272\u30BB\u30C3\u30C8\u306E\u7BA1\u7406" });
    contentEl.createEl("p", {
      cls: "ntj-preset-modal-desc",
      text: "\u30CE\u30FC\u30C9\u306E\u8272\u3068\u6587\u5B57\u8272\u306E\u7D44\u307F\u5408\u308F\u305B\u3092\u540D\u524D\u4ED8\u304D\u3067\u4FDD\u5B58\u3057\u3001\u30A4\u30D9\u30F3\u30C8\u4F5C\u6210\u30FB\u7DE8\u96C6\u6642\u306B\u9078\u629E\u3067\u304D\u307E\u3059\u3002"
    });
    const list = contentEl.createDiv({ cls: "ntj-preset-list" });
    const presets = this.store.getAll();
    if (presets.length === 0) {
      list.createEl("p", {
        cls: "ntj-preset-empty",
        text: "\u914D\u8272\u30BB\u30C3\u30C8\u304C\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002\u4E0B\u306E\u300C\u65B0\u898F\u8FFD\u52A0\u300D\u304B\u3089\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      });
    }
    for (const preset of presets) {
      this.renderPresetRow(list, preset);
    }
    contentEl.createEl("h3", { text: "\u65B0\u898F\u8FFD\u52A0" });
    this.renderEditForm(contentEl, null);
  }
  renderPresetRow(parent, preset) {
    const row = parent.createDiv({ cls: "ntj-preset-row" });
    const swatches = row.createDiv({ cls: "ntj-preset-swatches" });
    const nodeSwatch = swatches.createDiv({ cls: "ntj-preset-swatch" });
    nodeSwatch.style.backgroundColor = preset.nodeColor;
    nodeSwatch.title = `\u30CE\u30FC\u30C9\u8272: ${preset.nodeColor}`;
    const textSwatch = swatches.createDiv({ cls: "ntj-preset-swatch ntj-preset-swatch-text" });
    textSwatch.style.backgroundColor = preset.textColor;
    textSwatch.title = `\u6587\u5B57\u8272: ${preset.textColor}`;
    row.createEl("span", { cls: "ntj-preset-name", text: preset.name });
    const btnRow = row.createDiv({ cls: "ntj-preset-row-btns" });
    const editBtn = btnRow.createEl("button", { cls: "ntj-sf-btn", text: "\u7DE8\u96C6" });
    editBtn.addEventListener("click", () => this.openEditRow(parent, preset));
    const delBtn = btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-danger", text: "\u524A\u9664" });
    delBtn.addEventListener("click", async () => {
      if (!confirm(`\u300C${preset.name}\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F`)) return;
      this.store.remove(preset.id);
      await this.store.save();
      this.dirty = true;
      this.render();
    });
  }
  /** 行を編集フォームに差し替える */
  openEditRow(listParent, preset) {
    listParent.empty();
    for (const p of this.store.getAll()) {
      if (p.id === preset.id) {
        const editWrap = listParent.createDiv({ cls: "ntj-preset-edit-wrap" });
        this.renderEditForm(editWrap, p, () => this.render());
      } else {
        this.renderPresetRow(listParent, p);
      }
    }
  }
  /**
   * 追加・編集共通フォーム。
   * existing が null の場合は「新規追加」、指定時は「編集」として動作する。
   */
  renderEditForm(parent, existing, onDone) {
    var _a, _b, _c;
    const form = parent.createDiv({ cls: "ntj-preset-form" });
    let name = (_a = existing == null ? void 0 : existing.name) != null ? _a : "";
    let nodeColor = (_b = existing == null ? void 0 : existing.nodeColor) != null ? _b : "#4A90E2";
    let textColor = (_c = existing == null ? void 0 : existing.textColor) != null ? _c : "#ffffff";
    new import_obsidian5.Setting(form).setName("\u540D\u524D").addText((t) => {
      t.setValue(name).setPlaceholder("\u4F8B: \u4E3B\u4EBA\u516C");
      t.onChange((v) => {
        name = v;
      });
    });
    new import_obsidian5.Setting(form).setName("\u30CE\u30FC\u30C9\u8272").addColorPicker((c) => {
      c.setValue(nodeColor);
      c.onChange((v) => {
        nodeColor = v;
      });
    }).addText((t) => {
      t.setValue(nodeColor).setPlaceholder("#RRGGBB");
      t.onChange((v) => {
        nodeColor = v;
      });
    });
    new import_obsidian5.Setting(form).setName("\u6587\u5B57\u8272").addColorPicker((c) => {
      c.setValue(textColor);
      c.onChange((v) => {
        textColor = v;
      });
    }).addText((t) => {
      t.setValue(textColor).setPlaceholder("#RRGGBB");
      t.onChange((v) => {
        textColor = v;
      });
    });
    const btnRow = form.createDiv({ cls: "ntj-sf-btn-row" });
    const saveBtn = btnRow.createEl("button", {
      cls: "ntj-sf-btn ntj-sf-btn-primary",
      text: existing ? "\u4FDD\u5B58" : "\u8FFD\u52A0"
    });
    saveBtn.addEventListener("click", async () => {
      var _a2;
      if (!name.trim()) {
        new import_obsidian5.Notice("\u540D\u524D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return;
      }
      if (!HEX_RE.test(nodeColor.trim())) {
        new import_obsidian5.Notice("\u30CE\u30FC\u30C9\u8272\u306F #RRGGBB \u5F62\u5F0F\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return;
      }
      if (!HEX_RE.test(textColor.trim())) {
        new import_obsidian5.Notice("\u6587\u5B57\u8272\u306F #RRGGBB \u5F62\u5F0F\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
        return;
      }
      const preset = {
        id: (_a2 = existing == null ? void 0 : existing.id) != null ? _a2 : ColorPresetStore.generateId(),
        name: name.trim(),
        nodeColor: nodeColor.trim(),
        textColor: textColor.trim()
      };
      this.store.upsert(preset);
      await this.store.save();
      this.dirty = true;
      new import_obsidian5.Notice(existing ? "\u914D\u8272\u30BB\u30C3\u30C8\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F" : "\u914D\u8272\u30BB\u30C3\u30C8\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F");
      if (onDone) onDone();
      else this.render();
    });
    if (existing) {
      const cancelBtn = btnRow.createEl("button", { cls: "ntj-sf-btn", text: "\u30AD\u30E3\u30F3\u30BB\u30EB" });
      cancelBtn.addEventListener("click", () => {
        if (onDone) onDone();
        else this.render();
      });
    }
  }
};

// src/view/EventSidebarView.ts
var EVENT_SIDEBAR_VIEW_TYPE = "novels-timeline-jp-sidebar";
var INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;
var EventSidebarView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.mode = { type: "idle" };
    this.plugin = plugin;
  }
  getViewType() {
    return EVENT_SIDEBAR_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u30A4\u30D9\u30F3\u30C8\u60C5\u5831";
  }
  getIcon() {
    return "calendar-days";
  }
  async onOpen() {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("ntj-sidebar");
    this.contentEl2 = root.createDiv({ cls: "ntj-sidebar-content" });
    this.renderIdle();
  }
  async onClose() {
  }
  // ----------------------------------------------------------
  // 公開 API
  // ----------------------------------------------------------
  showCreate(dateStr, lane) {
    this.mode = { type: "create", dateStr, lane };
    this.refresh();
  }
  showViewEdit(event) {
    this.mode = { type: "view-edit", event };
    this.refresh();
  }
  /** 保存・作成・削除完了後にリーフ（サイドバー）を閉じる */
  closeLeaf() {
    this.mode = { type: "idle" };
    this.leaf.detach();
  }
  // ----------------------------------------------------------
  // 描画
  // ----------------------------------------------------------
  refresh() {
    if (!this.contentEl2) return;
    this.contentEl2.empty();
    switch (this.mode.type) {
      case "create":
        this.renderCreate(this.mode.dateStr, this.mode.lane);
        break;
      case "view-edit":
        this.renderViewEdit(this.mode.event);
        break;
      default:
        this.renderIdle();
        break;
    }
  }
  renderIdle() {
    if (!this.contentEl2) return;
    this.contentEl2.createEl("p", {
      cls: "ntj-sidebar-idle",
      text: "\u30A4\u30D9\u30F3\u30C8\u3092\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u304B\u3001\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u4E0A\u3067\u53F3\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u65B0\u898F\u30A4\u30D9\u30F3\u30C8\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
    });
  }
  // ----------------------------------------------------------
  // 暦名ヘルパー
  // ----------------------------------------------------------
  calendarName() {
    var _a, _b;
    return (_b = (_a = this.plugin.settings.calendar.name) == null ? void 0 : _a.trim()) != null ? _b : "";
  }
  /** 日付フィールドのラベル（暦名付き） */
  dateLabelText() {
    const cal = this.calendarName();
    return cal ? `${cal}\uFF1A\u65E5\u4ED8 * (yyyy/m/d)` : "\u65E5\u4ED8 * (yyyy/m/d)";
  }
  /** 日付プレースホルダ */
  datePlaceholder() {
    return "\u4F8B: 1345/5/12";
  }
  // ----------------------------------------------------------
  // 新規イベント作成フォーム
  // ----------------------------------------------------------
  renderCreate(dateStr, lane) {
    const el = this.contentEl2;
    el.createEl("h3", { cls: "ntj-sidebar-heading", text: "\u65B0\u898F\u30A4\u30D9\u30F3\u30C8\u4F5C\u6210" });
    this.addField(el, "\u30BF\u30A4\u30C8\u30EB *", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-title";
      i.placeholder = "\u4F8B: \u738B\u90FD\u3078\u306E\u51FA\u767A";
    });
    this.addField(el, this.dateLabelText(), (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-date";
      i.value = dateStr;
      i.placeholder = this.datePlaceholder();
    });
    const laneMax = this.plugin.settings.laneCount;
    this.addField(el, `\u30EC\u30FC\u30F3\uFF081\u301C${laneMax}\uFF09`, (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" });
      s.id = "ntj-f-lane";
      const clampedLane = Math.max(1, Math.min(laneMax, Math.round(lane)));
      for (let n = 1; n <= laneMax; n++) {
        const o = s.createEl("option", { text: String(n) });
        o.value = String(n);
        if (n === clampedLane) o.selected = true;
      }
    });
    this.addField(el, "\u30B5\u30A4\u30BA", (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" });
      s.id = "ntj-f-size";
      for (const [v, t] of [["small", "\u5C0F"], ["medium", "\u4E2D\uFF08\u6A19\u6E96\uFF09"], ["big", "\u5927"]]) {
        const o = s.createEl("option", { text: t });
        o.value = v;
        if (v === "medium") o.selected = true;
      }
    });
    {
      const presets = this.plugin.colorPresetStore.getAll();
      const defaultColor = presets.length > 0 ? presets[0].id : "#808080";
      this.addColorPresetField(el, "ntj-f", defaultColor);
    }
    this.addField(el, "\u767B\u5834\u4EBA\u7269\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-chars";
      i.placeholder = "\u4F8B: \u30A2\u30EC\u30F3, \u30EB\u30CA";
    });
    this.addField(el, "\u5834\u6240\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-locs";
      i.placeholder = "\u4F8B: \u738B\u90FD, \u68EE";
    });
    this.addField(el, "\u6982\u8981", (w) => {
      const ta = w.createEl("textarea", { cls: "ntj-sf-textarea" });
      ta.id = "ntj-f-summary";
      ta.rows = 3;
    });
    this.addLinksField(el, "ntj-f", []);
    this.addField(el, "\u4FDD\u5B58\u5148\u30D5\u30A9\u30EB\u30C0", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-f-folder";
      i.value = this.plugin.settings.newEventFolder || "";
      i.placeholder = "\u4F8B: events\uFF08\u7A7A\u3067Vault\u30EB\u30FC\u30C8\uFF09";
      const dl = w.createEl("datalist");
      dl.id = "ntj-folder-list";
      i.setAttribute("list", "ntj-folder-list");
      this.plugin.app.vault.getAllFolders().forEach((f) => {
        if (f.path !== "/") {
          const o = dl.createEl("option");
          o.value = f.path;
        }
      });
    });
    const btnRow = el.createDiv({ cls: "ntj-sf-btn-row" });
    const submit = btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-primary", text: "\u4F5C\u6210" });
    submit.addEventListener("click", () => this.submitCreate());
    const cancel = btnRow.createEl("button", { cls: "ntj-sf-btn", text: "\u30AF\u30EA\u30A2" });
    cancel.addEventListener("click", () => {
      this.mode = { type: "idle" };
      this.refresh();
    });
  }
  // ----------------------------------------------------------
  // 既存イベント表示・編集・削除
  // ----------------------------------------------------------
  renderViewEdit(event) {
    const el = this.contentEl2;
    el.createEl("h3", { cls: "ntj-sidebar-heading", text: event.displayTitle });
    const openRow = el.createDiv({ cls: "ntj-sf-btn-row ntj-sidebar-open-row" });
    openRow.createEl("button", {
      cls: "ntj-sf-btn",
      text: "\u{1F4C4} \u30A4\u30D9\u30F3\u30C8\u30CE\u30FC\u30C8\u3092\u958B\u304F"
    }).addEventListener("click", () => this.openEventNote(event));
    this.addField(el, "\u30BF\u30A4\u30C8\u30EB *", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-title";
      i.value = event.displayTitle;
    });
    this.addField(el, this.dateLabelText(), (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-date";
      i.value = this.toSlashFormat(event.date);
      i.placeholder = this.datePlaceholder();
    });
    const laneMaxEdit = this.plugin.settings.laneCount;
    this.addField(el, `\u30EC\u30FC\u30F3\uFF081\u301C${laneMaxEdit}\uFF09`, (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" });
      s.id = "ntj-e-lane";
      const clampedLane = Math.max(1, Math.min(laneMaxEdit, Math.round(event.lane)));
      for (let n = 1; n <= laneMaxEdit; n++) {
        const o = s.createEl("option", { text: String(n) });
        o.value = String(n);
        if (n === clampedLane) o.selected = true;
      }
    });
    this.addField(el, "\u30B5\u30A4\u30BA", (w) => {
      const s = w.createEl("select", { cls: "ntj-sf-input" });
      s.id = "ntj-e-size";
      for (const [v, t] of [["small", "\u5C0F"], ["medium", "\u4E2D"], ["big", "\u5927"]]) {
        const o = s.createEl("option", { text: t });
        o.value = v;
        if (v === (event.size || "small")) o.selected = true;
      }
    });
    this.addColorPresetField(el, "ntj-e", event.color || "#808080");
    this.addField(el, "\u767B\u5834\u4EBA\u7269\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-chars";
      i.value = event.characters.join(", ");
    });
    this.addField(el, "\u5834\u6240\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09", (w) => {
      const i = w.createEl("input", { type: "text", cls: "ntj-sf-input" });
      i.id = "ntj-e-locs";
      i.value = event.locations.join(", ");
    });
    this.addField(el, "\u6982\u8981", (w) => {
      var _a;
      const ta = w.createEl("textarea", { cls: "ntj-sf-textarea" });
      ta.id = "ntj-e-summary";
      ta.rows = 3;
      ta.value = this.restoreSummary((_a = event.summary) != null ? _a : "");
    });
    this.addLinksField(el, "ntj-e", event.links);
    const btnRow = el.createDiv({ cls: "ntj-sf-btn-row" });
    btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-primary", text: "\u4FDD\u5B58" }).addEventListener("click", () => this.submitEdit(event));
    btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-danger", text: "\u524A\u9664" }).addEventListener("click", () => this.confirmDelete(event));
    btnRow.createEl("button", { cls: "ntj-sf-btn", text: "\u9589\u3058\u308B" }).addEventListener("click", () => {
      this.mode = { type: "idle" };
      this.refresh();
    });
  }
  // ----------------------------------------------------------
  // Vault横断でイベント一覧を取得するヘルパー
  // ----------------------------------------------------------
  //
  // TimelineView（タイムライン画面）が開いていなくてもサイドバー単体で
  // 正しく動作するよう、TimelineView の EventStore には依存せず、
  // vault + metadataCache から直接フロントマターを読み取る。
  // NTJP_date の有無で「イベントファイルかどうか」を判定する
  // （DiscoveryEngine の判定条件と揃えている）。
  listAllEvents() {
    var _a;
    const { vault, metadataCache } = this.plugin.app;
    const dateParser = new DateParser(this.plugin.settings.calendar);
    const items = [];
    for (const file of vault.getMarkdownFiles()) {
      const fm = (_a = metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
      if (!fm || fm[NTJP_KEYS.date] === void 0) continue;
      const rawTitle = fm[NTJP_KEYS.eventTitle];
      const displayTitle = typeof rawTitle === "string" && rawTitle.trim().length > 0 ? rawTitle.trim() : file.basename.replace(/^\d+-/, "");
      const dateStr = String(fm[NTJP_KEYS.date]).trim();
      const parsed = dateParser.parse(dateStr);
      const timelineOrder = parsed.ok ? parsed.timelineOrder : Number.POSITIVE_INFINITY;
      const dateLabel = parsed.ok ? dateParser.formatSlash(parsed.parsed) : dateStr;
      items.push({
        id: file.basename,
        displayTitle,
        dateLabel,
        timelineOrder
      });
    }
    return items;
  }
  /**
   * 新規イベント用のファイル名連番を算出する。
   * フロントマターには一切保存せず、常にファイル名（既存イベントファイルの
   * "NNNN-" プレフィックス）から直接算出することで、番号の分裂・不整合を
   * 起こしようがない設計にしている。
   */
  getNextFileNumber() {
    var _a;
    const { vault, metadataCache } = this.plugin.app;
    let max = 0;
    for (const file of vault.getMarkdownFiles()) {
      const fm = (_a = metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
      if (!fm || fm[NTJP_KEYS.date] === void 0) continue;
      const m = file.basename.match(/^(\d+)-/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }
  // ----------------------------------------------------------
  // 関連イベント選択UI
  // ----------------------------------------------------------
  addLinksField(el, prefix, currentLinks) {
    const field = el.createDiv({ cls: "ntj-sf-field" });
    field.createEl("label", { cls: "ntj-sf-label", text: "\u95A2\u9023\u30A4\u30D9\u30F3\u30C8" });
    const listEl = field.createDiv({ cls: "ntj-sf-link-list" });
    listEl.id = `${prefix}-links-list`;
    const selfId = this.mode.type === "view-edit" ? this.mode.event.id : null;
    const allEvents = this.listAllEvents().filter((e) => e.id !== selfId).sort((a, b) => a.timelineOrder - b.timelineOrder);
    const eventById = new Map(allEvents.map((e) => [e.id, e]));
    for (const linkId of currentLinks) {
      this.addLinkItem(listEl, linkId, eventById);
    }
    const addRow = field.createDiv({ cls: "ntj-sf-link-add-row" });
    const select = addRow.createEl("select", { cls: "ntj-sf-input ntj-sf-link-select" });
    select.id = `${prefix}-link-select`;
    const placeholder = select.createEl("option", { text: "\u25BC\u30A4\u30D9\u30F3\u30C8\u3092\u9078\u629E" });
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    for (const e of allEvents) {
      const label = `${e.dateLabel}  ${e.displayTitle}`;
      const o = select.createEl("option", { text: label });
      o.value = e.id;
    }
    const addBtn = addRow.createEl("button", { cls: "ntj-sf-btn", text: "\u8FFD\u52A0" });
    addBtn.addEventListener("click", () => {
      const val = select.value;
      if (!val) return;
      const existing = Array.from(listEl.querySelectorAll(".ntj-sf-link-id")).map((e) => {
        var _a;
        return (_a = e.dataset.id) != null ? _a : "";
      });
      if (existing.includes(val)) {
        new import_obsidian6.Notice(`\u300C${val}\u300D\u306F\u3059\u3067\u306B\u8FFD\u52A0\u3055\u308C\u3066\u3044\u307E\u3059`);
        return;
      }
      this.addLinkItem(listEl, val, eventById);
      select.value = "";
    });
  }
  addLinkItem(listEl, linkId, eventById) {
    const item = listEl.createDiv({ cls: "ntj-sf-link-item" });
    const matched = eventById.get(linkId);
    const displayText = matched ? `${matched.dateLabel}  ${matched.displayTitle}` : linkId;
    const nameEl = item.createSpan({ cls: "ntj-sf-link-id", text: displayText });
    nameEl.dataset.id = linkId;
    if (!matched) {
      nameEl.addClass("ntj-sf-link-missing");
      item.createSpan({ cls: "ntj-sf-link-warn", text: " \u26A0 \u5B58\u5728\u3057\u306A\u3044\u30A4\u30D9\u30F3\u30C8" });
    }
    const delBtn = item.createEl("button", { cls: "ntj-sf-link-del", text: "\u2715" });
    delBtn.addEventListener("click", () => item.remove());
  }
  /** リンクリストから現在の選択値を取得 */
  getLinksFromList(listId) {
    const listEl = this.contentEl2.querySelector(`#${listId}`);
    if (!listEl) return [];
    return Array.from(listEl.querySelectorAll(".ntj-sf-link-id")).map((e) => {
      var _a;
      return (_a = e.dataset.id) != null ? _a : "";
    }).filter(Boolean);
  }
  // ----------------------------------------------------------
  // フォーム送信：新規作成
  // ----------------------------------------------------------
  async submitCreate() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    const get2 = (id) => this.contentEl2.querySelector(`#${id}`);
    const title = (_b = (_a = get2("ntj-f-title")) == null ? void 0 : _a.value.trim()) != null ? _b : "";
    const dateRaw = (_d = (_c = get2("ntj-f-date")) == null ? void 0 : _c.value.trim()) != null ? _d : "";
    const laneStr = (_f = (_e = this.contentEl2.querySelector("#ntj-f-lane")) == null ? void 0 : _e.value) != null ? _f : "";
    const size = (_h = (_g = this.contentEl2.querySelector("#ntj-f-size")) == null ? void 0 : _g.value) != null ? _h : "small";
    const colorVal = (_j = (_i = get2("ntj-f-color")) == null ? void 0 : _i.value.trim()) != null ? _j : "#808080";
    const chars = (_l = (_k = get2("ntj-f-chars")) == null ? void 0 : _k.value.trim()) != null ? _l : "";
    const locs = (_n = (_m = get2("ntj-f-locs")) == null ? void 0 : _m.value.trim()) != null ? _n : "";
    const summary = this.normalizeSummary(
      (_p = (_o = this.contentEl2.querySelector("#ntj-f-summary")) == null ? void 0 : _o.value) != null ? _p : ""
    );
    const folder = (_r = (_q = get2("ntj-f-folder")) == null ? void 0 : _q.value.trim().replace(/\/$/, "")) != null ? _r : "";
    const links = this.getLinksFromList("ntj-f-links-list");
    const errs = this.validateAll({ title, dateRaw, laneStr, colorVal });
    if (errs.length > 0) {
      new import_obsidian6.Notice(errs.join("\n"));
      return;
    }
    const date = DateParser.normalizeFullWidth(dateRaw);
    const lane = parseInt(laneStr, 10);
    const color = colorVal || "#808080";
    await this.createEventFile({ title, date, lane, size, color, chars, locs, summary, folder, links });
    this.closeLeaf();
  }
  // ----------------------------------------------------------
  // フォーム送信：編集保存
  // ----------------------------------------------------------
  async submitEdit(event) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    const get2 = (id) => this.contentEl2.querySelector(`#${id}`);
    const title = (_b = (_a = get2("ntj-e-title")) == null ? void 0 : _a.value.trim()) != null ? _b : event.displayTitle;
    const dateRaw = (_d = (_c = get2("ntj-e-date")) == null ? void 0 : _c.value.trim()) != null ? _d : this.toSlashFormat(event.date);
    const laneStr = (_f = (_e = this.contentEl2.querySelector("#ntj-e-lane")) == null ? void 0 : _e.value) != null ? _f : String(event.lane);
    const size = ((_g = this.contentEl2.querySelector("#ntj-e-size")) == null ? void 0 : _g.value) || "small";
    const colorVal = (_i = (_h = get2("ntj-e-color")) == null ? void 0 : _h.value.trim()) != null ? _i : event.color;
    const chars = (_k = (_j = get2("ntj-e-chars")) == null ? void 0 : _j.value.trim()) != null ? _k : event.characters.join(", ");
    const locs = (_m = (_l = get2("ntj-e-locs")) == null ? void 0 : _l.value.trim()) != null ? _m : event.locations.join(", ");
    const summary = this.normalizeSummary(
      (_p = (_o = (_n = this.contentEl2.querySelector("#ntj-e-summary")) == null ? void 0 : _n.value) != null ? _o : event.summary) != null ? _p : ""
    );
    const links = this.getLinksFromList("ntj-e-links-list");
    const errs = this.validateAll({ title, dateRaw, laneStr, colorVal });
    if (errs.length > 0) {
      new import_obsidian6.Notice(errs.join("\n"));
      return;
    }
    const date = DateParser.normalizeFullWidth(dateRaw);
    const lane = parseInt(laneStr, 10);
    const color = colorVal || "#808080";
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (!file) {
      new import_obsidian6.Notice("\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    try {
      const charList = chars.split(",").map((s) => s.trim()).filter(Boolean);
      const locList = locs.split(",").map((s) => s.trim()).filter(Boolean);
      await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
        fm[NTJP_KEYS.eventTitle] = title;
        fm[NTJP_KEYS.date] = date;
        fm[NTJP_KEYS.lane] = lane;
        fm[NTJP_KEYS.node] = size;
        fm[NTJP_KEYS.colors] = color;
        fm[NTJP_KEYS.characters] = charList;
        fm[NTJP_KEYS.locations] = locList;
        fm[NTJP_KEYS.summary] = summary || void 0;
        fm[NTJP_KEYS.links] = links.map((l) => `[[${l}]]`);
      });
      const oldBaseName = file.basename;
      const prefix = (_r = (_q = oldBaseName.match(/^(\d+)-/)) == null ? void 0 : _q[1]) != null ? _r : "";
      const newBaseName = prefix ? `${prefix}-${title}` : title;
      const newFullPath = (0, import_obsidian6.normalizePath)(
        file.parent ? `${file.parent.path}/${newBaseName}.md` : `${newBaseName}.md`
      );
      if (newBaseName !== oldBaseName) {
        await this.plugin.app.fileManager.renameFile(file, newFullPath);
      }
      new import_obsidian6.Notice("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
      this.closeLeaf();
    } catch (e) {
      new import_obsidian6.Notice(`\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
    }
  }
  // ----------------------------------------------------------
  // バリデーション（全項目）
  // ----------------------------------------------------------
  validateAll(params) {
    const errors = [];
    const { title, dateRaw, laneStr, colorVal } = params;
    if (!title) {
      errors.push("\u30BF\u30A4\u30C8\u30EB\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    } else if (INVALID_FILENAME_CHARS.test(title)) {
      errors.push(`\u30BF\u30A4\u30C8\u30EB\u306B\u4F7F\u7528\u3067\u304D\u306A\u3044\u8A18\u53F7\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\uFF08\\ / : * ? " < > |\uFF09`);
    }
    const normalized = DateParser.normalizeFullWidth(dateRaw);
    if (!normalized) {
      errors.push("\u65E5\u4ED8\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    } else {
      const slashOnly = /^\d+\/\d+\/\d+$/.test(normalized);
      if (!slashOnly) {
        errors.push("\u65E5\u4ED8\u306F yyyy/m/d \u5F62\u5F0F\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B: 1345/5/12\uFF09\u3002");
      } else {
        const parser = new DateParser(this.plugin.settings.calendar);
        const result = parser.parse(normalized);
        if (!result.ok) {
          errors.push(`\u65E5\u4ED8\u304C\u66A6\u306E\u7BC4\u56F2\u5916\u3067\u3059: ${result.reason}`);
        }
      }
    }
    const laneMax = this.plugin.settings.laneCount;
    const lane = parseInt(laneStr, 10);
    if (isNaN(lane) || lane < 1 || lane > laneMax) {
      errors.push(`\u30EC\u30FC\u30F3\u306F 1\u301C${laneMax} \u306E\u6574\u6570\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
    }
    if (!colorVal) {
      errors.push("\u914D\u8272\u30BB\u30C3\u30C8\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    return errors;
  }
  // ----------------------------------------------------------
  // イベントノートを開く（メインペインに新規タブ）
  // ----------------------------------------------------------
  async openEventNote(event) {
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (!file) {
      new import_obsidian6.Notice("\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    const leaf = this.plugin.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
  }
  // ----------------------------------------------------------
  // 削除確認
  // ----------------------------------------------------------
  async confirmDelete(event) {
    const confirmed = confirm(
      `\u300C${event.displayTitle}\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F
\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002`
    );
    if (!confirmed) return;
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (!file) {
      new import_obsidian6.Notice("\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    try {
      await this.plugin.app.vault.trash(file, true);
      new import_obsidian6.Notice(`\u524A\u9664\u3057\u307E\u3057\u305F: ${event.displayTitle}`);
      this.closeLeaf();
    } catch (e) {
      new import_obsidian6.Notice(`\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
    }
  }
  // ----------------------------------------------------------
  // ファイル生成
  // ----------------------------------------------------------
  async createEventFile(params) {
    const vault = this.plugin.app.vault;
    const nextNumber = this.getNextFileNumber();
    const padded = String(nextNumber).padStart(4, "0");
    const fileName = `${padded}-${params.title}.md`;
    const folder = params.folder ? (0, import_obsidian6.normalizePath)(params.folder) : "";
    const fullPath = (0, import_obsidian6.normalizePath)(folder ? `${folder}/${fileName}` : fileName);
    if (folder) {
      if (!vault.getAbstractFileByPath(folder)) {
        try {
          await vault.createFolder(folder);
        } catch (e) {
        }
      }
    }
    const chars = params.chars.split(",").map((s) => s.trim()).filter(Boolean);
    const locs = params.locs.split(",").map((s) => s.trim()).filter(Boolean);
    const frontmatter = this.buildFrontmatterText({
      title: params.title,
      date: params.date,
      lane: params.lane,
      size: params.size,
      color: params.color,
      characters: chars,
      locations: locs,
      summary: params.summary,
      links: params.links
    });
    const content = `${frontmatter}
# ${params.title}
`;
    try {
      await vault.create(fullPath, content);
      new import_obsidian6.Notice(`\u4F5C\u6210\u3057\u307E\u3057\u305F: ${fullPath}`);
    } catch (e) {
      new import_obsidian6.Notice(`\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
    }
  }
  // ----------------------------------------------------------
  // フロントマター生成（新規作成専用）
  // ----------------------------------------------------------
  //
  // 新規ファイルにはまだ他プラグインのフロントマターキーが存在しないため、
  // processFrontMatter を使わずテキストを直接組み立てる。
  // Wikilink は YAML 上で quote しないと "[[" がフロー配列として
  // 誤解釈されるため、明示的にダブルクォートで囲む。
  buildFrontmatterText(fields) {
    const lines = ["---"];
    lines.push(`${NTJP_KEYS.eventTitle}: "${this.escapeYamlDouble(fields.title)}"`);
    lines.push(`${NTJP_KEYS.date}: ${fields.date}`);
    lines.push(`${NTJP_KEYS.lane}: ${fields.lane}`);
    lines.push(`${NTJP_KEYS.node}: ${fields.size}`);
    lines.push(`${NTJP_KEYS.colors}: "${fields.color}"`);
    if (fields.characters.length > 0) {
      lines.push(`${NTJP_KEYS.characters}:`);
      for (const c of fields.characters) lines.push(`  - ${c}`);
    } else {
      lines.push(`${NTJP_KEYS.characters}: []`);
    }
    if (fields.locations.length > 0) {
      lines.push(`${NTJP_KEYS.locations}:`);
      for (const l of fields.locations) lines.push(`  - ${l}`);
    } else {
      lines.push(`${NTJP_KEYS.locations}: []`);
    }
    lines.push(`${NTJP_KEYS.summary}: "${this.escapeYamlDouble(fields.summary)}"`);
    if (fields.links.length > 0) {
      lines.push(`${NTJP_KEYS.links}:`);
      for (const l of fields.links) lines.push(`  - "[[${l}]]"`);
    } else {
      lines.push(`${NTJP_KEYS.links}: []`);
    }
    lines.push("---", "");
    return lines.join("\n");
  }
  escapeYamlDouble(text) {
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------
  /** 任意形式の日付文字列を yyyy/m/d に変換して返す */
  toSlashFormat(dateStr) {
    if (!dateStr) return "";
    const parser = new DateParser(this.plugin.settings.calendar);
    const result = parser.parse(dateStr);
    if (!result.ok) return dateStr;
    return parser.formatSlash(result.parsed);
  }
  normalizeSummary(text) {
    return text.replace(/\r\n/g, "_LineBreak_").replace(/\r/g, "_LineBreak_").replace(/\n/g, "_LineBreak_").trim();
  }
  restoreSummary(text) {
    return text.replace(/_LineBreak_/g, "\n");
  }
  addField(parent, labelText, build) {
    const field = parent.createDiv({ cls: "ntj-sf-field" });
    field.createEl("label", { cls: "ntj-sf-label", text: labelText });
    build(field.createDiv({ cls: "ntj-sf-input-wrapper" }));
  }
  /**
   * 配色セットから選択するフィールド。
   * 選択結果は隠しinput（id: `${idPrefix}-color`）に「配色セットのID」として
   * 書き込まれる（実色ではない）。submitCreate/submitEdit はこのIDをそのまま
   * イベントノートの NTJP_colors フィールドへ保存する。
   * こうすることで、配色セット側の色を変更すれば、それを参照する
   * 全イベントの表示色を一括で変更できる。
   *
   * currentColorValue は既存イベントの NTJP_colors フィールドの現在値
   * （配色セットIDまたは配色セット導入前の生HEX値）。
   * どの配色セットにも一致しない場合は、データを勝手に書き換えないよう
   * 「カスタム（現在の色）」を選択肢に加え、その値をそのまま保持する。
   */
  addColorPresetField(parent, idPrefix, currentColorValue) {
    const store = this.plugin.colorPresetStore;
    this.addField(parent, "\u914D\u8272\u30BB\u30C3\u30C8", (w) => {
      const row = w.createDiv({ cls: "ntj-sf-color-row" });
      const select = row.createEl("select", { cls: "ntj-sf-input" });
      const previewWrap = row.createDiv({ cls: "ntj-sf-color-preview" });
      const previewSwatch = previewWrap.createDiv({ cls: "ntj-sf-color-preview-swatch" });
      previewSwatch.setText("12");
      const colorInput = row.createEl("input", { type: "hidden" });
      colorInput.id = `${idPrefix}-color`;
      const applySelection = () => {
        colorInput.value = select.value === "__custom__" ? currentColorValue : select.value;
        const colors = store.resolve(colorInput.value);
        previewSwatch.style.backgroundColor = colors.nodeColor;
        previewSwatch.style.color = colors.textColor;
      };
      const populate = () => {
        select.empty();
        const presets = store.getAll();
        const matched = store.getById(currentColorValue);
        if (!matched) {
          const customOpt = select.createEl("option", { text: "\u30AB\u30B9\u30BF\u30E0\uFF08\u73FE\u5728\u306E\u8272\uFF09" });
          customOpt.value = "__custom__";
        }
        for (const p of presets) {
          const opt = select.createEl("option", { text: p.name });
          opt.value = p.id;
        }
        select.value = matched ? matched.id : "__custom__";
        applySelection();
      };
      select.addEventListener("change", applySelection);
      const editBtn = row.createEl("button", {
        type: "button",
        cls: "ntj-sf-btn",
        text: "\u7DE8\u96C6..."
      });
      editBtn.addEventListener("click", () => {
        new ColorPresetModal(this.plugin.app, store, () => populate()).open();
      });
      populate();
    });
  }
};

// src/settings/SettingsTab.ts
var import_obsidian7 = require("obsidian");
var NovelsTimelineSettingTab = class extends import_obsidian7.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  // ----------------------------------------------------------
  // control 定義は this.plugin.settings[key] を直接読み書きする。
  // 保存後にタイムラインビューへ反映する必要があるため、書き込み経路
  // だけを上書きし、保存直後に notifySettingsChanged() を呼ぶ。
  // （control を使わない項目＝newEventFolder は render 側で個別に
  //   saveSettings() のみ呼んでおり、この経路は通らない）
  // ----------------------------------------------------------
  async setControlValue(key, value) {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
    this.plugin.notifySettingsChanged();
  }
  getSettingDefinitions() {
    return [
      // ========================================================
      // General（先頭セクションのため見出しは付けない）
      // ========================================================
      {
        name: "\u65B0\u898F\u30A4\u30D9\u30F3\u30C8\u306E\u4FDD\u5B58\u5148\u30D5\u30A9\u30EB\u30C0",
        desc: "\u53F3\u30AF\u30EA\u30C3\u30AF\u3067\u4F5C\u6210\u3059\u308B\u30A4\u30D9\u30F3\u30C8\u30CE\u30FC\u30C8\u306E\u4FDD\u5B58\u5148\uFF08\u7A7A\u306E\u5834\u5408\u306F Vault \u30EB\u30FC\u30C8\uFF09",
        render: (setting) => {
          setting.addText(
            (text) => text.setPlaceholder("\u4F8B: events / stories/chapter1").setValue(this.plugin.settings.newEventFolder).onChange(async (value) => {
              const trimmed = value.trim();
              this.plugin.settings.newEventFolder = trimmed ? (0, import_obsidian7.normalizePath)(trimmed) : "";
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "Excluded folders",
        desc: "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u63A2\u7D22\u304B\u3089\u9664\u5916\u3059\u308B\u30D5\u30A9\u30EB\u30C0\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09",
        render: (setting) => {
          setting.addText(
            (text) => text.setPlaceholder("Templates, Archive, Trash").setValue(this.plugin.settings.excludedFolders.join(", ")).onChange(async (value) => {
              this.plugin.settings.excludedFolders = value.split(",").map((s) => s.trim()).filter((s) => s !== "").map((s) => (0, import_obsidian7.normalizePath)(s));
              await this.plugin.saveSettings();
              this.plugin.notifySettingsChanged();
            })
          );
        }
      },
      // ========================================================
      // Display
      // ========================================================
      {
        type: "group",
        heading: "Display",
        items: [
          {
            name: "Board zoom",
            desc: `\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u30DC\u30FC\u30C9\u306E\u62E1\u5927\u7387\uFF08${BOARD_ZOOM_MIN}\u301C${BOARD_ZOOM_MAX}%\uFF09\u3002\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u4E0A\u3067 Shift+\u30DB\u30A4\u30FC\u30EB\u3067\u3082\u5909\u66F4\u3067\u304D\u307E\u3059\u3002`,
            render: (setting) => {
              setting.addSlider(
                (slider) => slider.setLimits(BOARD_ZOOM_MIN, BOARD_ZOOM_MAX, 10).setValue(this.plugin.settings.boardZoom).setDynamicTooltip().onChange(async (value) => {
                  this.plugin.settings.boardZoom = value;
                  await this.plugin.saveSettings();
                  this.plugin.notifySettingsChanged();
                })
              ).addExtraButton(
                (btn) => btn.setIcon("reset").setTooltip(`${BOARD_ZOOM_DEFAULT}%\u306B\u623B\u3059`).onClick(async () => {
                  this.plugin.settings.boardZoom = BOARD_ZOOM_DEFAULT;
                  await this.plugin.saveSettings();
                  this.plugin.notifySettingsChanged();
                  this.update();
                })
              );
            }
          },
          {
            name: "\u914D\u8272\u30BB\u30C3\u30C8",
            desc: "\u30A4\u30D9\u30F3\u30C8\u4F5C\u6210\u30FB\u7DE8\u96C6\u6642\u306B\u9078\u3079\u308B\u300C\u30CE\u30FC\u30C9\u8272\uFF0B\u6587\u5B57\u8272\u300D\u306E\u7D44\u307F\u5408\u308F\u305B\u3092\u7BA1\u7406\u3057\u307E\u3059\u3002",
            action: () => {
              new ColorPresetModal(this.app, this.plugin.colorPresetStore, () => {
              }).open();
            }
          }
        ]
      },
      // ========================================================
      // Relation
      // ========================================================
      {
        type: "group",
        heading: "Relation",
        items: [
          {
            name: "Relation color",
            desc: "\u95A2\u4FC2\u7DDA\u306E\u8272",
            control: { type: "color", key: "relationColor" }
          },
          {
            name: "Relation style",
            control: {
              type: "dropdown",
              key: "relationStyle",
              options: { solid: "Solid", dashed: "Dashed", dotted: "Dotted" }
            }
          },
          {
            name: "Relation width",
            desc: "\u95A2\u4FC2\u7DDA\u306E\u592A\u3055\uFF081\u301C6px\uFF09",
            control: { type: "slider", key: "relationWidth", min: 1, max: 6, step: 1 }
          },
          {
            name: "Relation arrow style",
            control: {
              type: "dropdown",
              key: "relationArrowStyle",
              options: { none: "None", arrow: "Arrow", triangle: "Triangle" }
            }
          },
          {
            name: "Relation opacity",
            desc: "\u900F\u660E\u5EA6\uFF0810\u301C100%\uFF09",
            render: (setting) => {
              setting.addSlider(
                (slider) => slider.setLimits(10, 100, 5).setValue(Math.round(this.plugin.settings.relationOpacity * 100)).setDynamicTooltip().onChange(async (value) => {
                  this.plugin.settings.relationOpacity = value / 100;
                  await this.plugin.saveSettings();
                  this.plugin.notifySettingsChanged();
                })
              );
            }
          },
          {
            name: "Relation curve strength",
            desc: "\u30D9\u30B8\u30A7\u66F2\u7387\uFF080\u301C100\uFF09",
            control: { type: "slider", key: "relationCurveStrength", min: 0, max: 100, step: 5 }
          }
        ]
      },
      // ========================================================
      // Timeline
      // ========================================================
      {
        type: "group",
        heading: "Timeline",
        items: [
          {
            name: "Lane count",
            desc: `\u6642\u9593\u8EF8\u306E\u53F3\u5074\u306B\u4E26\u3079\u308B\u30EC\u30FC\u30F3\u5217\u306E\u6570\uFF08${LANE_COUNT_MIN}\u301C${LANE_COUNT_MAX}\uFF09\u3002\u65E2\u5B58\u30A4\u30D9\u30F3\u30C8\u306E\u30EC\u30FC\u30F3\u756A\u53F7\u304C\u3053\u306E\u5024\u3092\u8D85\u3048\u308B\u5834\u5408\u306F\u3001\u8868\u793A\u4E0A\u306F\u6700\u5927\u30EC\u30FC\u30F3\u306B\u4E38\u3081\u3066\u63CF\u753B\u3055\u308C\u307E\u3059\uFF08\u30CE\u30FC\u30C8\u5074\u306E\u5024\u306F\u5909\u66F4\u3055\u308C\u307E\u305B\u3093\uFF09\u3002`,
            render: (setting) => {
              setting.addSlider(
                (slider) => slider.setLimits(LANE_COUNT_MIN, LANE_COUNT_MAX, LANE_COUNT_STEP).setValue(this.plugin.settings.laneCount).setDynamicTooltip().onChange(async (value) => {
                  this.plugin.settings.laneCount = value;
                  await this.plugin.saveSettings();
                  this.plugin.notifySettingsChanged();
                })
              ).addExtraButton(
                (btn) => btn.setIcon("reset").setTooltip(`${LANE_COUNT_DEFAULT}\u306B\u623B\u3059`).onClick(async () => {
                  this.plugin.settings.laneCount = LANE_COUNT_DEFAULT;
                  await this.plugin.saveSettings();
                  this.plugin.notifySettingsChanged();
                  this.update();
                })
              );
            }
          },
          {
            name: "Gap compression",
            desc: "\u9577\u671F\u9593\u306E\u7A7A\u767D\u3092\u5727\u7E2E\u8868\u793A\u3059\u308B",
            control: { type: "toggle", key: "gapCompression" }
          },
          {
            name: "Gap threshold",
            desc: `Gap\u751F\u6210\u6761\u4EF6\uFF08\u65E5\u6570\u76F8\u5F53\u5024\u3001${GAP_THRESHOLD_MIN}\u301C${GAP_THRESHOLD_MAX}\uFF09\u3002\u30A4\u30D9\u30F3\u30C8\u9593\u9694\u304C\u3053\u306E\u5024\u4EE5\u4E0A\u306E\u5834\u5408\u306BGap\u3068\u3057\u3066\u5727\u7E2E\u8868\u793A\u3059\u308B\u3002`,
            render: (setting) => {
              setting.addSlider(
                (slider) => slider.setLimits(GAP_THRESHOLD_MIN, GAP_THRESHOLD_MAX, GAP_THRESHOLD_STEP).setValue(this.plugin.settings.gapThreshold).setDynamicTooltip().onChange(async (value) => {
                  this.plugin.settings.gapThreshold = value;
                  await this.plugin.saveSettings();
                  this.plugin.notifySettingsChanged();
                })
              ).addExtraButton(
                (btn) => btn.setIcon("reset").setTooltip(`${GAP_THRESHOLD_DEFAULT}\u306B\u623B\u3059`).onClick(async () => {
                  this.plugin.settings.gapThreshold = GAP_THRESHOLD_DEFAULT;
                  await this.plugin.saveSettings();
                  this.plugin.notifySettingsChanged();
                  this.update();
                })
              );
            }
          }
        ]
      },
      // ========================================================
      // Calendar（暦設定）
      // 月の追加・削除・名前/日数編集は動的な表形式UIのため、
      // 宣言型定義ではなく命令的なサブページ（SettingPage）として
      // 実装する。ページ自体は getSettingDefinitions() に登録される
      // ため、「Calendar（暦設定）」という名前・説明は検索対象になる。
      // ========================================================
      {
        type: "page",
        name: "Calendar\uFF08\u66A6\u8A2D\u5B9A\uFF09",
        desc: "\u7269\u8A9E\u4E16\u754C\u306E\u66A6\uFF08\u6708\u6570\u30FB\u6708\u540D\u30FB\u5404\u6708\u306E\u65E5\u6570\uFF09\u3092\u8A2D\u5B9A\u3057\u307E\u3059\u3002",
        page: () => new CalendarSettingsPage(this.plugin)
      },
      // ========================================================
      // Advanced
      // ========================================================
      {
        type: "group",
        heading: "Advanced",
        items: [
          {
            name: "Virtual rendering",
            desc: "\u4EEE\u60F3\u63CF\u753B\uFF08\u8868\u793A\u7BC4\u56F2\u5916\u306E\u30CE\u30FC\u30C9\u3092\u63CF\u753B\u3057\u306A\u3044\uFF09",
            control: { type: "toggle", key: "virtualRendering" }
          },
          {
            name: "Render buffer",
            desc: "\u5148\u8AAD\u307F\u63CF\u753B\u7BC4\u56F2\uFF08px\uFF09",
            control: { type: "number", key: "renderBuffer", min: 0 }
          },
          {
            name: "Rebuild cache",
            desc: "\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u524A\u9664\u3057\u3066\u5168\u518D\u89E3\u6790\u3059\u308B",
            action: async () => {
              const view = this.plugin.getTimelineView();
              if (view) {
                await view.rebuildAll();
                new import_obsidian7.Notice("\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u518D\u69CB\u7BC9\u3057\u307E\u3057\u305F");
              } else {
                new import_obsidian7.Notice("\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u30D3\u30E5\u30FC\u304C\u958B\u3044\u3066\u3044\u307E\u305B\u3093");
              }
            }
          }
        ]
      }
    ];
  }
};
var CalendarSettingsPage = class extends import_obsidian7.SettingPage {
  constructor(plugin) {
    super();
    this.plugin = plugin;
    this.title = "Calendar\uFF08\u66A6\u8A2D\u5B9A\uFF09";
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "\u7269\u8A9E\u4E16\u754C\u306E\u66A6\u3092\u5B9A\u7FA9\u3057\u307E\u3059\u3002\u6708\u6570\u30FB\u6708\u540D\u30FB\u5404\u6708\u306E\u65E5\u6570\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      cls: "setting-item-description"
    });
    const calendar = this.plugin.settings.calendar;
    new import_obsidian7.Setting(containerEl).setName("\u66A6\u306E\u540D\u524D").setDesc("\u8868\u793A\u7528\uFF08\u4EFB\u610F\uFF09").addText(
      (text) => text.setValue(calendar.name).onChange(async (value) => {
        this.plugin.settings.calendar.name = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    this.buildCalendarTable(containerEl, calendar);
    new import_obsidian7.Setting(containerEl).setName("\u6708\u3092\u8FFD\u52A0").setDesc("\u66A6\u306B\u6708\u3092\u8FFD\u52A0\u3057\u307E\u3059").addButton(
      (btn) => btn.setButtonText("\uFF0B \u6708\u3092\u8FFD\u52A0").onClick(async () => {
        const months = this.plugin.settings.calendar.months;
        const nextMonth = months.length + 1;
        months.push({ month: nextMonth, name: "", days: 30 });
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
        this.display();
      })
    );
    new import_obsidian7.Setting(containerEl).setName("\u30C7\u30D5\u30A9\u30EB\u30C8\u66A6\u306B\u623B\u3059").setDesc("\u66A6\u540D\u3092\u300C\u897F\u66A6\u300D\u3001\u6708\u540D\u3092\u672A\u8A2D\u5B9A\u306B\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3059").addButton(
      (btn) => btn.setButtonText("\u30EA\u30BB\u30C3\u30C8").setWarning().onClick(async () => {
        this.plugin.settings.calendar = JSON.parse(JSON.stringify(DEFAULT_CALENDAR));
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
        this.display();
      })
    );
  }
  // ----------------------------------------------------------
  // 暦テーブルUI
  // ----------------------------------------------------------
  buildCalendarTable(containerEl, calendar) {
    const tableWrapper = containerEl.createDiv({ cls: "ntj-calendar-table" });
    const table = tableWrapper.createEl("table");
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "\u6708\u756A\u53F7" });
    headerRow.createEl("th", { text: "\u6708\u540D\uFF08\u4EFB\u610F\uFF09" });
    headerRow.createEl("th", { text: "\u65E5\u6570" });
    headerRow.createEl("th", { text: "" });
    const tbody = table.createEl("tbody");
    for (let i = 0; i < calendar.months.length; i++) {
      this.buildCalendarRow(tbody, calendar.months, i);
    }
  }
  buildCalendarRow(tbody, months, index) {
    const month = months[index];
    const tr = tbody.createEl("tr");
    tr.createEl("td", { text: String(month.month) });
    const nameTd = tr.createEl("td");
    const nameInput = nameTd.createEl("input", { type: "text", cls: "ntj-calendar-month-name-input" });
    nameInput.value = month.name;
    nameInput.placeholder = "\u4F8B\uFF1A\u4E00\u6708";
    nameInput.addEventListener("change", async () => {
      months[index].name = nameInput.value;
      await this.plugin.saveSettings();
      this.plugin.notifySettingsChanged();
    });
    const daysTd = tr.createEl("td");
    const daysInput = daysTd.createEl("input", { type: "number", cls: "ntj-calendar-month-days-input" });
    daysInput.value = String(month.days);
    daysInput.min = "1";
    daysInput.max = "999";
    daysInput.addEventListener("change", async () => {
      const n = parseInt(daysInput.value, 10);
      if (Number.isFinite(n) && n >= 1) {
        months[index].days = n;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      }
    });
    const delTd = tr.createEl("td");
    const delBtn = delTd.createEl("button", { text: "\u524A\u9664" });
    delBtn.addEventListener("click", async () => {
      months.splice(index, 1);
      months.forEach((m, i) => {
        m.month = i + 1;
      });
      await this.plugin.saveSettings();
      this.plugin.notifySettingsChanged();
      this.display();
    });
  }
};

// src/main.ts
var NovelsTimelinePlugin = class extends import_obsidian8.Plugin {
  async onload() {
    await this.loadSettings();
    this.colorPresetStore = new ColorPresetStore(this.app);
    await this.colorPresetStore.load();
    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new TimelineView(leaf, this)
    );
    this.registerView(
      EVENT_SIDEBAR_VIEW_TYPE,
      (leaf) => new EventSidebarView(leaf, this)
    );
    const ribbonEl = this.addRibbonIcon("timeline", "Novels Timeline JP", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-novels-timeline",
      name: "\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u3092\u958B\u304F",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "rebuild-novels-timeline-cache",
      name: "\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u518D\u69CB\u7BC9",
      callback: async () => {
        const view = this.getTimelineView();
        if (view) {
          await view.rebuildAll();
          new import_obsidian8.Notice("\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u518D\u69CB\u7BC9\u3057\u307E\u3057\u305F");
        }
      }
    });
    this.addSettingTab(new NovelsTimelineSettingTab(this.app, this));
  }
  onunload() {
  }
  // ----------------------------------------------------------
  // 設定
  // ----------------------------------------------------------
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  /**
   * 設定をディスクに保存する。
   * ビューへの反映は行わない（連鎖フリーズ防止）。
   * ビュー反映が必要な場合は notifySettingsChanged() を別途呼ぶ。
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /**
   * 設定タブからの変更完了時にビューへ反映する。
   * wheel イベント等の高頻度操作からは呼ばないこと。
   */
  notifySettingsChanged() {
    var _a;
    (_a = this.getTimelineView()) == null ? void 0 : _a.refreshSettings();
  }
  // ----------------------------------------------------------
  // ビュー管理
  // ----------------------------------------------------------
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  getTimelineView() {
    const leaves = this.app.workspace.getLeavesOfType(TIMELINE_VIEW_TYPE);
    if (leaves.length === 0) return null;
    const view = leaves[0].view;
    return view instanceof TimelineView ? view : null;
  }
  async getOrOpenSidebarView() {
    const existing = this.app.workspace.getLeavesOfType(EVENT_SIDEBAR_VIEW_TYPE);
    let leaf = existing.length > 0 ? existing[0] : null;
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) return null;
      await leaf.setViewState({ type: EVENT_SIDEBAR_VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    return view instanceof EventSidebarView ? view : null;
  }
};
