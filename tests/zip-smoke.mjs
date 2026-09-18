import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const zipModulePath = path.resolve(currentDir, "../src/download/zip.js");
const zipSource = fs.readFileSync(zipModulePath, "utf8");

globalThis.PravovedExt = {};
vm.runInThisContext(zipSource, { filename: zipModulePath });

const createStoredZip = globalThis.PravovedExt
  && globalThis.PravovedExt.downloads
  && globalThis.PravovedExt.downloads.createStoredZip;

assert.equal(typeof createStoredZip, "function");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1)
        ? (0xedb88320 ^ (value >>> 1))
        : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));

  return {
    dosTime: ((date.getHours() & 0x1f) << 11)
      | ((date.getMinutes() & 0x3f) << 5)
      | ((Math.floor(date.getSeconds() / 2)) & 0x1f),
    dosDate: (((year - 1980) & 0x7f) << 9)
      | (((date.getMonth() + 1) & 0x0f) << 5)
      | (date.getDate() & 0x1f)
  };
}

const encoder = new TextEncoder();
const date = new Date(2026, 8, 18, 12, 0, 0);

function fixtureFile(name, text) {
  const bytes = encoder.encode(text);

  return {
    name,
    nameBytes: encoder.encode(name),
    bytes,
    size: bytes.byteLength,
    crc: crc32(bytes),
    dos: dosDateTime(date)
  };
}

const files = [
  fixtureFile("Исковое заявление.pdf", "fixture-one"),
  fixtureFile("Отзыв на иск.pdf", "fixture-two"),
  fixtureFile("Возражения.pdf", "fixture-three")
];

const blob = createStoredZip(files);
assert.equal(blob.type, "application/zip");

const bytes = Buffer.from(await blob.arrayBuffer());
assert.ok(bytes.length > 22);
assert.equal(bytes.readUInt32LE(0), 0x04034b50);
assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
assert.equal(bytes.readUInt16LE(bytes.length - 12), files.length);

const outputPath = path.join(os.tmpdir(), "pravoved-zip-smoke.zip");
fs.writeFileSync(outputPath, bytes);

console.log(outputPath);
