import SwiftUI

struct HanasandLogo: View {
    var body: some View {
        Image("hanasand-logo", bundle: .module)
            .resizable()
            .scaledToFit()
            .accessibilityLabel("Hanasand logo")
    }
}
