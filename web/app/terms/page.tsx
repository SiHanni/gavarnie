import type { Metadata } from 'next';
import Link from 'next/link';
import TocClient from './TocClient'; // ✅ 추가

export const metadata: Metadata = {
  title: 'Catarie – 약관 및 정책',
  description: 'Catarie 서비스 이용약관 및 정책',
};

const sections = [
  { id: 'terms', title: '약관' },
  { id: 'account', title: '계정' },
  { id: 'use', title: '이용' },
  { id: 'ip', title: '지식재산권' },
  { id: 'indemnity', title: '배상' },
  { id: 'no-waiver', title: '권리포기 금지' },
  { id: 'privacy', title: '개인정보 처리방침' },
  { id: 'copyright', title: '저작권 침해' },
  { id: 'enforcement', title: '콘텐츠 삭제, 계정 영구 정지' },
  { id: 'notice', title: '저작권 침해 신고' },
] as const;

export default function TermsPage() {
  return (
    <main className='min-h-screen bg-black text-white'>
      {/* 우측 상단: 돌아가기 */}
      <div className='fixed top-6 right-6 z-50'>
        <Link
          href='/'
          className='inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15'
          aria-label='홈으로 돌아가기'
        >
          ← 돌아가기
        </Link>
      </div>

      <div className='max-w-screen-2xl mx-auto px-5 md:px-10 py-8 md:py-12'>
        {/* 헤더: 아이콘 + 제목 */}
        <div className='mb-8 md:mb-12'>
          <div className='text-xs md:text-sm text-white/50'>
            일반 규정 – 모든 이용자
          </div>

          <div className='mt-2 flex items-center gap-3'>
            <img
              src='/images/appIcon.png'
              alt='Catarie'
              width={40}
              height={40}
              className='w-10 h-10'
              draggable={false}
            />
            <h1 className='text-3xl md:text-5xl font-extrabold tracking-tight'>
              Catarie – 서비스 약관
            </h1>
          </div>

          <div className='mt-3 text-sm text-white/50'>
            최종 업데이트: <time dateTime='2025-09-05'>2025-09-05</time> ·
            발효일: <time dateTime='2025-09-05'>2025-09-05</time>
          </div>
        </div>

        {/* 본문 레이아웃 */}
        <div className='grid grid-cols-12 gap-6 md:gap-10'>
          {/* 좌측 목차 (클라이언트) */}
          <aside className='hidden md:block col-span-3'>
            <div className='sticky top-20'>
              <TocClient sections={sections as any} />
            </div>
          </aside>

          {/* 우측 본문 */}
          <article
            className='
              col-span-12 md:col-span-9
              prose prose-invert max-w-none
              prose-p:leading-relaxed prose-li:leading-relaxed
            '
          >
            {/* ↓↓↓ 섹션들 — 제목 크게/굵게 + 섹션 간 넉넉한 간격 유지 */}
            <section
              id='terms'
              className='scroll-mt-28 mt-10 first:mt-0 space-y-4'
            >
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                1. 약관
              </h2>
              <p>
                본 약관은 Catarie(이하 “회사” 또는 “서비스”)가 제공하는
                웹/모바일 애플리케이션 및 관련 제품·콘텐츠의 이용에 적용됩니다.
                회사는 합리적인 사유가 있는 경우 약관을 개정할 수 있으며, 중요한
                변경은 최소 7일 전에 서비스 내 공지합니다(긴급 변경은 예외).
                공지 후에도 서비스를 계속 이용하시면 변경에 동의한 것으로
                간주됩니다. 약관과 별도 정책이 상충할 경우 특별 규정이 없는 한
                약관이 우선합니다.
              </p>
            </section>

            <section id='account' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                2. 계정
              </h2>
              <ul className='list-disc pl-6 space-y-2'>
                <li>
                  귀하는 본인 명의로 계정을 개설·이용해야 하며, 계정
                  보안(비밀번호, 토큰 등) 유지 의무가 있습니다.
                </li>
                <li>
                  타인의 권리 침해, 불법·부정 사용, 자동화 수단을 통한 어뷰징,
                  다중 계정으로 한도 회피 등은 금지됩니다.
                </li>
                <li>
                  위반 시 회사는 사전 통지 없이 게시물 삭제, 기능 제한, 계정
                  정지/해지 등 필요한 조치를 취할 수 있습니다.
                </li>
              </ul>
            </section>

            <section id='use' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                3. 이용
              </h2>
              <ul className='list-disc pl-6 space-y-2'>
                <li>
                  서비스는 개인적·비상업적 용도를 기본으로 합니다(별도
                  계약/정책이 있는 경우 제외).
                </li>
                <li>
                  <strong>무료 이용 한도:</strong> 결제하지 않은 경우{' '}
                  <strong>일일 업로드 수는 10개(Basic 등급 기준)</strong>로
                  제한됩니다. 기준 시간은{' '}
                  <strong>UTC+9(한국시간) 00:00–24:00</strong>이며, 운영
                  정책으로 조정될 수 있습니다.
                </li>
                <li>
                  시스템 보호를 위해 업로드 용량·형식·빈도 등에 기술적 제한이
                  적용될 수 있으며, 한도 우회(다중 계정, 스크립트 등)는
                  금지됩니다.
                </li>
                <li>
                  서비스 품질 유지를 위해 콘텐츠 인코딩·캐싱 등 처리가 수행될 수
                  있습니다.
                </li>
              </ul>
            </section>

            <section id='ip' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                4. 지식재산권
              </h2>
              <ul className='list-disc pl-6 space-y-2'>
                <li>
                  귀하는 업로드하는 모든 콘텐츠에 대한 권리 또는 필요한 모든
                  사용 권한을 보유해야 합니다.
                </li>
                <li>
                  서비스 제공·운영·개선에 필요한 범위에서 회사에 전
                  세계적·무상·양도불가·비독점적 라이선스를
                  부여합니다(저장·복제·전송·처리 포함, 법이 허용하는 범위 내).
                </li>
                <li>
                  <strong>
                    타인의 저작권을 침해한 영상 또는 음원을 업로드하더라도,
                    업로드 후 발생하는 모든 책임은 전적으로 귀하에게 있습니다.
                  </strong>
                </li>
                <li>
                  회사는 권리 침해 신고를 접수하면 합리적 범위에서 신속히 조치할
                  수 있습니다(게시 중단, 접근 제한 등).
                </li>
              </ul>
            </section>

            <section id='indemnity' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                5. 배상
              </h2>
              <p>
                귀하가 약관을 위반하거나 귀하의 콘텐츠/행위로 인해 제3자와의
                분쟁·청구·손해·<strong>법률 비용</strong>이 발생하는 경우,
                귀하는 회사 및 그 임직원/대리인을 방어·면책하고 회사에 해가
                발생하지 않도록(hold harmless) 모든 합리적 비용을 배상하는 데
                동의합니다. 회사의 고의 또는 중대한 과실이 없는 한 회사는
                간접·특별·결과적 손해에 대해 책임을 지지 않습니다.
              </p>
            </section>

            <section id='no-waiver' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                6. 권리포기 금지
              </h2>
              <p>
                회사가 본 약관의 조항을 즉시 이행하거나 집행하지 않았다고 해서
                해당 조항 또는 권리를 포기한 것으로 해석되지 않습니다. 어떤
                조항이 무효가 되더라도 나머지 조항의 유효성에는 영향이
                없습니다(분리가능).
              </p>
            </section>

            <section id='privacy' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                7. 개인정보 처리방침
              </h2>
              <ul className='list-disc pl-6 space-y-2'>
                <li>
                  <strong>
                    현재 버전의 Catarie는 개인정보를 수집하지 않습니다.
                  </strong>
                </li>
                <li>
                  보안/운영 목적의 비식별 서버 로그(IP, User-Agent, 시각 등)는
                  일시적으로 처리될 수 있으며, 법령상 의무가 있는 경우
                  예외적으로 보관될 수 있습니다.
                </li>
                <li>
                  로그인 사용 시 인증 토큰 등 최소 정보가 사용자 기기에 저장될
                  수 있으나, 회사는 이를 자체적으로 식별 가능한 개인정보로
                  수집·프로필링하지 않습니다.
                </li>
                <li>정책이 변경되는 경우 서비스 내 고지 후 적용합니다.</li>
              </ul>
            </section>

            <section id='copyright' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                8. 저작권 침해
              </h2>
              <p>
                회사는 저작권을 침해하는 어떠한 콘텐츠도 허용하지 않습니다.
                적절한 승인이나 법적으로 유효한 사유 없이 타인의 저작권 보호
                콘텐츠를 사용하는 행위는 정책 위반이 될 수 있습니다. 다만 모든
                승인되지 않은 사용이 침해에 해당하는 것은 아니며, 일부
                국가에서는 공정 이용/공정 거래 등 예외가 인정될 수 있습니다.
                적용 여부는 관할법과 개별 사안에 따라 달라집니다.
              </p>
            </section>

            <section id='enforcement' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                9. 콘텐츠 삭제, 계정 영구 정지
              </h2>
              <ul className='list-disc pl-6 space-y-2'>
                <li>
                  타인의 권리를 침해하는 사용자 콘텐츠는 삭제될 수 있으며,
                  실시간 기능에서 침해가 발생하면 해당 기능의 접근이 일시 제한될
                  수 있습니다.
                </li>
                <li>
                  회사는 반복 침해자 정책을 채택·합리적으로 집행하며, 반복적
                  또는 중대한 침해가 확인되면 계정을 즉시 영구 정지할 수
                  있습니다.
                </li>
                <li>
                  부적절한 활동에 사용된 계정의 소유자가 새 Catarie 계정을
                  개설하는 것을 회사는 거부할 권리를 보유합니다.
                </li>
              </ul>
            </section>

            <section id='notice' className='scroll-mt-28 mt-12 space-y-4'>
              <h2 className='!text-2xl md:!text-3xl !font-extrabold'>
                10. 저작권 침해 신고
              </h2>
              <p>
                권리 침해가 의심되는 경우 아래 정보를 포함하여 신고해
                주십시오(정확한 정보가 없으면 처리 지연/반려 가능).
              </p>
              <ol className='list-decimal pl-6 space-y-2'>
                <li>
                  권리자(또는 대리인) 성명/기관명 및 <strong>연락처</strong>
                  (이메일·전화)
                </li>
                <li>
                  침해 주장 <strong>저작물 식별 정보</strong>(제목, 등록번호,
                  소유 증빙 등)
                </li>
                <li>
                  서비스 내 <strong>침해 위치</strong>(URL/스크린샷 등)
                </li>
                <li>
                  무단 사용이 <strong>권리 침해라고 믿는 선의의 진술</strong>
                </li>
                <li>
                  신고 내용의 <strong>정확성 보증</strong> 및 권리자(대리인)임을
                  확인하는 진술
                </li>
                <li>서명(전자서명 가능)</li>
              </ol>
              <p className='mt-2'>
                접수처:{' '}
                <Link
                  href='mailto:copyright@catarie.app'
                  className='text-[#5a319f] hover:underline'
                >
                  copyright@catarie.app
                </Link>{' '}
                · 문의:{' '}
                <Link
                  href='mailto:support@catarie.app'
                  className='text-[#5a319f] hover:underline'
                >
                  support@catarie.app
                </Link>
              </p>
            </section>

            <section className='mt-12 space-y-3'>
              <h3 className='!text-xl md:!text-2xl !font-bold'>
                준거법 및 관할
              </h3>
              <p>
                본 약관은 대한민국 법을 따르며, 분쟁은 회사 소재지 관할 법원의
                전속 관할로 합니다.
              </p>
            </section>
          </article>
        </div>
      </div>
    </main>
  );
}
