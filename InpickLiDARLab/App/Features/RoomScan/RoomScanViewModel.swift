import Foundation
import RoomPlan

enum RoomScanPhase {
    case preparing
    case scanning
    case processing
    case saving
    case saved(RoomScanRecord)
    case failed(String)
}

@MainActor
final class RoomScanViewModel: ObservableObject {
    @Published private(set) var phase: RoomScanPhase = .preparing

    private let store: LocalRoomScanStore
    private weak var captureView: RoomCaptureView?
    private var discardsResult = false

    init(store: LocalRoomScanStore) {
        self.store = store
    }

    func attach(_ view: RoomCaptureView) {
        guard captureView == nil else { return }
        captureView = view

        var configuration = RoomCaptureSession.Configuration()
        configuration.isCoachingEnabled = true
        view.captureSession.run(configuration: configuration)
        phase = .scanning
    }

    func finishScan() {
        guard case .scanning = phase else { return }
        phase = .processing
        captureView?.captureSession.stop()
    }

    func cancelScan() {
        discardsResult = true
        captureView?.captureSession.stop()
    }

    func shouldPresentResult(error: Error?) -> Bool {
        guard !discardsResult else { return false }
        if let error {
            phase = .failed(error.localizedDescription)
            return false
        }
        return true
    }

    func didProduceResult(_ room: CapturedRoom, error: Error?) {
        guard !discardsResult else { return }
        if let error {
            phase = .failed(error.localizedDescription)
            return
        }

        phase = .saving
        Task { [weak self] in
            guard let self else { return }
            do {
                let record = try await store.save(room)
                phase = .saved(record)
            } catch {
                phase = .failed("스캔 결과를 저장하지 못했습니다: \(error.localizedDescription)")
            }
        }
    }

    func modelURL(for record: RoomScanRecord) -> URL {
        store.modelURL(for: record)
    }

    func detach(_ view: RoomCaptureView) {
        guard captureView === view else { return }
        captureView = nil
    }

    func shutdown() {
        guard case .scanning = phase else { return }
        discardsResult = true
        captureView?.captureSession.stop()
    }
}
