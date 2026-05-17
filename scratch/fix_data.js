const fs = require('fs');
const path = require('path');

const songsPath = path.join(process.cwd(), 'data', 'songs.json');

try {
    const songs = JSON.parse(fs.readFileSync(songsPath, 'utf8'));

    // Link sof-039 to art-084
    const song = songs.find(s => s.id === 'sof-039');
    if (song) {
        song.artist_ids = ['art-084'];
        console.log('Linked sof-039 to art-084');
    } else {
        console.log('Song sof-039 not found');
    }

    // Write back as clean UTF-8
    fs.writeFileSync(songsPath, JSON.stringify(songs, null, 2), 'utf8');
    console.log('Successfully updated songs.json with clean encoding');
} catch (err) {
    console.error('Error:', err);
}
