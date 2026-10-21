// 本文件由 scripts/gen-migration-registry.mjs 生成，请勿手改。新增或修改迁移后重新运行该脚本。
// 每个迁移建了哪些表、加了哪些列（体检 P0-2）。管理后台「迁移状态」页用它逐一探测哪些已经执行。

export interface MigrationEntry {
  /** 文件名，例如 20261017_learning_signals.sql */
  file: string;
  /** 建的表（CREATE TABLE） */
  tables: string[];
  /** 加的列（ALTER TABLE ... ADD COLUMN） */
  columns: { table: string; column: string }[];
}

export const MIGRATION_REGISTRY: MigrationEntry[] = [
  {
    file: "20240108_payment_orders.sql",
    tables: ["payment_orders"],
    columns: [],
  },
  {
    file: "20240108_payment_qrcodes.sql",
    tables: ["payment_qrcodes"],
    columns: [],
  },
  {
    file: "20240108_storage_buckets.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20240109_system_settings.sql",
    tables: ["system_settings"],
    columns: [],
  },
  {
    file: "20240109_user_quotas.sql",
    tables: ["user_quotas"],
    columns: [],
  },
  {
    file: "20260803192249_add_strategy_summary.sql",
    tables: [],
    columns: [{"table":"account_positioning","column":"strategy_summary"}],
  },
  {
    file: "20260804100500_create_scripts_table.sql",
    tables: ["scripts"],
    columns: [],
  },
  {
    file: "20260808230000_increment_quota_used.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20260809_create_subscriptions.sql",
    tables: ["subscriptions"],
    columns: [],
  },
  {
    file: "20260921_chat_conversations.sql",
    tables: ["chat_conversations"],
    columns: [],
  },
  {
    file: "20260921_dify_conversations.sql",
    tables: ["dify_conversations"],
    columns: [],
  },
  {
    file: "20260922_invitations.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20260922_invite_only_enforce.sql",
    tables: ["registration_authorizations"],
    columns: [],
  },
  {
    file: "20260922_payment.sql",
    tables: ["payment_orders","payment_qrcodes"],
    columns: [],
  },
  {
    file: "20260922_positioning_type.sql",
    tables: [],
    columns: [{"table":"account_positioning","column":"positioning_type"}],
  },
  {
    file: "20260922_positioning_type_brief.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20260922_rls_admin_tables.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20260922_rls_quotas.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20260922_rls_quotas_v2.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20260922_works.sql",
    tables: ["works"],
    columns: [{"table":"script_history","column":"work_id"}],
  },
  {
    file: "20260925_usage_events_todos.sql",
    tables: ["usage_events","user_todos"],
    columns: [],
  },
  {
    file: "20260926_usage_events_detail.sql",
    tables: [],
    columns: [{"table":"usage_events","column":"detail"}],
  },
  {
    file: "20260928_course_progress.sql",
    tables: ["course_progress"],
    columns: [],
  },
  {
    file: "20260928_funnel_events.sql",
    tables: ["funnel_events"],
    columns: [],
  },
  {
    file: "20260928_launch_plans.sql",
    tables: ["launch_plans"],
    columns: [],
  },
  {
    file: "20260928_public_trial_code.sql",
    tables: [],
    columns: [{"table":"invitation_codes","column":"max_uses"},{"table":"invitation_codes","column":"use_count"}],
  },
  {
    file: "20260929_interview_import.sql",
    tables: [],
    columns: [{"table":"user_profiles","column":"interview_notes"},{"table":"user_quotas","column":"interview_used"}],
  },
  {
    file: "20260929_interview_imports.sql",
    tables: ["interview_imports"],
    columns: [],
  },
  {
    file: "20260930_admin_monitor_realtime.sql",
    tables: ["admin_monitor_signal"],
    columns: [],
  },
  {
    file: "20260930_breakdown.sql",
    tables: [],
    columns: [{"table":"user_quotas","column":"breakdown_used"}],
  },
  {
    file: "20260930_deal_reasons_profile.sql",
    tables: [],
    columns: [{"table":"deal_reasons","column":"profile_id"}],
  },
  {
    file: "20260930_remix.sql",
    tables: [],
    columns: [{"table":"user_quotas","column":"remix_used"}],
  },
  {
    file: "20261001_web_search_quotas.sql",
    tables: ["web_search_periods","web_search_requests"],
    columns: [],
  },
  {
    file: "20261002_content_mix_and_taboos.sql",
    tables: [],
    columns: [{"table":"user_profiles","column":"content_mix"},{"table":"user_profiles","column":"taboo_settings"}],
  },
  {
    file: "20261002_direction.sql",
    tables: [],
    columns: [{"table":"user_quotas","column":"direction_used"}],
  },
  {
    file: "20261002_library_and_progress.sql",
    tables: ["material_library"],
    columns: [{"table":"works","column":"published_at"},{"table":"works","column":"shoot_status"},{"table":"works","column":"shot_at"}],
  },
  {
    file: "20261003_creation_quota_reservations.sql",
    tables: ["creation_requests"],
    columns: [{"table":"usage_events","column":"detail"}],
  },
  {
    file: "20261003_creation_sessions.sql",
    tables: ["creation_sessions"],
    columns: [{"table":"creation_sessions","column":"request_input"},{"table":"works","column":"creation_brief"}],
  },
  {
    file: "20261003_creator_presets.sql",
    tables: ["creator_presets"],
    columns: [],
  },
  {
    file: "20261003_library_assets.sql",
    tables: ["library_topic_index"],
    columns: [{"table":"material_library","column":"fields"},{"table":"material_library","column":"kind"}],
  },
  {
    file: "20261003_persona_facts.sql",
    tables: [],
    columns: [{"table":"user_profiles","column":"persona_facts"}],
  },
  {
    file: "20261003_quality_checks.sql",
    tables: ["quality_checks"],
    columns: [],
  },
  {
    file: "20261003_work_metrics.sql",
    tables: [],
    columns: [{"table":"works","column":"metrics"}],
  },
  {
    file: "20261004_creation_completion_evidence.sql",
    tables: ["creation_completion_evidence"],
    columns: [],
  },
  {
    file: "20261004_creator_preferences.sql",
    tables: ["creator_preferences"],
    columns: [],
  },
  {
    file: "20261004_deep_research.sql",
    tables: ["app_secrets","research_jobs","research_periods","research_requests","research_sources"],
    columns: [{"table":"research_jobs","column":"attachments"},{"table":"research_jobs","column":"canvas_versions"},{"table":"research_jobs","column":"client_request_id"},{"table":"research_jobs","column":"input_hash"},{"table":"research_jobs","column":"retry_count"},{"table":"research_jobs","column":"run_token"},{"table":"research_jobs","column":"summary_failed"},{"table":"research_sources","column":"collected_at"}],
  },
  {
    file: "20261004_legacy_view_permissions.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20261004_revoke_public_trial_code.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20261010_admin_approve_order.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20261010_positioning_type_advice.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20261010_result_feedback.sql",
    tables: ["result_feedback"],
    columns: [],
  },
  {
    file: "20261011_admin_search_users.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20261016_gate_tickets.sql",
    tables: ["gate_device_passes","gate_tickets","site_gate_settings"],
    columns: [],
  },
  {
    file: "20261017_benchmark.sql",
    tables: ["benchmark_accounts","benchmark_videos","hot_topics"],
    columns: [],
  },
  {
    file: "20261017_course_stars.sql",
    tables: ["course_stars"],
    columns: [],
  },
  {
    file: "20261017_gate_admin_login.sql",
    tables: [],
    columns: [{"table":"site_gate_settings","column":"admin_login"}],
  },
  {
    file: "20261017_learning_signals.sql",
    tables: ["user_signals"],
    columns: [{"table":"creator_preferences","column":"verified_signature"},{"table":"result_feedback","column":"control"},{"table":"result_feedback","column":"excerpt"},{"table":"result_feedback","column":"profile_id"}],
  },
  {
    file: "20261017_positioning_facts.sql",
    tables: [],
    columns: [{"table":"account_positioning","column":"profile_facts"}],
  },
  {
    file: "20261017_work_plan.sql",
    tables: [],
    columns: [{"table":"works","column":"material_note"},{"table":"works","column":"planned_at"}],
  },
  {
    file: "20261018_benchmark_analysis.sql",
    tables: ["benchmark_analyses"],
    columns: [],
  },
  {
    file: "20261018_gate_revoke_accounts.sql",
    tables: ["gate_user_blocks"],
    columns: [{"table":"gate_device_passes","column":"user_id"}],
  },
  {
    file: "20261020_count_packs.sql",
    tables: ["count_pack_ledger","count_pack_lots","count_pack_reservations"],
    columns: [],
  },
  {
    file: "20261021_account_materials.sql",
    tables: ["account_materials","account_work_insights"],
    columns: [],
  },
  {
    file: "20261022_assistant_memory.sql",
    tables: ["assistant_memories","assistant_messages","assistant_threads"],
    columns: [],
  },
  {
    file: "20261022_assistant_ops.sql",
    tables: ["assistant_feedback","assistant_jobs","assistant_notes"],
    columns: [],
  },
  {
    file: "20261022_ops_indexes.sql",
    tables: [],
    columns: [],
  },
  {
    file: "20261022_order_claims.sql",
    tables: [],
    columns: [{"table":"payment_orders","column":"claim_lease_until"},{"table":"payment_orders","column":"claimed_at"},{"table":"payment_orders","column":"claimed_by"}],
  },
  {
    file: "admin_logs.sql",
    tables: ["admin_logs"],
    columns: [],
  },
];
