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

  word: $ => $._identifier,

  supertypes: $ => [
    $._one_decl,
    $._one_provide,
    $._equation,
    $._expression,
    $._static_param,
    $._static_arg,
    $._named_static_arg,
    $._type,
  ],

  rules: {
    source_file: $ => seq(
      repeat($.include),
      seq(repeat($._one_decl), repeat($._one_package_or_model)),
    ),

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

    _one_package_or_model: $ => choice($.package_decl, $.model_decl),
    package_decl: $ => seq(
      'package',
      field('name', $.identifier),
      choice($._package_definition, $._package_alias),
    ),
    _package_definition: $ => seq(
      optional($.uses),
      optional($.provides),
      field('body', $.package_body),
    ),
    _package_alias: $ => seq(
      choice('=', 'is'),
      field('alias', $.package_alias),
      ';',
    ),
    package_body: $ => seq('body', repeat($._one_decl), 'end'),
    package_alias: $ => seq(
      field('name', $.identifier),
      '(',
      separated1($._named_static_arg, choice(',', ';')),
      ')'
    ),
    uses: $ => seq('uses', separated1($.identifier, ','), ';'),

    // Model rules

    provides: $ => seq('provides', repeat1(seq($._one_provide, ';'))),
    _one_provide: $ => choice($.const_provide, $.node_provide, $.type_provide),
    const_provide: $ => seq(
      'const',
      field('name', $.identifier),
      ':',
      field('type', $._type),
      optional(seq(
        '=',
        field('value', $._expression),
      )),
    ),
    node_provide: $ => seq(
      optional('unsafe'),
      choice('node', 'function'),
      field('name', $.identifier),
      optional($.static_params),
      $._node_profile,
    ),
    type_provide: $ => seq('type', $.one_type_decl),
    model_decl: $ => seq(
      'model',
      field('name', $.identifier),
      optional($.uses),
      'needs',
      repeat1(seq($._static_param, ';')),
      optional($.provides),
      field('body', $.package_body),
    ),

    // Ident 6 rules

    // TODO: extras should be forbidden inside this: there is no way to do that currently, AFAIK (maybe with a scanner?)
    identifier_ref: $ => prec(9999, seq(
      optional(seq(
        field('package', alias($._identifier, $.identifier)),
        '::',
      )),
      field('member', alias($._identifier, $.identifier)),
    )),
    _identifier: _ => /[_a-zA-Z][_'a-zA-Z0-9]*/,

    // Ident rules

    identifier: $ => prec.right(20, seq($._identifier, repeat($.pragma))),
    pragma: $ => seq(
      '%',
      field('key', alias($._identifier, $.identifier)),
      ':',
      field('value', alias($._identifier, $.identifier)),
      '%',
    ),

    // Node rules

    typed_ids: $ => seq(
      separated1(field('name', $.identifier), ','),
      ':',
      field('type', $._type),
    ),
    _typed_valued_ids_list: $ => separated1($.typed_valued_ids, ';'),
    typed_valued_ids: $ => choice(
      seq(separated1(field('name', $.identifier), ','), ':', field('type', $._type)),
      seq(field('name', $.identifier), ':', field('type', $._type), '=', field('value', $._expression)),
    ),

    node_decl: $ => seq(
      optional('unsafe'),
      choice('node', 'function'),
      field('name', $.identifier),
      optional($.static_params),
      choice($._node_definition, $._node_alias),
    ),
    _node_definition: $ => seq(
      $._node_profile,
      optional(';'),
      repeat($.one_local_decl),
      field('body', $.node_body),
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
      seq(separated1(field('name', $.identifier), ','), ':', field('type', $._type)),
      seq(field('name', $.identifier), ':', field('type', $._type), '=', field('value', $._expression)),
      seq(field('name', $.identifier), '=', field('value', $._expression)),
    ),

    // Type decl rules

    type_decl: $ => seq('type', repeat1(seq($.one_type_decl, ';'))),
    one_type_decl: $ => seq(
      field('name', $.identifier),
      optional(seq('=', field('type', $._one_type_decl_value))),
    ),
    _one_type_decl_value: $ => choice(
      $._type,
      $.enum_type_value,
      $.struct_type_value,
    ),
    enum_type_value: $ => seq(
      'enum',
      '{',
      separated1(field('constant', $.identifier), ','),
      '}',
    ),
    struct_type_value: $ => seq(optional('struct'), '{', $._typed_valued_ids_list, '}'),

    // Simple type rules

    _type: $ => choice(
      $.identifier_type,
      $.primitive_type,
      $.table_type,
    ),
    identifier_type: $ => prec(999, $.identifier_ref),
    primitive_type: _ => choice('bool', 'int', 'real'),
    table_type: $ => prec.left(PREC.hat, seq(field('element', $._type), '^', field('length', $._expression))),

    // Ext nodes rules

    ext_node_decl: $ => seq(
      optional('unsafe'),
      'extern',
      choice('function', 'node'),
      field('name', $.identifier),
      $._node_profile,
      optional(';'),
    ),

    // Static rules

    static_params: $ => seq('<<', separated($._static_param, ';'), '>>'),
    _static_param: $ => choice($.type_static_param, $.const_static_param, $.node_static_param),
    type_static_param: $ => seq('type', field('name', $.identifier)),
    const_static_param: $ => seq('const', field('name', $.identifier), ':', field('type', $._type)),
    node_static_param: $ => seq(
      optional('unsafe'),
      choice('node', 'function'),
      field('name', $.identifier),
      $._node_profile,
    ),

    effective_node: $ => seq($.identifier_ref, optional($.static_args)),

    static_args: $ => seq('<<', separated($._static_arg, choice(',', ';')), '>>'),
    _static_arg: $ => choice($.identifier_static_arg, $.type_static_arg, $.const_static_arg, $.node_static_arg, $.op_static_arg),
    identifier_static_arg: $ => prec(999, $.identifier_ref), // conflicts with _surely_expression (_expression1 to be precise)
    type_static_arg: $ => choice(seq('type', $._type), $._surely_type),
    const_static_arg: $ => choice(seq('const', $._expression), $._surely_expression),
    node_static_arg: $ => choice(seq(choice('node', 'function'), $.effective_node), alias($.surely_node, $.effective_node)),
    op_static_arg: $ => $._predef_op,

    _named_static_arg: $ => choice($.identifier_named_static_arg, $.type_named_static_arg, $.const_named_static_arg, $.node_named_static_arg, $.op_named_static_arg),
    _named_static_arg_name: $ => seq(field('name', $.identifier), '='),
    identifier_named_static_arg: $ => prec(999, seq( // conflicts with _surely_expression (_expression1 to be precise)
      $._named_static_arg_name,
      field('ref', $.identifier_ref),
    )),
    type_named_static_arg: $ => choice(
      seq('type', $._named_static_arg_name, field('type', $._type)),
      seq($._named_static_arg_name, field('type', $._surely_type)),
    ),
    const_named_static_arg: $ => choice(
      seq('const', $._named_static_arg_name, field('value', $._expression)),
      seq($._named_static_arg_name, field('value', $._surely_expression)),
    ),
    node_named_static_arg: $ => choice(
      seq(choice('node', 'function'), $._named_static_arg_name, $.effective_node),
      seq($._named_static_arg_name, alias($.surely_node, $.effective_node)),
    ),
    op_named_static_arg: $ => seq($._named_static_arg_name, $._predef_op),

    surely_node: $ => seq($.identifier_ref, $.static_args),
    _surely_type: $ => choice(
      $.primitive_type,
      alias($.surely_table_type, $.table_type),
    ),
    surely_table_type: $ => prec.left(PREC.hat, seq(field('element', $._type), '^', field('length', $._expression))),
    _surely_expression: $ => prec(0, $._expression), // conflicts with identifier_static_arg

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
      $.identifier_left_expression,
      $.field_left_expression,
      $.index_left_expression,
    ),
    identifier_left_expression: $ => $.identifier,
    field_left_expression: $ => prec.left(PREC.hat, seq(
      field('value', $._left_expression),
      '.',
      field('field', $.identifier),
    )),
    index_left_expression: $ => prec.left(PREC.bracket, seq(
      field('value', $._left_expression),
      '[',
      field('index', choice($._expression, $.select)),
      ']',
    )),
    select: $ => seq(
      field('from', $._expression),
      token('..'),
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
      $.identifier_expression,
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

    identifier_expression: $ => $.identifier_ref,

    tuple_expression: $ => seq('(', repeat($._expression), ')'),
    table_expression: $ => seq('[', repeat($._expression), ']'),
    // Struct expression is defined in its own eBNF group below

    field_expression: $ => prec.left(PREC.hat, seq(
      field('value', $._expression1),
      '.',
      field('field', $.identifier),
    )),

    index_expression: $ => prec.right(PREC.bracket, seq(
      field('value', $._expression),
      '[',
      field('index', choice($._expression, $.select)),
      ']',
    )),

    call_expression: $ => prec.right(PREC.bracket, seq(
      field('node', $.identifier_ref),
      '(',
      separated(field('argument', $._expression), ','),
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
      field('value', $.identifier),
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
      separated(field('operand', $._expression), ','),
      ')',
    ),

    clock_expression: $ => choice(
      seq($.identifier_ref, '(', $.identifier, ')'),
      $.identifier,
      seq('not', $.identifier),
      seq('not', '(', $.identifier, ')')
    ),

    // Merge rules

    merge_arm: $ => seq(
      '(',
      field('pattern', choice($.identifier_ref, $.boolean_literal)),
      '->',
      field('value', $._expression),
      ')',
    ),

    // Predef rules

    _predef_op: _ => choice('not', 'fby', 'pre', 'current', '->', 'and', 'or', 'xor', '=>', '=', '<>', '<', '<=', '>', '>=', 'div', 'mod', '-', '+', '/', '*', 'if'),

    // Expression by names rules (a.k.a. struct expressions)

    struct_expression: $ => seq(
      field('name', $.identifier_ref),
      '{',
      optional(seq(
        optional(seq($.identifier_ref, 'with')),
        separated1($.field_initializer, choice(',', ';')),
        optional(';'),
      )),
      '}',
    ),
    field_initializer: $ => seq(field('field', $.identifier), '=', field('value', $._expression)),

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
