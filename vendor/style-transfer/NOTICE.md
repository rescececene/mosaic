# 그림 재료 그림체 AI

- 모델: Magenta의 임의 그림체 옮기기(arbitrary image stylization, Ghiasi 외 2017)를 Reiichiro Nakano가 TensorFlow.js로 옮긴 것 가운데 '그림체 입히기' 부분(separable transformer)
  - 출처: https://github.com/reiinakano/arbitrary-image-stylization-tfjs (Apache License 2.0, 이 폴더 LICENSE)
  - `model.json`, `group1-shard1of1`는 고치지 않고 그대로 씀
- 재료별 그림체 값: `crayon.json`(크레파스) · `watercolor.json`(수채화) · `cpencil.json`(색연필) · `oil.json`(유화) · `charcoal.json`(연필·목탄) · `ink.json`(수묵화)
  - 각 100개 숫자예요. 같은 저장소의 '그림체 읽기' 부분(MobileNet-v2)에 재료마다 직접 그린 보기 그림(남의 그림 안 씀)을 넣어서 한 번 계산해 둔 값이에요.
- 돌리는 곳: 방문자의 폰·컴퓨터 브라우저 (TensorFlow.js 4.22.0, vendor/tfjs, Apache-2.0). 사진은 어디로도 보내지 않음
