import {
  Plugin,
  ItemView,
  WorkspaceLeaf,
  Notice,
  requestUrl,
  setIcon,
  MarkdownView,
} from "obsidian";

const VIEW_TYPE = "sidebar-workspace";

// ---- Module interface for extensibility ----

interface WorkspaceModule {
  id: string;
  name: string;
  render(container: HTMLElement): void;
}

// ---- Main Plugin ----

export default class SidebarWorkspacePlugin extends Plugin {
  private modules: WorkspaceModule[] = [];

  async onload() {
    this.registerView(
      VIEW_TYPE,
      (leaf) => new WorkspaceView(leaf, this.modules)
    );

    this.addRibbonIcon("languages", "打开工作区", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-workspace",
      name: "打开工作区",
      callback: () => this.activateView(),
    });
  }

  onunload() {}

  async activateView() {
    const { workspace } = this.app;

    const leaves = workspace.getLeavesOfType(VIEW_TYPE);
    let leaf: WorkspaceLeaf;

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }
}

// ---- Workspace View ----

class WorkspaceView extends ItemView {
  private modules: WorkspaceModule[];

  constructor(leaf: WorkspaceLeaf, modules: WorkspaceModule[]) {
    super(leaf);
    this.modules = modules;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "工作区";
  }

  getIcon(): string {
    return "languages";
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sidebar-workspace");

    // ---- Translation section ----
    this.renderTranslator(contentEl);

    // ---- Divider ----
    contentEl.createEl("hr", { cls: "workspace-divider" });

    // ---- Reserved area for future modules ----
    const reservedContainer = contentEl.createDiv({
      cls: "workspace-reserved",
    });
    reservedContainer.createEl("div", {
      text: "更多功能即将上线...",
      cls: "workspace-placeholder",
    });

    // Render any registered modules
    for (const mod of this.modules) {
      const section = reservedContainer.createDiv({
        cls: "workspace-module",
      });
      section.createEl("div", {
        text: mod.name,
        cls: "workspace-module-title",
      });
      const body = section.createDiv({ cls: "workspace-module-body" });
      mod.render(body);
    }
  }

  async onClose() {
    // nothing to clean up
  }

  // ---- Translator UI ----

  // Pending translation state — cleared when user clicks away or presses Esc
  private pendingResult: {
    original: string;
    translated: string;
    srcLang: string;
    tgtLang: string;
  } | null = null;

  private renderTranslator(container: HTMLElement) {
    const section = container.createDiv({ cls: "translator-section" });

    // Title
    const titleRow = section.createDiv({ cls: "translator-title-row" });
    setIcon(titleRow.createSpan(), "languages");
    titleRow.createEl("span", {
      text: "翻译助手",
      cls: "translator-title",
    });

    // Language selectors: source + target
    const langRow = section.createDiv({ cls: "translator-lang-row" });
    const srcLangSelect = langRow.createEl("select", {
      cls: "translator-lang-select",
    });
    const langOpts = [
      { text: "英语", value: "en" },
      { text: "葡萄牙语", value: "pt" },
      { text: "中文", value: "zh" },
    ];
    for (const opt of langOpts) {
      srcLangSelect.createEl("option", { text: opt.text, value: opt.value });
    }
    srcLangSelect.value = "en";
    langRow.createEl("span", {
      text: " → ",
      cls: "translator-arrow",
    });
    const tgtLangSelect = langRow.createEl("select", {
      cls: "translator-lang-select",
    });
    for (const opt of langOpts) {
      tgtLangSelect.createEl("option", { text: opt.text, value: opt.value });
    }
    tgtLangSelect.value = "zh";

    // Format selector
    const formatRow = section.createDiv({ cls: "translator-format-row" });
    formatRow.createEl("span", { text: "插入格式", cls: "translator-format-label" });
    const formatSelect = formatRow.createEl("select", {
      cls: "translator-format-select",
    });
    formatSelect.createEl("option", { text: "Callout 高亮块", value: "callout" });
    formatSelect.createEl("option", { text: "简洁文本", value: "plain" });

    // Input
    const inputArea = section.createEl("textarea", {
      cls: "translator-input",
      attr: {
        placeholder: "输入要翻译的文本，按 Ctrl+Enter 翻译",
        rows: "3",
      },
    });

    // Button row
    const btnRow = section.createDiv({ cls: "translator-btn-row" });
    const translateBtn = btnRow.createEl("button", {
      text: "翻译",
      cls: "translator-btn",
    });

    // Result area
    const resultContainer = section.createDiv({
      cls: "translator-result",
    });
    const resultLabel = resultContainer.createDiv({
      cls: "translator-result-label",
    });
    const resultContent = resultContainer.createDiv({
      cls: "translator-result-content",
      attr: { tabindex: "0" },
    });
    const resultHint = resultContainer.createDiv({
      cls: "translator-result-hint",
    });

    // ---- Insert pending translation into active note ----

    const insertIntoNote = () => {
      if (!this.pendingResult) return;

      // Get a markdown editor regardless of where focus is
      const mdLeaves = this.app.workspace.getLeavesOfType("markdown");
      const mdView = mdLeaves[0]?.view as MarkdownView | undefined;
      const editor = mdView?.editor;
      if (!editor) {
        new Notice("没有打开的笔记，无法插入");
        return;
      }

      const langMap: Record<string, string> = { en: "英语", pt: "葡萄牙语", zh: "中文" };
      const srcLabel = langMap[this.pendingResult.srcLang] || this.pendingResult.srcLang;
      const tgtLabel = langMap[this.pendingResult.tgtLang] || this.pendingResult.tgtLang;
      const original = this.pendingResult.original;
      const translated = this.pendingResult.translated;

      const useCallout = formatSelect.value === "callout";
      const markdown = useCallout
        ? [
            "> [!info] 翻译 | " + srcLabel + " → " + tgtLabel,
            "> **原文**: " + original.replace(/\n/g, "\n> "),
            "> **" + tgtLabel + "**: " + translated.replace(/\n/g, "\n> "),
          ].join("\n")
        : [
            srcLabel + ": " + original,
            tgtLabel + ": " + translated,
          ].join("\n");

      // Insert at the start of the next line, regardless of cursor column
      const cursor = editor.getCursor();
      const endOfLine = { line: cursor.line, ch: editor.getLine(cursor.line).length };
      editor.replaceRange("\n" + markdown + "\n", endOfLine);
      new Notice("已插入到笔记");
      clearPending(resultContent, resultHint);
    };

    // ---- Clear pending state ----

    const clearPending = (
      content: HTMLElement = resultContent,
      hint: HTMLElement = resultHint
    ) => {
      this.pendingResult = null;
      content.empty();
      content.setText("等待翻译...");
      content.removeClass("translator-result-pending");
      hint.empty();
    };

    // ---- Translation logic ----

    const doTranslate = async () => {
      const text = inputArea.value.trim();
      if (!text) {
        new Notice("请输入要翻译的文本");
        return;
      }

      const srcLang = srcLangSelect.value;
      const tgtLang = tgtLangSelect.value;
      if (srcLang === tgtLang) {
        new Notice("源语言和目标语言不能相同");
        return;
      }
      const langPair = `${srcLang}|${tgtLang}`;

      translateBtn.disabled = true;
      translateBtn.setText("翻译中...");
      this.pendingResult = null;
      resultContent.setText("正在翻译...");
      resultContent.removeClass("translator-result-pending");
      resultHint.empty();

      try {
        const resp = await requestUrl({
          url: `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`,
          throw: false,
        });

        if (resp.status !== 200) {
          resultContent.setText(`翻译失败: HTTP ${resp.status}`);
          return;
        }

        const json = resp.json;
        const translated = json?.responseData?.translatedText;
        const match = json?.responseData?.match;

        if (translated) {
          // Store pending result
          this.pendingResult = {
            original: text,
            translated,
            srcLang,
            tgtLang,
          };

          // Display with match quality
          let display = `**原文**: ${text}\n\n**中文**: ${translated}`;
          if (match && match < 0.8) {
            display += `\n\n*（机器翻译，匹配度: ${Math.round(match * 100)}%）*`;
          }

          resultContent.empty();
          resultContent.addClass("translator-result-pending");
          resultContent.createEl("div", { text: text, cls: "pending-original" });
          resultContent.createEl("div", { text: translated, cls: "pending-translated" });
          if (match && match < 0.8) {
            resultContent.createEl("div", {
              text: `匹配度: ${Math.round(match * 100)}%`,
              cls: "pending-match",
            });
          }

          resultHint.setText("按 Enter 插入笔记 | 按 Esc 取消");

          // Auto-focus result area so Enter works immediately
          resultContent.focus();
        } else {
          resultContent.setText("翻译失败：未返回结果");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resultContent.setText(`网络错误: ${msg}`);
      } finally {
        translateBtn.disabled = false;
        translateBtn.setText("翻译");
      }
    };

    translateBtn.addEventListener("click", doTranslate);

    inputArea.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doTranslate();
      }
    });

    // ---- Pending-result keyboard handling (listen on whole section, not just result) ----

    section.addEventListener("keydown", (e) => {
      if (!this.pendingResult) return;

      // Don't intercept Enter in the input textarea (user is typing)
      if (e.target === inputArea) return;

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        insertIntoNote();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        clearPending();
      }
    });

    // ---- Blur: clear pending only when focus leaves the entire translator section ----

    resultContent.addEventListener("blur", (evt) => {
      const relatedTarget = (evt as FocusEvent).relatedTarget as HTMLElement | null;
      // Don't clear if focus stays within the translator section (e.g. clicking format select)
      if (relatedTarget && section.contains(relatedTarget)) return;
      setTimeout(() => {
        if (this.pendingResult) {
          clearPending();
        }
      }, 200);
    });

    // Clear pending on click outside the entire translator section
    document.addEventListener("click", (e) => {
      if (this.pendingResult && !section.contains(e.target as Node)) {
        clearPending();
      }
    });
  }
}
