import SwiftUI

/// 모들 웹을 아이폰, 아이패드, 맥 창 안에 띄우는 시작점입니다.
/// 화면, 권한, 말투 사전은 웹에 그대로 두고 여기서 다시 만들지 않습니다.
@main
struct ModlApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .commands {
            CommandGroup(after: .appSettings) {
                Button("서버 주소") {
                    NotificationCenter.default.post(name: .modlEditServerAddress, object: nil)
                }
                .keyboardShortcut(",", modifiers: .command)
            }
        }
    }
}

extension Notification.Name {
    static let modlEditServerAddress = Notification.Name("modl.editServerAddress")
}
