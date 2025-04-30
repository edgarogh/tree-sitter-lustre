// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "TreeSitterLustre",
    products: [
        .library(name: "TreeSitterLustre", targets: ["TreeSitterLustre"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ChimeHQ/SwiftTreeSitter", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterLustre",
            dependencies: [],
            path: ".",
            sources: [
                "src/parser.c",
                "src/scanner.c",
            ],
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterLustreTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterLustre",
            ],
            path: "bindings/swift/TreeSitterLustreTests"
        )
    ],
    cLanguageStandard: .c11
)
