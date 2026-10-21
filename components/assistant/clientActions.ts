"use client";

import { getState, pause, setTimer, toggle, toggleSound } from "@/lib/ambient/engine";
import type { AmbientId } from "@/lib/ambient/synth";
import { parseClientAction } from "@/lib/assistant/client-action-spec";

/**
 * 在页面上替用户执行助理安排的动作（只执行白名单里的，参数不合法就忽略）。
 *   ambient.play：播放指定的声音（只放这一种，其它声音换掉），可以定时停
 *   ambient.stop：停止播放
 * 声音用的是开物自己的环境音引擎（和顶栏的播放器是同一个）。
 */
export async function runClientAction(raw: unknown): Promise<void> {
  const action = parseClientAction(raw);
  if (!action) return;

  if (action.name === "ambient.play") {
    const sound = action.args.sound as AmbientId;
    const st = getState();
    // 还没选的先加上（toggleSound 会顺便开始播放）；已经选着的，只保证它在放
    if (st.mix[sound] === undefined) await toggleSound(sound);
    else if (!st.playing) toggle();
    // 其它声音换掉，只留这一种（被去掉的最后一种会自动停）
    for (const id of Object.keys(getState().mix) as AmbientId[]) {
      if (id !== sound) await toggleSound(id);
    }
    const minutes = action.args.minutes;
    if (typeof minutes === "number") setTimer(minutes);
    return;
  }

  if (action.name === "ambient.stop") pause();

  // page.open 不在这里做：面板要等回答结束后再跳转，否则跳转会打断正在进行的对话（见 AssistantWidget）
}
