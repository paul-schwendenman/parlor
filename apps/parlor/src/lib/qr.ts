import qrcode from 'qrcode-generator';

export interface QrPath {
  /** Modules per side, including the quiet zone. */
  size: number;
  /** One SVG path drawing every dark module as a 1x1 square. */
  path: string;
}

/** Quiet zone in modules; the QR spec asks for four. */
const QUIET = 4;

/**
 * A QR code for `text`, drawn locally (no QR web service sees the invite
 * link). Error correction M survives a glare spot or a smudged screen.
 */
export function qrPath(text: string): QrPath {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  return { size: count + QUIET * 2, path };
}
