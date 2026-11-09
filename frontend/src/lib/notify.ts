const KEY = 'btt-notify';
export type NotifySettings = { sound: boolean };
const MAC_DINH: NotifySettings = { sound: true };

export function readNotify(): NotifySettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NotifySettings> | null;
    return { sound: typeof v?.sound === 'boolean' ? v.sound : MAC_DINH.sound };
  } catch {
    return MAC_DINH;
  }
}

export function saveNotify(value: NotifySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* trình duyệt chặn lưu: bỏ qua */
  }
}

/** Phát tiếng chuông ngắn (2 nốt). Trình duyệt chặn âm thanh trước khi người dùng bấm vào trang thì im lặng. */
export function playChime(force = false) {
  if (!force && !readNotify().sound) return;
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.18);
    });
    setTimeout(() => void ctx.close(), 700);
  } catch {
    /* không phát được: bỏ qua */
  }
}
