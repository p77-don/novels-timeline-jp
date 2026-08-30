// ============================================================
// ColorPresetModal.ts
// Novels Timeline JP — 配色セット（ノード色＋文字色）作成・編集モーダル
// ============================================================

import { App, Modal, Notice, Setting } from "obsidian";
import { ColorPreset } from "../types/TimelineTypes";
import { ColorPresetStore } from "../store/ColorPresetStore";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * 配色セットの一覧・作成・編集・削除を行うモーダル。
 * 保存は ColorPresetStore 経由で JSON ファイルへ書き込む。
 *
 * @param onChange モーダルを閉じた際に呼ばれる（呼び出し元で選択肢を再描画するため）
 */
export class ColorPresetModal extends Modal {
  private store: ColorPresetStore;
  private onChange: () => void;
  private dirty = false;

  constructor(app: App, store: ColorPresetStore, onChange: () => void) {
    super(app);
    this.store = store;
    this.onChange = onChange;
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.dirty) this.onChange();
  }

  // ----------------------------------------------------------
  // 描画
  // ----------------------------------------------------------

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ntj-preset-modal");

    contentEl.createEl("h2", { text: "配色セットの管理" });
    contentEl.createEl("p", {
      cls:  "ntj-preset-modal-desc",
      text: "ノードの色と文字色の組み合わせを名前付きで保存し、イベント作成・編集時に選択できます。",
    });

    const list = contentEl.createDiv({ cls: "ntj-preset-list" });
    const presets = this.store.getAll();

    if (presets.length === 0) {
      list.createEl("p", {
        cls:  "ntj-preset-empty",
        text: "配色セットがまだありません。下の「新規追加」から作成してください。",
      });
    }

    for (const preset of presets) {
      this.renderPresetRow(list, preset);
    }

    contentEl.createEl("h3", { text: "新規追加" });
    this.renderEditForm(contentEl, null);
  }

  private renderPresetRow(parent: HTMLElement, preset: ColorPreset): void {
    const row = parent.createDiv({ cls: "ntj-preset-row" });

    const swatches = row.createDiv({ cls: "ntj-preset-swatches" });
    const nodeSwatch = swatches.createDiv({ cls: "ntj-preset-swatch" });
    nodeSwatch.style.backgroundColor = preset.nodeColor;
    nodeSwatch.title = `ノード色: ${preset.nodeColor}`;
    const textSwatch = swatches.createDiv({ cls: "ntj-preset-swatch ntj-preset-swatch-text" });
    textSwatch.style.backgroundColor = preset.textColor;
    textSwatch.title = `文字色: ${preset.textColor}`;

    row.createEl("span", { cls: "ntj-preset-name", text: preset.name });

    const btnRow = row.createDiv({ cls: "ntj-preset-row-btns" });

    const editBtn = btnRow.createEl("button", { cls: "ntj-sf-btn", text: "編集" });
    editBtn.addEventListener("click", () => this.openEditRow(parent, preset));

    const delBtn = btnRow.createEl("button", { cls: "ntj-sf-btn ntj-sf-btn-danger", text: "削除" });
    delBtn.addEventListener("click", async () => {
      if (!confirm(`「${preset.name}」を削除しますか？`)) return;
      this.store.remove(preset.id);
      await this.store.save();
      this.dirty = true;
      this.render();
    });
  }

  /** 行を編集フォームに差し替える */
  private openEditRow(listParent: HTMLElement, preset: ColorPreset): void {
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
  private renderEditForm(
    parent: HTMLElement,
    existing: ColorPreset | null,
    onDone?: () => void
  ): void {
    const form = parent.createDiv({ cls: "ntj-preset-form" });

    let name = existing?.name ?? "";
    let nodeColor = existing?.nodeColor ?? "#4A90E2";
    let textColor = existing?.textColor ?? "#ffffff";

    new Setting(form)
      .setName("名前")
      .addText((t) => {
        t.setValue(name).setPlaceholder("例: 主人公");
        t.onChange((v) => { name = v; });
      });

    new Setting(form)
      .setName("ノード色")
      .addColorPicker((c) => {
        c.setValue(nodeColor);
        c.onChange((v) => { nodeColor = v; });
      })
      .addText((t) => {
        t.setValue(nodeColor).setPlaceholder("#RRGGBB");
        t.onChange((v) => { nodeColor = v; });
      });

    new Setting(form)
      .setName("文字色")
      .addColorPicker((c) => {
        c.setValue(textColor);
        c.onChange((v) => { textColor = v; });
      })
      .addText((t) => {
        t.setValue(textColor).setPlaceholder("#RRGGBB");
        t.onChange((v) => { textColor = v; });
      });

    const btnRow = form.createDiv({ cls: "ntj-sf-btn-row" });
    const saveBtn = btnRow.createEl("button", {
      cls:  "ntj-sf-btn ntj-sf-btn-primary",
      text: existing ? "保存" : "追加",
    });
    saveBtn.addEventListener("click", async () => {
      if (!name.trim()) { new Notice("名前を入力してください。"); return; }
      if (!HEX_RE.test(nodeColor.trim())) { new Notice("ノード色は #RRGGBB 形式で入力してください。"); return; }
      if (!HEX_RE.test(textColor.trim())) { new Notice("文字色は #RRGGBB 形式で入力してください。"); return; }

      const preset: ColorPreset = {
        id:   existing?.id ?? ColorPresetStore.generateId(),
        name: name.trim(),
        nodeColor: nodeColor.trim(),
        textColor: textColor.trim(),
      };
      this.store.upsert(preset);
      await this.store.save();
      this.dirty = true;
      new Notice(existing ? "配色セットを更新しました" : "配色セットを追加しました");

      if (onDone) onDone(); else this.render();
    });

    if (existing) {
      const cancelBtn = btnRow.createEl("button", { cls: "ntj-sf-btn", text: "キャンセル" });
      cancelBtn.addEventListener("click", () => { if (onDone) onDone(); else this.render(); });
    }
  }
}
