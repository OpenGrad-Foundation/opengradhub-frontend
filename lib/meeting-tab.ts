/**
 * Join a meeting in a new tab when the URL comes from an awaited request.
 *
 * The tab must be opened synchronously inside the click, before the await —
 * afterwards the user gesture is gone and iOS Safari / Android block it.
 * Do NOT pass "noopener" to window.open here: per spec that makes it return
 * null, so the tab can never be navigated and sits on about:blank. We sever
 * the opener by hand instead, before navigating to the third-party URL.
 *
 * Returns false when no tab could be opened, so the caller can show the link.
 */
export async function openMeetingTab(getUrl: () => Promise<string>): Promise<boolean> {
  const tab = window.open("", "_blank");
  let url: string;
  try {
    url = await getUrl();
  } catch (e) {
    tab?.close();
    throw e;
  }
  if (!tab || tab.closed) return false;
  tab.opener = null;
  tab.location.href = url;
  return true;
}
