'use client';

import { useEffect, useMemo, useState } from 'react';

type Section = { id: string; title: string };

export default function TocClient({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // 관성 덜하고, 중앙쯤 들어왔을 때 활성화되도록 rootMargin/threshold 조절
  const observer = useMemo(
    () =>
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            entries => {
              // 가장 화면에 가깝게 들어온 섹션을 active로
              const visible = entries
                .filter(e => e.isIntersecting)
                .sort(
                  (a, b) =>
                    (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0)
                );
              if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
            },
            {
              // 위 30% ~ 아래 55% 영역 안에 들어오면 활성
              rootMargin: '-30% 0px -55% 0px',
              threshold: [0, 0.25, 0.5, 0.75, 1],
            }
          )
        : null,
    []
  );

  useEffect(() => {
    if (!observer) return;
    const nodes = sections
      .map(s => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    nodes.forEach(n => observer.observe(n));
    return () => observer.disconnect();
  }, [observer, sections]);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 해시 업데이트(뒤로가기 동작 좋게)
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <ol className='space-y-3 border-l-2 border-white/10 pl-4'>
      {sections.map((s, i) => {
        const isActive = activeId === s.id || (activeId === null && i === 0);
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={e => onClick(e, s.id)}
              className={`text-[15px] inline-flex items-baseline gap-2 transition-colors ${
                isActive ? 'text-white' : 'text-white/85 hover:text-white'
              }`}
            >
              <span
                className='font-bold'
                style={{ color: '#5a319f' }} // 번호 색상 고정
              >
                {i + 1}.
              </span>
              <span className={isActive ? 'font-bold' : 'font-semibold'}>
                {s.title}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
