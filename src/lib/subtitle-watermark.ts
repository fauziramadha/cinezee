/**
 * Subtitle Watermark Helper v2
 *
 * Fix v1 bugs:
 * - Cue ID format tidak konsisten → pakai NOTE sebagai pembatas, bukan cue ID
 * - Watermark 5 menit tidak muncul → pakai absolute time tracking
 * - Teks bocor antar cue → pakai cue terpisah dengan timing yang tidak overlap
 */

const WATERMARK_TEXT = "nonton streaming film terupdate hanya di cinestream.my.id";
const WATERMARK_INTERVAL_SEC = 300; // 5 menit

/**
 * Tambah watermark ke VTT subtitle.
 */
export function addWatermarkToVtt(vtt: string): string {
  if (!vtt || !vtt.trim()) return vtt;

  const lines = vtt.split(/\r?\n/);
  const result: string[] = [];

  // Pastikan header WEBVTT ada
  if (lines[0]?.trim() === "WEBVTT") {
    result.push(lines[0]);
    result.push("");
  } else {
    result.push("WEBVTT");
    result.push("");
  }

  // Watermark di awal (0-1.5 detik)
  result.push("00:00:00.000 --> 00:00:01.500");
  result.push("align:center position:50%,90% line:90% size:60%");
  result.push(WATERMARK_TEXT);
  result.push("");

  // Track absolute time untuk watermark berikutnya
  let nextWatermarkSec = WATERMARK_INTERVAL_SEC; // 5 menit
  let i = 1; // skip WEBVTT header

  while (i < lines.length) {
    const line = lines[i];

    // Skip cue identifiers (lines before --> that are not blank)
    if (line.includes("-->")) {
      const match = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      if (match) {
        const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = match;
        const startSec = Number(h1) * 3600 + Number(m1) * 60 + Number(s1) + Number(ms1) / 1000;
        const endSec = Number(h2) * 3600 + Number(m2) * 60 + Number(s2) + Number(ms2) / 1000;

        // FIX: Insert watermark kalau start cue melewati nextWatermarkSec
        // Dan pastikan watermark TIDAK overlap dengan cue ini
        while (startSec >= nextWatermarkSec + 0.6) {
          // Slot watermark: 0.5 detik sebelum cue ini, atau di nextWatermarkSec (mana yang lebih awal)
          const wmStart = nextWatermarkSec;
          const wmEnd = nextWatermarkSec + 0.5;
          // Pastikan tidak overlap dengan cue
          if (wmEnd <= startSec) {
            result.push(`${formatTime(wmStart)} --> ${formatTime(wmEnd)}`);
            result.push("align:center position:50%,90% line:90% size:60%");
            result.push(WATERMARK_TEXT);
            result.push("");
          }
          nextWatermarkSec += WATERMARK_INTERVAL_SEC;
        }

        // Update nextWatermarkSec kalau cue ini melewati beberapa interval
        while (endSec >= nextWatermarkSec) {
          nextWatermarkSec += WATERMARK_INTERVAL_SEC;
        }
      }

      // Push timing line as-is
      result.push(line);
      i++;
      // Push cue content sampai blank line
      while (i < lines.length && lines[i].trim() !== "") {
        result.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        result.push(""); // blank line
        i++;
      }
    } else if (line.trim() === "") {
      i++; // skip extra blank lines
    } else {
      // Could be cue identifier or NOTE - push as-is
      result.push(line);
      i++;
    }
  }

  // Watermark di akhir video (kalau ada sisa) - optional, hanya kalau total > 5 menit
  // Tidak perlu, biarkan subtitle original

  return result.join("\n");
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
