# Obsidian Sidebar Workspace

Obsidian 右侧边栏工作区插件，内置翻译助手（英语/葡萄牙语 → 中文），支持扩展更多功能模块。

## 功能

- **翻译助手**：英语和葡萄牙语到中文的即时翻译，基于 MyMemory 免费 API
- **可扩展架构**：预留模块注册接口，方便后续添加更多工具

## 安装

### 手动安装

1. 下载最新 Release 中的 `main.js`、`manifest.json`、`styles.css`
2. 放入 vault 的 `.obsidian/plugins/sidebar-workspace/` 目录
3. 在 Obsidian 设置 → 第三方插件中启用「工作区」

### 从源码构建

```bash
npm install
npm run build
```

## 使用

- 点击左侧 ribbon 的语言图标，或命令面板执行「打开工作区」
- 选择源语言（英语/葡萄牙语），输入文本，按 `Ctrl+Enter` 或点击「翻译」

## 扩展开发

插件内部定义了 `WorkspaceModule` 接口，后续可通过注册模块扩展功能：

```ts
interface WorkspaceModule {
  id: string;
  name: string;
  render(container: HTMLElement): void;
}
```

## 许可

MIT
