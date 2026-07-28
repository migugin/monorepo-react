const INDENT_UNIT = "  ";

// 여러 줄 문자열의 각 줄 앞에 들여쓰기를 붙인다. <template>/<style> 블록 안에 중첩시킬 때 사용한다.
// 빈 줄은 그대로 두어 불필요한 trailing whitespace가 생기지 않게 한다.
function indentBlock(text, depth = 1) {
  const indent = INDENT_UNIT.repeat(depth);
  return text
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
}

/**
 * HTML과 CSS를 Vue 3 SFC(<template> + <style scoped lang="scss">) 문자열로 조립한다.
 * Zeplin 코드 패널용 스니펫(src/index.js)과 로컬 미리보기용 .vue 파일 생성 스크립트
 * (scripts/generate-from-fixture.js) 양쪽에서 공통으로 사용한다.
 * @param {string} html - buildComponent()가 생성한 HTML 문자열
 * @param {string} css - buildComponent()가 생성한 CSS(SCSS 호환) 문자열
 * @returns {string} `<template>...</template>\n\n<style scoped lang="scss">...</style>` 형태의 문자열
 */
export function buildVueSfc(html, css) {
  const template = `<template>\n${indentBlock(html)}\n</template>`;
  const style = `<style scoped lang="scss">\n${indentBlock(css)}\n</style>`;
  return `${template}\n\n${style}`;
}
