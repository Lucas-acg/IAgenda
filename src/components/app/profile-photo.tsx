import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { PHOTO_BUCKET, validProfilePhoto } from "@/lib/profile-photo";
import { useAuth } from "./auth-provider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProfileAvatar({ className }: { className?: string }) {
  const { data, ready } = useStore();
  const { user } = useAuth();
  const path = data.profile.avatarPath;
  const { data: url } = useQuery({
    queryKey: ["profile-photo", user?.id, path],
    enabled: ready && !!user && !!path && path.startsWith(`${user.id}/`),
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
    queryFn: async () => {
      const { data: photo, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return photo.signedUrl;
    },
  });
  const initials = (data.profile.name || "Você")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Avatar className={cn("size-10 shrink-0", className)}>
      <AvatarImage src={url} alt="Foto de perfil" className="object-cover" />
      <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
        {ready ? initials : ""}
      </AvatarFallback>
    </Avatar>
  );
}

export function ProfilePhotoControl() {
  const { data, ready, setData, flush } = useStore();
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const change = async (file: File | null) => {
    if (!user || !ready) return;
    if (file && !validProfilePhoto(file)) {
      toast.error("Escolha uma foto JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    setBusy(true);
    const oldPath = data.profile.avatarPath;
    let path = "";
    try {
      if (file) {
        path = `${user.id}/${crypto.randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"}`;
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, file, { contentType: file.type });
        if (error) throw error;
      }
      setData((d) => ({ ...d, profile: { ...d.profile, avatarPath: path } }));
      await flush();
      if (oldPath && oldPath.startsWith(`${user.id}/`))
        await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
      toast.success(file ? "Foto de perfil salva" : "Foto removida");
    } catch {
      toast.error("Não foi possível salvar a foto. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ProfileAvatar className="size-16" />
      <Button
        type="button"
        variant="outline"
        disabled={busy || !ready}
        className="h-11 rounded-xl"
        onClick={() => input.current?.click()}
      >
        <Camera className="size-4" />
        {busy ? "Salvando…" : "Alterar foto"}
      </Button>
      {data.profile.avatarPath && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          size="icon"
          className="size-11"
          aria-label="Remover foto"
          onClick={() => void change(null)}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
      <input
        ref={input}
        type="file"
        aria-label="Foto de perfil"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void change(file);
        }}
      />
    </div>
  );
}
