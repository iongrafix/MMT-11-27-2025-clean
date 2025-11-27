// portable-write.js — full replacement
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function resolveExiftool() {
  const candidates = [
    path.join(process.cwd(), "tools"),
    path.join(__dirname, "..", "tools"),
    path.join(__dirname, "tools"),
    process.resourcesPath ? path.join(process.resourcesPath, "tools") : null,
  ].filter(Boolean);

  for (const dir of candidates) {
    const exe = path.join(dir, "exiftool.exe");
    const files = path.join(dir, "exiftool_files");
    if (fs.existsSync(exe) && fs.existsSync(files)) {
      return { exe, dir };
    }
  }
  throw new Error(
    "exiftool.exe or exiftool_files/ not found. Expected under one of:\n" +
    candidates.map(d => d + "\\exiftool.exe").join("\n")
  );
}

function runExif(args) {
  const { exe, dir } = resolveExiftool();
  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, { windowsHide: true, cwd: dir });
    let out = "", err = "";
    proc.stdout.on("data", d => out += d.toString());
    proc.stderr.on("data", d => err += d.toString());
    proc.on("close", code => code === 0
      ? resolve(out.trim() || "OK")
      : reject(new Error(err || `ExifTool exited ${code}`)));
  });
}

async function writePortableMetadata(p) {
  const args = [
    "-overwrite_original",
    // Cross-platform (Adobe/Spotlight)
    `-XMP-dc:Title=${p.title || ""}`,
    `-XMP-dc:Description=${p.comments || ""}`,
    ...(p.tags
      ? p.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => `-XMP-dc:Subject=${t}`)
      : []),
    `-XMP-xmp:Rating=${p.rating || 0}`,
    // Finder “More Info” (fake camera fields)
    `-Make=${p.macMake || "DBM Tagger"}`,
    `-Model=${p.macModel || ""}`,
    `-LensModel=${p.macLens || ""}`,
    `-ExposureTime=${p.macExposure || ""}`,
    `-Software=${p.macSoftware || "MMT Tagger"}`,
    `-Artist=${p.macArtist || ""}`,
    // Video-friendly mirrors
    `-Title=${p.title || ""}`,
    `-Comment=${p.comments || ""}`,
    p.filePath,
  ];
  return runExif(args).then(() => "Metadata written successfully.");
}

module.exports = { writePortableMetadata };
