import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// zeplin-code-extension 패키지 안에서만 쓰는 Vite + Vue 3 미리보기 환경이다.
// zem(webpack) 기반 Extension 빌드(src/, zem.config 등)와는 완전히 분리되어 있어,
// 이 설정은 preview/ 아래의 파일만 다루고 Extension 번들에는 전혀 영향을 주지 않는다.
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "preview-dist"
  }
});
