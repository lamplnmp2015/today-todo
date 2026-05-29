// ============================================================
// 提示音模块 —— 使用 Web Audio API 合成提示音
// 无需外部音频文件，直接在浏览器端生成声音波形。
// ============================================================

/**
 * 获取全局 AudioContext 实例（懒加载，首次调用时创建）
 * 浏览器要求用户交互后才能播放音频，Tauri 桌面应用无此限制
 */
let audioCtx = null
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // 如果 AudioContext 被挂起（浏览器安全策略），尝试恢复
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * 播放温和提示音 —— 办理时间到时使用
 * 效果：两个柔和的正弦波音符（叮~咚~），类似门铃声
 * 频率：C5(523Hz) → E5(659Hz)，音量渐入渐出，不突兀
 */
export function playGentleSound() {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  // --- 第一个音符：C5 (523Hz) ---
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'              // 正弦波：最柔和的波形
  osc1.frequency.value = 523.25   // C5 音高
  // 音量包络：快速渐入 → 缓慢渐出，避免爆音
  gain1.gain.setValueAtTime(0, now)
  gain1.gain.linearRampToValueAtTime(0.3, now + 0.05)   // 50ms 渐入
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3) // 250ms 渐出
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.35)

  // --- 第二个音符：E5 (659Hz)，延迟 200ms 播放 ---
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.value = 659.25   // E5 音高，比第一个高，形成上行旋律
  gain2.gain.setValueAtTime(0, now + 0.2)
  gain2.gain.linearRampToValueAtTime(0.3, now + 0.25)
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55)
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(now + 0.2)
  osc2.stop(now + 0.6)
}

/**
 * 播放强烈提示音 —— 超时时使用
 * 效果：三声短促的警示音，节奏感强，引起注意但不刺耳
 * 使用三角波（比方波柔和）+ 略高频率，重复三次形成"嘟嘟嘟"节奏
 */
export function playUrgentSound() {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  // 三次短促的警示音，间隔 180ms
  for (let i = 0; i < 3; i++) {
    const startTime = now + i * 0.18  // 每次间隔 180ms

    // 主音：三角波 A5 (880Hz)，比温和提示音更高频以示区别
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'           // 三角波：比方波柔和，比正弦波有力
    osc.frequency.value = 880       // A5 音高

    // 音量包络：快速起音 → 快速衰减，形成短促有力的"嘟"声
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02)    // 20ms 快速起音
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12) // 100ms 衰减
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + 0.15)

    // 叠加一个低八度的泛音（440Hz），增加厚度和紧迫感
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.value = 440     // A4，低一个八度
    gain2.gain.setValueAtTime(0, startTime)
    gain2.gain.linearRampToValueAtTime(0.15, startTime + 0.02)
    gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(startTime)
    osc2.stop(startTime + 0.12)
  }
}
