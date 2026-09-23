import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseTime, minutesAgo, maskEmail, onlineUsers, isToday,
  pulseByMinute, featureBreakdown, buildEvents, newEventsSince,
  soundFor, relativeTime, effectiveRevenue, ONLINE_WINDOW_MIN, rememberSeen, SEEN_CAP,
} from '@/lib/monitor';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * 监控大屏。
 *
 * 大屏上每个数字都会被问「这是怎么算的」，所以算法全在纯函数里；
 * 而「响不响铃」这件事错一次的代价最大——该响的不响，等于白做；
 * 每轮都重响，管理员两分钟就把声音关了，也等于白做。
 */

const T = (min: number, now = Date.now()) => new Date(now - min * 60_000).toISOString();

describe('时间解析要吃得下真实数据', () => {
  it('Postgres 的 5 位微秒不能让它崩', () => {
    // 线上实测存在这种格式，探测脚本里的 Python 当场抛了 Invalid isoformat
    expect(parseTime('2026-09-22T13:28:36.92906+00:00')).not.toBeNull();
    expect(parseTime('2026-09-23T02:06:19.243287+00:00')).not.toBeNull();
  });

  it('脏数据一律返回 null，不抛异常', () => {
    for (const v of [null, undefined, '', '   ', '不是日期', 42, {}]) {
      expect(parseTime(v)).toBeNull();
    }
  });

  it('未来时间不会算出负数分钟', () => {
    const now = Date.now();
    expect(minutesAgo(new Date(now + 60_000).toISOString(), now)).toBe(0);
  });
});

describe('邮箱脱敏', () => {
  it('大屏可能被投屏或截图，不显示完整邮箱', () => {
    expect(maskEmail('songweiwei@example.com')).toBe('so****@example.com');
    expect(maskEmail('ab@qq.com')).toBe('ab*@qq.com');
  });

  it('拿不到邮箱时显示匿名用户', () => {
    for (const v of [null, undefined, '', 'not-an-email', 123]) {
      expect(maskEmail(v)).toBe('匿名用户');
    }
  });
});

describe('最近活跃用户', () => {
  const now = Date.now();

  it('只算窗口内登录过的，按最近排前面', () => {
    const list = onlineUsers(
      [
        { email: 'aaa@x.com', last_sign_in_at: T(10, now) },
        { email: 'bbb@x.com', last_sign_in_at: T(2, now) },
        { email: 'ccc@x.com', last_sign_in_at: T(ONLINE_WINDOW_MIN + 5, now) },
        { email: 'ddd@x.com', last_sign_in_at: null },
      ],
      now
    );
    expect(list.map((u) => u.minutesAgo)).toEqual([2, 10]);
    expect(list[0].name).toContain('@x.com');
  });

  it('空输入不炸', () => {
    expect(onlineUsers([], now)).toEqual([]);
    expect(onlineUsers(undefined as never, now)).toEqual([]);
  });
});

describe('活跃脉搏按分钟分桶', () => {
  const now = Date.now();

  it('固定 60 个桶，从旧到新', () => {
    const p = pulseByMinute([{ created_at: T(0, now) }, { created_at: T(0, now) }], now);
    expect(p.length).toBe(60);
    expect(p[59]).toBe(2); // 最后一个桶是"此刻"
  });

  it('没数据的分钟补 0，不能把时间轴压缩', () => {
    // 不补 0 的话，折线会因为跳过空分钟而看起来一直很忙
    const p = pulseByMinute([{ created_at: T(30, now) }], now);
    expect(p.filter((x) => x === 0).length).toBe(59);
    expect(p[29]).toBe(1);
  });

  it('超出一小时的不计入', () => {
    expect(pulseByMinute([{ created_at: T(90, now) }], now).every((x) => x === 0)).toBe(true);
  });
});

describe('今日功能用量', () => {
  it('只统计今天的，按次数从多到少', () => {
    const now = Date.now();
    const rows = [
      { task_type: '选题策划', created_at: T(1, now) },
      { task_type: '选题策划', created_at: T(2, now) },
      { task_type: '脚本生成', created_at: T(3, now) },
      { task_type: '脚本生成', created_at: new Date(now - 3 * 864e5).toISOString() }, // 三天前
    ];
    const out = featureBreakdown(rows, now);
    expect(out[0]).toEqual({ name: '选题策划', count: 2 });
    expect(out.find((x) => x.name === '脚本生成')?.count).toBe(1);
  });
});

describe('今日入账只算已通过的单', () => {
  it('pending / reviewing 不算进收入', () => {
    // 那是意向不是钱。看板写着进账了、卡里没有，比不显示更糟
    expect(
      effectiveRevenue([
        { amount: 49, status: 'approved' },
        { amount: 99, status: 'reviewing' },
        { amount: 199, status: 'pending' },
        { amount: 49, status: 'rejected' },
      ])
    ).toBe(49);
  });

  it('金额是脏数据时当 0，不产生 NaN', () => {
    expect(
      effectiveRevenue([{ amount: null, status: 'approved' }, { amount: 49, status: 'approved' }])
    ).toBe(49);
  });
});

describe('事件流', () => {
  const now = Date.now();

  it('三类信号都能变成事件，按时间倒序', () => {
    const events = buildEvents({
      generations: [{ id: 'g1', task_type: '脚本生成', created_at: T(5, now) }],
      users: [{ id: 'u1', email: 'new@x.com', created_at: T(2, now) }],
      orders: [{ id: 'o1', plan_id: 'basic', amount: 49, created_at: T(1, now) }],
      now,
    });
    expect(events.map((e) => e.type)).toEqual(['order', 'signup', 'usage']);
    expect(events[0].level).toBe('urgent');
  });

  it('上传凭证单独算一条——这条才是真要立刻处理的', () => {
    const events = buildEvents({
      orders: [{ id: 'o1', plan_id: 'pro', amount: 99, created_at: T(30, now), proof_uploaded_at: T(1, now) }],
      now,
    });
    expect(events.map((e) => e.type)).toEqual(['order_proof', 'order']);
    expect(events[0].level).toBe('urgent');
  });

  it('id 必须稳定：同一条数据每次算出来都一样', () => {
    const input = { generations: [{ id: 'g1', task_type: 'x', created_at: T(1, now) }], now };
    expect(buildEvents(input)[0].id).toBe(buildEvents(input)[0].id);
    expect(buildEvents(input)[0].id).toBe('usage:g1');
  });

  it('挡住时钟偏差造成的未来事件', () => {
    const future = new Date(now + 10 * 60_000).toISOString();
    expect(buildEvents({ generations: [{ id: 'g', created_at: future }], now })).toEqual([]);
  });

  it('时间是脏数据的记录直接跳过', () => {
    expect(buildEvents({ generations: [{ id: 'g', created_at: '坏数据' }], now })).toEqual([]);
  });
});

describe('响铃判定——错一次要么不响要么连珠炮', () => {
  const now = Date.now();
  const evts = buildEvents({
    generations: [
      { id: 'g1', task_type: 'a', created_at: T(1, now) },
      { id: 'g2', task_type: 'b', created_at: T(10, now) },
    ],
    now,
  });

  it('首次加载不响历史事件', () => {
    // 一进页面会拿到几十条历史，逐条响会炸出一串噪音
    expect(newEventsSince(evts, new Set(), true)).toEqual([]);
  });

  it('见过的 id 不再响', () => {
    const seen = new Set(evts.map((e) => e.id));
    expect(newEventsSince(evts, seen, false)).toEqual([]);
  });

  it('没见过的都要响，哪怕事件时间比上次轮询早', () => {
    /*
     * 这条是实测逼出来的。第一版还拿事件时间和"上次轮询的服务器时间"比，
     * 结果一次都不响：记录写入和被查到之间有时差，
     * 事件的 created_at 常常早于上一次轮询的 now，于是被当成旧事件吞掉。
     * 现在只认 id。
     */
    const old = buildEvents({
      generations: [{ id: 'gOld', task_type: 'x', created_at: T(59, now) }],
      now,
    });
    expect(newEventsSince(old, new Set(), false).map((e) => e.id)).toEqual(['usage:gOld']);
  });

  it('只挑没见过的那几条', () => {
    const fresh = newEventsSince(evts, new Set(['usage:g2']), false);
    expect(fresh.map((e) => e.id)).toEqual(['usage:g1']);
  });
});

describe('已见集合不会无限长大', () => {
  it('超过上限后只保留当前这批', () => {
    // 大屏会连着开几天，不设上限就是个慢速内存泄漏
    const big = new Set(Array.from({ length: SEEN_CAP + 10 }, (_, i) => `old:${i}`));
    const events = buildEvents({
      generations: [{ id: 'n1', created_at: new Date().toISOString() }],
    });
    const out = rememberSeen(big, events);
    expect(out.size).toBe(events.length);
    expect(out.has('usage:n1')).toBe(true);
  });

  it('没超上限时正常累加', () => {
    const seen = new Set(['a']);
    const events = buildEvents({
      generations: [{ id: 'n1', created_at: new Date().toISOString() }],
    });
    const out = rememberSeen(seen, events);
    expect(out.has('a')).toBe(true);
    expect(out.has('usage:n1')).toBe(true);
  });
});

describe('提示音分级', () => {
  it('充值类最响，和其他明显不同', () => {
    expect(soundFor('order')).toBe('alert');
    expect(soundFor('order_proof')).toBe('alert');
    expect(soundFor('signup')).toBe('chime');
    expect(soundFor('usage')).toBe('ping');
  });
});

describe('相对时间', () => {
  it('分钟/小时/天都说得清', () => {
    const now = Date.now();
    expect(relativeTime(T(0, now), now)).toBe('刚刚');
    expect(relativeTime(T(5, now), now)).toBe('5 分钟前');
    expect(relativeTime(T(120, now), now)).toBe('2 小时前');
    expect(relativeTime(T(60 * 24 * 3, now), now)).toBe('3 天前');
    expect(relativeTime(null, now)).toBe('');
  });
});

describe('页面本身的几条硬要求', () => {
  const page = read('app/admin/monitor/page.tsx');

  it('声音必须由用户手势解锁，否则永远静默失败', () => {
    // 浏览器不允许无手势自动播放，而且是不报错的那种失败
    expect(page).toContain('点击开启声音');
    expect(page).toMatch(/ctx\.state === "suspended"/);
    expect(page).toContain('ctx.resume()');
  });

  it('首次加载只记不响', () => {
    expect(page).toContain('firstLoadRef');
  });

  it('一轮多条时只响最要紧的一条', () => {
    expect(page).toMatch(/fresh\.find\(\(e\) => e\.level === "urgent"\)/);
  });

  it('拉不到数据要明确显示断连，不能显示一片 0', () => {
    expect(page).toContain('拉不到数据');
    expect(read('app/api/admin/monitor/route.ts')).toContain('监控数据读取失败');
  });

  it('接口要管理员权限', () => {
    expect(read('app/api/admin/monitor/route.ts')).toContain('requireAdmin');
  });

  it('后台导航里有入口', () => {
    expect(read('app/admin/layout.tsx')).toContain('/admin/monitor');
  });
});
