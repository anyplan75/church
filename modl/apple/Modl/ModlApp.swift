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
            // 맥의 설정 메뉴가 이미 command+쉼표를 씁니다.
            // 같은 단축키를 하나 더 넣으면 켜자마자 예외가 납니다.
            // 그래서 설정 자리를 서버 주소로 바꿉니다.
            CommandGroup(replacing: .appSettings) {
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
