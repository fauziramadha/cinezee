/**
 * Subtitle Watermark Helper v3
 *
 * Fix v2 bugs:
 * - Cue settings kompleks (align/position/line/size) tidak didukung konsisten
 *   oleh semua player (Safari iOS) → watermark overlap dengan subtitle asli
 *
 * v3 approach:
 * - Hapus cue settings, pakai posisi default player (bottom center)
 * - Watermark muncul di slot waktu yang TIDAK overlap dengan subtitle asli
 * - Pakai NOTE sebagai pembatas untuk clarity
 */

const WATERMARK_TEXT = "nonton streaming film terupdate hanya di cinestream.my.id";
const WATERMARK_INTERVAL_SEC = 300; // 5 menit

export function addWatermarkToVtt(vtt: string): string {
  if (!vtt || !vtt.trim()) return vtt;

  const lines = vtt.split(/\r?\n/);
  const result: string[] = [];

  // Header
  if (lines[0]?.trim() === "WEBVTT") {
    result.push(lines[0]);
    result.push("");
  } else {
    result.push("WEBVTT");
    result.push("");
  }

  // NOTE untuk branding (tidak ditampilkan player, tapi metadata)
  result.push("NOTE");
  result.push("Watermarked by CineStream - cinestream.my.id");
  result.push("");

  // Watermark di awal (0-1.5 detik) - pakai timing yang tidak overlap
  result.push("00:00:00.000 --> 00:00:01.500");
  result.push(WATERMARK_TEXT);
  result.push("");

  // Track absolute time untuk watermark berikutnya
  let nextWatermarkSec = WATERMARK_INTERVAL_SEC;
  let i = 1;

  while (i < lines.length) {
    const line = lines[i];

    if (line.includes("-->")) {
      const match = line.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
      if (match) {
        const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = match;
        const startSec = Number(h1) * 3600 + Number(m1) * 60 + Number(s1) + Number(ms1) / 1000;
        const endSec = Number(h2) * 3600 + Number(m2) * 60 + Number(s2) + Number(ms2) / 1000;

        // Insert watermark kalau ada slot sebelum cue ini
        while (startSec >= nextWatermarkSec + 0.6) {
          const wmStart = nextWatermarkSec;
          const wmEnd = nextWatermarkSec + 0.5;
          if (wmEnd <= startSec) {
            result.push(`${formatTime(wmStart)} --> ${formatTime(wmEnd)}`);
            result.push(WATERMARK_TEXT);
            result.push("");
          }
          nextWatermarkSec += WATERMARK_INTERVAL_SEC;
        }

        // Skip interval yang sudah lewat
        while (endSec >= nextWatermarkSec) {
          nextWatermarkSec += WATERMARK_INTERVAL_SEC;
        }
      }

      // Push timing line (normalize koma ke titik untuk VTT)
      result.push(line.replace(/,(\d{3})/g, ".$1"));
      i++;

      // Push cue content sampai blank line
      while (i < lines.length && lines[i].trim() !== "") {
        result.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        result.push("");
        i++;
      }
    } else if (line.trim() === "") {
      i++;
    } else {
      // Skip cue identifiers (SRT numbers) - VTT tidak butuh
      i++;
    }
  }

  return result.join("\n");
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
