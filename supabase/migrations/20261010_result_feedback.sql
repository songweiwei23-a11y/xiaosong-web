-- 结果反馈：每条生成结果下面的「有用 / 没用」，没用时可选原因。
-- 只有服务端（service_role）读写，浏览器不直接访问，所以不建任何 RLS 策略。
-- 用户注销时由 lib/admin-delete-user 按 user_id 删除，外键也是级联删除。

CREATE TABLE IF NOT EXISTS result_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board text NOT NULL,
  rating smallint NOT NULL CHECK (rating IN (-1, 1)),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_result_feedback_board_created
  ON result_feedback (board, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_result_feedback_user
  ON result_feedback (user_id);

ALTER TABLE result_feedback ENABLE ROW LEVEL SECURITY;

SELECT count(*) AS 已有反馈条数 FROM result_feedback;
