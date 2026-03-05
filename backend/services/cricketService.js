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


        // Improved regex to find match info AND state
        const matchRegex = /matchId\\\":(\d+),.*?seriesName\\\":\\\"(.*?)\\\",.*?matchDesc\\\":\\\"(.*?)\\\",.*?status\\\":\\\"(.*?)\\\",.*?state\\\":\\\"(.*?)\\\",.*?team1\\\":\{.*?teamName\\\":\\\"(.*?)\\\".*?team2\\\":\{.*?teamName\\\":\\\"(.*?)\\\"/g;

        let match;
        while ((match = matchRegex.exec(html)) !== null) {
            const [full, id, series, desc, status, jsonState, t1, t2] = match;

            // NEW: Larger segment to ensure we find the matchScore (5000 chars)
            const nextMatchIdx = html.indexOf('matchId', match.index + 20);
            const segmentEnd = nextMatchIdx > -1 ? nextMatchIdx : match.index + 5000;
            const segment = html.substring(match.index, segmentEnd);

            // Clean escaped strings
            const clean = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();

            let s1 = '', s2 = '';
            let state = clean(jsonState); // Use state from Cricbuzz: Live, Preview, Complete, Stumps, etc.

            // Support both full score and partial score regexes
            const scoreRegex = /matchScore\\\":\{.*?team1Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)(?:,.*?overs\\\":\\\"([\d.]+)\\\")?.*?team2Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)(?:,.*?overs\\\":\\\"([\d.]+)\\\")?/;
            const scoreMatch = segment.match(scoreRegex);

            if (scoreMatch) {
                const r1 = scoreMatch[1], w1 = scoreMatch[2], ov1 = scoreMatch[3];
                const r2 = scoreMatch[4], w2 = scoreMatch[5], ov2 = scoreMatch[6];

                s1 = `${r1}/${w1}${ov1 ? ` (${ov1})` : ''}`;
                s2 = `${r2}/${w2}${ov2 ? ` (${ov2})` : ''}`;
            } else {
                // Fallback for matches where only one team has a score so far
                const s1m = segment.match(/team1Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)/);
                if (s1m) s1 = `${s1m[1]}/${s1m[2]}`;
                const s2m = segment.match(/team2Score\\\":\{.*?runs\\\":(\d+),.*?wickets\\\":(\d+)/);
                if (s2m) s2 = `${s2m[1]}/${s2m[2]}`;
            }

            // Map special states to our frontend categories
            let mappedState = 'Live';
            if (state === 'Preview') mappedState = 'Preview';
            else if (state === 'Complete') mappedState = 'Complete';
            else if (state === 'Stumps') mappedState = 'Live'; // Show Stumps matches as Live (active)

            if (!matches.some(m => String(m.matchId) === String(id))) {
                let displayS1 = s1;
                let displayS2 = s2;

                // If match is active but scores are empty, it means they haven't started batting
                if (mappedState === 'Live') {
                    if (!displayS1) displayS1 = 'Yet to Bat';
                    if (!displayS2) displayS2 = 'Yet to Bat';
                }

                matches.push({
                    matchId: id,
                    seriesName: clean(series),
                    matchDesc: clean(desc),
                    status: clean(status),
                    team1: { name: clean(t1), score: displayS1 },
                    team2: { name: clean(t2), score: displayS2 },
                    state: mappedState
                });
            }
        }

        // Filter and Sort: Prioritize Live > Complete > Preview
        const sortedMatches = matches.sort((a, b) => {
            const states = { 'Live': 0, 'Complete': 1, 'Preview': 2 };
            return (states[a.state] ?? 1) - (states[b.state] ?? 1);
        });

        const now = new Date();
        const istTime = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        const finalData = {
            matches: sortedMatches,
            timestamp: now,
            istTimestamp: istTime,
            count: sortedMatches.length
        };

        // Save to file (fallback)
        try {
            fs.writeFileSync('./cricket_scores.json', JSON.stringify(finalData, null, 2));
        } catch (fsErr) {
            // Ignore write errors in serverless environments
        }

        // CRITICAL FIX: Only update DB if we found at least one match with a score OR enough matches
        // This prevents overwriting with an empty list if the scrape is blocked.
        const matchesWithScores = sortedMatches.filter(m => m.team1.score || m.team2.score).length;

        if (sortedMatches.length > 5 || matchesWithScores > 0) {
            console.log(`Updating MongoDB with ${sortedMatches.length} matches...`);
            await Cricket.deleteMany({});
            await Cricket.create(finalData);
            console.log('MongoDB Update Successful');
        } else {
            console.log('--- WARNING: Poor scrap results. Skipping DB update to preserve cache. ---');
        }

        return finalData;
    } catch (err) {
        console.error('Cricket Scraping Error:', err.message);
        throw err;
    }
}

module.exports = { scrapeCricket };
