import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 部署脚本的两道闸。
 *
 * 【为什么要用测试守一个 .ps1】
 * 真实发生过一次：源文件 12:24 传上服务器了，.next 却还是 10:44 的，
 * pm2 在 12:39 拿着旧构建重启。屏幕上一路绿字"构建完成""部署成功"，
 * 线上代码一个字没变——修的 bug 当然还在，而人会以为是代码没修对，
 * 往完全错误的方向查。
 *
 * 原因是判定"构建完成"的方式：轮询 /tmp/build.log 的末尾，看到
 * "Route (app)" 或 "(Static) prerendered" 就算完成。而构建没启动时，
 * 日志还是**上一次成功构建**留下的，那份旧日志的末尾恰好就有这两个标志。
 * 第一次轮询就匹配上，15 秒"构建完成"。
 *
 * 这类缺陷没法靠跑一次部署发现——它只在"构建恰好没起来"时才显形，
 * 而那时它伪装成成功。只能把两道闸钉死：
 *   1. 每次构建打唯一标记，日志里没有这个标记就不认
 *   2. 重启前比对 .next 与源码的新旧，产物比源码旧就中止
 */

const script = fs.readFileSync(path.join(process.cwd(), '同步到服务器.ps1'), 'utf8');

describe('部署脚本不会把失败的构建当成成功', () => {
  it('确实读到了脚本（防止路径写错导致空过）', () => {
    expect(script.length).toBeGreaterThan(3000);
    expect(script).toContain('pm2 restart xiaosong-web');
  });

  it('每次构建打唯一标记', () => {
    expect(script, '没有给构建打时间戳标记').toMatch(/\$buildTag\s*=\s*"BUILD_"/);
    // 标记必须写进日志第一行
    expect(script).toMatch(/echo \$buildTag > \/tmp\/build\.log/);
  });

  it('轮询时校验标记，日志不是本次写的就中止', () => {
    expect(script).toMatch(/notmatch \[regex\]::Escape\(\$buildTag\)/);
    // 校验必须在"构建完成"判定之前，否则旧日志照样能蒙混过关
    const tagCheck = script.indexOf('notmatch [regex]::Escape($buildTag)');
    const doneCheck = script.indexOf('Route \\(app\\)');
    expect(tagCheck, '标记校验必须排在完成判定之前').toBeGreaterThan(0);
    expect(doneCheck).toBeGreaterThan(0);
    expect(tagCheck).toBeLessThan(doneCheck);
  });

  it('构建命令没启动就直接报错，不再把输出丢掉', () => {
    expect(script).toContain('BUILD_STARTED');
    // 旧写法是 `ssh ... $buildCmd | Out-Null`，返回值整个丢了
    expect(script, '构建启动的输出又被 Out-Null 丢掉了').not.toMatch(
      /ssh[^\n]*\$buildCmd[^\n]*Out-Null/
    );
    expect(script).toMatch(/\$startOut\s*-notmatch\s*"BUILD_STARTED"/);
  });

  it('重启前比对构建产物与源码的新旧', () => {
    expect(script, '缺少 .next 是否比源码旧的检查').toMatch(/-newer \.next\/BUILD_ID/);
    // 这道检查必须在 pm2 restart 之前
    const staleCheck = script.indexOf('-newer .next/BUILD_ID');
    const restart = script.indexOf('pm2 restart xiaosong-web');
    expect(staleCheck).toBeGreaterThan(0);
    expect(staleCheck, '新旧比对必须排在重启之前，否则拦不住').toBeLessThan(restart);
  });

  it('非交互环境仍然能跑（-Yes）', () => {
    expect(script).toMatch(/param\(\[switch\]\$Yes\)/);
  });
});
