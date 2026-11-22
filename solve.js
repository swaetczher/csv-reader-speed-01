// csv-reader cepat, jawaban identik csv-reader 1.0.0 (make.fun).
// Parser monolitik satu-pass: seluruh parse dalam satu fungsi run(),
// tanpa call fungsi per field. Satu salinan loop unquoted (charCodeAt +
// slice per segmen) dipakai untuk field biasa, lanjutan quote_junk, dan
// fallback unterminated_quote; scan quoted inline dengan indexOf('"').
// Jalur lambat (normalisasi CR) hanya untuk segmen quoted yang memang
// mengandung CR/LF. Tanpa cache antar case, tanpa jam, tanpa acak.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  // Normalisasi satu segmen quoted: tiap CRLF dan tiap CR tunggal jadi
  // satu LF; kembalikan [teks ternormalisasi, jumlah baris yang dilewati].
  function normQuoted(seg) {
    let lines = 0;
    for (let i = 0; i < seg.length; i++) {
      const c = seg.charCodeAt(i);
      if (c === 10) lines++;
      else if (c === 13) {
        lines++;
        if (seg.charCodeAt(i + 1) === 10) i++;
      }
    }
    return [seg.replace(/\r\n?/g, "\n"), lines];
  }

  while (true) {
    // Baris kosong (tanpa karakter) bukan record.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else {
        break;
      }
    }
    if (pos >= n) break;
    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let firstQuoted = false;
    let moreFields = true;
    while (moreFields) {
      let val = "";
      let end = 2;
      let quoted = false;
      let scanUq = false;
      let junkCase = false;
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const open = pos;
        const openLine = line;
        let lineDelta = 0;
        let start = pos + 1;
        let q = -1;
        let closed = false;
        while (true) {
          q = text.indexOf('"', start);
          if (q === -1) break;
          const seg = text.slice(start, q);
          if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
            if (seg !== "") {
              if (seg.indexOf("\r") === -1 && seg.indexOf("\n") === -1) {
                val = val === "" ? seg : val + seg;
              } else {
                const norm = normQuoted(seg);
                lineDelta += norm[1];
                val = val === "" ? norm[0] : val + norm[0];
              }
            }
            val += '"';
            start = q + 2;
            continue;
          }
          closed = true;
          break;
        }
        if (!closed) {
          // Kutip tak pernah menutup: karakter literal, teks sesudahnya
          // dibaca ulang sebagai unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: "unterminated_quote", line: recordLine, row: recordRow });
          val = '"';
          scanUq = true;
        } else {
          const seg = text.slice(start, q);
          if (seg !== "") {
            if (seg.indexOf("\r") === -1 && seg.indexOf("\n") === -1) {
              val = val === "" ? seg : val + seg;
            } else {
              const norm = normQuoted(seg);
              lineDelta += norm[1];
              val = val === "" ? norm[0] : val + norm[0];
            }
          }
          line += lineDelta;
          pos = q + 1;
          if (pos >= n) {
            end = 2;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) {
              pos++;
              end = 0;
            } else if (c === 10) {
              pos++;
              line++;
              end = 1;
            } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line++;
              end = 1;
            } else {
              scanUq = true;
              junkCase = true;
            }
          }
        }
      } else {
        scanUq = true;
      }
      let added = 0;
      if (scanUq) {
        end = 2;
        let segStart = pos;
        while (pos < n) {
          const c = text.charCodeAt(pos);
          if (c === 44) {
            if (pos > segStart) {
              const seg = text.slice(segStart, pos);
              val = val === "" ? seg : val + seg;
              added += pos - segStart;
            }
            pos++;
            end = 0;
            break;
          }
          if (c === 10) {
            if (pos > segStart) {
              const seg = text.slice(segStart, pos);
              val = val === "" ? seg : val + seg;
              added += pos - segStart;
            }
            pos++;
            line++;
            end = 1;
            break;
          }
          if (c === 13) {
            if (pos > segStart) {
              const seg = text.slice(segStart, pos);
              val = val === "" ? seg : val + seg;
              added += pos - segStart;
            }
            if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line++;
              end = 1;
              break;
            }
            errors.push({ code: "stray_cr", line: recordLine, row: recordRow });
            pos++;
            segStart = pos;
          } else {
            pos++;
          }
        }
        if (end === 2 && pos > segStart) {
          const seg = text.slice(segStart, pos);
          val = val === "" ? seg : val + seg;
          added += pos - segStart;
        }
        if (junkCase && added > 0) errors.push({ code: "quote_junk", line: recordLine, row: recordRow });
      }
      if (fields.length === 0) firstQuoted = quoted;
      fields.push(val);
      moreFields = end === 0;
    }
    // Baris yang hanya berisi stray CR (field kosong unquoted) bukan record.
    if (fields.length === 1 && fields[0] === "" && !firstQuoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: "short_row", line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push("");
    } else if (fields.length > width) {
      errors.push({ code: "long_row", line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
