"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { notify } from '@/components/ui/feedback';

export default function NewProfilePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    // 基础信息
    profile_name: "",
    account_name: "",
    platforms: [] as string[],
    tracks: [] as string[],
    account_stage: "",
    fans_level: "",
    update_frequency: "",
    
    // 内容定位
    target_audience: {},
    pain_points: [] as string[],
    emotional_triggers: [] as string[],
    content_value: [] as string[],
    positioning_statement: "",
    
    // 创作风格
    visual_style: "",
    editing_rhythm: "",
    narrative_structure: [] as string[],
    persona_traits: [] as string[],
    tone_of_voice: "",
    
    // 商业模式
    monetization_methods: [] as string[],
    product_types: [] as string[],
    price_range: "",
    conversion_goal: "",
    sales_script_style: "",
    
    // 创作偏好
    preferred_topic_types: [] as string[],
    hot_elements: [] as string[],
    content_themes: [] as string[],
    forbidden_topics: [] as string[],
    creative_constraints: "",
    
    // 参考对标
    benchmark_accounts: [] as any[],
    differentiation: "",
    unique_selling_point: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/profiles");
      } else {
        notify("保存失败");
      }
    } catch (error) {
      console.error("Save error:", error);
      notify("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const toggleArrayItem = (field: string, item: string) => {
    const current = (formData as any)[field] as string[];
    if (current.includes(item)) {
      updateField(field, current.filter(i => i !== item));
    } else {
      updateField(field, [...current, item]);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">📝 基础信息</h2>
      
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          档案名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.profile_name}
          onChange={(e) => updateField("profile_name", e.target.value)}
          placeholder="例如：美食账号-小红书"
          className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">账号名称</label>
        <input
          type="text"
          value={formData.account_name}
          onChange={(e) => updateField("account_name", e.target.value)}
          placeholder="例如：美食日记"
          className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">平台</label>
        <div className="flex flex-wrap gap-2">
          {["抖音", "快手", "小红书", "视频号", "B站", "西瓜视频"].map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => toggleArrayItem("platforms", platform)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.platforms.includes(platform)
                  ? "bg-purple-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">领域赛道</label>
        <div className="flex flex-wrap gap-2">
          {["美食", "旅游", "情感", "知识干货", "剧情", "美妆", "母婴", "搞笑", "运动健身", "职场"].map((track) => (
            <button
              key={track}
              type="button"
              onClick={() => toggleArrayItem("tracks", track)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.tracks.includes(track)
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              {track}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">账号阶段</label>
          <select
            value={formData.account_stage}
            onChange={(e) => updateField("account_stage", e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">请选择</option>
            <option value="起号期">起号期</option>
            <option value="成长期">成长期</option>
            <option value="成熟期">成熟期</option>
            <option value="瓶颈期">瓶颈期</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">粉丝量级</label>
          <select
            value={formData.fans_level}
            onChange={(e) => updateField("fans_level", e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">请选择</option>
            <option value="0-1k">0-1k</option>
            <option value="1k-1w">1k-1w</option>
            <option value="1w-10w">1w-10w</option>
            <option value="10w-50w">10w-50w</option>
            <option value="50w+">50w+</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">更新频率</label>
        <select
          value={formData.update_frequency}
          onChange={(e) => updateField("update_frequency", e.target.value)}
          className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">请选择</option>
          <option value="日更">日更</option>
          <option value="周更3-5次">周更3-5次</option>
          <option value="周更1-2次">周更1-2次</option>
          <option value="不定期">不定期</option>
        </select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">🎯 内容定位</h2>
      
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">定位宣言</label>
        <textarea
          value={formData.positioning_statement}
          onChange={(e) => updateField("positioning_statement", e.target.value)}
          placeholder="一句话说清楚你做什么，例如：专注小白友好的编导知识分享"
          rows={3}
          className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">目标人群痛点</label>
        <input
          type="text"
          placeholder="输入痛点后按回车添加，例如：不知道拍什么"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value) {
              e.preventDefault();
              toggleArrayItem("pain_points", e.currentTarget.value);
              e.currentTarget.value = "";
            }
          }}
          className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
        />
        <div className="flex flex-wrap gap-2">
          {formData.pain_points.map((point, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2"
            >
              {point}
              <button
                type="button"
                onClick={() => updateField("pain_points", formData.pain_points.filter((_, i) => i !== idx))}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">情绪共鸣点</label>
        <div className="flex flex-wrap gap-2">
          {["焦虑", "治愈", "共鸣", "好奇", "惊喜", "愤怒", "感动", "搞笑"].map((emotion) => (
            <button
              key={emotion}
              type="button"
              onClick={() => toggleArrayItem("emotional_triggers", emotion)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.emotional_triggers.includes(emotion)
                  ? "bg-purple-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              {emotion}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">内容价值</label>
        <div className="flex flex-wrap gap-2">
          {["娱乐消遣", "知识干货", "情感共鸣", "工具实用"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleArrayItem("content_value", value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.content_value.includes(value)
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">🎨 创作风格</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">视觉风格</label>
          <select
            value={formData.visual_style}
            onChange={(e) => updateField("visual_style", e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">请选择</option>
            <option value="清新简约">清新简约</option>
            <option value="高级质感">高级质感</option>
            <option value="接地气">接地气</option>
            <option value="炫酷科技">炫酷科技</option>
            <option value="温馨治愈">温馨治愈</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">剪辑节奏</label>
          <select
            value={formData.editing_rhythm}
            onChange={(e) => updateField("editing_rhythm", e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">请选择</option>
            <option value="快节奏">快节奏</option>
            <option value="中节奏">中节奏</option>
            <option value="慢节奏">慢节奏</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">叙事结构</label>
        <div className="flex flex-wrap gap-2">
          {["故事型", "知识型", "剧情型", "Vlog", "访谈型", "混合型"].map((structure) => (
            <button
              key={structure}
              type="button"
              onClick={() => toggleArrayItem("narrative_structure", structure)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.narrative_structure.includes(structure)
                  ? "bg-purple-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              {structure}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">人设特点</label>
        <div className="flex flex-wrap gap-2">
          {["专业", "搞笑", "温暖", "犀利", "真实", "高冷", "亲和"].map((trait) => (
            <button
              key={trait}
              type="button"
              onClick={() => toggleArrayItem("persona_traits", trait)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.persona_traits.includes(trait)
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              {trait}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">语言风格</label>
        <select
          value={formData.tone_of_voice}
          onChange={(e) => updateField("tone_of_voice", e.target.value)}
          className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">请选择</option>
          <option value="幽默风趣">幽默风趣</option>
          <option value="专业严谨">专业严谨</option>
          <option value="接地气">接地气</option>
          <option value="高级感">高级感</option>
          <option value="温柔治愈">温柔治愈</option>
        </select>
      </div>
    </div>
  );

  const steps = [
    { number: 1, title: "基础信息", render: renderStep1 },
    { number: 2, title: "内容定位", render: renderStep2 },
    { number: 3, title: "创作风格", render: renderStep3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  创建新档案
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  步骤 {currentStep} / {steps.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-10 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                    currentStep >= step.number
                      ? "bg-purple-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.number}
                </div>
                <span className={`ml-2 font-medium ${
                  currentStep >= step.number ? "text-purple-600" : "text-muted-foreground"
                }`}>
                  {step.title}
                </span>
                {idx < steps.length - 1 && (
                  <div className={`w-20 h-1 mx-4 ${
                    currentStep > step.number ? "bg-purple-600" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-card rounded-2xl shadow-lg p-8 mb-6">
            {steps[currentStep - 1].render()}
          </div>

          <div className="flex justify-between">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-muted transition-colors font-semibold"
              >
                上一步
              </button>
            )}
            
            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="ml-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                下一步
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving || !formData.profile_name}
                className="ml-auto flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    保存档案
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}