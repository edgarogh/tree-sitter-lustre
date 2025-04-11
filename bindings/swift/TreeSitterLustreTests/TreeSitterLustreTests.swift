import XCTest
import SwiftTreeSitter
import TreeSitterLustre

final class TreeSitterLustreTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_lustre())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Lustre grammar")
    }
}
