import {
  Plugin,
  ItemView,
  WorkspaceLeaf,
  Notice,
  requestUrl,
  setIcon,
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

  private renderTranslator(container: HTMLElement) {
    const section = container.createDiv({ cls: "translator-section" });

    // Title
    const titleRow = section.createDiv({ cls: "translator-title-row" });
    setIcon(titleRow.createSpan(), "languages");
    titleRow.createEl("span", {
      text: "翻译助手",
      cls: "translator-title",
    });

    // Language selector
    const langRow = section.createDiv({ cls: "translator-lang-row" });
    const langSelect = langRow.createEl("select", {
      cls: "translator-lang-select",
    });
    langSelect.createEl("option", { text: "英语 → 中文", value: "en" });
    langSelect.createEl("option", { text: "葡萄牙语 → 中文", value: "pt" });
    langRow.createEl("span", {
      text: " → 中文",
      cls: "translator-arrow",
    });

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
      text: "翻译结果：",
      cls: "translator-result-label",
    });
    const resultContent = resultContainer.createDiv({
      cls: "translator-result-content",
    });
    resultContent.setText("等待翻译...");

    // ---- Translation logic ----

    const doTranslate = async () => {
      const text = inputArea.value.trim();
      if (!text) {
        new Notice("请输入要翻译的文本");
        return;
      }

      const srcLang = langSelect.value;
      const langPair = `${srcLang}|zh`;

      translateBtn.disabled = true;
      translateBtn.setText("翻译中...");
      resultContent.setText("正在翻译...");

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
          let displayText = translated;
          if (match && match < 0.8) {
            displayText += `\n\n(机器翻译，匹配度: ${Math.round(match * 100)}%)`;
          }
          resultContent.setText(displayText);
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
  }
}
