import Foundation

/// 처음 여는 주소는 제주 모들 웹입니다.
/// 사용자가 바꾼 주소는 앱 설정에만 저장하고, 그 주소가 있으면 처음 주소 대신 엽니다.
enum ServerAddressStore {
    static let key = "modl.serverAddress"
    static let defaultAddress = "https://modl-jeju.vercel.app"

    static func saved() -> String {
        let raw = UserDefaults.standard.string(forKey: key) ?? ""
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return defaultAddress
        }
        return trimmed
    }

    static func save(_ raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        UserDefaults.standard.set(trimmed, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }

    /// http 또는 https 이고 호스트가 있을 때만 주소로 받습니다.
    static func url(from raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              let host = url.host,
              host.isEmpty == false
        else {
            return nil
        }
        return url
    }
}
