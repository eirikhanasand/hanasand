import SwiftUI

struct HanasandLogo: View {
    private var resourceBundle: Bundle {
        Bundle.main.url(forResource: "Hanasand_Hanasand", withExtension: "bundle")
            .flatMap(Bundle.init(url:)) ?? .module
    }

    var body: some View {
        Image("hanasand-logo", bundle: resourceBundle)
            .resizable()
            .scaledToFit()
            .accessibilityLabel("Hanasand logo")
    }
}
