"use client";

import { useEffect, useState } from "react";
import { sortTodos, type Todo } from "@/lib/todos";

/**
 * 首页待办的数据和操作。样式归组件，这里只管增删改和失败回退。
 * 所有操作先改界面再发请求，失败了再退回去——点一下要等一秒的勾选框很烦人。
 */
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  /** 表还没建（迁移没跑） */
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/todos")
      .then(async (r) => {
        if (r.status === 503) {
          setUnavailable(true);
          return;
        }
        if (r.ok) {
          const list = await r.json();
          if (Array.isArray(list)) setTodos(list);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const flash = (msg: string) => {
    setError(msg);
    window.setTimeout(() => setError(""), 3000);
  };

  /** 成功返回 true，调用方据此清空输入框 */
  const add = async (content: string, dueAt: string | null): Promise<boolean> => {
    const text = content.trim();
    if (!text) return false;
    try {
      const r = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, dueAt }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 503) setUnavailable(true);
        flash(d.error || "没存上，再试一次");
        return false;
      }
      setTodos((list) => [d, ...list]);
      return true;
    } catch {
      flash("网络不太好，没存上");
      return false;
    }
  };

  const toggle = async (todo: Todo) => {
    const next = !todo.done;
    const doneAt = next ? new Date().toISOString() : null;
    setTodos((list) => list.map((t) => (t.id === todo.id ? { ...t, done: next, done_at: doneAt } : t)));
    const r = await fetch(`/api/todos?id=${encodeURIComponent(todo.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    }).catch(() => null);
    if (!r?.ok) {
      setTodos((list) => list.map((t) => (t.id === todo.id ? todo : t)));
      flash("没改成功，再点一次");
    }
  };

  const remove = async (todo: Todo) => {
    setTodos((list) => list.filter((t) => t.id !== todo.id));
    const r = await fetch(`/api/todos?id=${encodeURIComponent(todo.id)}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      setTodos((list) => sortTodos([...list, todo]));
      flash("没删掉，再试一次");
    }
  };

  const sorted = sortTodos(todos);
  return {
    loading,
    unavailable,
    error,
    open: sorted.filter((t) => !t.done),
    done: sorted.filter((t) => t.done),
    add,
    toggle,
    remove,
  };
}
