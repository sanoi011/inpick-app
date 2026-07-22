import SwiftUI

@main
struct InpickLiDARLabApp: App {
    @StateObject private var scanStore = LocalRoomScanStore()
    @StateObject private var designStore = LocalInteriorDesignStore()

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(scanStore)
                .environmentObject(designStore)
        }
    }
}
