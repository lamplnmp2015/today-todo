<template>
  <div class="app">
    <!-- 顶部标题栏：整块作为拖动区域（data-tauri-drag-region） -->
    <header class="title-bar" data-tauri-drag-region>
      <span class="title" data-tauri-drag-region>📝 今日待办</span>
      <div class="title-right" data-tauri-drag-region>
        <!-- 提示音开关按钮：点击切换是否播放提醒声音 -->
        <button
          class="sound-toggle"
          @click="toggleSound"
          :title="soundEnabled ? '提示音已开启，点击关闭' : '提示音已关闭，点击开启'"
        >
          {{ soundEnabled ? '🔔' : '🔕' }}
        </button>
        <span class="date" data-tauri-drag-region>{{ todayLabel }}</span>
      </div>
    </header>

    <!-- 输入区：不加 data-tauri-drag-region，所以默认不可拖动 -->
    <section class="input-area">
      <input
        v-model.trim="newText"
        @keyup.enter="add"
        placeholder="添加一条待办..."
        class="text-input"
        maxlength="200"
      />
      <div class="time-row">
        <label>
          <span>办理</span>
          <input type="datetime-local" v-model="newDueAt" />
        </label>
        <label>
          <span>截止</span>
          <input type="datetime-local" v-model="newDeadlineAt" />
        </label>
      </div>
      <div class="btn-row">
        <button class="add-btn" @click="add">添加</button>
        <button class="batch-btn" @click="showBatchModal = true">批量添加</button>
      </div>
    </section>

    <!-- 列表区 -->
    <main class="list">
      <transition-group name="item" tag="div">
        <div
          v-for="t in sortedTodos"
          :key="t.id"
          class="item"
          :class="{ done: t.completed, overdue: isOverdue(t) }"
        >
          <input
            type="checkbox"
            :checked="t.completed"
            @change="toggle(t.id)"
            class="checkbox"
          />
          <div class="item-body">
            <div class="item-text">{{ t.text }}</div>
            <div v-if="t.dueAt || t.deadlineAt" class="item-meta">
              <span v-if="t.dueAt">⏰ {{ fmt(t.dueAt) }}</span>
              <span v-if="t.deadlineAt" class="deadline">
                ⛔ {{ fmt(t.deadlineAt) }}
              </span>
            </div>
          </div>
          <button class="del-btn" @click="remove(t.id)" title="删除">✕</button>
        </div>
      </transition-group>
      <div v-if="todos.length === 0" class="empty">今天还没有待办 ✨</div>
    </main>

    <!-- 批量添加弹窗 -->
    <transition name="modal">
      <div v-if="showBatchModal" class="modal-overlay" @click.self="showBatchModal = false">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">批量添加待办</span>
            <button class="modal-close" @click="showBatchModal = false">✕</button>
          </div>
          <div class="modal-body">
            <textarea
              v-model="batchText"
              class="batch-textarea"
              placeholder="每行一条待办事项，例如：&#10;买菜&#10;写周报&#10;回复邮件"
              rows="8"
            ></textarea>
            <div class="batch-time-row">
              <label>
                <span>统一办理时间</span>
                <input type="datetime-local" v-model="batchDueAt" />
              </label>
              <label>
                <span>统一截止时间</span>
                <input type="datetime-local" v-model="batchDeadlineAt" />
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <span class="batch-hint">{{ batchCount }} 条待办</span>
            <button class="add-btn" @click="batchAdd" :disabled="batchCount === 0">
              确认添加
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 应用内 Toast 提示 -->
    <transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.msg }}</div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storage, notify, win } from './api.js'
import { playGentleSound, playUrgentSound } from './sound.js'

// ============ 响应式状态 ============
const todos = ref([])              // 全部待办列表
const newText = ref('')            // 新待办文本输入
const newDueAt = ref('')           // 新待办：办理时间（datetime-local 字符串）
const newDeadlineAt = ref('')      // 新待办：截止时间
const toast = ref(null)            // Toast 提示：{ msg, type } —— type: info/warn/error
const soundEnabled = ref(true)     // 提示音开关：是否在提醒时播放声音

// 批量添加相关状态
const showBatchModal = ref(false)  // 是否显示批量添加弹窗
const batchText = ref('')          // 批量添加的文本内容（每行一条）
const batchDueAt = ref('')         // 批量添加：统一办理时间
const batchDeadlineAt = ref('')    // 批量添加：统一截止时间

let toastTimer = null              // toast 自动隐藏定时器
let tickTimer = null               // 提醒检查定时器

// ============ 派生数据 ============
// 顶部显示的"今日"日期标签
const todayLabel = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

// 排序规则：未完成在上、已完成在下；同组内按创建时间降序（新→旧）
const sortedTodos = computed(() => {
  return [...todos.value].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return b.createdAt - a.createdAt
  })
})

// 批量添加：计算有效行数（去除空行）
const batchCount = computed(() => {
  return batchText.value.split('\n').filter(line => line.trim()).length
})

// ============ 工具函数 ============
// 判断一条待办是否已超时（未完成 && 设置了截止 && 当前时间已过）
function isOverdue(t) {
  if (t.completed || !t.deadlineAt) return false
  return Date.now() > new Date(t.deadlineAt).getTime()
}

// 把 datetime-local 字符串格式化为短显示（月/日 时:分）
function fmt(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 弹一条 toast 提示（2.5 秒后自动消失）
function showToast(msg, type = 'info') {
  toast.value = { msg, type }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 2500)
}

// 把当前 todos 写回磁盘持久化
async function persist() {
  await storage.setTodos(todos.value)
}

// ============ 提示音开关 ============
// 切换提示音开关状态并持久化
async function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  await storage.setSoundEnabled(soundEnabled.value)
}

// ============ 业务操作 ============
// 添加一条新待办
async function add() {
  if (!newText.value) {
    showToast('内容不能为空', 'warn')
    return
  }
  todos.value.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: newText.value,
    completed: false,
    createdAt: Date.now(),
    dueAt: newDueAt.value || null,
    deadlineAt: newDeadlineAt.value || null,
    // 提醒去重标志：每个时间点只通知一次
    dueNotified: false,
    overdueNotified: false
  })
  newText.value = ''
  newDueAt.value = ''
  newDeadlineAt.value = ''
  await persist()
}

// 批量添加待办：将文本框中每行作为一条待办创建
async function batchAdd() {
  const lines = batchText.value.split('\n').filter(line => line.trim())
  if (lines.length === 0) {
    showToast('请输入至少一条待办', 'warn')
    return
  }

  // 逐行创建待办，共享统一的办理/截止时间
  const now = Date.now()
  for (let i = 0; i < lines.length; i++) {
    todos.value.push({
      id: (now + i).toString(36) + Math.random().toString(36).slice(2, 6),
      text: lines[i].trim(),
      completed: false,
      createdAt: now + i,
      dueAt: batchDueAt.value || null,
      deadlineAt: batchDeadlineAt.value || null,
      dueNotified: false,
      overdueNotified: false
    })
  }

  // 批量创建完成后播放温和提示音作为反馈
  if (soundEnabled.value) {
    playGentleSound()
  }

  showToast(`已添加 ${lines.length} 条待办`, 'info')

  // 重置批量添加状态并关闭弹窗
  batchText.value = ''
  batchDueAt.value = ''
  batchDeadlineAt.value = ''
  showBatchModal.value = false
  await persist()
}

// 切换待办完成状态
async function toggle(id) {
  const t = todos.value.find((x) => x.id === id)
  if (!t) return
  t.completed = !t.completed
  await persist()
}

// 删除一条待办
async function remove(id) {
  todos.value = todos.value.filter((x) => x.id !== id)
  await persist()
}

// ============ 定时提醒：每 15 秒扫描一次 ============
function tick() {
  const now = Date.now()
  let mutated = false
  for (const t of todos.value) {
    if (t.completed) continue

    // 办理时间到 → 温和提醒（系统通知 + 温和提示音 + info toast）
    if (t.dueAt && !t.dueNotified && now >= new Date(t.dueAt).getTime()) {
      t.dueNotified = true
      mutated = true
      notify.send('该办理啦', t.text)
      // 如果提示音开关开启，播放温和的叮咚声
      if (soundEnabled.value) {
        playGentleSound()
      }
      showToast(`⏰ 该办理：${t.text}`, 'info')
    }

    // 截止时间到 → 强烈提示（系统通知 + 强烈提示音 + error toast + 闪窗置顶）
    if (
      t.deadlineAt &&
      !t.overdueNotified &&
      now >= new Date(t.deadlineAt).getTime()
    ) {
      t.overdueNotified = true
      mutated = true
      notify.send('⛔ 已超时', t.text)
      // 如果提示音开关开启，播放紧迫的警示音
      if (soundEnabled.value) {
        playUrgentSound()
      }
      showToast(`⛔ 已超时：${t.text}`, 'error')
      win.flash() // 调用 Rust 端：显示窗口 + 短暂置顶
    }
  }
  if (mutated) persist()
}

// ============ 生命周期 ============
onMounted(async () => {
  // 从磁盘加载待办列表
  todos.value = await storage.getTodos()
  // 从磁盘加载提示音开关状态
  soundEnabled.value = await storage.getSoundEnabled()
  // 启动后立即跑一次（处理已经过期的待办）
  tick()
  // 之后每 15 秒检查一次是否有待办需要提醒
  tickTimer = setInterval(tick, 15000)
})

onUnmounted(() => {
  clearInterval(tickTimer)
  clearTimeout(toastTimer)
})
</script>
