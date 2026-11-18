import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const windows = readFileSync('同步到服务器.ps1', 'utf8');
const linux = readFileSync('scripts/deploy-kaiwu-release.sh', 'utf8');

describe('部署与回滚的保护条件', () => {
  it('记录源码工作区、给每次打包唯一编号，并支持非交互式调用', () => {
    expect(windows).toMatch(/param\(\[switch\]\$Yes\)/);
    expect(windows).toContain('git rev-parse HEAD');
    expect(windows).toContain('yyyyMMddHHmmssfff');
    expect(windows).toMatch(/\$payload\s*=\s*@\([\s\S]*?"instrumentation\.ts"/);
    expect(windows).toContain('Get-FileHash -LiteralPath $archiveLocal -Algorithm SHA256');
  });

  it('核对归档，单独构建，拒绝旧产物，然后才触及在运行的版本', () => {
    expect(linux).toContain('flock -n 9');
    expect(linux).toContain('pm_cwd');
    const main = linux.slice(linux.indexOf('main()'));
    expect(main).toMatch(/sha256sum --check[\s\S]*tar -xzf "\$archive" -C "\$stage"[\s\S]*cd "\$stage"[\s\S]*npm ci[\s\S]*npm run build[\s\S]*-newer \.next\/BUILD_ID[\s\S]*activate_release/);
  });

  it('运行版本必须通过本机和外网检查，失败回到上一个已确认的构建', () => {
    expect(linux).toContain('https://biandao.icu');
    expect(linux).toContain('trap rollback EXIT');
    expect(linux).toContain('api/generation-tasks?taskType=release-probe');
    expect(linux).toMatch(/wait_for_release "\$local_origin" "\$expected_build" "\$tag"[\s\S]*wait_for_release "\$public_origin" "\$expected_build" "\$tag"[\s\S]*RELEASE_VERIFIED/);
    expect(linux).toMatch(/moved_old\[@\][\s\S]*wait_for_release "\$local_origin" "\$previous_build"[\s\S]*ROLLBACK_VERIFIED/);
    expect(readFileSync('app/api/build-id/route.ts', 'utf8')).toContain('release: process.env.NEXT_PUBLIC_APP_BUILD');
  });
});
