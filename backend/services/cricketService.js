const axios = require('axios');
const fs = require('fs');
const Cricket = require('../models/Cricket');

const CRICKET_URL = 'https://www.cricbuzz.com/cricket-match/live-scores';

/**
 * Converts "Mar 05, 13:30 GMT" to "Mar 05, 19:00 IST"
 */
function convertToIST(status) {
    if (!status || typeof status !== 'string') return status;

    // Regex matches "Mar 05, 13:30 GMT"
    const gmtRegex = /(\w{3} \d{1,2}, \d{2}:\d{2}) GMT/g;

    return status.replace(gmtRegex, (match, dateTimeStr) => {
        try {
            const currentYear = new Date().getFullYear();
            const date = new Date(`${dateTimeStr} ${currentYear} GMT`);

            if (isNaN(date.getTime())) return match;

            const options = {
                timeZone: 'Asia/Kolkata',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            };

            const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
            const p = {};
            parts.forEach(part => p[part.type] = part.value);

            // Format to "Mar 05, 19:00 IST"
            return `${p.month} ${p.day}, ${p.hour}:${p.minute} IST`;
        } catch (e) {
            console.error('Time conversion error:', e.message);
            return match;
        }
    });
}

async function scrapeCricket() {
    console.log('--- Starting Cricket Robust Scraping ---');
    try {
        const res = await axios.get(CRICKET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        const html = res.data;
        const matches = [];

        // Save raw as requested by user
        fs.writeFileSync('./cricket_raw.html', html);

        // This regex is very specific to the Next.js chunked format we saw in the logs
        const matchRegex = /matchId\\\":(\d+),.*?seriesName\\\":\\\"(.*?)\\\",.*?matchDesc\\\":\\\"(.*?)\\\",.*?status\\\":\\\"(.*?)\\\",.*?team1\\\":\{.*?teamName\\\":\\\"(.*?)\\\".*?team2\\\":\{.*?teamName\\\":\\\"(.*?)\\\"/g;

        let match;
        while ((match = matchRegex.exec(html)) !== null) {
            const [full, id, series, desc, status, t1, t2] = match;

            // NEW: Bound the segment to only THIS match object to prevent picking up the next match's score
            const nextMatchIdx = html.indexOf('matchId', match.index + 20);
            const segmentEnd = nextMatchIdx > -1 ? nextMatchIdx : match.index + 3000;
            const segment = html.substring(match.index, segmentEnd);

            // Try to find the score in the same escaped format
            const scoreRegex = /matchScore\\\":\{.*?team1Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+),.*?overs\\\":\\\"([\d.]+)\\\".*?team2Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+),.*?overs\\\":\\\"([\d.]+)\\\"/;
            const scoreMatch = segment.match(scoreRegex);

            let s1 = '', s2 = '';
            let state = 'Preview';

            if (scoreMatch) {
                s1 = `${scoreMatch[1]}/${scoreMatch[2]} (${scoreMatch[3]})`;
                s2 = `${scoreMatch[4]}/${scoreMatch[5]} (${scoreMatch[6]})`;
                state = 'Live';
            } else {
                // Try simpler score check
                const s1m = segment.match(/team1Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)/);
                const s2m = segment.match(/team2Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)/);
                if (s1m) s1 = `${s1m[1]}/${s1m[2]}`;
                if (s2m) s2 = `${s2m[1]}/${s2m[2]}`;
                if (s1m || s2m) state = 'Live';
            }

            if (!matches.some(m => m.matchId === id)) {
                // Cleaning up escaped double quotes properly
                const clean = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                matches.push({
                    matchId: id,
                    seriesName: clean(series),
                    matchDesc: clean(desc),
                    status: convertToIST(clean(status)),
                    team1: { name: clean(t1), score: s1 },
                    team2: { name: clean(t2), score: s2 },
                    state: state
                });
            }
        }

        // 2. Fallback for unescaped JSON (standard __NEXT_DATA__)
        if (matches.length === 0) {
            const cleanRegex = /\"matchId\":(\d+),.*?\"seriesName\":\"(.*?)\",.*?\"matchDesc\":\"(.*?)\",.*?\"status\":\"(.*?)\",.*?\"team1\":\{.*?\"teamName\":\"(.*?)\".*?\"team2\":\{.*?\"teamName\":\"(.*?)\"/g;
            while ((match = cleanRegex.exec(html)) !== null) {
                const [full, id, series, desc, status, t1, t2] = match;
                if (!matches.some(m => m.matchId === id)) {
                    matches.push({
                        matchId: id,
                        seriesName: series,
                        matchDesc: desc,
                        status: convertToIST(status),
                        team1: { name: t1, score: '' },
                        team2: { name: t2, score: '' },
                        state: 'Live'
                    });
                }
            }
        }

        const now = new Date();
        const istTime = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const finalData = {
            matches,
            timestamp: now,
            istTimestamp: istTime,
            count: matches.length
        };

        fs.writeFileSync('./cricket_scores.json', JSON.stringify(finalData, null, 2));

        await Cricket.deleteMany({});
        if (matches.length > 0) {
            await Cricket.create(finalData);
        }

        return finalData;
    } catch (err) {
        console.error('Cricket Scraping Error:', err.message);
        throw err;
    }
}

module.exports = { scrapeCricket };

