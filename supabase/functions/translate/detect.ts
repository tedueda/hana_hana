// 入力文の言語判定 (ハングル / かな・漢字 / ラテン文字の出現数で判定)。UI 言語をそのまま信頼しない。
export function detectLang(text: string): string {
  let ko = 0, ja = 0, cjk = 0, latin = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) ko++;
    else if ((c >= 0x3040 && c <= 0x309f) || (c >= 0x30a0 && c <= 0x30ff)) ja++;
    else if (c >= 0x4e00 && c <= 0x9fff) cjk++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++;
  }
  if (ko > 0 && ko >= ja + cjk) return 'ko';
  if (ja > 0 || cjk > 0) return 'ja';
  if (latin > 0) return 'en';
  return 'und';
}
