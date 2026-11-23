# MediaPipe (인물 일러스트: 셀애니 · 목판화)

얼굴 부위 나누기와 얼굴 점 찾기에 Google MediaPipe를 이 기기 브라우저에서 돌려요. 사진은 어디에도 안 올라가요.

| 파일 | 원본 | 라이선스 |
|---|---|---|
| vision_bundle.mjs, wasm/vision_wasm_internal.js, wasm/vision_wasm_internal.wasm | npm @mediapipe/tasks-vision 1.2.3 (그대로) | Apache-2.0 |
| models/selfie_multiclass_256x256.tflite | MediaPipe Image Segmenter "Selfie Multiclass" (Google, Adel Ahmadyan, 2023) — storage.googleapis.com/mediapipe-models | Apache-2.0 (모델 카드) |
| models/face_landmarker.task | MediaPipe Face Landmarker (BlazeFace · Face Mesh V2 · Blendshape V2, Google) — storage.googleapis.com/mediapipe-models | Apache-2.0 (모델 카드) |

- 라이선스 전문: 같은 폴더의 LICENSE (Apache License 2.0)
- 모델 카드: huggingface.co/litert-community/MediaPipe-ImageSegmenter-Selfie-Multiclass · huggingface.co/litert-community/MediaPipe-FaceLandmarker
- 모델 카드의 사용 범위: 감시·신원 확인 용도는 다루지 않음 — 이 사이트는 그림 그리기에만 씀
- 파일은 고치지 않고 그대로 둠
