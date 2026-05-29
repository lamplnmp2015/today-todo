# 今日待办

一款轻量级桌面待办事项应用，基于 Tauri 2 + Vue 3 构建，支持时间提醒、系统通知、全局快捷键和系统托盘。

## 功能特性

- 添加/完成/删除待办事项
- 设置办理时间和截止时间，到期自动提醒
- 系统通知 + 窗口置顶闪烁提醒
- 全局快捷键 `Ctrl+Shift+T` 快速唤起/隐藏窗口
- 系统托盘常驻，关闭窗口最小化到托盘
- 磨砂玻璃半透明界面
- 数据本地持久化存储

## 技术栈

- **前端**：Vue 3 (Composition API) + Vite
- **后端**：Tauri 2 (Rust)
- **插件**：tauri-plugin-store / tauri-plugin-notification / tauri-plugin-global-shortcut

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式
npm run tauri:dev

# 构建发布包
npm run tauri:build
```

## 系统要求

- Windows 10/11
- WebView2 Runtime（Windows 10 1803+ 通常已预装）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+T` | 显示/隐藏窗口 |

## 许可证

MIT
