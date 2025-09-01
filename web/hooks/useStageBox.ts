'use client';

/**
 * 화면에 따라 "9:16 프레임"의 width/height를 계산해 주는 훅.
 * - reserveY: 카드 내부에서 헤더/푸터/컨트롤로 쓸 여백(px)
 * - vwRatio: 화면 가로의 최대 사용 비율(0~1)
 * - ar: 가로/세로 비 (9/16 = 0.5625)
 * 결과: { width, height } - 이 크기를 카드 프레임 style에 그대로 넣으면 됨.
 */
import { useEffect, useState } from 'react';

export function useStageBox(reserveY = 200, vwRatio = 0.99, ar = 9 / 16) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      // 미디어가 실제로 차지할 수 있는 최대 높이(상하 여백 제외)
      const maxH = Math.max(260, vh - reserveY);

      // 높이 기준으로 만드는 9:16 가로폭
      const wByH = maxH * ar;

      // 화면 가로폭의 일정 비율도 동시에 한계로 둠
      const wByVW = vw * vwRatio;

      // 두 제약 중 작은 값을 선택
      const width = Math.min(wByH, wByVW);

      // 비율 유지해서 최종 높이 재계산
      const height = Math.min(maxH, width / ar);

      setSize({ width: Math.floor(width), height: Math.floor(height) });
    };

    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [reserveY, vwRatio, ar]);

  return size;
}
