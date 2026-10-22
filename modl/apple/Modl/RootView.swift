import SwiftUI

/// 주소가 없으면 안내를 보여 주고, 주소가 있으면 웹 화면을 엽니다.
struct RootView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var draft = ServerAddressStore.saved()
    @State private var saved = ServerAddressStore.saved()
    @State private var editing = false
    @State private var loadFailed = false
    @State private var notice = ""

    var body: some View {
        NavigationStack {
            Group {
                if let url = activeURL, editing == false {
                    WebShellView(url: url, failed: $loadFailed)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    AddressPrompt(
                        wide: sizeClass == .regular,
                        draft: $draft,
                        notice: notice,
                        onOpen: openAddress
                    )
                }
            }
            .navigationTitle("모들")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if activeURL != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("서버 주소") {
                            editing = true
                            notice = AddressCopy.editing
                        }
                    }
                }
            }
        }
        .onAppear {
            saved = ServerAddressStore.saved()
            draft = saved
            if saved.isEmpty {
                notice = AddressCopy.waiting
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .modlEditServerAddress)) { _ in
            editing = true
            notice = AddressCopy.editing
        }
        .onChange(of: loadFailed) { _, failed in
            if failed {
                editing = true
                notice = AddressCopy.unreachable
            }
        }
    }

    private var activeURL: URL? {
        ServerAddressStore.url(from: saved)
    }

    private func openAddress() {
        guard let url = ServerAddressStore.url(from: draft) else {
            notice = AddressCopy.invalid
            return
        }
        ServerAddressStore.save(url.absoluteString)
        saved = url.absoluteString
        draft = url.absoluteString
        loadFailed = false
        notice = ""
        editing = false
    }
}

private enum AddressCopy {
    static let waiting = "서버 주소는 나중에 연결됩니다. 지금 이 앱에는 켜 둔 서버가 없습니다. 주소를 적으면 그 주소의 모들 화면이 이 창 안에 열립니다."
    static let editing = "주소를 바꾸면 그 주소의 모들 화면이 이 창 안에 열립니다."
    static let invalid = "http 또는 https 로 시작하는 주소를 적어 주세요."
    static let unreachable = "이 주소에 연결하지 못했습니다. 서버가 켜지면 다시 시도해 주세요."
}

/// 폰은 글을 아래로 쌓고, 패드와 맥의 넓은 화면은 안내와 입력 칸을 나란히 둡니다.
private struct AddressPrompt: View {
    let wide: Bool
    @Binding var draft: String
    let notice: String
    let onOpen: () -> Void
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            content
                .padding(24)
                .frame(maxWidth: 880, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(red: 0.957, green: 0.937, blue: 0.894))
        .onAppear { focused = true }
    }

    @ViewBuilder
    private var content: some View {
        if wide {
            HStack(alignment: .top, spacing: 28) {
                guidance
                form
            }
        } else {
            VStack(alignment: .leading, spacing: 20) {
                guidance
                form
            }
        }
    }

    private var guidance: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("모들")
                .font(.largeTitle)
                .fixedSize(horizontal: false, vertical: true)
            Text(notice.isEmpty ? AddressCopy.waiting : notice)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
            Text("폰에서는 아래 탭, 넓은 화면에서는 옆 메뉴가 웹 화면 그대로 열립니다. 맥에서는 창과 키보드를 씁니다.")
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("서버 주소")
                .font(.headline)
                .fixedSize(horizontal: false, vertical: true)
            TextField("https:// 로 시작하는 주소", text: $draft, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .focused($focused)
                .submitLabel(.go)
                .onSubmit(onOpen)
            Button("이 주소로 열기", action: onOpen)
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
