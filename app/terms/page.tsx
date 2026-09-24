import type { Metadata } from "next";
import { LegalPage, SUPPORT_WECHAT } from "@/components/legal/LegalPage";
import { QUOTA_PERIOD_DAYS, FREE_ONE_TIME_FEATURES, FEATURE_NAMES } from "@/lib/config/plans";

export const metadata: Metadata = { title: "服务条款 - 开物" };

/*
 * 这里的每一条规则，都必须和代码实际执行的一致：
 *   - 额度周期：QUOTA_PERIOD_DAYS（从配置取，不手写天数）
 *   - 免费版一次性额度：FREE_ONE_TIME_FEATURES
 *   - 续费顺延 / 升级立即生效：lib/config/plans.ts 的 activationPlan
 *   - 不支持无理由退款、不开发票：本人确认过的政策
 * 条款说一套、系统跑一套，比没有条款更容易出纠纷。
 */
export default function TermsPage() {
  const oneTime = FREE_ONE_TIME_FEATURES.map((k) => FEATURE_NAMES[k] ?? k).join("、");

  return (
    <LegalPage title="服务条款">
      <section>
        <p>
          欢迎使用开物（以下简称"我们"）。注册或使用本服务，即表示你同意以下条款。
        </p>
      </section>

      <section>
        <h2>一、账号</h2>
        <ul>
          <li>本服务目前采用邀请制，需要有效邀请码才能注册。</li>
          <li>请妥善保管账号和密码。忘记密码时，请联系客服微信 {SUPPORT_WECHAT}，核实身份后我们会为你重置。</li>
          <li>一个账号仅限本人使用，不得出租、出借或转让。</li>
        </ul>
      </section>

      <section>
        <h2>二、会员与付款</h2>
        <ul>
          <li>付费方式为扫码转账并上传转账凭证，经人工核对后开通会员。</li>
          <li>各功能的使用额度每 {QUOTA_PERIOD_DAYS} 天重置一次，未用完的次数不累积到下个周期。月付和年付都按这个节奏重置。</li>
          <li>免费版的{oneTime}额度是一次性的，用完不会按周期重置。</li>
          <li>在会员有效期内续费同一档套餐，新的有效期从原到期日往后顺延，剩余天数不会损失。</li>
          <li>升级到其他档位立即生效，新的有效期从升级当天起算，原套餐未使用的天数不退款。</li>
        </ul>
      </section>

      <section>
        <h2>三、退款与发票</h2>
        <ul>
          <li>会员属于虚拟商品，开通后不支持无理由退款。购买前如有疑问，请先联系客服问清楚再付款。</li>
          <li>目前暂不支持开具发票。</li>
          <li>如因我们的原因导致已付费的服务长时间无法使用，请联系客服协商处理。</li>
        </ul>
      </section>

      <section>
        <h2>四、AI 生成的内容</h2>
        <ul>
          <li>本服务的内容由 AI 结合编导知识库生成，仅供创作参考，不保证准确、完整或一定获得流量。</li>
          <li>你对自己最终发布的内容负责，请自行核实其中的事实、数据和引用，并遵守所发布平台的规则。</li>
          <li>你输入的内容和生成的结果归你所有，你可以自由使用。</li>
        </ul>
      </section>

      <section>
        <h2>五、禁止的用途</h2>
        <p>不得利用本服务生成或传播违法违规内容，包括但不限于：侵犯他人肖像权、名誉权、著作权的内容，
          虚假宣传，以及其他违反法律法规或公序良俗的内容。违反者我们有权停用其账号。</p>
      </section>

      <section>
        <h2>六、服务的可用性</h2>
        <p>
          本服务依赖第三方 AI 与数据存储服务，可能因对方故障、网络问题或系统维护而短时中断。
          我们会尽力保障稳定，但不承诺服务永不中断。
        </p>
      </section>

      <section>
        <h2>七、条款更新</h2>
        <p>条款如有修改，我们会更新本页顶部的日期。修改后继续使用本服务，视为同意新的条款。</p>
      </section>
    </LegalPage>
  );
}
