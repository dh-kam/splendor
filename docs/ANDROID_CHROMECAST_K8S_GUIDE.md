# Splendor Android WebView + Chromecast + Kubernetes HTTPS 연동 가이드

이 저장소는 **단일 모노레포(프론트엔드 + `/server/` 백엔드)** 구조로 구성되어 있으며,
하나의 Docker 이미지로 **웹 클라이언트(모바일 컨트롤러 + Chromecast TV Receiver)**와 **Socket.IO HTTPS/WSS 서버**를 함께 서빙합니다.

---

## 1. 파티 게임 구조 (최대 4인 = 방장 본인 + QR 초대 최대 3명)

- **호스트(방장, Android 앱)**
  1. 앱에서 `TV · 모바일 로컬` → `파티 방 만들기 (QR 초대)` 선택
  2. 서버가 6자리 방 코드(`party:<CODE>`)를 발급하고 방장을 1번 좌석에 자동 배정
  3. 휴대폰 화면 상단의 **`QR 초대`** 버튼을 눌러 QR 모달 표시 (`본인 포함 최대 4명 · 친구 최대 3명 초대`)
- **친구(최대 3명)**
  - 별도 앱 설치 없이 카메라로 QR 스캔 → `https://<도메인>/?view=player&room=<CODE>`로 즉시 참가
  - 5번째 참가 시도 및 게임 시작 후 늦은 참가는 서버에서 차단
- **Chromecast TV 보드**
  - TV 화면 URL: `https://<도메인>/?view=tv&room=<CODE>&cast=1`
  - 대기 중에는 TV 로비(참가 현황 + QR)가 표시되고, 방장이 `게임 시작`을 누르면 현재 플레이 화면 그대로 풀스크린 보드 + 승점/승리 연출이 실시간 동기화됩니다.
  - 타 플레이어의 비공개 킵 카드는 TV 보드에서 자동 마스킹(`secret`)됩니다.

---

## 2. Kubernetes 배포 & HTTPS/WebSocket 설정

### 컨테이너 빌드
```bash
docker build -t splendor-guild:latest .
```

### 필수 환경 변수
- `NODE_ENV=production`
- `PORT=3000`
- `PUBLIC_BASE_URL=https://splendor.yourdomain.com` (QR 초대 링크에 사용될 공인 HTTPS 도메인)
- `CORS_ORIGIN=https://splendor.yourdomain.com` (Android 로컬 WebView 자산 사용 시 `,https://appassets.androidplatform.net` 추가)

### Kubernetes Probe & Ingress 권장 설정
- **Liveness Probe**: `GET /healthz` (HTTP 200)
- **Readiness Probe**: `GET /readyz` (HTTP 200)
- **Replica 주의**: 현재 방 상태는 프로세스 메모리(`server/roomManager.js`)에 저장되므로 기본 **`replicas: 1`** 권장 (다중 Pod 확장 시 Redis Adapter + Ingress Sticky Session 필요).
- **NGINX Ingress 예시 주석** (WebSocket 유지):
  ```yaml
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/websocket-services: "splendor-service"
  ```

---

## 3. Android WebView ↔ Web JS Bridge (`window.SplendorAndroid`)

Android 앱에서 WebView에 `https://splendor.yourdomain.com`을 로드하고, 아래 JavaScript 인터페이스를 `window.SplendorAndroid`로 주입하면 웹의 `QR 초대` 모달 및 상단 헤더에 Chromecast 연결 버튼이 자동 활성화됩니다.

```kotlin
class SplendorAndroidBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun getServerUrl(): String = "https://splendor.yourdomain.com"

    @JavascriptInterface
    fun isCastConnected(): Boolean = activity.isCastSessionConnected()

    @JavascriptInterface
    fun openCastPicker() {
        activity.runOnUiThread { activity.showCastDialog() }
    }

    @JavascriptInterface
    fun notifyRoomChanged(roomCode: String, tvUrl: String) {
        activity.onActiveRoomChanged(roomCode, tvUrl)
    }

    @JavascriptInterface
    fun castRoom(roomCode: String, tvUrl: String) {
        activity.sendCastAttachRoom(roomCode, tvUrl)
    }
}
```

### Native → Web Cast 연결 상태 알림
Chromecast 세션이 연결되거나 해제될 때 WebView에서 아래 JS를 호출하세요:
```kotlin
webView.evaluateJavascript("window.__SPLENDOR_ON_CAST_STATE__?.($isConnected);", null)
```

---

## 4. Google Cast Custom Receiver 연동 (CAF)

1. Google Cast Developer Console에서 **Custom Receiver**를 등록하고 Receiver URL을 아래로 설정:
   ```text
   https://splendor.yourdomain.com/?view=tv&cast=1
   ```
   (Google Cast CAF Receiver SDK 스크립트를 호스트 HTML에 포함하거나 Receiver 래퍼 페이지에서 로드)
2. Android Sender가 Cast 세션 연결 시 커스텀 네임스페이스로 방 코드를 전송합니다:
   - **Namespace**: `urn:x-cast:com.splendor.guild`
   - **Payload (JSON)**:
     ```json
     { "type": "ATTACH_ROOM", "roomCode": "K8M4QX" }
     ```
3. 웹의 `src/utils/castBridge.js`가 해당 메시지를 수신 즉시 `register-tv`로 해당 파티 방을 구독하고, 현재 보드 상태를 TV에 렌더링합니다.
