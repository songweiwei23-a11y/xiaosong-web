-- 作品：把同一条内容的各个环节串起来
--
-- 背景：九个功能各自独立保存记录，系统并不知道「这条脚本」和「那条分镜」
-- 其实是同一条内容的两个环节。结果是用户只能看到一堆零散记录，
-- 想知道某条内容做到哪一步了，只能靠自己记。
--
-- 设计取舍：
-- 不另建 work_items 表，而是给已有的 script_history 加一个 work_id。
-- 理由是环节内容本来就存在 script_history 里，再建一张表就要做数据迁移，
-- 而且两处都存内容必然出现不一致。现在的做法下，历史记录照常独立可用，
-- 只是多了一个「属于哪个作品」的指向；work_id 为空就是零散记录，
-- 改造前已有的几百条记录不受影响。

CREATE TABLE IF NOT EXISTS works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 归属的账号档案。代运营时同一批作品要能按账号区分
  profile_id UUID,

  -- 作品名。通常取自选题标题或脚本主题，用户也可以改
  title TEXT NOT NULL DEFAULT '未命名作品',

  -- 用户手动标记为完成后不再出现在「进行中」里
  is_done BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 任一环节更新都会刷新它，列表按此排序，最近动过的排在前面
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_works_list
  ON works(user_id, is_done, updated_at DESC);

ALTER TABLE works ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own works" ON works;
CREATE POLICY "own works" ON works
  FOR ALL USING (auth.uid() = user_id);

-- 历史记录指向所属作品。作品被删时只断开关联、不删记录，
-- 因为那条脚本本身仍然有价值，用户可能只是不想再按作品组织它。
ALTER TABLE script_history
  ADD COLUMN IF NOT EXISTS work_id UUID REFERENCES works(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_script_history_work
  ON script_history(work_id);
