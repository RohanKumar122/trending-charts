const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const Cricket = require('../models/Cricket');

const CRICKET_URL = 'https://www.cricbuzz.com/cricket-match/live-scores';

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
                    status: clean(status),
                    team1: { name: clean(t1), score: s1 },
                    team2: { name: clean(t2), score: s2 },
                    state: state
                });
            }
        }

        // 3. Fallback: Parse from __NEXT_DATA__ or self.__next_f script tags
        if (matches.length === 0) {
            const $ = cheerio.load(html);
            $('script').each((i, el) => {
                const content = $(el).html();
                if (content && content.includes('matchId')) {
                    // Try to find the JSON-like objects in the script chunks
                    const regex = /\{"matchId":(\d+),.*?"team1":\{.*?"teamName":"(.*?)"\}.*?"team2":\{.*?"teamName":"(.*?)"\}/g;
                    let m;
                    while ((m = regex.exec(content)) !== null) {
                        if (!matches.some(x => x.matchId === m[1])) {
                            matches.push({
                                matchId: m[1],
                                seriesName: "Unknown Series",
                                matchDesc: "Match",
                                status: "Live",
                                team1: { name: m[2], score: '' },
                                team2: { name: m[3], score: '' },
                                state: 'Live'
                            });
                        }
                    }
                }
            });
        }

        const now = new Date();
        const istTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        const finalData = {
            matches,
            timestamp: now,
            istTimestamp: istTime,
            count: matches.length
        };

        // Save to file as fallback/log
        fs.writeFileSync('./cricket_scores.json', JSON.stringify(finalData, null, 2));

        // CRITICAL FIX: Only update DB if we found matches!
        if (matches.length > 0) {
            console.log(`Updating MongoDB with ${matches.length} matches...`);
            // Use findOneAndReplace or deleteMany/create
            // We'll stick to delete/create but only if we have data
            await Cricket.deleteMany({});
            await Cricket.create(finalData);
            console.log('MongoDB Update Successful');
        } else {
            console.log('--- WARNING: No matches found during scrap. Skipping DB update to preserve cache. ---');
        }

        return finalData;
    } catch (err) {
        console.error('Cricket Scraping Error:', err.message);
        throw err;
    }
}

module.exports = { scrapeCricket };
