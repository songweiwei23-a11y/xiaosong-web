// 选题工作台的静态配置数据（从 page.tsx 抽离）

/*
 * 17 个成交理由原来在这里和成交理由页各写了一份，一模一样的两份。
 * 改一处漏一处迟早会发生，现在统一从 lib/deal-reasons 取。
 */
export { DEAL_REASONS as ALL_DEAL_REASONS } from "@/lib/deal-reasons";
