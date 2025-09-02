// 공유하기: 현재는 링크 자동 복사임
export async function shareLink(url: string, title = 'Catarie') {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return true;
    }
  } catch {
    // 무시하고 복사 시도
  }
  try {
    await navigator.clipboard.writeText(url);
    alert('링크가 클립보드에 복사되었어요.');
    return true;
  } catch {
    alert('링크 복사에 실패했어요. 직접 복사해 주세요:\n' + url);
    return false;
  }
}
