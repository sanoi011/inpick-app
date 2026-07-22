import AVFoundation
import RoomPlan

enum RoomScanAvailability {
    static var isLiDARSupported: Bool {
        RoomCaptureSession.isSupported
    }

    static var cameraAuthorizationStatus: AVAuthorizationStatus {
        AVCaptureDevice.authorizationStatus(for: .video)
    }

    static func requestCameraAccess() async -> Bool {
        switch cameraAuthorizationStatus {
        case .authorized:
            return true
        case .notDetermined:
            return await withCheckedContinuation { continuation in
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    continuation.resume(returning: granted)
                }
            }
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }
}
