/** 给视觉模型传压缩副本，原始图片仍独立保存供历史下载。 */
export async function prepareVisionImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('图片处理失败，请重新导出图片');
    for (let attempt = 0; attempt < 8; attempt++) {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', Math.max(.45, .85 - attempt * .06)));
      if (blob && blob.size <= 350 * 1024) return blob;
      canvas.width = Math.max(1, Math.round(canvas.width * .8));
      canvas.height = Math.max(1, Math.round(canvas.height * .8));
    }
    throw new Error('图片过于复杂，请缩小图片后重试');
  } finally { bitmap.close(); }
}
