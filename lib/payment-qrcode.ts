/**
 * 收款码能不能拿给用户扫。
 *
 * 占位图（地址里带 placeholder）和非 https 的地址一律不算数：收款码是真钱，
 * 显示一张占位图等于让用户把钱转到一个不存在的收款方。管理端启用时校验，
 * 付款页展示时也校验，两头都守。
 */
export function isUsableQrcodeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!/^https:\/\//i.test(url)) return false;
  if (/placeholder/i.test(url)) return false;
  return true;
}
