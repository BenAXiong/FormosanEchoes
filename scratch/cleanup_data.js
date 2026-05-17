const fs = require('fs');
const path = require('path');

const songsPath = path.join(process.cwd(), 'data', 'songs.json');
const artistsPath = path.join(process.cwd(), 'data', 'artists.json');

function cleanFile(filePath, updateFn) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
    console.log(`Stripped BOM from ${path.basename(filePath)}`);
  }
  
  let data = JSON.parse(content);
  if (updateFn) {
    data = updateFn(data);
  }
  
  // Write back as clean UTF-8 (no BOM)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 1. Clean songs.json (Revert sof-039)
cleanFile(songsPath, (songs) => {
  const song = songs.find(s => s.id === 'sof-039');
  if (song && song.artist_ids.includes('art-084')) {
    song.artist_ids = [];
    console.log('Reverted sof-039 artist_ids to []');
  }
  return songs;
});

// 2. Clean artists.json (Just fix encoding/BOM)
cleanFile(artistsPath);

console.log('Database cleanup complete.');
