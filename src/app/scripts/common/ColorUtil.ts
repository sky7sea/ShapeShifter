import * as tinycolor from 'tinycolor2';

const BRIGHTNESS_THRESHOLD = 130;

export function parseAndroidColor(val: string): ColorFormats.RGBA | undefined {
  val = (val || '').replace(/^\s*#?|\s*$/g, '');
  const dict: ColorFormats.RGBA = { a: 0, r: 0, g: 0, b: 0 };

  if (val.length === 3) {
    dict.a = 255;
    dict.r = parseInt(val.substring(0, 1), 16) * 17;
    dict.g = parseInt(val.substring(1, 2), 16) * 17;
    dict.b = parseInt(val.substring(2, 3), 16) * 17;
  } else if (val.length === 4) {
    dict.a = parseInt(val.substring(0, 1), 16) * 17;
    dict.r = parseInt(val.substring(1, 2), 16) * 17;
    dict.g = parseInt(val.substring(2, 3), 16) * 17;
    dict.b = parseInt(val.substring(3, 4), 16) * 17;
  } else if (val.length === 6) {
    dict.a = 255;
    dict.r = parseInt(val.substring(0, 2), 16);
    dict.g = parseInt(val.substring(2, 4), 16);
    dict.b = parseInt(val.substring(4, 6), 16);
  } else if (val.length === 8) {
    dict.a = parseInt(val.substring(0, 2), 16);
    dict.r = parseInt(val.substring(2, 4), 16);
    dict.g = parseInt(val.substring(4, 6), 16);
    dict.b = parseInt(val.substring(6, 8), 16);
  } else {
    return undefined;
  }

  return (isNaN(dict.r) || isNaN(dict.g) || isNaN(dict.b) || isNaN(dict.a)) ? undefined : dict;
}

export function toAndroidString(dict: ColorFormats.RGBA): string {
  let str = '#';
  if (dict.a !== 255) {
    str += ((dict.a < 16) ? '0' : '') + dict.a.toString(16);
  }
  str += ((dict.r < 16) ? '0' : '') + dict.r.toString(16)
    + ((dict.g < 16) ? '0' : '') + dict.g.toString(16)
    + ((dict.b < 16) ? '0' : '') + dict.b.toString(16);
  return str;
}

export function svgToAndroidColor(color: string): string | undefined {
  if (color === 'none') {
    return undefined;
  }
  const colorInstance = tinycolor(color);
  return '#' + colorInstance.toHex8().substr(6) + colorInstance.toHex();
}

export function androidToCssColor(androidColor: string | undefined, multAlpha = 1): string {
  if (!androidColor) {
    return 'transparent';
  }
  const d = parseAndroidColor(androidColor);
  return `rgba(${d.r},${d.g},${d.b},${(d.a * multAlpha / 255).toFixed(2)})`;
}
