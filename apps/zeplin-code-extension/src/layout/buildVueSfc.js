const INDENT_UNIT = "  ";

function indentBlock(text, depth = 1) {
  const indent = INDENT_UNIT.repeat(depth);
  return text
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
}

export function buildVueSfc(html, css) {
  const template = `<template>\n${indentBlock(html)}\n</template>`;
  const style = `<style scoped lang="scss">\n${indentBlock(css)}\n</style>`;
  return `${template}\n\n${style}`;
}
