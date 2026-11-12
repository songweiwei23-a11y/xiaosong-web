// 摸底考试入口：把夜间回归的固定题、调用和体检函数打包成一个 CJS 文件，供 run-exam.cjs 调用。
export { regressionCases, runRegression, readDifyAnswer, REGRESSION_PROFILE } from '../../lib/quality-regression';
export { runQualityChecks, reviewedQualityOutput } from '../../lib/quality-checks';
