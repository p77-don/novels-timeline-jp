// ============================================================
// SettingsTab.ts
// Novels Timeline JP — 設定画面
//
// Obsidian 1.13.0 以降の宣言型設定API（getSettingDefinitions）に
// 準拠する。display() は使用しない（本プラグインの minAppVersion は
// 既に 1.13.0 であるため、旧API向けフォールバックは不要）。
// これにより、設定項目が Obsidian の設定検索に表示されるようになる。
// ============================================================

import {
  App,
  PluginSettingTab,
  Setting,
  SettingPage,
  SettingDefinitionItem,
  Notice,
  normalizePath,
} from "obsidian";
import type NovelsTimelinePlugin from "../main";
import { CalendarMonth, CalendarSettings } from "../types/TimelineTypes";
import {
  BOARD_ZOOM_MIN,
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_DEFAULT,
  GAP_THRESHOLD_MIN,
  GAP_THRESHOLD_MAX,
  GAP_THRESHOLD_DEFAULT,
  GAP_THRESHOLD_STEP,
  LANE_COUNT_MIN,
  LANE_COUNT_MAX,
  LANE_COUNT_DEFAULT,
  LANE_COUNT_STEP,
  cloneDefaultCalendar,
  sanitizeSettings,
} from "./PluginSettings";
import { ColorPresetModal } from "../view/ColorPresetModal";

export class NovelsTimelineSettingTab extends PluginSettingTab {
  plugin: NovelsTimelinePlugin;

  constructor(app: App, plugin: NovelsTimelinePlugin) {
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
  async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    // 各コントロールのmin/max等でUI側では基本的に範囲外の値は入力できないが、
    // 将来のコントロール追加ミスや、この経路を通らない手編集データとの整合を
    // 保つための二重の安全網として、保存前に必ず検証・補正する。
    this.plugin.settings = sanitizeSettings(this.plugin.settings);
    await this.plugin.saveSettings();
    this.plugin.notifySettingsChanged();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      // ========================================================
      // General（先頭セクションのため見出しは付けない）
      // ========================================================
      {
        name: "新規イベントの保存先フォルダ",
        desc: "右クリックで作成するイベントノートの保存先（空の場合は Vault ルート）",
        render: (setting) => {
          setting.addText((text) =>
            text
              .setPlaceholder("例: events / stories/chapter1")
              .setValue(this.plugin.settings.newEventFolder)
              .onChange(async (value) => {
                const trimmed = value.trim();
                this.plugin.settings.newEventFolder = trimmed ? normalizePath(trimmed) : "";
                await this.plugin.saveSettings();
              })
          );
        },
      },
      {
        name: "Excluded folders",
        desc: "タイムライン探索から除外するフォルダ（カンマ区切り）",
        render: (setting) => {
          setting.addText((text) =>
            text
              .setPlaceholder("Templates, Archive, Trash")
              .setValue(this.plugin.settings.excludedFolders.join(", "))
              .onChange(async (value) => {
                this.plugin.settings.excludedFolders = value
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s !== "")
                  .map((s) => normalizePath(s));
                await this.plugin.saveSettings();
                this.plugin.notifySettingsChanged();
              })
          );
        },
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
            desc:
              `タイムラインボードの拡大率（${BOARD_ZOOM_MIN}〜${BOARD_ZOOM_MAX}%）。` +
              "タイムライン上で Shift+ホイールでも変更できます。",
            render: (setting) => {
              setting
                .addSlider((slider) =>
                  slider
                    .setLimits(BOARD_ZOOM_MIN, BOARD_ZOOM_MAX, 10)
                    .setValue(this.plugin.settings.boardZoom)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                      this.plugin.settings.boardZoom = value;
                      await this.plugin.saveSettings();
                      this.plugin.notifySettingsChanged();
                    })
                )
                .addExtraButton((btn) =>
                  btn
                    .setIcon("reset")
                    .setTooltip(`${BOARD_ZOOM_DEFAULT}%に戻す`)
                    .onClick(async () => {
                      this.plugin.settings.boardZoom = BOARD_ZOOM_DEFAULT;
                      await this.plugin.saveSettings();
                      this.plugin.notifySettingsChanged();
                      this.update();
                    })
                );
            },
          },
          {
            name: "配色セット",
            desc: "イベント作成・編集時に選べる「ノード色＋文字色」の組み合わせを管理します。",
            action: () => {
              new ColorPresetModal(this.app, this.plugin.colorPresetStore, () => {
                /* サイドバーは開かれるたびに最新の配色セットを読み込むため、
                   ここでは特に何もしなくてよい。 */
              }).open();
            },
          },
        ],
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
            desc: "関係線の色",
            control: { type: "color", key: "relationColor" },
          },
          {
            name: "Relation style",
            control: {
              type: "dropdown",
              key: "relationStyle",
              options: { solid: "Solid", dashed: "Dashed", dotted: "Dotted" },
            },
          },
          {
            name: "Relation width",
            desc: "関係線の太さ（1〜6px）",
            control: { type: "slider", key: "relationWidth", min: 1, max: 6, step: 1 },
          },
          {
            name: "Relation arrow style",
            control: {
              type: "dropdown",
              key: "relationArrowStyle",
              options: { none: "None", arrow: "Arrow", triangle: "Triangle" },
            },
          },
          {
            name: "Relation opacity",
            desc: "透明度（10〜100%）",
            render: (setting) => {
              setting.addSlider((slider) =>
                slider
                  .setLimits(10, 100, 5)
                  .setValue(Math.round(this.plugin.settings.relationOpacity * 100))
                  .setDynamicTooltip()
                  .onChange(async (value) => {
                    this.plugin.settings.relationOpacity = value / 100;
                    await this.plugin.saveSettings();
                    this.plugin.notifySettingsChanged();
                  })
              );
            },
          },
          {
            name: "Relation curve strength",
            desc: "ベジェ曲率（0〜100）",
            control: { type: "slider", key: "relationCurveStrength", min: 0, max: 100, step: 5 },
          },
        ],
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
            desc:
              `時間軸の右側に並べるレーン列の数（${LANE_COUNT_MIN}〜${LANE_COUNT_MAX}）。` +
              "既存イベントのレーン番号がこの値を超える場合は、表示上は最大レーンに丸めて描画されます（ノート側の値は変更されません）。",
            render: (setting) => {
              setting
                .addSlider((slider) =>
                  slider
                    .setLimits(LANE_COUNT_MIN, LANE_COUNT_MAX, LANE_COUNT_STEP)
                    .setValue(this.plugin.settings.laneCount)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                      this.plugin.settings.laneCount = value;
                      await this.plugin.saveSettings();
                      this.plugin.notifySettingsChanged();
                    })
                )
                .addExtraButton((btn) =>
                  btn
                    .setIcon("reset")
                    .setTooltip(`${LANE_COUNT_DEFAULT}に戻す`)
                    .onClick(async () => {
                      this.plugin.settings.laneCount = LANE_COUNT_DEFAULT;
                      await this.plugin.saveSettings();
                      this.plugin.notifySettingsChanged();
                      this.update();
                    })
                );
            },
          },
          {
            name: "Gap compression",
            desc: "長期間の空白を圧縮表示する",
            control: { type: "toggle", key: "gapCompression" },
          },
          {
            name: "Gap threshold",
            desc: `Gap生成条件（日数相当値、${GAP_THRESHOLD_MIN}〜${GAP_THRESHOLD_MAX}）。イベント間隔がこの値以上の場合にGapとして圧縮表示する。`,
            render: (setting) => {
              setting
                .addSlider((slider) =>
                  slider
                    .setLimits(GAP_THRESHOLD_MIN, GAP_THRESHOLD_MAX, GAP_THRESHOLD_STEP)
                    .setValue(this.plugin.settings.gapThreshold)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                      this.plugin.settings.gapThreshold = value;
                      await this.plugin.saveSettings();
                      this.plugin.notifySettingsChanged();
                    })
                )
                .addExtraButton((btn) =>
                  btn
                    .setIcon("reset")
                    .setTooltip(`${GAP_THRESHOLD_DEFAULT}に戻す`)
                    .onClick(async () => {
                      this.plugin.settings.gapThreshold = GAP_THRESHOLD_DEFAULT;
                      await this.plugin.saveSettings();
                      this.plugin.notifySettingsChanged();
                      this.update();
                    })
                );
            },
          },
        ],
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
        name: "Calendar（暦設定）",
        desc: "物語世界の暦（月数・月名・各月の日数）を設定します。",
        page: () => new CalendarSettingsPage(this.plugin),
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
            desc: "仮想描画（表示範囲外のノードを描画しない）",
            control: { type: "toggle", key: "virtualRendering" },
          },
          {
            name: "Render buffer",
            desc: "先読み描画範囲（px）",
            control: { type: "number", key: "renderBuffer", min: 0 },
          },
          {
            name: "Rebuild cache",
            desc: "キャッシュを削除して全再解析する",
            action: async () => {
              const view = this.plugin.getTimelineView();
              if (view) {
                await view.rebuildAll();
                new Notice("キャッシュを再構築しました");
              } else {
                new Notice("タイムラインビューが開いていません");
              }
            },
          },
        ],
      },
    ];
  }
}

// ================================================================
// Calendar（暦設定）サブページ
//
// 月テーブルは行の追加・削除・複数フィールド編集を伴う動的UIであり、
// 宣言型 control / list の1行1コントロール前提では表現しづらいため、
// 公式ガイドの推奨（"Reach for the imperative form only when this
// can't express what you need"）に従い、SettingPage を用いた命令的
// 実装のままとする。
// ================================================================

class CalendarSettingsPage extends SettingPage {
  constructor(private plugin: NovelsTimelinePlugin) {
    super();
    this.title = "Calendar（暦設定）";
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      text: "物語世界の暦を定義します。月数・月名・各月の日数を設定してください。",
      cls: "setting-item-description",
    });

    const calendar: CalendarSettings = this.plugin.settings.calendar;

    // 暦名
    new Setting(containerEl)
      .setName("暦の名前")
      .setDesc("表示用（任意）")
      .addText((text) =>
        text
          .setValue(calendar.name)
          .onChange(async (value) => {
            this.plugin.settings.calendar.name = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    // 月テーブル
    this.buildCalendarTable(containerEl, calendar);

    // 月を追加ボタン
    new Setting(containerEl)
      .setName("月を追加")
      .setDesc("暦に月を追加します")
      .addButton((btn) =>
        btn.setButtonText("＋ 月を追加").onClick(async () => {
          const months = this.plugin.settings.calendar.months;
          const nextMonth = months.length + 1;
          months.push({ month: nextMonth, name: "", days: 30 });
          await this.plugin.saveSettings();
          this.plugin.notifySettingsChanged();
          this.display(); // 再描画
        })
      );

    // デフォルト暦に戻す
    new Setting(containerEl)
      .setName("デフォルト暦に戻す")
      .setDesc("暦名を「西暦」、月名を未設定にリセットします")
      .addButton((btn) =>
        btn
          .setButtonText("リセット")
          .setDestructive()
          .onClick(async () => {
            this.plugin.settings.calendar = cloneDefaultCalendar();
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
            this.display();
          })
      );
  }

  // ----------------------------------------------------------
  // 暦テーブルUI
  // ----------------------------------------------------------

  private buildCalendarTable(containerEl: HTMLElement, calendar: CalendarSettings): void {
    const tableWrapper = containerEl.createDiv({ cls: "ntj-calendar-table" });
    const table = tableWrapper.createEl("table");

    // ヘッダー
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "月番号" });
    headerRow.createEl("th", { text: "月名（任意）" });
    headerRow.createEl("th", { text: "日数" });
    headerRow.createEl("th", { text: "" });

    // 月行
    const tbody = table.createEl("tbody");
    for (let i = 0; i < calendar.months.length; i++) {
      this.buildCalendarRow(tbody, calendar.months, i);
    }
  }

  private buildCalendarRow(
    tbody: HTMLElement,
    months: CalendarMonth[],
    index: number
  ): void {
    const month = months[index];
    const tr = tbody.createEl("tr");

    // 月番号（読み取り専用）
    tr.createEl("td", { text: String(month.month) });

    // 月名
    const nameTd = tr.createEl("td");
    const nameInput = nameTd.createEl("input", { type: "text", cls: "ntj-calendar-month-name-input" });
    nameInput.value = month.name;
    nameInput.placeholder = "例：一月";
    nameInput.addEventListener("change", async () => {
      months[index].name = nameInput.value;
      await this.plugin.saveSettings();
      this.plugin.notifySettingsChanged();
    });

    // 日数
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

    // 削除ボタン
    // 暦の月数が0になると calcYearDays() が0を返し、全イベントの日付が
    // 不正扱いになってしまうため、最後の1か月は削除できないようにする。
    const delTd = tr.createEl("td");
    const delBtn = delTd.createEl("button", { text: "削除" });
    if (months.length <= 1) {
      delBtn.disabled = true;
      delBtn.setAttribute("title", "暦には最低1か月が必要です");
    }
    delBtn.addEventListener("click", async () => {
      if (months.length <= 1) {
        new Notice("暦には最低1か月が必要です。これ以上削除できません。");
        return;
      }
      months.splice(index, 1);
      // 月番号を振り直す
      months.forEach((m, i) => { m.month = i + 1; });
      await this.plugin.saveSettings();
      this.plugin.notifySettingsChanged();
      this.display();
    });
  }
}
