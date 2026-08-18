/**
 * Subtitle Watermark Helper
 *
 * Tambah watermark ke subtitle untuk mencegah pencurian.
 * Watermark: "nonton streaming film terupdate hanya di cinestream.my.id"
 *
 * Strategi:
 * - Tidak mengganggu subtitle asli (tidak ubah timing/isi)
 * - Sisipkan watermark sebagai cue terpisah di awal video (1 detik)
 * - Setiap 5 menit, sisipkan watermark 0.5 detik (cepat, tidak mengganggu)
 * - Pakai posisi tengah bawah agar tidak mengganggu subtitle utama
 */

const WATERMARK_TEXT = "nonton streaming film terupdate hanya di cinestream.my.id";

/**
 * Tambah watermark ke VTT subtitle.
 * Input: VTT text (sudah dikonversi dari SRT kalau perlu)
 * Output: VTT text dengan watermark
 */
export function addWatermarkToVtt(vtt: string): string {
  if (!vtt || !vtt.trim()) return vtt;

  const lines = vtt.split(/\r?\n/);
  const result: string[] = [];

  // Pastikan header WEBVTT ada
  if (lines[0]?.trim() === "WEBVTT") {
    result.push(lines[0]);
    result.push(""); // blank line
  } else {
    result.push("WEBVTT");
    result.push("");
  }

  // Watermark di awal (1 detik di awal video)
  result.push("cue-1");
  result.push("00:00:00.000 --> 00:00:01.000");
  result.push("align:center position:50%,90% line:90%");
  result.push(WATERMARK_TEXT);
  result.push("");

  // Parse semua cue original, sisipkan watermark setiap ~5 menit
  let lastEndSec = 0;
  let cueIdx = 2;
  let i = 1; // skip header
  let currentCue: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.includes("-->")) {
      // Start of new cue
      // Kalau ada currentCue, flush dulu
      if (currentCue.length > 0) {
        result.push(`cue-${cueIdx++}`);
        result.push(...currentCue);
        result.push("");
        currentCue = [];
      }

      // Extract end time
      const match = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      if (match) {
        const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = match;
        const startSec = Number(h1) * 3600 + Number(m1) * 60 + Number(s1) + Number(ms1) / 1000;
        const endSec = Number(h2) * 3600 + Number(m2) * 60 + Number(s2) + Number(ms2) / 1000;

        // Sisipkan watermark kalau gap > 5 menit dari lastEndSec
        if (startSec - lastEndSec >= 300 && endSec > startSec + 0.5) {
          // Insert watermark 0.5s sebelum cue ini (atau overlap sedikit)
          const wmStart = formatTime(Math.max(startSec, lastEndSec + 0.1));
          const wmEnd = formatTime(Math.max(startSec + 0.5, lastEndSec + 0.6));
          result.push(`cue-${cueIdx++}`);
          result.push(`${wmStart} --> ${wmEnd}`);
          result.push("align:center position:50%,90% line:90%");
          result.push(WATERMARK_TEXT);
          result.push("");
        }

        lastEndSec = endSec;
      }

      currentCue.push(line);
    } else if (line.trim() === "") {
      // End of cue - flush
      if (currentCue.length > 0) {
        result.push(`cue-${cueIdx++}`);
        result.push(...currentCue);
        result.push("");
        currentCue = [];
      }
    } else {
      currentCue.push(line);
    }
    i++;
  }

  // Flush last cue
  if (currentCue.length > 0) {
    result.push(`cue-${cueIdx++}`);
    result.push(...currentCue);
    result.push("");
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
