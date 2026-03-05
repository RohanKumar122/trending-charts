const fs = require('fs');
const html = fs.readFileSync('cricket_raw.html', 'utf8');
const index = html.indexOf('matchId\\":139478');
if (index > -1) {
    console.log(html.substring(index, index + 2000));
} else {
    // Try without escaped double quotes
    const index2 = html.indexOf('matchId":139478');
    if (index2 > -1) {
        console.log(html.substring(index2, index2 + 2000));
    } else {
        console.log('Not found');
    }
}
