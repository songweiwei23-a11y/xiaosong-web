"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { notify, confirmDialog } from '@/components/ui/feedback';

type Profile = {
  id: string;
  profile_name: string;
  account_name: string;
  platforms: string[];
  tracks: string[];
  account_stage: string;
  fans_level: string;
  positioning_statement: string;
  created_at: string;
};

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch("/api/profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles);
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog("确定要删除这个档案吗？", { tone: 'danger', confirmText: '删除', title: '确认删除' })) return;

    try {
      const response = await fetch(`/api/profiles?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setProfiles(profiles.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete profile:", error);
      notify("删除失败");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">📋</div>
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  我的档案
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">管理你的账号档案</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/profiles/new")}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                <Plus className="h-5 w-5" />
                创建新档案
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted rounded-lg transition-colors"
              >
                返回工作台
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-10">
        {profiles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">📝</div>
            <h3 className="text-2xl font-bold text-foreground mb-2">还没有档案</h3>
            <p className="text-muted-foreground mb-6">创建你的第一个账号档案，开始专业的编导工作</p>
            <button
              onClick={() => router.push("/profiles/new")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
            >
              <Plus className="h-5 w-5" />
              创建第一个档案
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-card rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border border-border"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-1">
                      {profile.profile_name}
                    </h3>
                    {profile.account_name && (
                      <p className="text-sm text-muted-foreground">@{profile.account_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/profiles/${profile.id}`)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {profile.positioning_statement && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {profile.positioning_statement}
                  </p>
                )}

                <div className="space-y-2">
                  {profile.platforms && profile.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {profile.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  )}

                  {profile.tracks && profile.tracks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {profile.tracks.map((track) => (
                        <span
                          key={track}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                        >
                          {track}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 text-xs text-muted-foreground pt-2">
                    {profile.account_stage && <span>• {profile.account_stage}</span>}
                    {profile.fans_level && <span>• {profile.fans_level}</span>}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => router.push(`/profiles/${profile.id}`)}
                    className="w-full py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    查看详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}