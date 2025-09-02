'use client';

export default function Avatar({
  src,
  size = 32,
  alt = 'avatar',
}: {
  src?: string | null;
  size?: number;
  alt?: string;
}) {
  const common = { width: size, height: size };

  if (src) {
    // 원격 도메인 무관하게 표시되도록 next/image 대신 <img> 사용
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        referrerPolicy='no-referrer'
        className='rounded-full object-cover border border-white/20'
        style={common}
      />
    );
  }

  // 기본 placeholder
  return (
    <div
      className='rounded-full bg-white/10 border border-white/20'
      style={common}
      aria-label='no avatar'
    />
  );
}
