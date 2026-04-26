import { useRef, useState } from "react";
import { Map, Upload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  propertyId: string;
  propertyName: string;
  mapUrl: string | null | undefined;
}

export default function PropertyMapButton({ propertyId, propertyName, mapUrl }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${propertyId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("property-maps")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("property-maps").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("properties")
        .update({ map_image_url: data.publicUrl })
        .eq("id", propertyId);
      if (dbErr) throw dbErr;
      toast.success("Karta uppladdad");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (err: any) {
      toast.error(err.message || "Kunde inte ladda upp karta");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    const { error } = await supabase
      .from("properties")
      .update({ map_image_url: null })
      .eq("id", propertyId);
    if (error) {
      toast.error("Kunde inte ta bort karta");
      return;
    }
    toast.success("Karta borttagen");
    queryClient.invalidateQueries({ queryKey: ["properties"] });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-primary"
        onClick={handleClick}
        title="Visa karta"
      >
        <Map className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Karta – {propertyName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {mapUrl ? (
              <img
                src={mapUrl}
                alt={`Karta för ${propertyName}`}
                className="w-full h-auto rounded-lg border border-border"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Ingen karta uppladdad ännu. Ladda upp en bild eller PDF-sida av kartan från din skogsbruksplan.
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {mapUrl ? "Byt karta" : "Ladda upp karta"}
              </Button>
              {mapUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Ta bort
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
