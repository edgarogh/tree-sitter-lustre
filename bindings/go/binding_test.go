package tree_sitter_lustre_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_lustre "https://github.com/edgarogh/tree-sitter-lustre/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_lustre.Language())
	if language == nil {
		t.Errorf("Error loading Lustre grammar")
	}
}
