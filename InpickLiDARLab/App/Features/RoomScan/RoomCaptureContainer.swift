import RoomPlan
import SwiftUI

struct RoomCaptureContainer: UIViewRepresentable {
    @ObservedObject var viewModel: RoomScanViewModel

    func makeCoordinator() -> InpickRoomCaptureCoordinator {
        InpickRoomCaptureCoordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> RoomCaptureView {
        let captureView = RoomCaptureView(frame: .zero)
        captureView.delegate = context.coordinator
        captureView.isModelEnabled = true
        viewModel.attach(captureView)
        return captureView
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}

    static func dismantleUIView(
        _ uiView: RoomCaptureView,
        coordinator: InpickRoomCaptureCoordinator
    ) {
        coordinator.viewModel.detach(uiView)
    }
}

@objc(InpickRoomCaptureCoordinator)
@MainActor
final class InpickRoomCaptureCoordinator: NSObject, @preconcurrency RoomCaptureViewDelegate {
    let viewModel: RoomScanViewModel

    init(viewModel: RoomScanViewModel) {
        self.viewModel = viewModel
        super.init()
    }

    required init?(coder: NSCoder) {
        return nil
    }

    func encode(with coder: NSCoder) {}

    func captureView(
        shouldPresent roomDataForProcessing: CapturedRoomData,
        error: Error?
    ) -> Bool {
        viewModel.shouldPresentResult(error: error)
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        viewModel.didProduceResult(processedResult, error: error)
    }
}
