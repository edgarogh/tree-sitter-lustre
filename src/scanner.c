#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"

enum TokenType {
  // Matches the `package` part of a `package::member` Lv6IdRef, BUT also looks ahead to ensure that there is no
  // whitespace between `package`, `::` and `members`
  IDENTIFIER_REF_PACKAGE,

  // Matches a real literal that looks exactly like `12.` (/\d+\./), BUT that is NOT followed by a second dot.
  SINGLE_DOT_REAL_LITERAL
};

// The scanner is context-free ;-)
void * tree_sitter_lustre_external_scanner_create() { return NULL; }
void tree_sitter_lustre_external_scanner_destroy(void *payload) { }
unsigned tree_sitter_lustre_external_scanner_serialize(void *payload, char *buffer) { return 0; }
void tree_sitter_lustre_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) { }

// Actual lexing code

static bool is_digit(int c) {
  return c >= '0' && c <= '9';
}

static bool is_identifier_start_char(int c) {
  return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

static bool is_identifier_continue_char(int c) {
  return c == '_' || c == '\'' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || is_digit(c);
}

bool tree_sitter_lustre_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  // Reminder: an identifier respects /[_a-zA-Z][_'a-zA-Z0-9]*/
  if (valid_symbols[IDENTIFIER_REF_PACKAGE] && is_identifier_start_char(lexer->lookahead)) {
    do { lexer->advance(lexer, false); } while (is_identifier_continue_char(lexer->lookahead));
    lexer->mark_end(lexer);

    if (lexer->lookahead != ':') return false;
    lexer->advance(lexer, false);
    if (lexer->lookahead != ':') return false;
    lexer->advance(lexer, false);
    if (!is_identifier_start_char(lexer->lookahead)) return false;

    lexer->result_symbol = IDENTIFIER_REF_PACKAGE;
    return true;
  }

  if (valid_symbols[SINGLE_DOT_REAL_LITERAL] && is_digit(lexer->lookahead)) {
    do { lexer->advance(lexer, false); } while (is_digit(lexer->lookahead));
    if (lexer->lookahead != '.') return false;
    lexer->advance(lexer, false);
    lexer->result_symbol = SINGLE_DOT_REAL_LITERAL;
    return lexer->lookahead != '.' && lexer->lookahead != 'e' && lexer->lookahead != 'E' && !is_digit(lexer->lookahead);
  }

  return false;
}
