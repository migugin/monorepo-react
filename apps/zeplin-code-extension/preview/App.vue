<script setup>
import { ref, onMounted } from "vue";

const GeneratedComponent = ref(null);
const loadErrorMessage = ref("");

/**
 * data/generated.vue를 동적으로 불러와 렌더링 대상 컴포넌트로 설정한다.
 * data/generated.vue는 generate:fixture 스크립트가 실행될 때만 만들어지는(gitignore 대상) 파일이라
 * 정적 import 대신 glob으로 느슨하게 참조해, 파일이 없을 때도 개발 서버 자체는 죽지 않게 한다.
 * @returns {Promise<void>}
 */
async function loadGeneratedComponent() {
  const modules = import.meta.glob("../data/generated.vue");
  const loadModule = modules["../data/generated.vue"];

  if (!loadModule) {
    loadErrorMessage.value =
      "data/generated.vue 파일이 없습니다. 먼저 `pnpm --filter zeplin-code-extension generate:fixture`를 실행해주세요.";
    return;
  }

  try {
    const module = await loadModule();
    GeneratedComponent.value = module.default;
  } catch (error) {
    loadErrorMessage.value = `data/generated.vue를 불러오는 중 오류가 발생했습니다: ${error.message}`;
  }
}

onMounted(loadGeneratedComponent);
</script>

<template>
  <main class="preview">
    <h1 class="preview__title">Zeplin Code Extension 미리보기</h1>
    <p class="preview__hint">
      <code>generate:fixture</code> 실행 결과(<code>data/generated.vue</code>)를 렌더링합니다.
      다시 생성한 뒤에는 브라우저를 새로고침해주세요.
    </p>

    <p v-if="loadErrorMessage" class="preview__error">{{ loadErrorMessage }}</p>
    <div v-else-if="GeneratedComponent" class="preview__canvas">
      <component :is="GeneratedComponent" />
    </div>
    <p v-else class="preview__hint">불러오는 중...</p>
  </main>
</template>

<style scoped lang="scss">
.preview {
  padding: 24px;
  color: #222;
  font-family: system-ui, sans-serif;

  &__title {
    margin: 0 0 8px;
    font-size: 20px;
  }

  &__hint {
    margin: 0 0 24px;
    color: #666;
    font-size: 13px;
  }

  &__error {
    padding: 12px 16px;
    border-radius: 8px;
    background-color: #fdecea;
    color: #b3261e;
    font-size: 13px;
  }

  &__canvas {
    display: inline-block;
    padding: 16px;
    border: 1px dashed #ccc;
  }
}
</style>
