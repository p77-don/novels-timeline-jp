// ============================================================
// SettingsTab.ts
// Novels Timeline JP — 設定画面
// ============================================================

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type NovelsTimelinePlugin from "../main";
import { CalendarMonth, CalendarSettings } from "../types/TimelineTypes";
import { DEFAULT_CALENDAR } from "./PluginSettings";

export class NovelsTimelineSettingTab extends PluginSettingTab {
  plugin: NovelsTimelinePlugin;

  constructor(app: App, plugin: NovelsTimelinePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ========================================================
    // General
    // ========================================================
    containerEl.createEl("h2", { text: "General" });

    new Setting(containerEl)
      .setName("新規イベントの保存先フォルダ")
      .setDesc("右クリックで作成するイベントノートの保存先（空の場合は Vault ルート）")
      .addText((text) =>
        text
          .setPlaceholder("例: events / stories/chapter1")
          .setValue(this.plugin.settings.newEventFolder)
          .onChange(async (value) => {
            this.plugin.settings.newEventFolder = value.trim().replace(/\/$/, "");
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Excluded Folders")
      .setDesc("タイムライン探索から除外するフォルダ（カンマ区切り）")
      .addText((text) =>
        text
          .setPlaceholder("Templates, Archive, Trash")
          .setValue(this.plugin.settings.excludedFolders.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s !== "");
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    // ========================================================
    // Display
    // ========================================================
    containerEl.createEl("h2", { text: "Display" });

    new Setting(containerEl)
      .setName("Node Scale")
      .setDesc("ノード倍率（50〜300%）")
      .addSlider((slider) =>
        slider
          .setLimits(50, 300, 10)
          .setValue(this.plugin.settings.nodeScale)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.nodeScale = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    // ========================================================
    // Relation
    // ========================================================
    containerEl.createEl("h2", { text: "Relation" });

    new Setting(containerEl)
      .setName("Relation Color")
      .setDesc("関係線の色")
      .addColorPicker((picker) =>
        picker
          .setValue(this.plugin.settings.relationColor)
          .onChange(async (value) => {
            this.plugin.settings.relationColor = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Relation Style")
      .addDropdown((dd) =>
        dd
          .addOption("solid",  "Solid")
          .addOption("dashed", "Dashed")
          .addOption("dotted", "Dotted")
          .setValue(this.plugin.settings.relationStyle)
          .onChange(async (value) => {
            this.plugin.settings.relationStyle = value as "solid" | "dashed" | "dotted";
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Relation Width")
      .setDesc("関係線の太さ（1〜6px）")
      .addSlider((slider) =>
        slider
          .setLimits(1, 6, 1)
          .setValue(this.plugin.settings.relationWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.relationWidth = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Relation Arrow Style")
      .addDropdown((dd) =>
        dd
          .addOption("none",     "None")
          .addOption("arrow",    "Arrow")
          .addOption("triangle", "Triangle")
          .setValue(this.plugin.settings.relationArrowStyle)
          .onChange(async (value) => {
            this.plugin.settings.relationArrowStyle = value as "none" | "arrow" | "triangle";
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Relation Opacity")
      .setDesc("透明度（10〜100%）")
      .addSlider((slider) =>
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

    new Setting(containerEl)
      .setName("Relation Curve Strength")
      .setDesc("ベジェ曲率（0〜100）")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(this.plugin.settings.relationCurveStrength)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.relationCurveStrength = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    // ========================================================
    // Timeline
    // ========================================================
    containerEl.createEl("h2", { text: "Timeline" });

    new Setting(containerEl)
      .setName("Gap Compression")
      .setDesc("長期間の空白を圧縮表示する")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.gapCompression)
          .onChange(async (value) => {
            this.plugin.settings.gapCompression = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Gap Threshold")
      .setDesc("Gap生成条件（日数相当値）")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.gapThreshold))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (Number.isFinite(n) && n > 0) {
              this.plugin.settings.gapThreshold = n;
              await this.plugin.saveSettings();
              this.plugin.notifySettingsChanged();
            }
          })
      );

    new Setting(containerEl)
      .setName("左レーンタイトル")
      .setDesc("レーン -1〜-10 の上部に表示するタイトル（任意）。例：表サイド")
      .addText((text) =>
        text
          .setPlaceholder("例: 表サイド")
          .setValue(this.plugin.settings.leftLaneTitle)
          .onChange(async (value) => {
            this.plugin.settings.leftLaneTitle = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("右レーンタイトル")
      .setDesc("レーン 1〜10 の上部に表示するタイトル（任意）。例：裏サイド")
      .addText((text) =>
        text
          .setPlaceholder("例: 裏サイド")
          .setValue(this.plugin.settings.rightLaneTitle)
          .onChange(async (value) => {
            this.plugin.settings.rightLaneTitle = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    // ========================================================
    // Calendar（C. 暦設定）
    // ========================================================
    containerEl.createEl("h2", { text: "Calendar（暦設定）" });
    containerEl.createEl("p", {
      text: "物語世界の暦を定義します。月数・月名・各月の日数を設定してください。",
      cls: "setting-item-description",
    });

    // 暦名
    new Setting(containerEl)
      .setName("暦の名前")
      .setDesc("表示用（任意）")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.calendar.name)
          .onChange(async (value) => {
            this.plugin.settings.calendar.name = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    // 月テーブル
    this.buildCalendarTable(containerEl);

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
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.calendar = JSON.parse(JSON.stringify(DEFAULT_CALENDAR));
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
            this.display();
          })
      );

    // ========================================================
    // Advanced
    // ========================================================
    containerEl.createEl("h2", { text: "Advanced" });

    new Setting(containerEl)
      .setName("Virtual Rendering")
      .setDesc("仮想描画（表示範囲外のノードを描画しない）")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.virtualRendering)
          .onChange(async (value) => {
            this.plugin.settings.virtualRendering = value;
            await this.plugin.saveSettings();
            this.plugin.notifySettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Render Buffer")
      .setDesc("先読み描画範囲（px）")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.renderBuffer))
          .onChange(async (value) => {
            const n = parseInt(value, 10);
            if (Number.isFinite(n) && n >= 0) {
              this.plugin.settings.renderBuffer = n;
              await this.plugin.saveSettings();
              this.plugin.notifySettingsChanged();
            }
          })
      );

    new Setting(containerEl)
      .setName("Rebuild Cache")
      .setDesc("キャッシュを削除して全再解析する")
      .addButton((btn) =>
        btn.setButtonText("再構築").onClick(async () => {
          const view = this.plugin.getTimelineView();
          if (view) {
            await view.rebuildAll();
            new Notice("キャッシュを再構築しました");
          } else {
            new Notice("タイムラインビューが開いていません");
          }
        })
      );
  }

  // ----------------------------------------------------------
  // 暦テーブルUI（C. の暦設定）
  // ----------------------------------------------------------

  private buildCalendarTable(containerEl: HTMLElement): void {
    const calendar: CalendarSettings = this.plugin.settings.calendar;

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
    const nameInput = nameTd.createEl("input", { type: "text" });
    nameInput.value = month.name;
    nameInput.placeholder = "例：五月";
    nameInput.style.width = "80px";
    nameInput.addEventListener("change", async () => {
      months[index].name = nameInput.value;
      await this.plugin.saveSettings();
      this.plugin.notifySettingsChanged();
    });

    // 日数
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

    // 削除ボタン
    const delTd = tr.createEl("td");
    const delBtn = delTd.createEl("button", { text: "✕" });
    delBtn.addEventListener("click", async () => {
      months.splice(index, 1);
      // 月番号を振り直す
      months.forEach((m, i) => { m.month = i + 1; });
      await this.plugin.saveSettings();
      this.plugin.notifySettingsChanged();
      this.display();
    });
  }
}
