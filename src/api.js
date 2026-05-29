// ============================================================
// API 封装层 —— 统一管理所有 Tauri 能力
// 业务组件只调用这里的函数，不直接使用底层 API。
// 这一层等同于 Electron 的 contextBridge：
// 组件不直接持有 invoke/listen 等底层 API，便于未来替换实现。
// ============================================================
import { invoke } from '@tauri-apps/api/core'
import { Store } from '@tauri-apps/plugin-store'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification'

// ---------- 存储：落盘到 todos.json ----------
// 使用 Tauri Store 插件，数据保存在系统 App 数据目录
let storePromise = null
async function getStore() {
  // load() 会自动创建/读取磁盘文件
  if (!storePromise) storePromise = Store.load('todos.json')
  return storePromise
}

export const storage = {
  // 获取所有待办事项
  async getTodos() {
    const store = await getStore()
    return (await store.get('todos')) || []
  },

  // 保存所有待办事项（立即写盘，避免崩溃丢数据）
  async setTodos(todos) {
    const store = await getStore()
    await store.set('todos', todos)
    await store.save()
  },

  // 获取提示音开关状态（默认开启）
  async getSoundEnabled() {
    const store = await getStore()
    const val = await store.get('soundEnabled')
    // 如果从未设置过，默认为开启
    return val === null || val === undefined ? true : val
  },

  // 保存提示音开关状态
  async setSoundEnabled(enabled) {
    const store = await getStore()
    await store.set('soundEnabled', enabled)
    await store.save()
  }
}

// ---------- 通知：首次调用时申请权限 ----------
// Windows 系统通知需要正确的权限授予
let notifReady = null
async function ensureNotifPerm() {
  if (notifReady) return notifReady
  notifReady = (async () => {
    let granted = await isPermissionGranted()
    if (!granted) granted = (await requestPermission()) === 'granted'
    return granted
  })()
  return notifReady
}

export const notify = {
  /**
   * 发送系统通知
   * 注意：Windows 上通知标题默认可能显示为 PowerShell，
   * 这是因为开发模式下 Tauri 通过 PowerShell 启动。
   * 打包后（NSIS 安装器）会使用 tauri.conf.json 中的 productName。
   * 我们在 title 前加上应用名称前缀确保辨识度。
   */
  async send(title, body) {
    if (!(await ensureNotifPerm())) return
    sendNotification({
      title: `今日待办 - ${title}`,
      body
    })
  }
}

// ---------- 窗口：超时时调用，让 Rust 端置顶并闪一下 ----------
export const win = {
  // 显示窗口 + 聚焦 + 短暂置顶 3 秒（引起用户注意）
  async flash() {
    await invoke('flash_window')
  }
}
