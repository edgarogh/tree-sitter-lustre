/**
 * @file Lustre (LV6) grammar for tree-sitter
 * @author Edgar Onghena <dev@edgar.bzh>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// https://gricad-gitlab.univ-grenoble-alpes.fr/verimag/synchrone/lustre-v6/-/blob/d000fdd87d959a4463c8cdc0c600ba6242125c99/lib/lv6parser.mly#L109-L128
const PREC = {
  'fby': 19,
  'comma': 18,
  'bracket': 17,
  'hat': 16,
  'uminus': 15,
  'cast': 14,
  'when': 13,
  'power': 12,
  'multiplicative': 11,
  'additive': 10,
  'not': 9,
  'eq': 8,
  'and': 7,
  'or': 6,
  'impl': 5,
  'cdots': 4,
  'step': 3,
  'arrow': 2,
  'bar': 1,
  'else': 0,
};

const IDENTIFIER_REGEX = /[_a-zA-Z][_'a-zA-Z0-9]*/;

/**
 * @param item {RuleOrLiteral}
 * @param separator {RuleOrLiteral}
 * @returns RuleOrLiteral
 */
function separated1(item, separator) {
  return seq(item, repeat(seq(separator, item)));
}

/**
 * @param item {RuleOrLiteral}
 * @param separator {RuleOrLiteral}
 * @returns RuleOrLiteral
 */
function separated(item, separator) {
  return optional(separated1(item, separator));
}

function binaryExpr($expression, ...operators) {
  return seq(
    field('left', $expression),
    operators.length === 1 ? operators[0] : choice(...operators),
    field('right', $expression),
  )
}

module.exports = grammar({
  name: "lustre",

  extras: $ => [$._whitespace, $.line_comment, $.block_comment],

  // word: $ => $.id,

  conflicts: $ => [
    [$.id_ref_type, $._expression1],
  ],

  rules: {
    source_file: $ => seq(repeat($.include), repeat($._one_decl)),

    _whitespace: _ => /[\t\n\v ]/, // TODO(laxity): allow more characters but treat them as errors?
    line_comment: _ => /--.*/,
    // Note: block comments cannot be nested as per the spec, no need for a non-context-free scanner
    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    block_comment: _ => token(choice(
      // Pascal/SML-style block comments
      seq(
        '(*',
        /[^*]*\*+([^)*][^*]*\*+)*/,
        ')',
      ),
      // C-style block comments
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),
    string: _ => /"[^"]*"/,

    include: $ => seq('include', field('source', $.string)),
    _one_decl: $ => choice($.node_decl, $.type_decl, $.const_decl, $.ext_node_decl),

    // Package rules

    // Model rules

    // Ident 6 rules

    id_ref: _ => token(prec(-2, /[_a-zA-Z][_'a-zA-Z0-9]*(::[_a-zA-Z][_'a-zA-Z0-9]*)?/)),

    // Ident rules

    id: _ => token(prec(-1, IDENTIFIER_REGEX)), // TODO pragma
    _pragma: $ => repeat1($.one_pragma),
    _id_no_pragma: _ => IDENTIFIER_REGEX,
    one_pragma: $ => seq(
      '%',
      field('key', alias($._id_no_pragma, $.id)),
      ':',
      field('value', alias($._id_no_pragma, $.id)),
      '%',
    ),

    // Node rules

    typed_ids: $ => seq(
      separated1(field('name', $.id), ','),
      ':',
      field('type', $._type),
    ),
    _typed_valued_ids_list: $ => separated1($.typed_valued_ids, ';'),
    typed_valued_ids: $ => choice(
      seq(separated1(field('name', $.id), ','), ':', field('type', $._type)),
      seq(field('name', $.id), ':', field('type', $._type), '=', field('value', $._expression)),
    ),

    node_decl: $ => seq(
      optional('unsafe'),
      choice('node', 'function'),
      field('name', $.id),
      optional($.static_params),
      choice($._node_definition, $._node_alias),
    ),
    _node_definition: $ => seq(
      $._node_profile,
      optional(';'),
      repeat($.one_local_decl),
      $.node_body,
      optional(choice('.', ';')),
    ),
    _node_alias: $ => seq(
      optional($._node_profile),
      '=',
      field('alias', $.effective_node),
      optional(';'),
    ),

    _node_profile: $ => seq(
      field('input', $.params),
      'returns',
      field('output', $.params),
    ),

    params: $ => seq('(', separated($.var_decl, ';'), ')'),
    one_local_decl: $ => choice(
      seq('var', repeat1(seq($.var_decl, ';'))),
      seq('const', repeat1(seq($.one_const_decl, ';'))),
    ),
    var_decl: $ => choice(
      $.typed_ids,
      seq($.typed_ids, 'when', $.clock_expression),
      seq('(', repeat($.typed_ids), ')', 'when', $.clock_expression),
    ),

    // Constant decl rules

    const_decl: $ => seq('const', repeat1(seq($.one_const_decl, ';'))),
    one_const_decl: $ => choice(
      seq(separated1($.id, ','), ':', field('type', $._type)),
      seq($.id, ':', field('type', $._type), '=', field('value', $._expression)),
      seq($.id, '=', field('value', $._expression)),
    ),

    // Type decl rules

    type_decl: $ => seq('type', repeat1(seq($.one_type_decl, ';'))),
    one_type_decl: $ => seq(
      field('name', $.id),
      optional(seq('=', field('type', $._one_type_decl_value))),
    ),
    _one_type_decl_value: $ => choice(
      $._type,
      $.enum_type_value,
      $.struct_type_value,
    ),
    enum_type_value: $ => seq('enum', '{', separated1($.id, ','), '}'),
    struct_type_value: $ => seq(optional('struct'), '{', $._typed_valued_ids_list, '}'),

    // Simple type rules

    _type: $ => choice(
      $.id_ref_type,
      $.primitive_type,
      $.table_type,
    ),
    id_ref_type: $ => $.id_ref,
    primitive_type: _ => choice('bool', 'int', 'real'),
    table_type: $ => prec.left(PREC.hat, seq(field('element', $._type), '^', field('length', $._expression))),

    // Ext nodes rules

    ext_node_decl: $ => seq(
      optional('unsafe'),
      'extern',
      choice('function', 'node'),
      $.id,
      $._node_profile,
      optional(';'),
    ),

    // Static rules

    static_params: $ => seq('<<', separated($._static_param, ';'), '>>'),
    _static_param: $ => choice($.type_static_param, $.const_static_param, $.node_static_param),
    type_static_param: $ => seq('type', $.id),
    const_static_param: $ => seq('const', $.id, ':', $._type),
    node_static_param: $ => seq(
      optional('unsafe'),
      choice('node', 'function'),
      $.id,
      $._node_profile,
    ),

    effective_node: $ => seq($.id_ref, optional($.static_args)),

    static_args: $ => seq('<<', separated($._static_arg, choice(',', ';')), '>>'),
    _static_arg: $ => choice($.id_static_arg, $.type_static_arg, $.const_static_arg, $.node_static_arg, $.op_static_arg),
    id_static_arg: $ => prec(999, $.id_ref), // conflicts with _surely_expression (_expression1 to be precise)
    type_static_arg: $ => choice(seq('type', $._type), $._surely_type),
    const_static_arg: $ => choice(seq('const', $._expression), $._surely_expression),
    node_static_arg: $ => choice(seq(choice('node', 'function'), $.effective_node), alias($.surely_node, $.effective_node)),
    op_static_arg: $ => $._predef_op,

    surely_node: $ => seq($.id_ref, $.static_args),
    _surely_type: $ => choice(
      $.primitive_type,
      alias($.surely_table_type, $.table_type),
    ),
    surely_table_type: $ => prec.left(PREC.hat, seq(field('element', $._type), '^', field('length', $._expression))),
    _surely_expression: $ => prec(0, $._expression), // conflicts with id_static_arg

    // Body rules

    node_body: $ => seq(
      'let',
      repeat($._equation),
      'tel',
    ),

    _equation: $ => choice($.assert_equation, $.eq_equation),
    assert_equation: $ => seq('assert', $._expression, ';'),
    eq_equation: $ => seq(
      field('left', $.left_expression_list),
      '=',
      field('right', $._expression),
      ';',
    ),

    // Left rules

    left_expression_list: $ => choice(
      separated1($._left_expression, ','),
      seq('(', separated($._left_expression, ','), ')'),
    ),
    _left_expression: $ => choice(
      $.id_left_expression,
      $.field_left_expression,
      $.index_left_expression,
    ),
    id_left_expression: $ => $.id_ref,
    field_left_expression: $ => prec.left(PREC.hat, seq(
      field('value', $._left_expression),
      '.',
      field('field', $.id),
    )),
    index_left_expression: $ => prec.left(PREC.bracket, seq(
      field('value', $._left_expression),
      '[',
      field('index', choice($._expression, $.select)),
      ']',
    )),
    select: $ => seq(
      field('from', $._expression),
      token(prec(999, '..')),
      field('to', $._expression),
      optional(seq('step', field('step', $._expression))),
    ),

    // Expression rules

    /*
    Because comparison operators are non-associative (yacc's %noassoc), we have to split expressions in two groups to
    manually implement precedences. `$._expression` is the top-level expression that should be used everywhere, and
    `$._expression1` is used for expressions with a higher precedence than Lustre's comparison operators.
    */

    _expression: $ => choice(
      $._expression1,
      alias($.comparison_expression, $.binary_expression),
      alias($.binary_expression0, $.binary_expression),
    ),

    binary_expression0: $ => choice(
      prec.left(PREC.bar, binaryExpr($._expression, '|')),
      prec.left(PREC.arrow, binaryExpr($._expression, '->')),
      prec.right(PREC.impl, binaryExpr($._expression, '=>')),
      prec.left(PREC.or, binaryExpr($._expression, 'or', 'xor')),
      prec.left(PREC.and, binaryExpr($._expression, 'and')),
    ),

    comparison_expression: $ => prec.left(PREC.eq, seq(
      field('left', $._expression1),
      choice('<', '<=', '=', '>=', '>', '<>'),
      field('right', $._expression1),
    )),

    _expression1: $ => choice(
      $._constant,
      $.id_ref,
      $.tuple_expression,
      $.table_expression,
      $.field_expression,
      $.index_expression,
      $.call_expression,
      $.if_expression,
      $.merge_expression,
      $.when_expression,
      $.unary_expression,
      $.binary_expression,
      $.nary_expression,
    ),

    tuple_expression: $ => seq('(', repeat($._expression), ')'),
    table_expression: $ => seq('[', repeat($._expression), ']'),
    // Struct expression is defined in its own eBNF group below

    field_expression: $ => prec.left(PREC.hat, seq(
      field('value', $._expression1),
      '.',
      field('field', $.id),
    )),

    index_expression: $ => prec.right(PREC.bracket, seq(
      field('value', $._expression),
      '[',
      field('index', choice($._expression, $.select)),
      ']',
    )),

    call_expression: $ => prec.right(PREC.bracket, seq(
      field('node', $.id_ref),
      '(',
      separated($._expression, ','),
      ')',
    )),

    if_expression: $ => seq(
      choice('if', 'when'),
      field('condition', $._expression),
      'then',
      field('consequence', $._expression),
      'else',
      field('alternative', $._expression),
    ),

    merge_expression: $ => prec.left(PREC.bracket, seq(
      'merge',
      field('value', $.id),
      repeat($.merge_arm),
    )),

    when_expression: $ => prec.left(PREC.when, seq(
      field('left', $._expression1),
      'when',
      field('right', $.clock_expression),
    )),

    unary_expression: $ => choice(
      prec.right(PREC.not, seq('not', $._expression1)),
      prec.right(PREC.cast, seq(choice('int', 'real'), $._expression1)),
      prec.right(PREC.uminus, seq(choice('-', 'pre', 'current'), $._expression1)),
    ),

    binary_expression: $ => choice(
      prec.left(PREC.additive, binaryExpr($._expression1, '+', '-')),
      prec.left(PREC.multiplicative, binaryExpr($._expression1, '*', '/', '%', 'mod', 'div')),
      prec.left(PREC.power, binaryExpr($._expression1, '**')),
      prec.left(PREC.hat, binaryExpr($._expression1, '^')),
      prec.right(PREC.fby, binaryExpr($._expression1, 'fby')),
    ),

    nary_expression: $ => seq(
      choice('#', 'nor'),
      '(',
      separated($._expression, ','),
      ')',
    ),

    clock_expression: $ => choice(
      seq($.id_ref, '(', $.id, ')'),
      $.id,
      seq('not', $.id),
      seq('not', '(', $.id, ')')
    ),

    // Merge rules

    merge_arm: $ => seq(
      '(',
      field('pattern', choice($.id_ref, $.boolean_literal)),
      '->',
      field('value', $._expression),
      ')',
    ),

    // Predef rules

    _predef_op: _ => choice('not', 'fby', 'pre', 'current', '->', 'and', 'or', 'xor', '=>', '=', '<>', '<', '<=', '>', '>=', 'div', 'mod', '-', '+', '/', '*', 'if'),

    // Expression by names rules (a.k.a. struct expressions)

    struct_expression: $ => seq(
      field('name', $.id_ref),
      '{',
      optional(seq(
        optional(seq($.id_ref, 'with')),
        separated1($.field_initializer, choice(',', ';')),
        optional(';'),
      )),
      '}',
    ),
    field_initializer: $ => seq($.id, '=', $._expression),

    // Constant rules

    boolean_literal: _ => choice('true', 'false'),
    integer_literal: _ => /\d+/,
    real_literal: _ => {
      const _real_exponent = /[eE][+\-]?\d+/;

      // TODO(external scanner): due to the ambiguity between "/\d+\./" and "<integer_literal> '..'"
      return token.immediate(choice(
        seq(/\d+/, _real_exponent),
        seq(/\d+\./, _real_exponent),
        seq(/\d+\.\d+/, optional(_real_exponent)),
        seq(/\.\d+/, optional(_real_exponent))
      ));
    },
    _constant: $ => choice($.boolean_literal, $.integer_literal, $.real_literal),
  }
});
