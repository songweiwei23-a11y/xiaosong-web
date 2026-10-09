type Node = { type: string; value?: string; url?: string; children?: Node[]; position?: { start: { offset?: number }; end: { offset?: number } } };

/** GFM 裸链接不能吞掉中文括号及其后的叙述；显式 Markdown 链接保持原样。 */
export function remarkAutolinkBoundary() {
  return (tree: Node, file: { value: unknown }) => {
    const source = String(file.value);
    const walk = (parent: Node) => {
      if (!parent.children) return;
      parent.children = parent.children.flatMap(node => {
        walk(node);
        if (node.type !== 'link' || node.children?.length !== 1 || node.children[0].type !== 'text') return [node];
        const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
        if (!/^(?:https?:\/\/|www\.)/i.test(raw)) return [node];
        const label = node.children[0].value ?? '';
        const stop = label.search(/[，。；：！？、（）【】“”‘’《》]/u);
        if (stop < 0) return [node];
        const prefix = label.slice(0, stop);
        if (!prefix) return [node];
        const url = /^www\./i.test(prefix) ? `http://${prefix}` : prefix;
        return [{ ...node, url, children: [{ type: 'text', value: prefix }] }, { type: 'text', value: label.slice(stop) }];
      });
    };
    walk(tree);
  };
}
