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
var import_obsidian4 = require("obsidian");

// src/settings/PluginSettings.ts
var DEFAULT_CALENDAR = {
  name: "\u6A19\u6E96\u66A6",
  months: [
    { month: 1, name: "\u4E00\u6708", days: 31 },
    { month: 2, name: "\u4E8C\u6708", days: 28 },
    { month: 3, name: "\u4E09\u6708", days: 31 },
    { month: 4, name: "\u56DB\u6708", days: 30 },
    { month: 5, name: "\u4E94\u6708", days: 31 },
    { month: 6, name: "\u516D\u6708", days: 30 },
    { month: 7, name: "\u4E03\u6708", days: 31 },
    { month: 8, name: "\u516B\u6708", days: 31 },
    { month: 9, name: "\u4E5D\u6708", days: 30 },
    { month: 10, name: "\u5341\u6708", days: 31 },
    { month: 11, name: "\u5341\u4E00\u6708", days: 30 },
    { month: 12, name: "\u5341\u4E8C\u6708", days: 31 }
  ]
};
var DEFAULT_SETTINGS = {
  excludedFolders: [],
  nodeScale: 100,
  zoomDefault: 100,
  themeMode: "auto",
  gapCompression: true,
  gapThreshold: 30,
  autoExpandGap: false,
  calendar: DEFAULT_CALENDAR,
  relationDisplayMode: "selected",
  relationStyle: "solid",
  relationWidth: 2,
  relationArrowStyle: "arrow",
  relationOpacity: 0.6,
  relationCurveStrength: 50,
  virtualRendering: true,
  renderBuffer: 1500,
  debugMode: false,
  newEventFolder: ""
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
var import_obsidian = require("obsidian");

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

// node_modules/js-yaml/dist/js-yaml.mjs
var __create = Object.create;
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames2 = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps2 = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames2(from), i = 0, n = keys.length, key; i < n; i++) {
    key = keys[i];
    if (!__hasOwnProp2.call(to, key) && key !== except) __defProp2(to, key, {
      get: ((k) => from[k]).bind(null, key),
      enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable
    });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps2(isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", {
  value: mod,
  enumerable: true
}) : target, mod));
var require_common = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject2(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0; cycle < count; cycle += 1) result += string;
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  module2.exports.isNothing = isNothing;
  module2.exports.isObject = isObject2;
  module2.exports.toArray = toArray;
  module2.exports.repeat = repeat;
  module2.exports.isNegativeZero = isNegativeZero;
  module2.exports.extend = extend;
});
var require_exception = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  function formatError(exception, compact) {
    let where = "";
    const message = exception.reason || "(unknown reason)";
    if (!exception.mark) return message;
    if (exception.mark.name) where += 'in "' + exception.mark.name + '" ';
    where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
    if (!compact && exception.mark.snippet) where += "\n\n" + exception.mark.snippet;
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
    else this.stack = (/* @__PURE__ */ new Error()).stack || "";
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString2(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  module2.exports = YAMLException2;
});
var require_snippet = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var common = require_common();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
      pos: position - lineStart + head.length
    };
  }
  function padStart(string, max) {
    return common.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer) return null;
    if (!options.maxLength) options.maxLength = 79;
    if (typeof options.indent !== "number") options.indent = 1;
    if (typeof options.linesBefore !== "number") options.linesBefore = 3;
    if (typeof options.linesAfter !== "number") options.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i = 1; i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
      result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
    for (let i = 1; i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
      result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
    }
    return result.replace(/\n$/, "");
  }
  module2.exports = makeSnippet;
});
var require_type = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var YAMLException2 = require_exception();
  var TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  var YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map) {
    const result = {};
    if (map !== null) Object.keys(map).forEach(function(style) {
      map[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
  module2.exports = Type2;
});
var require_schema = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var YAMLException2 = require_exception();
  var Type2 = require_type();
  function compileList(schema, name) {
    const result = [];
    schema[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) newIndex = previousIndex;
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type) {
      if (type.multi) {
        result.multi[type.kind].push(type);
        result.multi["fallback"].push(type);
      } else result[type.kind][type.tag] = result["fallback"][type.tag] = type;
    }
    for (let index = 0, length = arguments.length; index < length; index += 1) arguments[index].forEach(collectType);
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) explicit.push(definition);
    else if (Array.isArray(definition)) explicit = explicit.concat(definition);
    else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit) implicit = implicit.concat(definition.implicit);
      if (definition.explicit) explicit = explicit.concat(definition.explicit);
    } else throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    implicit.forEach(function(type) {
      if (!(type instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      if (type.loadKind && type.loadKind !== "scalar") throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      if (type.multi) throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    });
    explicit.forEach(function(type) {
      if (!(type instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  module2.exports = Schema2;
});
var require_str = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  module2.exports = new (require_type())("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
});
var require_seq = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  module2.exports = new (require_type())("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
});
var require_map = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  module2.exports = new (require_type())("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
});
var require_failsafe = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  module2.exports = new (require_schema())({ explicit: [
    require_str(),
    require_seq(),
    require_map()
  ] });
});
var require_null = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  function resolveYamlNull(data) {
    if (data === null) return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  module2.exports = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
});
var require_bool = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean2(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  module2.exports = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean2,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
});
var require_int = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var common = require_common();
  var Type2 = require_type();
  function isHexCode(c) {
    return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
  }
  function isOctCode(c) {
    return c >= 48 && c <= 55;
  }
  function isDecCode(c) {
    return c >= 48 && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max) return false;
    let ch = data[index];
    if (ch === "-" || ch === "+") ch = data[++index];
    if (ch === "0") {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index++;
        for (; index < max; index++) {
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index++;
        for (; index < max; index++) {
          if (!isOctCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && Number.isFinite(parseYamlInteger(data));
      }
    }
    for (; index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) return false;
      hasDigits = true;
    }
    if (!hasDigits) return false;
    return Number.isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && object % 1 === 0 && !common.isNegativeZero(object);
  }
  module2.exports = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
});
var require_float = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var common = require_common();
  var Type2 = require_type();
  var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  var YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data)) return false;
    if (Number.isFinite(parseFloat(data, 10))) return true;
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) value = value.slice(1);
    if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    else if (value === ".nan") return NaN;
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
    else if (Number.POSITIVE_INFINITY === object) switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
    else if (Number.NEGATIVE_INFINITY === object) switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
    else if (common.isNegativeZero(object)) return "-0.0";
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
  }
  module2.exports = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
});
var require_json = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  module2.exports = require_failsafe().extend({ implicit: [
    require_null(),
    require_bool(),
    require_int(),
    require_float()
  ] });
});
var require_core = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  module2.exports = require_json();
});
var require_timestamp = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
  var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) return new Date(Date.UTC(year, month, day));
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) fraction += "0";
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 6e4;
      if (match[9] === "-") delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  module2.exports = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
});
var require_merge = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  module2.exports = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
});
var require_binary = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data) {
    if (data === null) return false;
    let bitlen = 0;
    const max = data.length;
    const map = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      const code = map.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) result.push(bits >> 4 & 255);
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map[bits >> 18 & 63];
        result += map[bits >> 12 & 63];
        result += map[bits >> 6 & 63];
        result += map[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map[bits >> 18 & 63];
      result += map[bits >> 12 & 63];
      result += map[bits >> 6 & 63];
      result += map[bits & 63];
    } else if (tail === 2) {
      result += map[bits >> 10 & 63];
      result += map[bits >> 4 & 63];
      result += map[bits << 2 & 63];
      result += map[64];
    } else if (tail === 1) {
      result += map[bits >> 2 & 63];
      result += map[bits << 4 & 63];
      result += map[64];
      result += map[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  module2.exports = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
});
var require_omap = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    const objectKeys = [];
    const object = data;
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      let pairKey;
      for (pairKey in pair) if (_hasOwnProperty.call(pair, pairKey)) if (!pairHasKey) pairHasKey = true;
      else return false;
      if (!pairHasKey) return false;
      if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
      else return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  module2.exports = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
});
var require_pairs = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  var _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== "[object Object]") return false;
      const keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      const keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  module2.exports = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
});
var require_set = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var Type2 = require_type();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    const object = data;
    for (const key in object) if (_hasOwnProperty.call(object, key)) {
      if (object[key] !== null) return false;
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  module2.exports = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
});
var require_default = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  module2.exports = require_core().extend({
    implicit: [require_timestamp(), require_merge()],
    explicit: [
      require_binary(),
      require_omap(),
      require_pairs(),
      require_set()
    ]
  });
});
var require_loader = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var common = require_common();
  var YAMLException2 = require_exception();
  var makeSnippet = require_snippet();
  var DEFAULT_SCHEMA2 = require_default();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  var PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) return c - 48;
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) return lc - 97 + 10;
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) return 2;
    if (c === 117) return 4;
    if (c === 85) return 8;
    return 0;
  }
  function fromDecimalCode(c) {
    if (c >= 48 && c <= 57) return c - 48;
    return -1;
  }
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return "\0";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "	";
      case 9:
        return "	";
      case 110:
        return "\n";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "\x85";
      case 95:
        return "\xA0";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c) {
    if (c <= 65535) return String.fromCharCode(c);
    return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
    else object[key] = value;
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxMergeSeqLength = typeof options["maxMergeSeqLength"] === "number" ? options["maxMergeSeqLength"] : 20;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) state.onWarning.call(null, generateError(state, message));
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) transaction[name] = {
        existed: _hasOwnProperty.call(state.anchorMap, name),
        value: state.anchorMap[name]
      };
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0) return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length; index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) parent[name] = transaction[name];
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1; index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) state.anchorMap[names[index]] = entry.value;
      else delete state.anchorMap[names[index]];
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) throwError(state, "duplication of %YAML directive");
      if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) throwError(state, "ill-formed argument of the YAML directive");
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) throwError(state, "unacceptable YAML version of the document");
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) throwWarning(state, "unsupported YAML version of the document");
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      if (_hasOwnProperty.call(state.tagMap, handle)) throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      if (!PATTERN_TAG_URI.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
        const _character = _result.charCodeAt(_position);
        if (!(_character === 9 || _character >= 32 && _character <= 1114111)) throwError(state, "expected valid JSON character");
      }
      else if (PATTERN_NON_PRINTABLE.test(_result)) throwError(state, "the stream contains non-printable characters");
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common.isObject(source)) throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      const key = sourceKeys[index];
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) throwError(state, "nested arrays are not supported inside keys");
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") keyNode[index] = "[object Object]";
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") keyNode = "[object Object]";
    keyNode = String(keyNode);
    if (_result === null) _result = {};
    if (keyTag === "tag:yaml.org,2002:merge") if (Array.isArray(valueNode)) {
      if (valueNode.length > state.maxMergeSeqLength) throwError(state, "merge sequence length exceeded maxMergeSeqLength (" + state.maxMergeSeqLength + ")");
      const seen = /* @__PURE__ */ new Set();
      for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        const src = valueNode[index];
        if (seen.has(src)) continue;
        seen.add(src);
        mergeMappings(state, _result, src, overridableKeys);
      }
    } else mergeMappings(state, _result, valueNode, overridableKeys);
    else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) state.position++;
    else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) state.position++;
    } else throwError(state, "a line break is expected");
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) do
        ch = state.input.charCodeAt(++state.position);
      while (ch !== 10 && ch !== 13 && ch !== 0);
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else break;
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) throwWarning(state, "deficient indentation");
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) return true;
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) state.result += " ";
    else if (count > 1) state.result += common.repeat("\n", count - 1);
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) return false;
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) return false;
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) break;
      } else if (ch === 35) {
        if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) break;
      else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) captureEnd = state.position + 1;
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) return true;
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) return false;
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else return true;
    } else if (isEol(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
    else {
      state.position++;
      if (!isWhiteSpace(ch)) captureEnd = state.position;
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) return false;
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (isEol(ch)) skipSeparationSpace(state, false, nodeIndent);
      else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        let hexLength = tmp;
        let hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) hexResult = (hexResult << 4) + tmp;
          else throwError(state, "expected hexadecimal character");
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else throwError(state, "unknown escape sequence");
      captureStart = captureEnd = state.position;
    } else if (isEol(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
    else {
      state.position++;
      if (!isWhiteSpace(ch)) captureEnd = state.position;
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) throwError(state, "missed comma between flow collection entries");
      else if (ch === 44) throwError(state, "expected the node content, but found ','");
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        if (isWsOrEol(state.input.charCodeAt(state.position + 1))) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      else if (isPair) _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      else _result.push(keyNode);
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else readNext = false;
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) folding = false;
    else if (ch === 62) folding = true;
    else return false;
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) if (CHOMPING_CLIP === chomping) chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      else throwError(state, "repeat of a chomping mode identifier");
      else if ((tmp = fromDecimalCode(ch)) >= 0) if (tmp === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else throwError(state, "repeat of an indentation width identifier");
      else break;
    }
    if (isWhiteSpace(ch)) {
      do
        ch = state.input.charCodeAt(++state.position);
      while (isWhiteSpace(ch));
      if (ch === 35) do
        ch = state.input.charCodeAt(++state.position);
      while (!isEol(ch) && ch !== 0);
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) textIndent = state.lineIndent;
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) throwError(state, "missing indentation for block scalar");
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) state.result += "\n";
        }
        break;
      }
      if (folding) if (isWhiteSpace(ch)) {
        atMoreIndented = true;
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) state.result += " ";
      } else state.result += common.repeat("\n", emptyLines);
      else state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) ch = state.input.charCodeAt(++state.position);
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) break;
      if (!isWsOrEol(state.input.charCodeAt(state.position + 1))) break;
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a sequence entry");
      else if (state.lineIndent < nodeIndent) break;
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) throwError(state, "can not read an implicit mapping pair; a colon is missed");
          else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) if (atExplicitKey) keyNode = state.result;
        else valueNode = state.result;
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
      else if (state.lineIndent < nodeIndent) break;
    }
    if (atExplicitKey) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) throwError(state, "duplication of a tag property");
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else tagHandle = "!";
    let _position = state.position;
    if (isVerbatim) {
      do
        ch = state.input.charCodeAt(++state.position);
      while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else throwError(state, "unexpected end of the stream within a verbatim tag");
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
          isNamed = true;
          _position = state.position + 1;
        } else throwError(state, "tag suffix cannot contain exclamation marks");
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) throwError(state, "tag name cannot contain such characters: " + tagName);
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) state.tag = tagName;
    else if (_hasOwnProperty.call(state.tagMap, tagHandle)) state.tag = state.tagMap[tagHandle] + tagName;
    else if (tagHandle === "!") state.tag = "!" + tagName;
    else if (tagHandle === "!!") state.tag = "tag:yaml.org,2002:" + tagName;
    else throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) throwError(state, "duplication of an anchor property");
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
    if (state.position === _position) throwError(state, "name of an anchor node must contain at least one character");
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
    if (state.position === _position) throwError(state, "name of an alias node must contain at least one character");
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) throwError(state, 'unidentified alias "' + alias + '"');
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    state.depth += 1;
    if (state.listener !== null) state.listener("open", state);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) indentStatus = 1;
        else if (state.lineIndent === parentIndent) indentStatus = 0;
        else if (state.lineIndent < parentIndent) indentStatus = -1;
      }
    }
    if (indentStatus === 1) while (true) {
      const ch = state.input.charCodeAt(state.position);
      const propertyState = snapshotState(state);
      if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) break;
      if (!readTagProperty(state) && !readAnchorProperty(state)) break;
      if (propertyStart === null) propertyStart = propertyState;
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) indentStatus = 1;
        else if (state.lineIndent === parentIndent) indentStatus = 0;
        else if (state.lineIndent < parentIndent) indentStatus = -1;
      } else allowBlockCollections = false;
    }
    if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) flowIndent = parentIndent;
      else flowIndent = parentIndent + 1;
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) hasContent = true;
      else {
        const ch = state.input.charCodeAt(state.position);
        if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(state, propertyStart, propertyStart.position - propertyStart.lineStart, flowIndent)) hasContent = true;
        else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) hasContent = true;
        else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) throwError(state, "alias node should not have any properties");
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) state.tag = "?";
        }
        if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
      }
      else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
    if (state.tag === null) {
      if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type = state.implicitTypes[typeIndex];
        if (type.resolve(state.result)) {
          state.result = type.construct(state.result);
          state.tag = type.tag;
          if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) type = state.typeMap[state.kind || "fallback"][state.tag];
      else {
        type = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type = typeList[typeIndex];
          break;
        }
      }
      if (!type) throwError(state, "unknown tag !<" + state.tag + ">");
      if (state.result !== null && type.kind !== state.kind) throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
      if (!type.resolve(state.result, state.tag)) throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      else {
        state.result = type.construct(state.result, state.tag);
        if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
      }
    }
    if (state.listener !== null) state.listener("close", state);
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) break;
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) throwError(state, "directive name must not be less than one character in length");
      while (ch !== 0) {
        while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
        if (ch === 35) {
          do
            ch = state.input.charCodeAt(++state.position);
          while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch)) break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) directiveHandlers[directiveName](state, directiveName, directiveArgs);
      else throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) throwError(state, "directives end mark is expected");
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) throwWarning(state, "non-ASCII line breaks are interpreted as content");
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) throwError(state, "end of the stream or a document separator is expected");
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) input += "\n";
      if (input.charCodeAt(0) === 65279) input = input.slice(1);
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) readDocument(state);
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") return documents;
    for (let index = 0, length = documents.length; index < length; index += 1) iterator(documents[index]);
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) return;
    else if (documents.length === 1) return documents[0];
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  module2.exports.loadAll = loadAll2;
  module2.exports.load = load2;
});
var require_dumper = /* @__PURE__ */ __commonJSMin((exports, module2) => {
  var common = require_common();
  var YAMLException2 = require_exception();
  var DEFAULT_SCHEMA2 = require_default();
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_BOM = 65279;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  var DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema, map) {
    if (map === null) return {};
    const result = {};
    const keys = Object.keys(map);
    for (let index = 0, length = keys.length; index < length; index += 1) {
      let tag = keys[index];
      let style = String(map[tag]);
      if (tag.slice(0, 2) === "!!") tag = "tag:yaml.org,2002:" + tag.slice(2);
      const type = schema.compiledTypeMap["fallback"][tag];
      if (type && _hasOwnProperty.call(type.styleAliases, style)) style = type.styleAliases[style];
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    return "\\" + handle + common.repeat("0", length - string.length) + string;
  }
  var QUOTING_TYPE_SINGLE = 1;
  var QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf("\n", position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== "\n") result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str) {
    for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) if (state.implicitTypes[index].resolve(str)) return true;
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) return (first - 55296) * 1024 + second - 56320 + 65536;
    }
    return first;
  }
  function needIndentIndicator(string) {
    return /^\n* /.test(string);
  }
  var STYLE_PLAIN = 1;
  var STYLE_SINGLE = 2;
  var STYLE_LITERAL = 3;
  var STYLE_FOLDED = 4;
  var STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) return STYLE_DOUBLE;
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    else {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) return STYLE_DOUBLE;
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) return STYLE_PLAIN;
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) return STYLE_DOUBLE;
    if (!forceQuotes) return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = function() {
      if (string.length === 0) return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string, lineWidth) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    }();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === "\n";
    return indentIndicator + (clip && (string[string.length - 2] === "\n" || string === "\n") ? "+" : clip ? "" : "-") + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = function() {
      let nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    }();
    let prevMoreIndented = string[0] === "\n" || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += "\n" + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += "\n";
    if (line.length - start > width && curr > start) result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    else result += line.slice(start);
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536) result += string[i + 1];
      } else result += escapeSeq || encodeHex(char);
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) value = state.replacer.call(object, String(index), value);
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) value = state.replacer.call(object, String(index), value);
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") _result += generateNextLine(state, level);
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) _result += "-";
        else _result += "- ";
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (_result !== "") pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
      if (!writeNode(state, level, objectKey, false, false)) continue;
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) continue;
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) objectKeyList.sort();
    else if (typeof state.sortKeys === "function") objectKeyList.sort(state.sortKeys);
    else if (state.sortKeys) throw new YAMLException2("sortKeys must be a boolean or a function");
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") pairBuffer += generateNextLine(state, level);
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
      if (!writeNode(state, level + 1, objectKey, true, true, true)) continue;
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += "?";
      else pairBuffer += "? ";
      pairBuffer += state.dump;
      if (explicitPair) pairBuffer += generateNextLine(state, level);
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) continue;
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += ":";
      else pairBuffer += ": ";
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length; index < length; index += 1) {
      const type = typeList[index];
      if ((type.instanceOf || type.predicate) && (!type.instanceOf || typeof object === "object" && object instanceof type.instanceOf) && (!type.predicate || type.predicate(object))) {
        if (explicit) if (type.multi && type.representName) state.tag = type.representName(object);
        else state.tag = type.tag;
        else state.tag = "?";
        if (type.represent) {
          const style = state.styleMap[type.tag] || type.defaultStyle;
          let _result;
          if (_toString.call(type.represent) === "[object Function]") _result = type.represent(object, style);
          else if (_hasOwnProperty.call(type.represent, style)) _result = type.represent[style](object, style);
          else throw new YAMLException2("!<" + type.tag + '> tag resolver accepts not "' + style + '" style');
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) detectType(state, object, true);
    const type = _toString.call(state.dump);
    const inblock = block;
    if (block) block = state.flowLevel < 0 || state.flowLevel > level;
    const objectOrArray = type === "[object Object]" || type === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) compact = false;
    if (duplicate && state.usedDuplicates[duplicateIndex]) state.dump = "*ref_" + duplicateIndex;
    else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) state.usedDuplicates[duplicateIndex] = true;
      if (type === "[object Object]") if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
      }
      else if (type === "[object Array]") if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) writeBlockSequence(state, level - 1, state.dump, compact);
        else writeBlockSequence(state, level, state.dump, compact);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
      }
      else if (type === "[object String]") {
        if (state.tag !== "?") writeScalar(state, state.dump, level, iskey, inblock);
      } else if (type === "[object Undefined]") return false;
      else {
        if (state.skipInvalid) return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
        if (state.tag[0] === "!") tagStr = "!" + tagStr;
        else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") tagStr = "!!" + tagStr.slice(18);
        else tagStr = "!<" + tagStr + ">";
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0; index < length; index += 1) state.duplicates.push(objects[duplicatesIndexes[index]]);
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) duplicatesIndexes.push(index);
      } else {
        objects.push(object);
        if (Array.isArray(object)) for (let i = 0, length = object.length; i < length; i += 1) inspectNode(object[i], objects, duplicatesIndexes);
        else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length; i < length; i += 1) inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs) getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) value = state.replacer.call({ "": value }, "", value);
    if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
    return "";
  }
  module2.exports.dump = dump2;
});
var import_js_yaml = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin((exports, module2) => {
  var loader = require_loader();
  var dumper = require_dumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  module2.exports.Type = require_type();
  module2.exports.Schema = require_schema();
  module2.exports.FAILSAFE_SCHEMA = require_failsafe();
  module2.exports.JSON_SCHEMA = require_json();
  module2.exports.CORE_SCHEMA = require_core();
  module2.exports.DEFAULT_SCHEMA = require_default();
  module2.exports.load = loader.load;
  module2.exports.loadAll = loader.loadAll;
  module2.exports.dump = dumper.dump;
  module2.exports.YAMLException = require_exception();
  module2.exports.types = {
    binary: require_binary(),
    float: require_float(),
    map: require_map(),
    null: require_null(),
    pairs: require_pairs(),
    set: require_set(),
    timestamp: require_timestamp(),
    bool: require_bool(),
    int: require_int(),
    merge: require_merge(),
    omap: require_omap(),
    seq: require_seq(),
    str: require_str()
  };
  module2.exports.safeLoad = renamed("safeLoad", "load");
  module2.exports.safeLoadAll = renamed("safeLoadAll", "loadAll");
  module2.exports.safeDump = renamed("safeDump", "dump");
}))(), 1);
var { Type, Schema, FAILSAFE_SCHEMA, JSON_SCHEMA, CORE_SCHEMA, DEFAULT_SCHEMA, load, loadAll, dump, YAMLException, types, safeLoad, safeLoadAll, safeDump } = import_js_yaml.default;
var index_vite_proxy_tmp_default = import_js_yaml.default;

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
function extractWikilinkTarget(raw) {
  const m = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/.exec(raw.trim());
  return m ? m[1].trim() : raw.trim();
}
function parseFileName(filePath) {
  var _a;
  const fileName = (_a = filePath.split("/").pop()) != null ? _a : filePath;
  const baseName = fileName.replace(/\.md$/i, "");
  const displayTitle = baseName.replace(/^\d+-/, "");
  return { id: baseName, displayTitle };
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
   * Markdown ファイル全文を受け取り、timelineブロックをパースする
   *
   * @param content   ファイル全文
   * @param filePath  Vault相対パス
   * @returns         ParseResult
   */
  parse(content, filePath) {
    const blocks = this.extractTimelineBlocks(content);
    if (blocks.length > 1) {
      return {
        ok: false,
        error: "multiple_timeline_blocks",
        message: `timeline\u30D6\u30ED\u30C3\u30AF\u304C${blocks.length}\u500B\u3042\u308A\u307E\u3059\uFF081\u30D5\u30A1\u30A4\u30EB1\u30D6\u30ED\u30C3\u30AF\u307E\u3067\uFF09`
      };
    }
    if (blocks.length === 0) {
      return {
        ok: false,
        error: "missing_required_field",
        message: "timeline\u30D6\u30ED\u30C3\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"
      };
    }
    return this.parseBlock(blocks[0], filePath);
  }
  // ----------------------------------------------------------
  // ブロック抽出
  // ----------------------------------------------------------
  /**
   * Markdown本文から ```timeline ... ``` ブロックをすべて抽出する
   * Rule-002: timelineブロック以外は解析対象外
   */
  extractTimelineBlocks(content) {
    const blocks = [];
    const pattern = /^```+novels_timeline_jp\s*\n([\s\S]*?)^```+/gm;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      blocks.push(match[1]);
    }
    return blocks;
  }
  // ----------------------------------------------------------
  // YAMLパース
  // ----------------------------------------------------------
  parseBlock(blockContent, filePath) {
    const { id, displayTitle } = parseFileName(filePath);
    let raw;
    try {
      const parsed = load(blockContent);
      if (!parsed || typeof parsed !== "object") {
        return {
          ok: false,
          error: "missing_required_field",
          message: "timeline\u30D6\u30ED\u30C3\u30AF\u306EYAML\u304C\u7A7A\u307E\u305F\u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093"
        };
      }
      raw = parsed;
    } catch (e) {
      return {
        ok: false,
        error: "missing_required_field",
        message: `YAML\u30D1\u30FC\u30B9\u30A8\u30E9\u30FC: ${e.message}`
      };
    }
    const missingFields = [];
    for (const field of ["date", "lane", "size", "color"]) {
      if (raw[field] === void 0 || raw[field] === null || raw[field] === "") {
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
    const dateStr = String(raw["date"]).trim();
    const dateResult = this.dateParser.parse(dateStr);
    if (!dateResult.ok) {
      const event2 = this.buildEvent({
        id,
        displayTitle,
        filePath,
        raw,
        date: dateStr,
        timelineOrder: 0,
        error: "invalid_date"
      });
      return { ok: true, event: event2 };
    }
    const event = this.buildEvent({
      id,
      displayTitle,
      filePath,
      raw,
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
    const { id, displayTitle, filePath, raw, date, timelineOrder, error } = params;
    return {
      id,
      displayTitle,
      date,
      timelineOrder,
      lane: this.parseIntField(raw["lane"], 0, -10, 10),
      size: this.parseSizeField(raw["size"]),
      color: this.parseColorField(raw["color"]),
      characters: this.parseStringArray(raw["characters"]),
      locations: this.parseStringArray(raw["locations"]),
      summary: this.parseOptionalString(raw["summary"]),
      links: this.parseLinks(raw["links"]),
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
  parseSizeField(value) {
    if (value === "small" || value === "medium" || value === "big") return value;
    return "medium";
  }
  parseColorField(value) {
    if (typeof value === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(value.trim())) {
      return value.trim();
    }
    return "#808080";
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
var DiscoveryEngine = class {
  constructor(vault, calendar, excludedFolders = []) {
    this.vault = vault;
    this.parser = new TimelineParser(calendar);
    this.excludedFolders = excludedFolders;
  }
  updateCalendar(calendar) {
    this.parser.updateCalendar(calendar);
  }
  updateExcludedFolders(folders) {
    this.excludedFolders = folders;
  }
  // ----------------------------------------------------------
  // Vault全体を探索して全イベントを返す
  // ----------------------------------------------------------
  async discoverAll() {
    const files = this.vault.getMarkdownFiles();
    const targetFiles = files.filter((f) => !this.isExcluded(f.path));
    const events = [];
    const errors = [];
    for (const file of targetFiles) {
      const result = await this.processFile(file);
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
  // 単一ファイルを再解析して返す（差分更新用）
  // ----------------------------------------------------------
  async discoverFile(file) {
    if (this.isExcluded(file.path)) return null;
    const result = await this.processFile(file);
    if (!result || !result.ok) return null;
    return result.event;
  }
  // ----------------------------------------------------------
  // ファイルがtimelineブロックを持つか高速チェック（全文読み前）
  // ----------------------------------------------------------
  async hasTimelineBlock(file) {
    const content = await this.vault.cachedRead(file);
    return /^```+novels_timeline_jp/m.test(content);
  }
  // ----------------------------------------------------------
  // プライベートヘルパー
  // ----------------------------------------------------------
  async processFile(file) {
    let content;
    try {
      content = await this.vault.cachedRead(file);
    } catch (e) {
      return { ok: false, message: `\u30D5\u30A1\u30A4\u30EB\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ${file.path}` };
    }
    if (!/^```+novels_timeline_jp/m.test(content)) return null;
    const result = this.parser.parse(content, file.path);
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
var LANE_WIDTH = 40;
var BASE_RADIUS = {
  small: 8,
  medium: 12,
  big: 18
};
var TOP_MARGIN = 110;
var MIN_Y_GAP = 40;
var COMPRESSED_GAP_HEIGHT = 40;
var Y_SCALE = 4;
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
  buildLayout(sortedEvents, centerX, nodeScale, gaps, gapCompression) {
    var _a;
    if (sortedEvents.length === 0) return [];
    const dayGroups = this.groupByDay(sortedEvents);
    const yByOrder = this.calcYByDayGroup(dayGroups, gaps, gapCompression);
    const nodes = [];
    for (const group of dayGroups) {
      const y = (_a = yByOrder.get(group.order)) != null ? _a : 0;
      this.resolveGroupLayout(group.events, y, centerX, nodeScale, nodes);
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
    let currentY = TOP_MARGIN;
    yMap.set(groups[0].order, currentY);
    for (let i = 1; i < groups.length; i++) {
      const prev = groups[i - 1];
      const cur = groups[i];
      const orderDiff = cur.order - prev.order;
      if (gapCompression) {
        const matchingGap = gaps.find(
          (g) => g.fromOrder === prev.order && g.toOrder === cur.order
        );
        if (matchingGap) {
          currentY += matchingGap.expanded ? Math.max(MIN_Y_GAP, orderDiff * Y_SCALE) : COMPRESSED_GAP_HEIGHT;
        } else {
          currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE);
        }
      } else {
        currentY += Math.max(MIN_Y_GAP, orderDiff * Y_SCALE);
      }
      yMap.set(cur.order, currentY);
    }
    return yMap;
  }
  // ----------------------------------------------------------
  // ③ グループ内レイアウト
  //    - lane=0 を自動的に空きlaneへ移動
  //    - 同laneの衝突はlaneをずらして回避
  // ----------------------------------------------------------
  resolveGroupLayout(events, y, centerX, nodeScale, out) {
    const usedLanes = /* @__PURE__ */ new Set();
    const resolved = [];
    for (const event of events) {
      if (event.lane !== 0) {
        let lane = event.lane;
        lane = this.findFreeLane(lane, usedLanes);
        usedLanes.add(lane);
        resolved.push({ event, effectiveLane: lane });
      }
    }
    for (const event of events) {
      if (event.lane === 0) {
        const lane = this.findFreeLane(0, usedLanes);
        usedLanes.add(lane);
        resolved.push({ event, effectiveLane: lane });
      }
    }
    for (const { event, effectiveLane } of resolved) {
      const x = this.calcX(effectiveLane, centerX);
      const radius = this.calcRadius(event.size, nodeScale);
      out.push({ event, x, y, radius });
    }
  }
  /**
   * 指定laneから最も近い未使用laneを探す。
   * startLane=0 の場合は 1 → -1 → 2 → -2 の順に探す（0は時間軸予約）。
   */
  findFreeLane(startLane, usedLanes) {
    if (startLane === 0) {
      for (let n = 1; n <= 20; n++) {
        for (const candidate of [n, -n]) {
          if (!usedLanes.has(candidate)) return candidate;
        }
      }
      return 1;
    }
    if (!usedLanes.has(startLane)) return startLane;
    for (let delta = 1; delta <= 20; delta++) {
      for (const candidate of [startLane + delta, startLane - delta]) {
        if (candidate !== 0 && !usedLanes.has(candidate)) return candidate;
      }
    }
    return startLane > 0 ? startLane + 1 : startLane - 1;
  }
  // ----------------------------------------------------------
  // Y座標マップ（GapEngine・yToDateString 用の公開API）
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
  calcTotalHeight(nodes) {
    if (nodes.length === 0) return 600;
    return Math.max(...nodes.map((n) => n.y)) + 120;
  }
  calcX(lane, centerX) {
    if (lane === 0) return centerX;
    if (lane > 0) return centerX + LANE_WIDTH / 2 + lane * LANE_WIDTH;
    return centerX - LANE_WIDTH / 2 + lane * LANE_WIDTH;
  }
  calcRadius(size, nodeScale) {
    var _a;
    const base = (_a = BASE_RADIUS[size]) != null ? _a : BASE_RADIUS["medium"];
    return base * nodeScale;
  }
  /**
   * D. SVGのY座標 → timelineOrder → date 文字列 への逆算
   *
   * @param calendarPrefix  暦プレフィックス（例: "帝国暦"）。
   *                        呼び出し元で既存イベントのprefixを渡すこと。
   */
  yToDateString(clickY, sortedEvents, gaps, gapCompression, calendarPrefix = "") {
    if (sortedEvents.length === 0) {
      return this.orderToDateString(0, calendarPrefix);
    }
    const groups = this.groupByDay(sortedEvents);
    const yByOrder = this.calcYByDayGroup(groups, gaps, gapCompression);
    const yEntries = Array.from(yByOrder.entries()).map(([order, y]) => ({ order, y })).sort((a, b) => a.y - b.y);
    if (clickY <= yEntries[0].y) {
      return this.orderToDateString(Math.max(0, yEntries[0].order - 1), calendarPrefix);
    }
    if (clickY >= yEntries[yEntries.length - 1].y) {
      return this.orderToDateString(yEntries[yEntries.length - 1].order + 1, calendarPrefix);
    }
    for (let i = 0; i < yEntries.length - 1; i++) {
      const cur = yEntries[i];
      const next = yEntries[i + 1];
      if (clickY >= cur.y && clickY <= next.y) {
        const t = next.y - cur.y > 0 ? (clickY - cur.y) / (next.y - cur.y) : 0;
        const estimatedOrder = Math.round(cur.order + t * (next.order - cur.order));
        return this.orderToDateString(estimatedOrder, calendarPrefix);
      }
    }
    return this.orderToDateString(0, calendarPrefix);
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
   * @param yPositions    イベントID → SVG Y座標のマップ
   * @param threshold     Gap生成条件（日数相当値）
   */
  buildGaps(sortedEvents, yPositions, threshold) {
    var _a, _b;
    const gaps = [];
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const before = sortedEvents[i];
      const after = sortedEvents[i + 1];
      const diff = after.timelineOrder - before.timelineOrder;
      if (diff < threshold) continue;
      const yBefore = (_a = yPositions.get(before.id)) != null ? _a : 0;
      const yAfter = (_b = yPositions.get(after.id)) != null ? _b : 0;
      gaps.push(this.buildGap({ before, after, yBefore, yAfter }));
    }
    return gaps;
  }
  // ----------------------------------------------------------
  // Gap の Y 座標を正式Y座標マップで更新する
  // ----------------------------------------------------------
  /**
   * buildGaps() 後に calcYPositions(gap考慮済み) で再計算したY座標で
   * 各 Gap の y（表示位置）を更新する。
   *
   * Gap の y = 前後イベントのY座標の中間点
   * これにより「折りたたみ時」と「展開時」で正しい位置に表示される。
   */
  updateGapYPositions(gaps, finalYMap, sortedEvents) {
    const orderToId = /* @__PURE__ */ new Map();
    for (const event of sortedEvents) {
      if (!orderToId.has(event.timelineOrder)) {
        orderToId.set(event.timelineOrder, event.id);
      }
    }
    for (const gap of gaps) {
      const fromId = orderToId.get(gap.fromOrder);
      const toId = orderToId.get(gap.toOrder);
      if (fromId === void 0 || toId === void 0) continue;
      const yFrom = finalYMap.get(fromId);
      const yTo = finalYMap.get(toId);
      if (yFrom !== void 0 && yTo !== void 0) {
        const GAP_TOP_MARGIN = 30;
        gap.y = yFrom + GAP_TOP_MARGIN + (yTo - yFrom - GAP_TOP_MARGIN) / 2;
      }
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
    return {
      fromOrder: before.timelineOrder,
      toOrder: after.timelineOrder,
      y: (yBefore + yAfter) / 2,
      label: this.formatDiff(diff),
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
    this.el.style.display = "none";
    this.el.style.position = "fixed";
    this.el.style.zIndex = "99999";
    this.el.style.pointerEvents = "none";
  }
  show(event, mouseX, mouseY) {
    this.el.empty();
    this.el.createEl("div", { cls: "ntj-tooltip-title", text: event.displayTitle });
    const dateRow = this.el.createEl("div", { cls: "ntj-tooltip-row" });
    dateRow.createSpan({ cls: "ntj-tooltip-label", text: "\u65E5\u4ED8" });
    dateRow.createSpan({ text: event.date || "\u4E0D\u660E" });
    if (event.characters.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-label", text: "\u767B\u5834\u4EBA\u7269" });
      row.createSpan({ text: event.characters.length > 1 ? `${event.characters[0]}\u2026\u4ED6` : event.characters[0] });
    }
    if (event.locations.length > 0) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-label", text: "\u5834\u6240" });
      row.createSpan({ text: event.locations.length > 1 ? `${event.locations[0]}\u2026\u4ED6` : event.locations[0] });
    }
    if (event.summary) {
      const row = this.el.createEl("div", { cls: "ntj-tooltip-row" });
      row.createSpan({ cls: "ntj-tooltip-label", text: "\u6982\u8981" });
      const summarySpan = row.createSpan({
        text: event.summary.replace(/_LineBreak_/g, "\n")
      });
      summarySpan.style.whiteSpace = "pre-wrap";
    }
    this.el.style.left = `${mouseX}px`;
    this.el.style.top = `${mouseY}px`;
    this.el.style.display = "block";
  }
  move(mouseX, mouseY) {
    if (this.el.style.display === "none") return;
    this.el.style.left = `${mouseX}px`;
    this.el.style.top = `${mouseY}px`;
  }
  hide() {
    this.el.style.display = "none";
  }
  /** プラグインアンロード時に DOM を片付ける */
  destroy() {
    this.el.remove();
  }
};

// src/view/GapRenderer.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var GAP_X_OFFSET = 100;
var GapRenderer = class {
  render(gap, centerX, _svgWidth) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "ntj-gap");
    g.style.cursor = "pointer";
    const y = gap.y;
    const gapX = centerX + GAP_X_OFFSET;
    const labelText = gap.expanded ? `\u25B2 ${gap.label}` : `\u25BC ${gap.label}`;
    const labelW = labelText.length * 8 + 28;
    const labelH = 22;
    const nodeR = 5;
    const dx = nodeR;
    const dy = nodeR;
    const diamond = document.createElementNS(SVG_NS, "polygon");
    const pts = [
      `${centerX},${y - dy}`,
      `${centerX + dx},${y}`,
      `${centerX},${y + dy}`,
      `${centerX - dx},${y}`
    ].join(" ");
    diamond.setAttribute("points", pts);
    diamond.setAttribute("fill", "var(--background-secondary)");
    diamond.setAttribute("stroke", "var(--text-muted)");
    diamond.setAttribute("stroke-width", "1.5");
    g.appendChild(diamond);
    const lineX1 = centerX + dx;
    const lineX2 = gapX - labelW / 2;
    const connector = document.createElementNS(SVG_NS, "line");
    connector.setAttribute("x1", String(lineX1));
    connector.setAttribute("y1", String(y));
    connector.setAttribute("x2", String(lineX2));
    connector.setAttribute("y2", String(y));
    connector.setAttribute("stroke", "var(--text-muted)");
    connector.setAttribute("stroke-width", "1");
    g.appendChild(connector);
    const shadow = document.createElementNS(SVG_NS, "rect");
    shadow.setAttribute("x", String(gapX - labelW / 2 + 2));
    shadow.setAttribute("y", String(y - labelH / 2 + 2));
    shadow.setAttribute("width", String(labelW));
    shadow.setAttribute("height", String(labelH));
    shadow.setAttribute("rx", "6");
    shadow.setAttribute("fill", "rgba(0,0,0,0.18)");
    g.appendChild(shadow);
    const card = document.createElementNS(SVG_NS, "rect");
    card.setAttribute("x", String(gapX - labelW / 2));
    card.setAttribute("y", String(y - labelH / 2));
    card.setAttribute("width", String(labelW));
    card.setAttribute("height", String(labelH));
    card.setAttribute("rx", "6");
    card.setAttribute("fill", "var(--background-secondary)");
    card.setAttribute("stroke", "var(--background-modifier-border)");
    card.setAttribute("stroke-width", "0.8");
    g.appendChild(card);
    const highlight = document.createElementNS(SVG_NS, "rect");
    highlight.setAttribute("x", String(gapX - labelW / 2 + 2));
    highlight.setAttribute("y", String(y - labelH / 2 + 1));
    highlight.setAttribute("width", String(labelW - 4));
    highlight.setAttribute("height", "1");
    highlight.setAttribute("rx", "1");
    highlight.setAttribute("fill", "var(--background-primary)");
    highlight.setAttribute("fill-opacity", "0.5");
    g.appendChild(highlight);
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(gapX));
    text.setAttribute("y", String(y));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "11");
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
  timeAxis: "var(--background-modifier-border)",
  timeAxisMonth: "var(--text-faint)",
  nodeStroke: "var(--text-normal)",
  nodeFiltered: "var(--background-modifier-border)",
  relation: "var(--text-muted)",
  errorIcon: "var(--text-error)",
  dateLabel: "var(--text-faint)",
  dateLabelDay: "var(--text-muted)",
  dateLabelMonth: "var(--text-normal)",
  dateLabelBg: "var(--background-secondary)",
  calendarHeader: "var(--text-accent)"
};
var TimelineRenderer = class {
  constructor(container) {
    this.dragState = { active: false, eventId: "", startX: 0, currentX: 0, laneWidth: 40, circle: null };
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
    const { settings, totalHeight, virtualWindow } = ctx;
    const LANE_W = 40;
    const AXIS_W = LANE_W * 2;
    const LANES = 10;
    const svgWidth = LANE_W * LANES + AXIS_W + LANE_W * LANES;
    const centerX = LANE_W * LANES + AXIS_W / 2;
    this.svg.setAttribute("viewBox", `0 0 ${svgWidth} ${totalHeight}`);
    this.svg.setAttribute("width", String(svgWidth));
    this.svg.setAttribute("height", String(totalHeight));
    this.svg.style.minWidth = `${svgWidth}px`;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const buffer = settings.virtualRendering ? virtualWindow.buffer : Infinity;
    const visTop = virtualWindow.scrollTop - buffer;
    const visBottom = virtualWindow.scrollTop + virtualWindow.viewportHeight + buffer;
    const defs = document.createElementNS(SVG_NS2, "defs");
    this.svg.appendChild(defs);
    const ctxWithCenter = { ...ctx, centerX };
    this.drawRuler(centerX, svgWidth, LANE_W, AXIS_W, LANES, virtualWindow.scrollTop);
    this.drawTimeAxis(centerX, totalHeight);
    if (settings.gapCompression) {
      this.drawGaps(ctxWithCenter, visTop, visBottom);
    }
    this.drawDateLabels(ctxWithCenter, visTop, visBottom);
    this.drawNodes(ctxWithCenter, visTop, visBottom);
    this.drawRelations(ctxWithCenter, visTop, visBottom, defs);
    this.svg.oncontextmenu = (e) => {
      e.preventDefault();
      ctx.onContextMenu(this.clientYToSvgY(e.clientY), e.clientX, e.clientY);
    };
    this.svg.onmousemove = (e) => {
      this.tooltip.move(e.clientX, e.clientY);
      this.onDragMove(e, ctxWithCenter);
    };
    this.svg.onmouseup = (e) => this.onDragEnd(e, ctxWithCenter);
  }
  // ----------------------------------------------------------
  // レーンルーラー（タイムライン上部のレーン番号表示）
  // スクロールに追従して常に上部に固定表示する
  // ----------------------------------------------------------
  drawRuler(centerX, svgWidth, laneW, axisW, lanes, scrollTop) {
    const rulerH = 28;
    const rulerY = scrollTop;
    const bg = document.createElementNS(SVG_NS2, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", String(rulerY));
    bg.setAttribute("width", String(svgWidth));
    bg.setAttribute("height", String(rulerH));
    bg.setAttribute("fill", "var(--background-secondary)");
    this.svg.appendChild(bg);
    const axisLeft = centerX - axisW / 2;
    for (let lane = -lanes; lane <= -1; lane++) {
      const cellLeft = axisLeft + lane * laneW;
      const cellCenterX = cellLeft + laneW / 2;
      this.drawRulerCell(
        cellLeft,
        rulerY,
        laneW,
        rulerH,
        String(lane),
        "var(--text-normal)"
      );
    }
    this.drawRulerCell(
      axisLeft,
      rulerY,
      axisW,
      rulerH,
      "\uFF5C",
      "var(--text-muted)",
      true
    );
    for (let lane = 1; lane <= lanes; lane++) {
      const cellLeft = axisLeft + axisW + (lane - 1) * laneW;
      this.drawRulerCell(
        cellLeft,
        rulerY,
        laneW,
        rulerH,
        String(lane),
        "var(--text-accent)"
      );
    }
    const rightX = axisLeft + axisW + lanes * laneW;
    const rline = document.createElementNS(SVG_NS2, "line");
    rline.setAttribute("x1", String(rightX));
    rline.setAttribute("y1", String(rulerY));
    rline.setAttribute("x2", String(rightX));
    rline.setAttribute("y2", String(rulerY + rulerH));
    rline.setAttribute("stroke", "var(--background-modifier-border)");
    rline.setAttribute("stroke-width", "0.5");
    this.svg.appendChild(rline);
    const border = document.createElementNS(SVG_NS2, "line");
    border.setAttribute("x1", "0");
    border.setAttribute("y1", String(rulerY + rulerH));
    border.setAttribute("x2", String(svgWidth));
    border.setAttribute("y2", String(rulerY + rulerH));
    border.setAttribute("stroke", "var(--background-modifier-border)");
    border.setAttribute("stroke-width", "1");
    this.svg.appendChild(border);
  }
  /** ルーラーの1セル（左端縦線＋ラベルテキスト）を描画 */
  drawRulerCell(cellLeft, rulerY, cellW, rulerH, label, color, isAxis = false) {
    const vline = document.createElementNS(SVG_NS2, "line");
    vline.setAttribute("x1", String(cellLeft));
    vline.setAttribute("y1", String(rulerY));
    vline.setAttribute("x2", String(cellLeft));
    vline.setAttribute("y2", String(rulerY + rulerH));
    vline.setAttribute("stroke", "var(--background-modifier-border)");
    vline.setAttribute("stroke-width", isAxis ? "1" : "0.5");
    this.svg.appendChild(vline);
    const text = document.createElementNS(SVG_NS2, "text");
    text.setAttribute("x", String(cellLeft + cellW / 2));
    text.setAttribute("y", String(rulerY + rulerH / 2));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", isAxis ? "13" : "10");
    text.setAttribute("fill", color);
    text.textContent = label;
    this.svg.appendChild(text);
  }
  // ----------------------------------------------------------
  // 時間軸（中央縦線 + 帯背景）ニューモーフィズムスタイル
  // ----------------------------------------------------------
  drawTimeAxis(centerX, totalHeight) {
    const AXIS_W = 80;
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
      for (const [offset, opacity] of [["0%", "0"], ["20%", "0.06"], ["50%", "0.12"], ["80%", "0.06"], ["100%", "0"]]) {
        const stop = document.createElementNS(SVG_NS2, "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", "var(--interactive-accent)");
        stop.setAttribute("stop-opacity", opacity);
        grad.appendChild(stop);
      }
      defs.appendChild(grad);
    }
    const band = document.createElementNS(SVG_NS2, "rect");
    band.setAttribute("x", String(centerX - AXIS_W / 2));
    band.setAttribute("y", "0");
    band.setAttribute("width", String(AXIS_W));
    band.setAttribute("height", String(totalHeight));
    band.setAttribute("fill", `url(#${gradId})`);
    this.svg.appendChild(band);
    const line = document.createElementNS(SVG_NS2, "line");
    line.setAttribute("x1", String(centerX));
    line.setAttribute("y1", "0");
    line.setAttribute("x2", String(centerX));
    line.setAttribute("y2", String(totalHeight));
    line.setAttribute("stroke", "var(--interactive-accent)");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("stroke-opacity", "0.4");
    this.svg.appendChild(line);
  }
  // ----------------------------------------------------------
  // 日付ラベル描画（ニューモーフィズムスタイル）
  // ----------------------------------------------------------
  drawDateLabels(ctx, visTop, visBottom) {
    const { dateRows, centerX } = ctx;
    if (dateRows.length === 0) return;
    const firstRow = dateRows[0];
    if (firstRow.calendarPrefix) {
      this.drawCalendarHeader(firstRow.calendarPrefix, centerX);
    }
    let prevYear = -1;
    let prevMonth = -1;
    for (const row of dateRows) {
      if (row.y < visTop - 30 || row.y > visBottom + 30) {
        prevYear = row.year;
        prevMonth = row.month;
        continue;
      }
      if (row.year !== prevYear) {
        this.drawYearCard(row.year, row.y, centerX);
        prevYear = row.year;
        prevMonth = -1;
      }
      if (row.month !== prevMonth) {
        this.drawMonthBadge(row.monthLabel, row.y, centerX);
        prevMonth = row.month;
      }
      this.drawDayDot(row.day, row.y, centerX);
    }
  }
  /** ① 暦名ヘッダー */
  drawCalendarHeader(prefix, centerX) {
    const y = 45;
    const tw = prefix.length * 8 + 20;
    const th = 22;
    const shadow = document.createElementNS(SVG_NS2, "rect");
    shadow.setAttribute("x", String(centerX - tw / 2 + 2));
    shadow.setAttribute("y", String(y - th / 2 + 2));
    shadow.setAttribute("width", String(tw));
    shadow.setAttribute("height", String(th));
    shadow.setAttribute("rx", "6");
    shadow.setAttribute("fill", "rgba(0,0,0,0.18)");
    this.svg.appendChild(shadow);
    const card = document.createElementNS(SVG_NS2, "rect");
    card.setAttribute("x", String(centerX - tw / 2));
    card.setAttribute("y", String(y - th / 2));
    card.setAttribute("width", String(tw));
    card.setAttribute("height", String(th));
    card.setAttribute("rx", "6");
    card.setAttribute("fill", "var(--background-secondary)");
    card.setAttribute("stroke", "var(--interactive-accent)");
    card.setAttribute("stroke-width", "1");
    card.setAttribute("stroke-opacity", "0.5");
    this.svg.appendChild(card);
    const text = document.createElementNS(SVG_NS2, "text");
    text.setAttribute("x", String(centerX));
    text.setAttribute("y", String(y));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-weight", "700");
    text.setAttribute("fill", "var(--interactive-accent)");
    text.textContent = prefix;
    this.svg.appendChild(text);
  }
  /** ② 年カード（ニューモーフィズム浮き上がりカード） */
  drawYearCard(year, y, centerX) {
    const label = `${year}`;
    const tw = label.length * 9 + 20;
    const th = 18;
    const cardY = y - 38;
    const line = document.createElementNS(SVG_NS2, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", String(y - 50));
    line.setAttribute("x2", "9999");
    line.setAttribute("y2", String(y - 50));
    line.setAttribute("stroke", "var(--interactive-accent)");
    line.setAttribute("stroke-width", "0.5");
    line.setAttribute("stroke-opacity", "0.3");
    line.setAttribute("stroke-dasharray", "4 6");
    this.svg.appendChild(line);
    const shadow = document.createElementNS(SVG_NS2, "rect");
    shadow.setAttribute("x", String(centerX - tw / 2 + 2));
    shadow.setAttribute("y", String(cardY - th / 2 + 2));
    shadow.setAttribute("width", String(tw));
    shadow.setAttribute("height", String(th));
    shadow.setAttribute("rx", "5");
    shadow.setAttribute("fill", "rgba(0,0,0,0.2)");
    this.svg.appendChild(shadow);
    const card = document.createElementNS(SVG_NS2, "rect");
    card.setAttribute("x", String(centerX - tw / 2));
    card.setAttribute("y", String(cardY - th / 2));
    card.setAttribute("width", String(tw));
    card.setAttribute("height", String(th));
    card.setAttribute("rx", "5");
    card.setAttribute("fill", "var(--background-secondary)");
    card.setAttribute("stroke", "var(--background-modifier-border)");
    card.setAttribute("stroke-width", "0.8");
    this.svg.appendChild(card);
    const text = document.createElementNS(SVG_NS2, "text");
    text.setAttribute("x", String(centerX));
    text.setAttribute("y", String(cardY));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-weight", "700");
    text.setAttribute("fill", "var(--text-normal)");
    text.textContent = label;
    this.svg.appendChild(text);
  }
  /** ③ 月バッジ（ピル型） */
  drawMonthBadge(monthLabel, y, centerX) {
    const tw = monthLabel.length * 7 + 14;
    const th = 14;
    const bY = y - 18;
    const badge = document.createElementNS(SVG_NS2, "rect");
    badge.setAttribute("x", String(centerX - tw / 2));
    badge.setAttribute("y", String(bY - th / 2));
    badge.setAttribute("width", String(tw));
    badge.setAttribute("height", String(th));
    badge.setAttribute("rx", "7");
    badge.setAttribute("fill", "var(--background-secondary)");
    badge.setAttribute("fill-opacity", "1");
    badge.setAttribute("stroke", "var(--interactive-accent)");
    badge.setAttribute("stroke-width", "0.8");
    badge.setAttribute("stroke-opacity", "0.5");
    this.svg.appendChild(badge);
    const text = document.createElementNS(SVG_NS2, "text");
    text.setAttribute("x", String(centerX));
    text.setAttribute("y", String(bY));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "9");
    text.setAttribute("font-weight", "600");
    text.setAttribute("fill", "var(--text-accent)");
    text.textContent = monthLabel;
    this.svg.appendChild(text);
  }
  /** ④ 日ドット＋日ラベル */
  drawDayDot(day, y, centerX) {
    const dot = document.createElementNS(SVG_NS2, "circle");
    dot.setAttribute("cx", String(centerX));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", "2.5");
    dot.setAttribute("fill", "var(--interactive-accent)");
    dot.setAttribute("fill-opacity", "0.7");
    this.svg.appendChild(dot);
    const text = document.createElementNS(SVG_NS2, "text");
    text.setAttribute("x", String(centerX - 10));
    text.setAttribute("y", String(y));
    text.setAttribute("text-anchor", "end");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-size", "10");
    text.setAttribute("fill", COLOR.dateLabelDay);
    text.textContent = String(day);
    this.svg.appendChild(text);
  }
  // ----------------------------------------------------------
  // ノード描画
  // ----------------------------------------------------------
  drawNodes(ctx, visTop, visBottom) {
    for (const node of ctx.nodes) {
      if (node.y + node.radius < visTop || node.y - node.radius > visBottom) continue;
      const isFiltered = ctx.filteredIds !== null && !ctx.filteredIds.has(node.event.id);
      const isSelected = node.event.id === ctx.selectedId;
      this.drawNode(node, isFiltered, isSelected, ctx);
    }
  }
  drawNode(node, isFiltered, isSelected, ctx) {
    const g = document.createElementNS(SVG_NS2, "g");
    g.setAttribute("class", "ntj-node");
    g.style.cursor = "grab";
    const circle = document.createElementNS(SVG_NS2, "circle");
    circle.setAttribute("cx", String(node.x));
    circle.setAttribute("cy", String(node.y));
    circle.setAttribute("r", String(node.radius));
    circle.setAttribute("fill", isFiltered ? COLOR.nodeFiltered : node.event.color);
    circle.setAttribute("fill-opacity", isFiltered ? "0.25" : "1");
    circle.setAttribute("stroke", isSelected ? COLOR.nodeStroke : "none");
    circle.setAttribute("stroke-width", isSelected ? "2.5" : "0");
    g.appendChild(circle);
    if (node.event.error) {
      const warn = document.createElementNS(SVG_NS2, "text");
      warn.setAttribute("x", String(node.x + node.radius - 2));
      warn.setAttribute("y", String(node.y - node.radius + 2));
      warn.setAttribute("font-size", "10");
      warn.setAttribute("dominant-baseline", "auto");
      warn.setAttribute("fill", COLOR.errorIcon);
      warn.textContent = "\u26A0";
      g.appendChild(warn);
    }
    g.addEventListener("mouseenter", (e) => {
      this.tooltip.show(node.event, e.clientX, e.clientY);
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
      this.startDrag(e, node, circle);
    });
    this.svg.appendChild(g);
  }
  // ----------------------------------------------------------
  // 関係線描画
  // ----------------------------------------------------------
  drawRelations(ctx, visTop, visBottom, defs) {
    const { edges, selectedId, settings } = ctx;
    const mode = settings.relationDisplayMode;
    if (mode === "hidden") return;
    if (settings.relationArrowStyle !== "none") {
      this.addArrowMarker(defs, settings);
    }
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
    const dy = toNode.y - fromNode.y;
    const cpOffset = strength / 100 * Math.max(40, Math.abs(dy) * 0.4);
    const path = document.createElementNS(SVG_NS2, "path");
    path.setAttribute(
      "d",
      `M ${fromNode.x} ${fromNode.y} C ${fromNode.x + cpOffset} ${fromNode.y + dy * 0.3}, ${toNode.x - cpOffset} ${toNode.y - dy * 0.3}, ${toNode.x} ${toNode.y}`
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", COLOR.relation);
    path.setAttribute("stroke-width", String(settings.relationWidth));
    path.setAttribute("stroke-opacity", String(settings.relationOpacity));
    if (settings.relationStyle === "dashed") path.setAttribute("stroke-dasharray", "6 4");
    else if (settings.relationStyle === "dotted") path.setAttribute("stroke-dasharray", "2 4");
    if (settings.relationArrowStyle !== "none") {
      path.setAttribute("marker-end", `url(#ntj-arrow-${settings.relationArrowStyle})`);
    }
    this.svg.appendChild(path);
  }
  addArrowMarker(defs, settings) {
    const style = settings.relationArrowStyle;
    const markerId = `ntj-arrow-${style}`;
    if (defs.querySelector(`#${markerId}`)) return;
    const marker = document.createElementNS(SVG_NS2, "marker");
    marker.setAttribute("id", markerId);
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    const shape = document.createElementNS(SVG_NS2, "path");
    if (style === "triangle") {
      shape.setAttribute("d", "M0 0L10 5L0 10Z");
      shape.setAttribute("fill", COLOR.relation);
      shape.setAttribute("stroke", "none");
    } else {
      shape.setAttribute("d", "M2 1L8 5L2 9");
      shape.setAttribute("fill", "none");
      shape.setAttribute("stroke", COLOR.relation);
      shape.setAttribute("stroke-width", "1.5");
      shape.setAttribute("stroke-linecap", "round");
    }
    marker.appendChild(shape);
    defs.appendChild(marker);
  }
  // ----------------------------------------------------------
  // Gap 描画
  // ----------------------------------------------------------
  drawGaps(ctx, visTop, visBottom) {
    const width = this.container.clientWidth || 800;
    for (const gap of ctx.gaps) {
      if (gap.y < visTop || gap.y > visBottom) continue;
      const el = this.gapRenderer.render(gap, ctx.centerX, width);
      el.addEventListener("click", () => ctx.onGapClick(gap));
      this.svg.appendChild(el);
    }
  }
  // ----------------------------------------------------------
  // Drag & Drop
  // ----------------------------------------------------------
  startDrag(e, node, circle) {
    this.dragState = {
      active: true,
      eventId: node.event.id,
      startX: e.clientX,
      currentX: e.clientX,
      laneWidth: 80,
      circle
    };
    circle.style.cursor = "grabbing";
  }
  onDragMove(e, _ctx) {
    var _a;
    if (!this.dragState.active || !this.dragState.circle) return;
    const svgDx = this.clientDxToSvgDx(e.clientX - this.dragState.currentX);
    const cx = parseFloat((_a = this.dragState.circle.getAttribute("cx")) != null ? _a : "0");
    this.dragState.circle.setAttribute("cx", String(cx + svgDx));
    this.dragState.currentX = e.clientX;
  }
  onDragEnd(e, ctx) {
    if (!this.dragState.active) return;
    const totalDx = e.clientX - this.dragState.startX;
    const laneShift = Math.round(this.clientDxToSvgDx(totalDx) / this.dragState.laneWidth);
    if (laneShift !== 0) ctx.onLaneDrop(this.dragState.eventId, laneShift);
    if (this.dragState.circle) this.dragState.circle.style.cursor = "grab";
    this.dragState.active = false;
  }
  // ----------------------------------------------------------
  // ユーティリティ
  // ----------------------------------------------------------
  clientYToSvgY(clientY) {
    var _a;
    const rect = this.svg.getBoundingClientRect();
    const totalH = parseFloat((_a = this.svg.getAttribute("height")) != null ? _a : "1");
    const scaleY = totalH / (rect.height || 1);
    return (clientY - rect.top) * scaleY;
  }
  clientDxToSvgDx(clientDx) {
    var _a;
    const rect = this.svg.getBoundingClientRect();
    const totalW = parseFloat((_a = this.svg.getAttribute("width")) != null ? _a : "1");
    return clientDx * (totalW / (rect.width || 1));
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

// src/view/TimelineView.ts
var TIMELINE_VIEW_TYPE = "novels-timeline-jp";
var LANE_MIN = -10;
var LANE_MAX = 10;
var TimelineView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.nodes = [];
    this.gaps = [];
    this.selectedId = null;
    this.filterState = {
      characters: /* @__PURE__ */ new Set(),
      locations: /* @__PURE__ */ new Set(),
      searchQuery: ""
    };
    // タイマーID
    this.renderTimer = null;
    // ドラッグパン状態
    this.pan = { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 };
    this.plugin = plugin;
    const { app, settings } = plugin;
    this.eventStore = new EventStore();
    this.cacheStore = new CacheStore(app);
    this.discovery = new DiscoveryEngine(app.vault, settings.calendar, settings.excludedFolders);
    this.layoutEngine = new LayoutEngine(settings.calendar);
    this.relationEngine = new RelationEngine();
    this.gapEngine = new GapEngine(settings.calendar);
    this.filterEngine = new FilterEngine();
  }
  getViewType() {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText() {
    return "Novels Timeline JP";
  }
  getIcon() {
    return "book-open";
  }
  async onOpen() {
    await this.buildUI();
    await this.loadAll();
    this.registerFileWatcher();
  }
  async onClose() {
    var _a;
    if (this.renderTimer) clearTimeout(this.renderTimer);
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
    this.renderer = new TimelineRenderer(this.timelineEl);
    this.debugOverlay = this.timelineEl.createDiv({ cls: "ntj-debug-overlay" });
    this.debugOverlay.style.display = "none";
    this.timelineEl.addEventListener("scroll", () => this.scheduleRender());
    this.timelineEl.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 60 : -60;
      this.timelineEl.scrollLeft += delta;
    }, { passive: false });
    this.registerPanEvents();
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
      el.style.cursor = "grabbing";
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
      el.style.cursor = "";
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
      clearBtn.style.display = this.searchInput.value ? "block" : "none";
      this.scheduleRender();
    });
    const clearBtn = searchWrapper.createEl("button", { cls: "ntj-search-clear", text: "\u2715" });
    clearBtn.style.display = "none";
    clearBtn.addEventListener("click", () => {
      this.searchInput.value = "";
      this.filterState.searchQuery = "";
      clearBtn.style.display = "none";
      this.scheduleRender();
      this.searchInput.focus();
    });
    this.buildFilterPanel("ntj-filter-characters", "\u4EBA\u7269\u25BC", "characters");
    this.buildFilterPanel("ntj-filter-locations", "\u5834\u6240\u25BC", "locations");
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
  }
  /**
   * フィルタパネル（独自ドロップダウン）
   * Obsidian Menu は選択で即閉じるため、複数選択できる独自実装にする
   */
  buildFilterPanel(cls, label, key) {
    const wrapper = this.toolbarEl.createDiv({ cls: "ntj-filter-wrapper" });
    const btn = wrapper.createEl("button", { cls: `ntj-btn ${cls}`, text: label });
    const panel = wrapper.createDiv({ cls: "ntj-filter-panel" });
    panel.style.display = "none";
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
      panel.style.display = "block";
    };
    const closePanel = () => {
      isOpen = false;
      panel.style.display = "none";
    };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) closePanel();
    });
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
      const LANE_W = 40;
      const AXIS_W = LANE_W * 2;
      const LANES = 10;
      const svgWidth = LANE_W * LANES + AXIS_W + LANE_W * LANES;
      const centerX = LANE_W * LANES + AXIS_W / 2;
      const viewW = this.timelineEl.clientWidth;
      this.timelineEl.scrollLeft = centerX - Math.floor(viewW / 2);
    });
  }
  // ----------------------------------------------------------
  // File Watch（差分更新）
  // ----------------------------------------------------------
  registerFileWatcher() {
    const vault = this.plugin.app.vault;
    this.registerEvent(vault.on("create", async (file) => {
      if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return;
      const event = await this.discovery.discoverFile(file);
      if (!event) return;
      this.eventStore.upsert(event);
      this.cacheStore.setEntry(event.id, { order: event.timelineOrder, date: event.date });
      this.filterEngine.buildIndex(this.eventStore.getAll());
      this.scheduleRender();
    }));
    this.registerEvent(vault.on("modify", async (file) => {
      if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return;
      const event = await this.discovery.discoverFile(file);
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
      if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return;
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
      if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return;
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
    const LANE_W = 40;
    const AXIS_W = LANE_W * 2;
    const LANES = 10;
    const svgWidth = LANE_W * LANES + AXIS_W + LANE_W * LANES;
    const centerX = LANE_W * LANES + AXIS_W / 2;
    const tempYMap = this.layoutEngine.calcYPositions(
      validEvents,
      [],
      settings.gapCompression
    );
    this.gaps = settings.gapCompression ? this.gapEngine.buildGaps(validEvents, tempYMap, settings.gapThreshold) : [];
    const finalYMap = this.layoutEngine.calcYPositions(
      validEvents,
      this.gaps,
      settings.gapCompression
    );
    this.gapEngine.updateGapYPositions(this.gaps, finalYMap, validEvents);
    this.nodes = this.layoutEngine.buildLayout(
      validEvents,
      centerX,
      settings.nodeScale / 100,
      this.gaps,
      settings.gapCompression
    );
    const totalHeight = this.layoutEngine.calcTotalHeight(this.nodes);
    const edges = this.relationEngine.buildEdges(validEvents, this.nodes);
    const virtualWindow = {
      scrollTop: this.timelineEl.scrollTop,
      scrollLeft: this.timelineEl.scrollLeft,
      viewportHeight: this.timelineEl.clientHeight,
      viewportWidth: this.timelineEl.clientWidth,
      buffer: settings.renderBuffer
    };
    this.renderer.render({
      nodes: this.nodes,
      gaps: this.gaps,
      edges,
      filteredIds,
      selectedId: this.selectedId,
      settings,
      centerX,
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
      onContextMenu: (svgY, mx, my) => this.handleContextMenu(svgY, mx, my),
      onLaneDrop: (eventId, laneShift) => this.handleLaneDrop(eventId, laneShift)
    });
    const t1 = performance.now();
    this.updateDebugOverlay(validEvents.length, this.nodes.length, this.gaps.length, t1 - t0);
  }
  // ----------------------------------------------------------
  // デバッグオーバーレイ
  // ----------------------------------------------------------
  updateDebugOverlay(eventCount, nodeCount, gapCount, renderMs) {
    const isDebug = this.plugin.settings.debugMode;
    this.debugOverlay.style.display = isDebug ? "block" : "none";
    if (!isDebug) return;
    this.debugOverlay.innerHTML = [
      `events:  ${eventCount}`,
      `nodes:   ${nodeCount}`,
      `gaps:    ${gapCount}`,
      `render:  ${renderMs.toFixed(1)}ms`,
      `scroll:  ${this.timelineEl.scrollTop.toFixed(0)}px`,
      `scale:   ${this.plugin.settings.nodeScale}%`
    ].join("<br>");
  }
  // ----------------------------------------------------------
  // インタラクション
  // ----------------------------------------------------------
  async handleNodeClick(event, _mouseX, _mouseY) {
    this.selectedId = this.selectedId === event.id ? null : event.id;
    this.scheduleRender();
    const sidebar = await this.plugin.getOrOpenSidebarView();
    sidebar == null ? void 0 : sidebar.showViewEdit(event);
  }
  handleGapClick(gap) {
    this.gapEngine.toggleExpand(gap);
    this.scheduleRender();
  }
  handleContextMenu(svgY, mouseX, mouseY) {
    const settings = this.plugin.settings;
    const allEvents = this.eventStore.getAllSorted();
    const dateStr = this.layoutEngine.yToDateString(
      svgY,
      allEvents,
      this.gaps,
      settings.gapCompression,
      ""
    );
    const menu = new import_obsidian.Menu();
    menu.addItem((item) => {
      item.setTitle("\u65B0\u898F\u30A4\u30D9\u30F3\u30C8\u3092\u4F5C\u6210");
      item.setIcon("file-plus");
      item.onClick(async () => {
        const sidebar = await this.plugin.getOrOpenSidebarView();
        sidebar == null ? void 0 : sidebar.showCreate(dateStr);
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
  async handleLaneDrop(eventId, laneShift) {
    const event = this.eventStore.getById(eventId);
    if (!event) return;
    const newLane = Math.max(LANE_MIN, Math.min(LANE_MAX, event.lane + laneShift));
    if (newLane === event.lane) return;
    const updated = { ...event, lane: newLane };
    this.eventStore.upsert(updated);
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (file) {
      try {
        const content = await this.plugin.app.vault.read(file);
        const newContent = this.rewriteLaneInContent(content, newLane);
        if (newContent !== content) {
          await this.plugin.app.vault.modify(file, newContent);
        }
      } catch (e) {
        new import_obsidian.Notice(`lane\u306E\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
      }
    }
    this.scheduleRender();
  }
  /**
   * Markdown 本文中の timelineブロック内の lane: を書き換える。
   * - ``` または ```` で囲まれた timeline ブロックに対応
   * - ブロック内の最初の lane: のみ書き換える
   */
  rewriteLaneInContent(content, newLane) {
    return content.replace(
      /(^`{3,}novels_timeline_jp\s*$)([\s\S]*?)(^`{3,}\s*$)/m,
      (_match, open, body, close) => {
        const newBody = body.replace(
          /^(lane\s*:\s*)(-?\d+)/m,
          `$1${newLane}`
        );
        return open + newBody + close;
      }
    );
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
    this.scheduleRender();
  }
};

// src/view/EventSidebarView.ts
var import_obsidian2 = require("obsidian");
var EVENT_SIDEBAR_VIEW_TYPE = "novels-timeline-jp-sidebar";
var INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;
var EventSidebarView = class extends import_obsidian2.ItemView {
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
  showCreate(dateStr) {
    this.mode = { type: "create", dateStr };
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
        this.renderCreate(this.mode.dateStr);
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
  renderCreate(dateStr) {
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
    this.addField(el, "\u30EC\u30FC\u30F3\uFF08-10\u301C-1 \u307E\u305F\u306F 1\u301C10\uFF09", (w) => {
      const i = w.createEl("input", { type: "number", cls: "ntj-sf-input" });
      i.id = "ntj-f-lane";
      i.value = "1";
      i.min = "-10";
      i.max = "10";
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
    this.addColorField(el, "ntj-f-color", "#808080");
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
    this.addField(el, "\u30EC\u30FC\u30F3\uFF08-10\u301C-1 \u307E\u305F\u306F 1\u301C10\uFF09", (w) => {
      const i = w.createEl("input", { type: "number", cls: "ntj-sf-input" });
      i.id = "ntj-e-lane";
      i.value = String(event.lane);
      i.min = "-10";
      i.max = "10";
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
    this.addColorField(el, "ntj-e-color", event.color || "#808080");
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
  // 関連イベント選択UI
  // ----------------------------------------------------------
  addLinksField(el, prefix, currentLinks) {
    const field = el.createDiv({ cls: "ntj-sf-field" });
    field.createEl("label", { cls: "ntj-sf-label", text: "\u95A2\u9023\u30A4\u30D9\u30F3\u30C8" });
    const listEl = field.createDiv({ cls: "ntj-sf-link-list" });
    listEl.id = `${prefix}-links-list`;
    for (const linkId of currentLinks) {
      this.addLinkItem(listEl, linkId);
    }
    const addRow = field.createDiv({ cls: "ntj-sf-link-add-row" });
    const select = addRow.createEl("select", { cls: "ntj-sf-input ntj-sf-link-select" });
    select.id = `${prefix}-link-select`;
    const selfId = this.mode.type === "view-edit" ? this.mode.event.id : null;
    const allEvents = this.plugin.app.vault.getMarkdownFiles().map((f) => f.basename).filter((name) => /^\d{4}-/.test(name) && name !== selfId).sort();
    const placeholder = select.createEl("option", { text: "\u2500\u2500 \u30A4\u30D9\u30F3\u30C8\u3092\u9078\u629E \u2500\u2500" });
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    for (const name of allEvents) {
      const o = select.createEl("option", { text: name });
      o.value = name;
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
        new import_obsidian2.Notice(`\u300C${val}\u300D\u306F\u3059\u3067\u306B\u8FFD\u52A0\u3055\u308C\u3066\u3044\u307E\u3059`);
        return;
      }
      this.addLinkItem(listEl, val);
      select.value = "";
    });
  }
  addLinkItem(listEl, linkId) {
    const item = listEl.createDiv({ cls: "ntj-sf-link-item" });
    const exists = this.plugin.app.vault.getMarkdownFiles().some((f) => f.basename === linkId);
    const nameEl = item.createSpan({ cls: "ntj-sf-link-id", text: linkId });
    nameEl.dataset.id = linkId;
    if (!exists) {
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
    const laneStr = (_f = (_e = get2("ntj-f-lane")) == null ? void 0 : _e.value.trim()) != null ? _f : "";
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
      new import_obsidian2.Notice(errs.join("\n"));
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
    const laneStr = (_f = (_e = get2("ntj-e-lane")) == null ? void 0 : _e.value.trim()) != null ? _f : String(event.lane);
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
      new import_obsidian2.Notice(errs.join("\n"));
      return;
    }
    const date = DateParser.normalizeFullWidth(dateRaw);
    const lane = parseInt(laneStr, 10);
    const color = colorVal || "#808080";
    const file = this.plugin.app.vault.getFileByPath(event.filePath);
    if (!file) {
      new import_obsidian2.Notice("\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    try {
      let content = await this.plugin.app.vault.read(file);
      content = this.rewriteBlock(content, {
        date,
        lane,
        size,
        color,
        characters: chars.split(",").map((s) => s.trim()).filter(Boolean),
        locations: locs.split(",").map((s) => s.trim()).filter(Boolean),
        summary,
        links
      });
      const oldBaseName = file.basename;
      const prefix = (_r = (_q = oldBaseName.match(/^(\d+)-/)) == null ? void 0 : _q[1]) != null ? _r : "";
      const newBaseName = prefix ? `${prefix}-${title}` : title;
      const newFullPath = file.parent ? `${file.parent.path}/${newBaseName}.md` : `${newBaseName}.md`;
      await this.plugin.app.vault.modify(file, content);
      if (newBaseName !== oldBaseName) {
        await this.plugin.app.fileManager.renameFile(file, newFullPath);
      }
      new import_obsidian2.Notice("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
      this.closeLeaf();
    } catch (e) {
      new import_obsidian2.Notice(`\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
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
    const lane = parseInt(laneStr, 10);
    if (isNaN(lane) || lane === 0 || lane < -10 || lane > 10) {
      errors.push("\u30EC\u30FC\u30F3\u306F -10\u301C-1 \u307E\u305F\u306F 1\u301C10 \u306E\u6574\u6570\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    if (colorVal && !/^#[0-9A-Fa-f]{6}$/.test(colorVal)) {
      errors.push("\u30AB\u30E9\u30FC\u306F #RRGGBB \u5F62\u5F0F\uFF08\u4F8B: #4A90E2\uFF09\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    return errors;
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
      new import_obsidian2.Notice("\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    try {
      await this.plugin.app.vault.trash(file, true);
      new import_obsidian2.Notice(`\u524A\u9664\u3057\u307E\u3057\u305F: ${event.displayTitle}`);
      this.closeLeaf();
    } catch (e) {
      new import_obsidian2.Notice(`\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
    }
  }
  // ----------------------------------------------------------
  // ファイル生成
  // ----------------------------------------------------------
  async createEventFile(params) {
    const vault = this.plugin.app.vault;
    const maxNum = vault.getMarkdownFiles().reduce((max, f) => {
      const n = parseInt(f.basename.split("-")[0], 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const padded = String(maxNum + 1).padStart(4, "0");
    const fileName = `${padded}-${params.title}.md`;
    const folder = params.folder;
    const fullPath = folder ? `${folder}/${fileName}` : fileName;
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
    const charLines = chars.length ? "characters:\n" + chars.map((c) => `  - ${c}`).join("\n") : "characters:";
    const locLines = locs.length ? "locations:\n" + locs.map((l) => `  - ${l}`).join("\n") : "locations:";
    const linkLines = params.links.length ? "links:\n" + params.links.map((l) => `  - "[[${l}]]"`).join("\n") : "links:";
    const template = [
      `# ${padded}-${params.title}`,
      "",
      "```novels_timeline_jp",
      `date: ${params.date}`,
      "",
      `lane: ${params.lane}`,
      "",
      `size: ${params.size}`,
      "",
      `color: "${params.color}"`,
      "",
      charLines,
      "",
      locLines,
      "",
      params.summary ? `summary: ${params.summary}` : "summary:",
      "",
      linkLines,
      "```",
      ""
    ].join("\n");
    try {
      const file = await vault.create(fullPath, template);
      await this.plugin.app.workspace.getLeaf(false).openFile(file);
      new import_obsidian2.Notice(`\u4F5C\u6210\u3057\u307E\u3057\u305F: ${fullPath}`);
    } catch (e) {
      new import_obsidian2.Notice(`\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
    }
  }
  // ----------------------------------------------------------
  // timelineブロック書き換え
  // ----------------------------------------------------------
  rewriteBlock(content, fields) {
    return content.replace(
      /(^`{3,}novels_timeline_jp\s*$)([\s\S]*?)(^`{3,}\s*$)/m,
      (_match, open, body, close) => {
        var _a;
        let b = body;
        b = b.replace(/^(date\s*:\s*).*$/m, `$1${fields.date}`);
        b = b.replace(/^(lane\s*:\s*).*$/m, `$1${fields.lane}`);
        b = b.replace(/^(size\s*:\s*).*$/m, `$1${fields.size}`);
        b = b.replace(/^(color\s*:\s*).*$/m, `$1"${fields.color}"`);
        b = b.replace(/^(summary\s*:\s*).*$/m, `$1${(_a = fields.summary) != null ? _a : ""}`);
        b = this.rewriteListField(b, "characters", fields.characters);
        b = this.rewriteListField(b, "locations", fields.locations);
        b = this.rewriteLinksField(b, fields.links);
        return open + b + close;
      }
    );
  }
  rewriteListField(body, key, values) {
    const lines = body.split("\n");
    const newLines = [];
    let i = 0;
    while (i < lines.length) {
      if (new RegExp(`^${key}\\s*:`).test(lines[i])) {
        newLines.push(values.length ? `${key}:
` + values.map((v) => `  - ${v}`).join("\n") : `${key}:`);
        i++;
        while (i < lines.length && /^\s+-/.test(lines[i])) i++;
      } else {
        newLines.push(lines[i++]);
      }
    }
    return newLines.join("\n");
  }
  rewriteLinksField(body, links) {
    const lines = body.split("\n");
    const newLines = [];
    let i = 0;
    while (i < lines.length) {
      if (/^links\s*:/.test(lines[i])) {
        newLines.push(links.length ? "links:\n" + links.map((l) => `  - "[[${l}]]"`).join("\n") : "links:");
        i++;
        while (i < lines.length && /^\s+-/.test(lines[i])) i++;
      } else {
        newLines.push(lines[i++]);
      }
    }
    return newLines.join("\n");
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
  addColorField(parent, id, initial) {
    this.addField(parent, "\u30AB\u30E9\u30FC", (w) => {
      const row = w.createDiv({ cls: "ntj-sf-color-row" });
      const picker = row.createEl("input", { type: "color", cls: "ntj-sf-color-picker" });
      picker.value = initial;
      const hex = row.createEl("input", { type: "text", cls: "ntj-sf-input ntj-sf-color-hex" });
      hex.id = id;
      hex.value = initial;
      picker.addEventListener("input", () => {
        hex.value = picker.value;
      });
      hex.addEventListener("input", () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) picker.value = hex.value;
      });
    });
  }
};

// src/settings/SettingsTab.ts
var import_obsidian3 = require("obsidian");
var NovelsTimelineSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "General" });
    new import_obsidian3.Setting(containerEl).setName("Excluded Folders").setDesc("\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u63A2\u7D22\u304B\u3089\u9664\u5916\u3059\u308B\u30D5\u30A9\u30EB\u30C0\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09").addText(
      (text) => text.setPlaceholder("Templates, Archive, Trash").setValue(this.plugin.settings.excludedFolders.join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedFolders = value.split(",").map((s) => s.trim()).filter((s) => s !== "");
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    containerEl.createEl("h2", { text: "Display" });
    new import_obsidian3.Setting(containerEl).setName("Node Scale").setDesc("\u30CE\u30FC\u30C9\u500D\u7387\uFF0850\u301C300%\uFF09").addSlider(
      (slider) => slider.setLimits(50, 300, 10).setValue(this.plugin.settings.nodeScale).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.nodeScale = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Zoom Default").setDesc("\u521D\u671F\u30BA\u30FC\u30E0\u7387\uFF0850\u301C300%\uFF09").addSlider(
      (slider) => slider.setLimits(50, 300, 10).setValue(this.plugin.settings.zoomDefault).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.zoomDefault = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Theme Mode").setDesc("\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u8868\u793A\u30C6\u30FC\u30DE").addDropdown(
      (dd) => dd.addOption("auto", "Auto").addOption("light", "Light").addOption("dark", "Dark").setValue(this.plugin.settings.themeMode).onChange(async (value) => {
        this.plugin.settings.themeMode = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    containerEl.createEl("h2", { text: "Timeline" });
    new import_obsidian3.Setting(containerEl).setName("Gap Compression").setDesc("\u9577\u671F\u9593\u306E\u7A7A\u767D\u3092\u5727\u7E2E\u8868\u793A\u3059\u308B").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.gapCompression).onChange(async (value) => {
        this.plugin.settings.gapCompression = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Gap Threshold").setDesc("Gap\u751F\u6210\u6761\u4EF6\uFF08\u65E5\u6570\u76F8\u5F53\u5024\uFF09").addText(
      (text) => text.setValue(String(this.plugin.settings.gapThreshold)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (Number.isFinite(n) && n > 0) {
          this.plugin.settings.gapThreshold = n;
          await this.plugin.saveSettings();
          this.plugin.notifySettingsChanged();
        }
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Auto Expand Gap").setDesc("\u8D77\u52D5\u6642\u306BGap\u3092\u5C55\u958B\u3057\u305F\u72B6\u614B\u306B\u3059\u308B").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoExpandGap).onChange(async (value) => {
        this.plugin.settings.autoExpandGap = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    containerEl.createEl("h2", { text: "Calendar\uFF08\u66A6\u8A2D\u5B9A\uFF09" });
    containerEl.createEl("p", {
      text: "\u7269\u8A9E\u4E16\u754C\u306E\u66A6\u3092\u5B9A\u7FA9\u3057\u307E\u3059\u3002\u6708\u6570\u30FB\u6708\u540D\u30FB\u5404\u6708\u306E\u65E5\u6570\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      cls: "setting-item-description"
    });
    new import_obsidian3.Setting(containerEl).setName("\u66A6\u306E\u540D\u524D").setDesc("\u8868\u793A\u7528\uFF08\u4EFB\u610F\uFF09").addText(
      (text) => text.setValue(this.plugin.settings.calendar.name).onChange(async (value) => {
        this.plugin.settings.calendar.name = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    this.buildCalendarTable(containerEl);
    new import_obsidian3.Setting(containerEl).setName("\u6708\u3092\u8FFD\u52A0").setDesc("\u66A6\u306B\u6708\u3092\u8FFD\u52A0\u3057\u307E\u3059").addButton(
      (btn) => btn.setButtonText("\uFF0B \u6708\u3092\u8FFD\u52A0").onClick(async () => {
        const months = this.plugin.settings.calendar.months;
        const nextMonth = months.length + 1;
        months.push({ month: nextMonth, name: "", days: 30 });
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
        this.display();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("\u30C7\u30D5\u30A9\u30EB\u30C8\u66A6\u306B\u623B\u3059").setDesc("\u897F\u66A6\u4E92\u63DB\u306E12\u304B\u6708\u8A2D\u5B9A\u306B\u623B\u3057\u307E\u3059").addButton(
      (btn) => btn.setButtonText("\u30EA\u30BB\u30C3\u30C8").setWarning().onClick(async () => {
        this.plugin.settings.calendar = JSON.parse(JSON.stringify(DEFAULT_CALENDAR));
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
        this.display();
      })
    );
    containerEl.createEl("h2", { text: "Relation" });
    new import_obsidian3.Setting(containerEl).setName("Relation Display Mode").setDesc("\u95A2\u4FC2\u7DDA\u306E\u8868\u793A\u65B9\u6CD5").addDropdown(
      (dd) => dd.addOption("selected", "Selected Event").addOption("always", "Always Visible").addOption("hidden", "Hidden").setValue(this.plugin.settings.relationDisplayMode).onChange(async (value) => {
        this.plugin.settings.relationDisplayMode = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Relation Style").addDropdown(
      (dd) => dd.addOption("solid", "Solid").addOption("dashed", "Dashed").addOption("dotted", "Dotted").setValue(this.plugin.settings.relationStyle).onChange(async (value) => {
        this.plugin.settings.relationStyle = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Relation Width").setDesc("\u95A2\u4FC2\u7DDA\u306E\u592A\u3055\uFF081\u301C6px\uFF09").addSlider(
      (slider) => slider.setLimits(1, 6, 1).setValue(this.plugin.settings.relationWidth).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.relationWidth = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Relation Arrow Style").addDropdown(
      (dd) => dd.addOption("none", "None").addOption("arrow", "Arrow").addOption("triangle", "Triangle").setValue(this.plugin.settings.relationArrowStyle).onChange(async (value) => {
        this.plugin.settings.relationArrowStyle = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Relation Opacity").setDesc("\u900F\u660E\u5EA6\uFF0810\u301C100%\uFF09").addSlider(
      (slider) => slider.setLimits(10, 100, 5).setValue(Math.round(this.plugin.settings.relationOpacity * 100)).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.relationOpacity = value / 100;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Relation Curve Strength").setDesc("\u30D9\u30B8\u30A7\u66F2\u7387\uFF080\u301C100\uFF09").addSlider(
      (slider) => slider.setLimits(0, 100, 5).setValue(this.plugin.settings.relationCurveStrength).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.relationCurveStrength = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    containerEl.createEl("h2", { text: "Performance" });
    new import_obsidian3.Setting(containerEl).setName("Virtual Rendering").setDesc("\u4EEE\u60F3\u63CF\u753B\uFF08\u8868\u793A\u7BC4\u56F2\u5916\u306E\u30CE\u30FC\u30C9\u3092\u63CF\u753B\u3057\u306A\u3044\uFF09").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.virtualRendering).onChange(async (value) => {
        this.plugin.settings.virtualRendering = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Render Buffer").setDesc("\u5148\u8AAD\u307F\u63CF\u753B\u7BC4\u56F2\uFF08px\uFF09").addText(
      (text) => text.setValue(String(this.plugin.settings.renderBuffer)).onChange(async (value) => {
        const n = parseInt(value, 10);
        if (Number.isFinite(n) && n >= 0) {
          this.plugin.settings.renderBuffer = n;
          await this.plugin.saveSettings();
          this.plugin.notifySettingsChanged();
        }
      })
    );
    containerEl.createEl("h2", { text: "Advanced" });
    new import_obsidian3.Setting(containerEl).setName("\u65B0\u898F\u30A4\u30D9\u30F3\u30C8\u306E\u4FDD\u5B58\u5148\u30D5\u30A9\u30EB\u30C0").setDesc("\u53F3\u30AF\u30EA\u30C3\u30AF\u3067\u4F5C\u6210\u3059\u308B\u30A4\u30D9\u30F3\u30C8\u30CE\u30FC\u30C8\u306E\u4FDD\u5B58\u5148\uFF08\u7A7A\u306E\u5834\u5408\u306F Vault \u30EB\u30FC\u30C8\uFF09").addText(
      (text) => text.setPlaceholder("\u4F8B: events / stories/chapter1").setValue(this.plugin.settings.newEventFolder).onChange(async (value) => {
        this.plugin.settings.newEventFolder = value.trim().replace(/\/$/, "");
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Debug Mode").setDesc("\u30C7\u30D0\u30C3\u30B0\u60C5\u5831\u3092\u30B3\u30F3\u30BD\u30FC\u30EB\u306B\u51FA\u529B\u3059\u308B").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
        this.plugin.settings.debugMode = value;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Rebuild Cache").setDesc("\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u524A\u9664\u3057\u3066\u5168\u518D\u89E3\u6790\u3059\u308B").addButton(
      (btn) => btn.setButtonText("\u518D\u69CB\u7BC9").onClick(async () => {
        const view = this.plugin.getTimelineView();
        if (view) {
          await view.rebuildAll();
          new import_obsidian3.Notice("\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u518D\u69CB\u7BC9\u3057\u307E\u3057\u305F");
        } else {
          new import_obsidian3.Notice("\u30BF\u30A4\u30E0\u30E9\u30A4\u30F3\u30D3\u30E5\u30FC\u304C\u958B\u3044\u3066\u3044\u307E\u305B\u3093");
        }
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Clear Cache").setDesc("\u30AD\u30E3\u30C3\u30B7\u30E5\u30D5\u30A1\u30A4\u30EB\u3092\u524A\u9664\u3059\u308B").addButton(
      (btn) => btn.setButtonText("\u524A\u9664").setWarning().onClick(async () => {
        const view = this.plugin.getTimelineView();
        if (view) {
          await view.rebuildAll();
          new import_obsidian3.Notice("\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u524A\u9664\u3057\u307E\u3057\u305F");
        }
      })
    );
  }
  // ----------------------------------------------------------
  // 暦テーブルUI（C. の暦設定）
  // ----------------------------------------------------------
  buildCalendarTable(containerEl) {
    const calendar = this.plugin.settings.calendar;
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
    const nameInput = nameTd.createEl("input", { type: "text" });
    nameInput.value = month.name;
    nameInput.placeholder = "\u4F8B\uFF1A\u4E94\u6708";
    nameInput.style.width = "80px";
    nameInput.addEventListener("change", async () => {
      months[index].name = nameInput.value;
      await this.plugin.saveSettings();
      this.plugin.notifySettingsChanged();
    });
    const daysTd = tr.createEl("td");
    const daysInput = daysTd.createEl("input", { type: "number" });
    daysInput.value = String(month.days);
    daysInput.min = "1";
    daysInput.max = "999";
    daysInput.style.width = "60px";
    daysInput.addEventListener("change", async () => {
      const n = parseInt(daysInput.value, 10);
      if (Number.isFinite(n) && n >= 1) {
        months[index].days = n;
        await this.plugin.saveSettings();
        this.plugin.notifySettingsChanged();
      }
    });
    const delTd = tr.createEl("td");
    const delBtn = delTd.createEl("button", { text: "\u2715" });
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
var NovelsTimelinePlugin = class extends import_obsidian4.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      TIMELINE_VIEW_TYPE,
      (leaf) => new TimelineView(leaf, this)
    );
    this.registerView(
      EVENT_SIDEBAR_VIEW_TYPE,
      (leaf) => new EventSidebarView(leaf, this)
    );
    const ribbonEl = this.addRibbonIcon("book-open", "Novels Timeline JP", () => {
      this.activateView();
    });
    ribbonEl.innerHTML = `<svg class="lucide lucide-timeline-icon lucide-timeline" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" version="1.1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h.01"/><path d="M4 16h.01"/><path d="M4 20h.01"/><path d="M4 4h.01"/><path d="M4 8h.01"/><g stroke-width="1.2"><path d="M9.414 13.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 12z"/><path d="M9.414 21.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 20z"/><path d="M9.414 5.414A2 2 0 0 0 10.828 6H19a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 4z"/></g></svg>`;
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
          new import_obsidian4.Notice("\u30AD\u30E3\u30C3\u30B7\u30E5\u3092\u518D\u69CB\u7BC9\u3057\u307E\u3057\u305F");
        }
      }
    });
    this.addSettingTab(new NovelsTimelineSettingTab(this.app, this));
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
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
/*! Bundled license information:

js-yaml/dist/js-yaml.mjs:
  (*! js-yaml 4.2.0 https://github.com/nodeca/js-yaml @license MIT *)
*/
