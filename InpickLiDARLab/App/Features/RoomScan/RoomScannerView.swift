import SwiftUI

struct RoomScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: RoomScanViewModel
    private let onContinueToDesign: (RoomScanRecord) -> Void

    init(
        store: LocalRoomScanStore,
        onContinueToDesign: @escaping (RoomScanRecord) -> Void = { _ in }
    ) {
        _viewModel = StateObject(wrappedValue: RoomScanViewModel(store: store))
        self.onContinueToDesign = onContinueToDesign
    }

    var body: some View {
        ZStack {
            RoomCaptureContainer(viewModel: viewModel)
                .ignoresSafeArea()

            LinearGradient(
                colors: [.black.opacity(0.58), .clear, .black.opacity(0.72)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 16) {
                scannerHeader
                Spacer()
                phasePanel
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .statusBarHidden()
        .onDisappear {
            viewModel.shutdown()
        }
    }

    private var scannerHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("INPICK")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .tracking(2)
                Text("공간 스캔")
                    .font(InpickTheme.titleFont(size: 22))
            }
            .foregroundStyle(.white)

            Spacer()

            Button {
                viewModel.cancelScan()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.headline)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .tint(.white)
            .accessibilityLabel("스캔 취소")
        }
    }

    @ViewBuilder
    private var phasePanel: some View {
        VStack(spacing: 14) {
            switch viewModel.phase {
            case .preparing:
                ProgressView()
                    .tint(.white)
                Text("LiDAR를 준비하고 있습니다")
                    .font(InpickTheme.titleFont(size: 17))

            case .scanning:
                Image(systemName: "viewfinder")
                    .font(.system(size: 30, weight: .semibold))
                Text("천천히 공간 전체를 비춰주세요")
                    .font(InpickTheme.titleFont(size: 18))
                Text("벽의 모서리와 가구의 각 면이 화면에 들어오도록 이동하면 결과가 좋아집니다.")
                    .font(InpickTheme.bodyFont(size: 14))
                    .foregroundStyle(.white.opacity(0.78))
                    .multilineTextAlignment(.center)
                Button("스캔 완료") {
                    viewModel.finishScan()
                }
                .buttonStyle(InpickPrimaryButtonStyle())

            case .processing:
                ProgressView()
                    .tint(.white)
                Text("공간 모델을 생성하고 있습니다")
                    .font(InpickTheme.titleFont(size: 17))

            case .saving:
                ProgressView()
                    .tint(.white)
                Text("JSON과 USDZ를 로컬에 저장하고 있습니다")
                    .font(InpickTheme.titleFont(size: 17))

            case .saved(let record):
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(.green)
                Text("로컬 저장 완료")
                    .font(InpickTheme.titleFont(size: 18))
                Text("벽 \(record.wallCount) · 문 \(record.doorCount) · 창문 \(record.windowCount) · 객체 \(record.objectCount)")
                    .font(InpickTheme.bodyFont(size: 14))
                    .foregroundStyle(.white.opacity(0.78))

                HStack {
                    ShareLink(item: viewModel.modelURL(for: record)) {
                        Label("USDZ 공유", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(InpickSecondaryButtonStyle())

                    Button("디자인·견적") {
                        onContinueToDesign(record)
                        dismiss()
                    }
                    .buttonStyle(InpickPrimaryButtonStyle())
                }

            case .failed(let message):
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(.yellow)
                Text("스캔을 완료하지 못했습니다")
                    .font(InpickTheme.titleFont(size: 18))
                Text(message)
                    .font(InpickTheme.bodyFont(size: 14))
                    .foregroundStyle(.white.opacity(0.78))
                    .multilineTextAlignment(.center)
                Button("닫기") {
                    dismiss()
                }
                .buttonStyle(InpickPrimaryButtonStyle())
            }
        }
        .foregroundStyle(.white)
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(.black.opacity(0.52), in: RoundedRectangle(cornerRadius: InpickTheme.cornerRadius))
        .overlay {
            RoundedRectangle(cornerRadius: InpickTheme.cornerRadius)
                .stroke(.white.opacity(0.16), lineWidth: 1)
        }
    }
}
