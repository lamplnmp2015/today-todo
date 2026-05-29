// ============================================================
// 统一封装所有 Tauri 能力，业务组件只调用这里的函数。
// 这一层等同于 Electron 的 contextBridge：组件不直接持有
// invoke/listen 这些底层 API，便于未来替换实现 & 控制权限。
// ============================================================
import { invoke } from '@tauri-apps/api/core'
import { Store } from '@tauri-apps/plugin-store'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification'

// ---------- 存储：键名固定 "todos"，落盘到 todos.json ----------
let storePromise = null
async function getStore() {
  // load() 会自动创建/读取磁盘文件（位于系统 App 数据目录）
  if (!storePromise) storePromise = Store.load('todos.json')
  return storePromise
}

export const storage = {
  async getTodos() {
    const store = await getStore()
    return (await store.get('todos')) || []
  },
  async setTodos(todos) {
    const store = await getStore()
    await store.set('todos', todos)
    await store.save() // 立即写盘，避免崩溃丢数据
  }
}

// ---------- 通知：首次调用时申请权限 ----------
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
  async send(title, body) {
    if (!(await ensureNotifPerm())) return
    sendNotification({ title, body })
  }
}

// ---------- 窗口：超时时调用，让 Rust 端置顶并闪一下 ----------
export const win = {
  async flash() {
    await invoke('flash_window')
  }
}
