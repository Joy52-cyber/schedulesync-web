const fs = require("fs");
const path = require("path");

const distBuilt = path.join(__dirname, "..", "dist-built");
const clientDist = path.join(__dirname, "..", "client", "dist");

// delete existing dist-built
if (fs.existsSync(distBuilt)) {
  fs.rmSync(distBuilt, { recursive: true, force: true });
}

// recreate folder
fs.mkdirSync(distBuilt, { recursive: true });

// copy client/dist → dist-built
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(clientDist, distBuilt);

console.log("✅ dist-built folder copied successfully!");
