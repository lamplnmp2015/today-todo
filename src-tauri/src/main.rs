// Windows 下打包后不要弹黑色控制台
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

/// 切换主窗口显示/隐藏：
/// - 可见 → hide()（注意：不是 destroy()，符合需求）
/// - 不可见 → show() + set_focus()
fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        match win.is_visible() {
            Ok(true) => {
                let _ = win.hide();
            }
            _ => {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    }
}

/// 前端 invoke('flash_window') 调用：
/// 把窗口显示出来、聚焦、并短暂置顶 3 秒以引起用户注意（超时提醒用）
#[tauri::command]
fn flash_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.set_always_on_top(true);

        // 3 秒后取消置顶
        let w = win.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(3));
            let _ = w.set_always_on_top(false);
        });
    }
}

fn main() {
    tauri::Builder::default()
        // ---------- 插件 ----------
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // 按下时（不是释放）切换窗口
                    if event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        // ---------- 暴露给前端的命令 ----------
        .invoke_handler(tauri::generate_handler![flash_window])
        // ---------- 启动设置：注册托盘和快捷键 ----------
        .setup(|app| {
            // ======== 全局快捷键 ========
            // macOS 用 Cmd+Shift+T；其他平台 Ctrl+Shift+T
            #[cfg(target_os = "macos")]
            let modifiers = Modifiers::SUPER | Modifiers::SHIFT;
            #[cfg(not(target_os = "macos"))]
            let modifiers = Modifiers::CONTROL | Modifiers::SHIFT;

            let shortcut = Shortcut::new(Some(modifiers), Code::KeyT);
            app.global_shortcut().register(shortcut)?;

            // ======== 托盘 ========
            // 右键菜单项
            let show_item = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::with_id("main-tray")
                // 复用应用图标作为托盘图标（即"使用系统默认图标"）
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("今日待办")
                .menu(&menu)
                // 左键不弹菜单（我们自己处理）
                .show_menu_on_left_click(false)
                // 右键菜单事件
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_main_window(app),
                    "quit" => {
                        // 退出前显式清理：注销所有全局快捷键
                        let _ = app.global_shortcut().unregister_all();
                        app.exit(0);
                    }
                    _ => {}
                })
                // 左键单击：切换窗口
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        // ---------- 窗口关闭事件 ----------
        // 拦截关闭：隐藏而不是销毁，避免数据/状态丢失
        .on_window_event(|win, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = win.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("应用启动失败");
}
