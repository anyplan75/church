import UIKit
import WebKit
import Capacitor

/// Next 정적보내기(trailingSlash)용 라우터.
/// Capacitor 기본값은 확장자 없는 경로를 항상 /index.html(루트)로만 보낸다.
/// /login/ → /login/index.html 처럼 하위 HTML을 열어야 로그인 UI가 보인다.
struct NextExportRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        let pathUrl = URL(fileURLWithPath: path)
        let ext = pathUrl.pathExtension.lowercased()

        if ext.isEmpty {
            var dir = path
            while dir.count > 1, dir.hasSuffix("/") {
                dir = String(dir.dropLast())
            }
            if dir.isEmpty || dir == "/" {
                return basePath + "/index.html"
            }
            if !dir.hasPrefix("/") {
                dir = "/" + dir
            }
            return basePath + dir + "/index.html"
        }

        return basePath + path
    }
}

/// RSC 실패 시 Next가 /…/index.txt 로 전체 이동하면 시뮬에 flight 원문이 보인다.
/// 메인 프레임의 .txt 문서 로드만 막고 같은 경로의 .html 로 바꾼다. fetch(RSC)는 그대로 둔다.
@objc(RscHtmlGuardPlugin)
public class RscHtmlGuardPlugin: CAPInstancePlugin, CAPBridgedPlugin {
    public let identifier = "RscHtmlGuardPlugin"
    public let jsName = "RscHtmlGuard"
    public let pluginMethods: [CAPPluginMethod] = []

    public override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url else { return nil }
        let isMain = navigationAction.targetFrame == nil || navigationAction.targetFrame?.isMainFrame == true
        guard isMain else { return nil }
        guard url.pathExtension.lowercased() == "txt" else { return nil }

        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return true
        }
        let path = components.path
        if path.hasSuffix(".txt") {
            components.path = String(path.dropLast(4)) + ".html"
        }
        guard let htmlURL = components.url else { return true }

        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.load(URLRequest(url: htmlURL))
        }
        return true
    }
}

class AppBridgeViewController: CAPBridgeViewController {
    override open func router() -> Router {
        return NextExportRouter()
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(RscHtmlGuardPlugin())
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AppBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
