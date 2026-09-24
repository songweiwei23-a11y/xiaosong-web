/**
 * 品牌「开物」。全站凡是出现品牌名、品牌标志的地方都从这里取，别再各写各的——
 * 改名那次，旧名字散在 9 个文件 14 处，就是因为各处手写。
 *
 * 名字取自《天工开物》：开物是创作，天工是手艺和打磨。
 */

export const BRAND_NAME = '开物';
export const BRAND_LATIN = 'KAIWU';

/** 印章式标志：渐变方印，中间一个宋体「开」 */
export function BrandSeal({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={`brand-seal flex shrink-0 items-center justify-center text-white ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    >
      <span className="font-brand leading-none" style={{ fontSize: Math.round(size * 0.5), letterSpacing: 0, marginRight: 0 }}>
        开
      </span>
    </div>
  );
}

/** 文字标：宋体「开物」，可选下挂英文 KAIWU */
export function BrandWordmark({
  className = '',
  latin = false,
  latinClassName = '',
}: {
  className?: string;
  latin?: boolean;
  latinClassName?: string;
}) {
  return (
    <span className="inline-flex flex-col items-center">
      <span className={`font-brand leading-none ${className}`}>{BRAND_NAME}</span>
      {latin && (
        /*
         * 英文跟着主字等比缩放，居中挂在下面。
         * 小尺寸（侧边栏 19px）按比例会小到看不清，所以设了 8.5px 的下限。
         */
        <span
          className={`font-brand-latin leading-none opacity-60 ${latinClassName}`}
          style={{ fontSize: 'max(8.5px, 0.22em)', marginTop: '0.4em' }}
        >
          {BRAND_LATIN}
        </span>
      )}
    </span>
  );
}
