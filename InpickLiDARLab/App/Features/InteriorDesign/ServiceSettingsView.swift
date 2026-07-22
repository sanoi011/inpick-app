import SwiftUI

struct ServiceSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("designServiceURL") private var designServiceURL = "http://127.0.0.1:8787"

    @State private var connectionStatus: String?
    @State private var isChecking = false

    var body: some View {
        NavigationStack {
            Form {
                Section("GPT Image 2 중계 서버") {
                    TextField("http://127.0.0.1:8787", text: $designServiceURL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()

                    Button {
                        checkConnection()
                    } label: {
                        if isChecking {
                            ProgressView()
                        } else {
                            Text("연결 확인")
                        }
                    }
                    .disabled(isChecking)

                    if let connectionStatus {
                        Text(connectionStatus)
                            .font(InpickTheme.bodyFont(size: 13))
                    }
                }

                Section("실기기 연결") {
                    Text("시뮬레이터는 127.0.0.1을 사용합니다. iPhone 실기기에서는 Mac의 Bonjour 주소(예: http://내맥이름.local:8787)를 입력하고 같은 Wi-Fi에 연결하세요.")
                    Text("OpenAI API 키는 앱이 아닌 Server의 OPENAI_API_KEY 환경변수에만 저장합니다.")
                }
                .font(InpickTheme.bodyFont(size: 13))
                .foregroundStyle(InpickTheme.mutedInk)
            }
            .font(InpickTheme.bodyFont())
            .scrollContentBackground(.hidden)
            .background(InpickTheme.canvas)
            .navigationTitle("AI 연결 설정")
            .navigationBarTitleDisplayMode(.inline)
            .tint(InpickTheme.accent)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("완료") { dismiss() }
                }
            }
        }
    }

    private func checkConnection() {
        guard let url = URL(string: designServiceURL) else {
            connectionStatus = "서버 주소가 올바르지 않습니다."
            return
        }

        isChecking = true
        connectionStatus = nil
        Task {
            defer { isChecking = false }
            do {
                let model = try await InteriorDesignAPIClient().health(serviceURL: url)
                connectionStatus = "연결됨 · \(model)"
            } catch {
                connectionStatus = "연결 실패 · \(error.localizedDescription)"
            }
        }
    }
}
