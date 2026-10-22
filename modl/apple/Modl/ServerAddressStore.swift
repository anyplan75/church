import Foundation

/// 서버 주소는 앱 설정에만 저장합니다. 빌드 파일에 주소를 적지 않습니다.
enum ServerAddressStore {
    static let key = "modl.serverAddress"

    static func saved() -> String {
        let raw = UserDefaults.standard.string(forKey: key) ?? ""
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
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
