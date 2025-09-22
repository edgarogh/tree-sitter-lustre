#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"

enum TokenType {
  // Matches the `package` part of a `package::member` Lv6IdRef, BUT also looks ahead to ensure that there is no
  // whitespace between `package`, `::` and `members`
  IDENTIFIER_REF_PACKAGE,

  // Matches a real literal that looks exactly like `12.` (/\d+\./), BUT that is NOT followed by a second dot.
  SINGLE_DOT_REAL_LITERAL,

  // Matches a block comment (Pascal-style and C-style), but not a multiline pragma
  BLOCK_COMMENT,

  ML_PRAGMA_START_WHITESPACE,
  ML_PRAGMA_VALUE,
};

typedef struct {
  bool is_in_ml_pragma;
} state;

void * tree_sitter_lustre_external_scanner_create() {
    state* payload = ts_malloc(sizeof(state));
    payload->is_in_ml_pragma = false;
    return payload;
}
void tree_sitter_lustre_external_scanner_destroy(void *payload) { free(payload); }
unsigned tree_sitter_lustre_external_scanner_serialize(void *payload, char *buffer) {
  memcpy(buffer, payload, sizeof(state));
  return sizeof(state);
}
void tree_sitter_lustre_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  memcpy(payload, buffer, length);
}

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
  void *restrict _payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  state* payload = (state*) _payload;

    if (valid_symbols[ML_PRAGMA_START_WHITESPACE]) {
      payload->is_in_ml_pragma = true;
      while (!is_identifier_start_char(lexer->lookahead)) {
        lexer->advance(lexer, true);
        if (lexer->eof(lexer)) {
          break;
        }
      }
      lexer->result_symbol = ML_PRAGMA_START_WHITESPACE;
      return true;
    }

    if (payload->is_in_ml_pragma && valid_symbols[ML_PRAGMA_VALUE]) {
      payload->is_in_ml_pragma = false;
      lexer->result_symbol = ML_PRAGMA_VALUE;
      // Eat everything until `*)` (excluded)
      while (true) {
        while (lexer->lookahead != '*') {
          lexer->advance(lexer, false);
          if (lexer->eof(lexer)) return true;
        }
        lexer->mark_end(lexer);
        lexer->advance(lexer, false);
        if (lexer->lookahead == ')') break;
      }
      return true;
    }

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

  int first_char = lexer->lookahead;
  if (valid_symbols[BLOCK_COMMENT] && (first_char == '(' || first_char == '/')) {
    lexer->advance(lexer, false);
    if (lexer->lookahead != '*') return false;
    lexer->advance(lexer, false);
    if (lexer->lookahead == '@' && first_char == '(') return false;
    lexer->result_symbol = BLOCK_COMMENT;

    int expected_end = first_char == '(' ? ')' : '/';
    while (true) {
      while (lexer->lookahead != '*') {
        lexer->advance(lexer, false);
        if (lexer->eof(lexer)) return false;
      }
      lexer->advance(lexer, false);
      if (lexer->lookahead == expected_end) break;
    }

    lexer->advance(lexer, false);

    return true;
  }

  return false;
}
