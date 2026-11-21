/* Byte-mode QR codes, error correction M, versions 1–10. Offline, no library. */
(function (Aurel) {
  'use strict';

  const ALIGN = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50]
  };

  // [block count, data codewords, error-correction codewords] per group. Level M.
  const BLOCKS = {
    1: [[1, 16, 10]],
    2: [[1, 28, 16]],
    3: [[1, 44, 26]],
    4: [[2, 32, 18]],
    5: [[2, 43, 24]],
    6: [[4, 27, 16]],
    7: [[4, 31, 18]],
    8: [[2, 38, 22], [2, 39, 22]],
    9: [[3, 36, 22], [2, 37, 22]],
    10: [[4, 43, 26], [1, 44, 26]]
  };

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initField() {
    let x = 1;
    for (let i = 0; i < 255; i += 1) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
  }());

  function mul(a, b) {
    if (!a || !b) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsEncode(data, nsym) {
    let gen = [1];
    for (let i = 0; i < nsym; i += 1) {
      const next = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j += 1) {
        next[j] ^= gen[j];
        next[j + 1] ^= mul(gen[j], EXP[i]);
      }
      gen = next;
    }
    const out = data.concat(new Array(nsym).fill(0));
    for (let i = 0; i < data.length; i += 1) {
      const coef = out[i];
      if (!coef) continue;
      for (let j = 0; j < gen.length; j += 1) out[i + j] ^= mul(gen[j], coef);
    }
    return out.slice(data.length);
  }

  function dataCodewords(version) {
    return BLOCKS[version].reduce((sum, group) => sum + group[0] * group[1], 0);
  }

  function encodeData(text, version) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const capacity = dataCodewords(version);
    const bits = [];
    const put = (value, length) => {
      for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
    };
    put(0b0100, 4);
    put(bytes.length, version >= 10 ? 16 : 8);
    bytes.forEach((byte) => put(byte, 8));
    const maxBits = capacity * 8;
    const terminator = Math.min(4, Math.max(0, maxBits - bits.length));
    for (let i = 0; i < terminator; i += 1) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | bits[i + bit];
      data.push(value);
    }
    let pad = 0;
    while (data.length < capacity) {
      data.push(pad ? 0x11 : 0xec);
      pad ^= 1;
    }
    return data;
  }

  function interleave(data, version) {
    const blocks = [];
    let offset = 0;
    BLOCKS[version].forEach(([count, dataLen, eccLen]) => {
      for (let i = 0; i < count; i += 1) {
        const block = data.slice(offset, offset + dataLen);
        offset += dataLen;
        blocks.push({ data: block, ecc: rsEncode(block, eccLen) });
      }
    });
    const out = [];
    const maxData = Math.max.apply(null, blocks.map((block) => block.data.length));
    for (let i = 0; i < maxData; i += 1) {
      blocks.forEach((block) => {
        if (i < block.data.length) out.push(block.data[i]);
      });
    }
    const eccLen = blocks[0].ecc.length;
    for (let i = 0; i < eccLen; i += 1) blocks.forEach((block) => out.push(block.ecc[i]));
    return out;
  }

  function blank(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
  }

  function reserveFinder(modules, reserved, row, col) {
    const n = modules.length;
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        modules[r][c] = inside && (edge || core) ? 1 : 0;
        reserved[r][c] = true;
      }
    }
  }

  function reserveAlignment(modules, reserved, row, col) {
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        modules[row + dr][col + dc] = on ? 1 : 0;
        reserved[row + dr][col + dc] = true;
      }
    }
  }

  function formatBits(mask) {
    const data = mask;
    let rem = data << 10;
    for (let i = 14; i >= 10; i -= 1) {
      if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    }
    return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
  }

  function versionBits(version) {
    let rem = version << 12;
    for (let i = 17; i >= 12; i -= 1) {
      if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
    }
    return (version << 12) | (rem & 0xfff);
  }

  function bitAt(value, index) {
    return (value >>> index) & 1;
  }

  function drawFormat(modules, reserved, mask) {
    const n = modules.length;
    const bits = formatBits(mask);
    const set = (row, col, index) => {
      modules[row][col] = bitAt(bits, index);
      reserved[row][col] = true;
    };
    for (let i = 0; i < 15; i += 1) {
      if (i < 6) set(i, 8, i);
      else if (i < 8) set(i + 1, 8, i);
      else set(n - 15 + i, 8, i);
      if (i < 8) set(8, n - 1 - i, i);
      else if (i < 9) set(8, 7, i);
      else set(8, 14 - i, i);
    }
    modules[n - 8][8] = 1;
    reserved[n - 8][8] = true;
  }

  function drawVersion(modules, reserved, version) {
    if (version < 7) return;
    const n = modules.length;
    const bits = versionBits(version);
    for (let i = 0; i < 18; i += 1) {
      const on = bitAt(bits, i);
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      modules[b][a] = on;
      reserved[b][a] = true;
      modules[a][b] = on;
      reserved[a][b] = true;
    }
  }

  function functionMatrix(version) {
    const n = 17 + version * 4;
    const modules = blank(n);
    const reserved = blank(n);
    reserveFinder(modules, reserved, 0, 0);
    reserveFinder(modules, reserved, 0, n - 7);
    reserveFinder(modules, reserved, n - 7, 0);
    const positions = ALIGN[version] || [];
    positions.forEach((row) => {
      positions.forEach((col) => {
        if (modules[row][col] !== null) return;
        reserveAlignment(modules, reserved, row, col);
      });
    });
    for (let i = 0; i < n; i += 1) {
      if (!reserved[6][i]) {
        modules[6][i] = i % 2 === 0 ? 1 : 0;
        reserved[6][i] = true;
      }
      if (!reserved[i][6]) {
        modules[i][6] = i % 2 === 0 ? 1 : 0;
        reserved[i][6] = true;
      }
    }
    modules[n - 8][8] = 1;
    reserved[n - 8][8] = true;
    drawVersion(modules, reserved, version);
    for (let i = 0; i <= 8; i += 1) {
      if (modules[8][i] === null) reserved[8][i] = true;
      if (modules[i][8] === null) reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i += 1) {
      reserved[8][n - 1 - i] = true;
      reserved[n - 1 - i][8] = true;
    }
    return { modules, reserved };
  }

  function placeData(modules, reserved, codewords) {
    const n = modules.length;
    const bits = [];
    codewords.forEach((word) => {
      for (let i = 7; i >= 0; i -= 1) bits.push((word >>> i) & 1);
    });
    let index = 0;
    let upward = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (let step = 0; step < n; step += 1) {
        const row = upward ? n - 1 - step : step;
        for (let offset = 0; offset < 2; offset += 1) {
          const c = col - offset;
          if (reserved[row][c]) continue;
          modules[row][c] = index < bits.length ? bits[index] : 0;
          index += 1;
        }
      }
      upward = !upward;
    }
  }

  function masked(modules, reserved, mask) {
    const n = modules.length;
    const out = modules.map((row) => row.slice());
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (reserved[r][c]) continue;
        let flip = false;
        if (mask === 0) flip = (r + c) % 2 === 0;
        else if (mask === 1) flip = r % 2 === 0;
        else if (mask === 2) flip = c % 3 === 0;
        else if (mask === 3) flip = (r + c) % 3 === 0;
        else if (mask === 4) flip = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        else if (mask === 5) flip = ((r * c) % 2) + ((r * c) % 3) === 0;
        else if (mask === 6) flip = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        else flip = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
        if (flip) out[r][c] ^= 1;
      }
    }
    return out;
  }

  function penalty(modules) {
    const n = modules.length;
    let score = 0;
    const runScore = (line) => {
      let total = 0;
      let run = 1;
      for (let i = 1; i < line.length; i += 1) {
        if (line[i] === line[i - 1]) run += 1;
        else {
          if (run >= 5) total += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) total += 3 + (run - 5);
      return total;
    };
    for (let r = 0; r < n; r += 1) score += runScore(modules[r]);
    for (let c = 0; c < n; c += 1) {
      const col = [];
      for (let r = 0; r < n; r += 1) col.push(modules[r][c]);
      score += runScore(col);
    }
    for (let r = 0; r < n - 1; r += 1) {
      for (let c = 0; c < n - 1; c += 1) {
        const v = modules[r][c];
        if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) score += 3;
      }
    }
    const finderLike = (line) => {
      const text = line.join('');
      let total = 0;
      for (let i = 0; i <= text.length - 11; i += 1) {
        const slice = text.slice(i, i + 11);
        if (slice === '10111010000' || slice === '00001011101') total += 40;
      }
      return total;
    };
    for (let r = 0; r < n; r += 1) score += finderLike(modules[r]);
    for (let c = 0; c < n; c += 1) {
      const col = [];
      for (let r = 0; r < n; r += 1) col.push(modules[r][c]);
      score += finderLike(col);
    }
    let dark = 0;
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) dark += modules[r][c] ? 1 : 0;
    }
    const percent = (dark * 100) / (n * n);
    score += 10 * Math.floor(Math.abs(percent - 50) / 5);
    return score;
  }

  function build(text) {
    const length = new TextEncoder().encode(text).length;
    let version = 0;
    for (let candidate = 1; candidate <= 10; candidate += 1) {
      const header = 4 + (candidate >= 10 ? 16 : 8);
      if (header + length * 8 <= dataCodewords(candidate) * 8) {
        version = candidate;
        break;
      }
    }
    if (!version) throw new Error('This payment code is too long to draw.');
    const codewords = interleave(encodeData(text, version), version);
    const base = functionMatrix(version);
    placeData(base.modules, base.reserved, codewords);
    let best = null;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask += 1) {
      const grid = masked(base.modules, base.reserved, mask);
      drawFormat(grid, base.reserved, mask);
      const score = penalty(grid);
      if (score < bestScore) {
        bestScore = score;
        best = grid;
      }
    }
    return best;
  }

  function svg(text) {
    const modules = build(text);
    const quiet = 4;
    const n = modules.length;
    const size = n + quiet * 2;
    let marks = '';
    for (let r = 0; r < n; r += 1) {
      let c = 0;
      while (c < n) {
        if (!modules[r][c]) {
          c += 1;
          continue;
        }
        let end = c;
        while (end < n && modules[r][end]) end += 1;
        marks += `<rect x="${c + quiet}" y="${r + quiet}" width="${end - c}" height="1"/>`;
        c = end;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><rect width="100%" height="100%" fill="#fff"/><g fill="#171614">${marks}</g></svg>`;
  }

  Aurel.qrSvg = svg;
  Aurel.qrModules = build;
}(window.Aurel = window.Aurel || {}));
