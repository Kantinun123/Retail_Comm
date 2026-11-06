/* =============================================================
   ย่อรูปก่อนเก็บเป็น base64 (ลด quota ใน localStorage)
   - ย่อให้ด้านยาวสุดไม่เกิน maxDim พิกเซล
   - ส่งออกเป็น JPEG data URL
   ============================================================= */

const MAX_DIM = 320;
const QUALITY = 0.82;
/** จำกัดไฟล์ต้นทางไม่ให้ใหญ่เกินไป (8MB) */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export async function fileToResizedDataUrl(
  file: File,
  maxDim = MAX_DIM
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("ไฟล์ที่เลือกไม่ใช่รูปภาพ");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("ไฟล์รูปใหญ่เกินไป (จำกัด 8MB)");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถประมวลผลรูปได้");
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", QUALITY);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
    img.src = src;
  });
}

/** ย่อรูปแล้วคืนเป็น JPEG Blob (สำหรับอัปโหลดขึ้น Storage)
 *  - ด้านยาวสุดไม่เกิน maxDim พิกเซล ; ไม่ขยายรูปที่เล็กกว่าอยู่แล้ว
 *  - เบราว์เซอร์สมัยใหม่หมุนรูปตาม EXIF ให้เองตอนวาดลง canvas */
export async function fileToResizedBlob(
  file: File,
  maxDim = 1600,
  quality = 0.85
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("ไฟล์ที่เลือกไม่ใช่รูปภาพ");
  }
  // รูปจากกล้องมือถือใหญ่ได้ถึงหลาย MB ; จำกัดไฟล์ต้นทางที่ 25MB กันเครื่องค้าง
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("ไฟล์รูปใหญ่เกินไป (จำกัด 25MB)");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถประมวลผลรูปได้");
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("แปลงรูปไม่สำเร็จ"))),
      "image/jpeg",
      quality
    );
  });
}
