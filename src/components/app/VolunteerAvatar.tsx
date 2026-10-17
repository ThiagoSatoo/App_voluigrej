import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-2xl",
  xl: "h-28 w-28 text-3xl",
};

const palettes = [
  "bg-primary-soft text-primary",
  "bg-accent-soft text-accent-foreground",
  "bg-success-soft text-success",
  "bg-destructive-soft text-destructive",
  "bg-secondary text-secondary-foreground",
];

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

/**
 * Reusable photo/avatar. Photo is optional; falls back to elegant initials.
 * `photoUrl` can later point to any storage provider.
 */
export function VolunteerAvatar({
  name,
  photoUrl,
  size = "sm",
  className,
}: {
  name: string;
  photoUrl?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full ring-2 ring-card", sizes[size], className)}>
      {photoUrl && !broken ? (
        <img src={photoUrl} alt={name} className="h-full w-full object-cover" onError={() => setBroken(true)} loading="lazy" />
      ) : (
        <div className={cn("grid h-full w-full place-items-center font-display font-semibold", palettes[hash % palettes.length])}>{initials(name)}</div>
      )}
    </div>
  );
}

/**
 * Abre a câmera/galeria e devolve a foto reduzida (máx. 512 px, JPEG).
 * Redesenhar no canvas também remove metadados como a localização GPS.
 */
export function PhotoPicker({ onPick, children }: { onPick: (photo: Blob, previewUrl: string) => void; children: (open: () => void) => React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
            toast.error("Escolha uma imagem JPG, PNG ou WEBP.");
            return;
          }
          if (f.size > 15 * 1024 * 1024) {
            toast.error("Imagem muito grande (máx. 15 MB).");
            return;
          }
          const url = URL.createObjectURL(f);
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            const s = Math.min(1, 512 / Math.max(img.width, img.height));
            c.width = Math.round(img.width * s);
            c.height = Math.round(img.height * s);
            c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob((blob) => blob && onPick(blob, c.toDataURL("image/jpeg", 0.85)), "image/jpeg", 0.85);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            toast.error("Não foi possível ler esta imagem.");
          };
          img.src = url;
        }}
      />
      {children(() => ref.current?.click())}
    </>
  );
}

export function PersonRow({ name, photoUrl, sub, right }: { name: string; photoUrl?: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <VolunteerAvatar name={name} photoUrl={photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export { Camera as CameraIcon };
