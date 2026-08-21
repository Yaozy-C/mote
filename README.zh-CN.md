# Mote

[English](README.md) · **简体中文**

Mote 是一款面向 macOS 和 Windows 的本地剪贴板历史工具。它会安静地记录复制内容，支持随时搜索，并能把一条或一组有序内容直接粘贴回刚才使用的应用。

![Mote 产品界面](public/assets/mote-interface.png)

## Mote 可以做什么

- 自动记录文字、链接、颜色、代码、HTML、图片和文件。
- 一次复制中包含的多种格式会保存为同一条记录，不会拆开。
- 自动选择最适合的预览，不向用户展示没有必要的格式标签页。
- 快速搜索全部剪贴板历史。
- 直接粘贴回刚才使用的应用。
- 先选择多条记录，再按照从最早到最新的顺序一次粘贴。
- 置顶经常使用的记录。
- 删除或清空后，可在七秒内通过“撤销”恢复。
- 检查原文件是否已经移动或删除。
- 从图片中提取配色，并复制 HEX 或 RGB 色值。
- 使用本地 SQLite 数据库存储全部记录。
- 从 GitHub Releases 检查并安装应用更新。
- 支持简体中文和英文。

## 支持平台

| 平台 | 安装包 | 自动粘贴 | 说明 |
| --- | --- | --- | --- |
| macOS（Apple 芯片与 Intel） | DMG | 使用 macOS 辅助功能权限 | 保留原生剪贴板格式及有序的剪贴板项目。 |
| Windows 10/11 x64 | NSIS 安装程序（`.exe`） | 使用标准 `Ctrl+V` 输入方式 | 保留文字、HTML、图片、文件及系统能够提供的组合格式。 |

前往 [GitHub Releases](https://github.com/Yaozy-C/mote/releases/latest) 下载最新版本。

## 快捷键

所有应用快捷键都可以在 **设置 → 键盘快捷键** 中修改。

| 操作 | macOS 默认快捷键 | Windows 默认快捷键 |
| --- | --- | --- |
| 打开 Mote | `Option + 空格` | `Ctrl + Shift + 空格` |
| 打开多条粘贴 | `Option + Shift + 空格` | `Ctrl + Alt + 空格` |
| 在 Mote 中切换多选模式 | `Command + Shift + M` | `Ctrl + Shift + M` |
| 搜索 | `Command + K` | `Ctrl + K` |
| 粘贴选中的内容 | `Enter` | `Enter` |
| 只复制选中内容、不直接粘贴 | `Command + Enter` | `Ctrl + Enter` |

## 隐私与权限

Mote 不需要账号，也不依赖云服务。剪贴板记录和图片预览缓存在操作系统的应用数据目录中，并保存在本地 SQLite 数据库里。

- **macOS：**辅助功能权限只用于把粘贴快捷键发送给打开 Mote 之前正在使用的应用。
- **Windows：**不需要单独授予辅助功能权限；如果目标应用以管理员身份运行，Windows 可能会阻止普通权限的 Mote 向其中粘贴。
- **敏感应用：**可以开启“忽略密码管理器”，当识别到敏感应用处于前台时不记录新的剪贴板内容。

## 本地开发

### 环境要求

- Node.js 22 或更高版本
- npm
- Rust 1.77.2 或更高版本
- 对应平台的构建工具：
  - macOS：Xcode Command Line Tools
  - Windows：Visual Studio 2022 Build Tools，安装“使用 C++ 的桌面开发”工作负载，并安装 WebView2

### 运行桌面应用

```bash
npm install
npm run desktop:dev
```

### 构建与测试

```bash
npm run build
npm run test:sites
cargo test --manifest-path src-tauri/Cargo.toml
```

请在对应的操作系统中生成原生安装包：

```bash
# macOS
npm run desktop:bundle:dmg

# Windows
npm run desktop:bundle:windows
```

## 项目结构

```text
src/                         React 界面
  components/                历史记录、预览、帮助、设置和弹窗
  hooks/                     剪贴板历史和升级状态
  services/                  Tauri 命令桥接与网页演示数据
  utils/                     跨平台快捷键处理
src-tauri/                   Tauri 原生应用
  src/database.rs            SQLite 存储、搜索、保留策略和撤销
  src/watcher.rs             剪贴板监听与记录生成
  src/platform.rs            macOS 和 Windows 原生剪贴板及粘贴能力
  src/commands.rs            提供给界面的原生命令
.github/workflows/release.yml  macOS 与 Windows GitHub Release 构建
worker/                      可交付到 Sites 的网页预览 Worker
```

## 发布与升级

推送 `v0.3.0` 这类版本标签后，Release 工作流会生成 Apple 芯片和 Intel 版本的 DMG、Windows x64 NSIS 安装包、升级文件以及 `latest.json`。Mote 会读取对应的 GitHub Release 信息进行应用内更新检查。

升级文件已经使用密钥签名。Windows 安装包本身还需要配置 Authenticode 证书，才能避免新设备首次安装时出现“未知发布者”提示。

