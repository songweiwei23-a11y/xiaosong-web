/**
 * 对照组的效果（二期，见 docs/越用越懂你_二期方案_20261017.md 六）：
 * 同一批用户、同一段时间里，「带偏好」生成的结果和「对照组（不带偏好）」生成的结果，
 * 谁更多被点「有用」。这是证明「开物懂了、懂的有用」的唯一可靠办法。
 *
 * 只有对上了生成记录的反馈才算（control 不为空）。两边各至少 30 条才给结论，少于就只给数，不下判断。
 */

export interface ControlRow { control: boolean | null; rating: number }
export interface Side { n: number; up: number; rate: number | null }

export const MIN_SAMPLE_PER_SIDE = 30;

export function compareControl(rows: ControlRow[]): { treatment: Side; control: Side; liftPoints: number | null; enoughSample: boolean } {
  const side = (c: boolean): Side => {
    const xs = rows.filter((r) => r.control === c);
    const up = xs.filter((r) => r.rating > 0).length;
    return { n: xs.length, up, rate: xs.length ? Math.round((up / xs.length) * 100) : null };
  };
  const treatment = side(false);
  const control = side(true);
  const enoughSample = treatment.n >= MIN_SAMPLE_PER_SIDE && control.n >= MIN_SAMPLE_PER_SIDE;
  const liftPoints = treatment.rate !== null && control.rate !== null ? treatment.rate - control.rate : null;
  return { treatment, control, liftPoints, enoughSample };
}
