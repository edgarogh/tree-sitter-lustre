# [Lustre (LV6)](https://www-verimag.imag.fr/DIST-TOOLS/SYNCHRONE/lustre-v6/) grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter)

This repository contains a tree-sitter grammar that should parse Lustre (`.lus`) files, as well as its subset dialects (e.g. `.ec`).

> The language bindings that have a centralized package repository (PyPI, crates.io, ...) have not been published yet. I'll do that when the grammar is somewhat complete. You _should_ be able to use them using the git URL though, but I haven't tested.

**Remark about encoding:** Lustre uses plain ASCII encoding. Input bytes greater than 127 (i.e. outside of ASCII) aren't straight up rejected, but the only grammar rules that will allow them are comments. This gives rise to two important observations:
- While tree-sitter supports both UTF-8 and UTF-16, using UTF-16 is nonsensical, as Lustre won't parse the file, since only UTF-8 is compatible with ASCII.
- Using another ASCII-compatible encoding than UTF-8 will not work, as tree-sitter requires UTF-8 input to be… well… valid UTF-8. This is unfortunate, because some Lustre files in the original repository are encoded in ISO-8859-1. There is no solution to this problem besides re-encoding the file beforehand.
  - If `tree-sitter-lustre` is used as part of another standalone tool specifically for Lustre, I suggest trying to parse the file as UTF-8, and if that fails, map all bytes with value >127 to a Unicode [PUA](https://en.wikipedia.org/wiki/Private_Use_Areas), so that you'll be able to do the inverse operation if you want to retrieve the original bytes after parsing.

## Scope

**The goal of this grammar is to be strictly identical to the official one.** I plan on using it in [a tool](https://gricad-gitlab.univ-grenoble-alpes.fr/Projets-INFO4/22-23/26/rustre) that I want to be 100% compatible with the official compiler implementation, so divergences with the specification are _not_ desirable. _However_, if having some laxity is useful to someone, we could discuss on defining multiple "dialects" of Lustre; the baseline — spec compliant — dialect, and a more tolerant one. Since the grammar DSL is plain old JS, it's very easy to wrap it in a function, with parameters to customize what is and what is not accepted depending on the use case. Then, we'd need to decide which of these dialects is actually published to package registries. I'd be OK with publishing the laxer one, because my tool will most likely use a fork of this repository anyway.

## Forward compatibility

It is too early to offer any forward compatibility guarantees when it comes to how the nodes or their fields are named. Please use a pinned version if you rely on specific names or tree structures. The Lustre syntax doesn't evolve too much, so this TS implementation should stabilize over time.

## Contributing

Contributions are very welcome. Here's ideas of what I'm interested in:
- Fixes to the grammar
- Quality assurance : unit tests, differential fuzz testing with the official parser
- Queries : [`highlights.scm`](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html), [`tags.scm`](https://tree-sitter.github.io/tree-sitter/4-code-navigation.html), [`locals.scm`](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html#local-variables), etc.
  - I don't use Neovim, so I personally may not have the best judgment
- Anything that, in your opinion, improves the overall code quality and reduces the maintaining burden 🙃

### Code structure

The rules in `grammar.js` are sorted to match the "eBNF groups" found in the PDF spec (see below). However, keep in mind that this grammar is not supposed to match the rules 1:1 ; the only goal is that the main rule matches the same files as the official compiler. To quote the tree-sitter book:

> Tree-sitter's output is a concrete syntax tree; each node in the tree corresponds directly to a terminal or non-terminal symbol in the grammar. So to produce an easy-to-analyze tree, there should be a direct correspondence between the symbols in your grammar and the recognizable constructs in the language. This might seem obvious, but it is very different from the way that context-free grammars are often written in contexts like language specifications or Yacc/Bison parsers.

Our grammar is supposed to produce relatively simple trees — without too much (useless) nesting — to make it easier to read and/or process later. This requires a bit of human judgement.

Some nodes have been renamed for consistency, simplicity, and to try to adhere to existing naming conventions in tree-sitter grammars. Specifically, I've been taking a lot of inspiration from [the Rust grammar for tree-sitter](https://github.com/tree-sitter/tree-sitter-rust).

## References

- [The official grammar specification](https://www-verimag.imag.fr/DIST-TOOLS/SYNCHRONE/lustre-v6/doc/lv6grammarlicence.pdf)
  - It is unfortunately not sufficient by itself: it is outdated, it lacks precise information about how to lex some tokens (identifiers, literals...) and doesn't give information about the precedence of any operator
- [The source code](https://gricad-gitlab.univ-grenoble-alpes.fr/verimag/synchrone/lustre-v6/-/blob/d000fdd87d959a4463c8cdc0c600ba6242125c99/lib/lv6parser.mly) — the most precise specification to exist
