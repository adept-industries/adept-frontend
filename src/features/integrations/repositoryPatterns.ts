// Settings use Python fnmatch globs. Selected GitHub names must match literally;
// custom patterns are intentionally not escaped.
export function literalRepositoryPattern(name: string): string {
  return name.replace(/[[*?]/g, (character) => ({ "[": "[[]", "*": "[*]", "?": "[?]" })[character]!);
}
