// ─── Constantes (cliente) ────────────────────────────────────────────────────

export const CLOUD_NAME     = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   ?? "";
export const UPLOAD_PRESET  = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "directors_cut";
export const DEFAULT_TAG    = process.env.NEXT_PUBLIC_CLOUDINARY_TAG           ?? "pelicula";

// ─── Upload (cliente) ────────────────────────────────────────────────────────

export interface UploadResult {
  public_id:  string;
  secure_url: string;
  width:      number;
  height:     number;
}

/**
 * Sube un archivo directamente a Cloudinary desde el cliente.
 * Usa el upload preset sin firma configurado en "directors_cut".
 */
export async function uploadImage(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file",           file);
    formData.append("upload_preset",  UPLOAD_PRESET);
    formData.append("tags",           DEFAULT_TAG);
    formData.append("folder",         "directors_cut");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          public_id:  data.public_id,
          secure_url: data.secure_url,
          width:      data.width,
          height:     data.height,
        });
      } else {
        reject(new Error(`Cloudinary error ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Error de red al subir imagen")));
    xhr.send(formData);
  });
}

// ─── URLs optimizadas (cliente + servidor) ───────────────────────────────────

export function imageUrl(
  publicId: string,
  opts: { w?: number; h?: number; crop?: string } = {}
): string {
  const cloud = CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const transforms = ["f_webp", "q_auto"];
  if (opts.w)    transforms.push(`w_${opts.w}`);
  if (opts.h)    transforms.push(`h_${opts.h}`);
  if (opts.crop) transforms.push(`c_${opts.crop}`);
  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join(",")}/${publicId}`;
}
