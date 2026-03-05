const axios = require('axios');
const fs = require('fs');
const Cricket = require('../models/Cricket');

const CRICKET_URL = 'https://www.cricbuzz.com/cricket-match/live-scores';

async function scrapeCricket() {
    console.log('--- Starting Cricket Payload Scraping ---');
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

        // This regex looks for the JSON-like payload of matches
        // It's very common in Cricbuzz's Next.js implementation
        const matchDataRegex = /\"matches\":\[(.*?)\]/g;
        let matchResult;

        while ((matchResult = matchDataRegex.exec(html)) !== null) {
            try {
                const jsonStr = `{"matches":[${matchResult[1]}]}`;
                // Clean up escaped quotes if any
                const parsed = JSON.parse(jsonStr.replace(/\\\"/g, '"'));

                parsed.matches.forEach(m => {
                    const info = m.match?.matchInfo || m.matchInfo;
                    const score = m.match?.matchScore || m.matchScore;

                    if (!info || !info.team1) return;

                    const formatScore = (s) => {
                        if (!s || !s.inngs1) return '';
                        let txt = `${s.inngs1.runs || 0}/${s.inngs1.wickets || 0}`;
                        if (s.inngs1.overs) txt += ` (${s.inngs1.overs})`;
                        return txt;
                    };

                    // Only add if not already added
                    if (!matches.some(existing => existing.matchId === info.matchId)) {
                        matches.push({
                            matchId: info.matchId,
                            seriesName: info.seriesName,
                            matchDesc: info.matchDesc,
                            status: info.status || info.statusTitle || '',
                            team1: {
                                name: info.team1.teamName,
                                score: formatScore(score?.team1Score)
                            },
                            team2: {
                                name: info.team2.teamName,
                                score: formatScore(score?.team2Score)
                            },
                            state: info.state || 'Preview'
                        });
                    }
                });
            } catch (e) {
                // Ignore parsing errors for partial matches
            }
        }

        // Fallback to SportsEvent if regex failed
        if (matches.length === 0) {
            const ldJsonRegex = /<script type=\"application\/ld\+json\">(.*?)<\/script>/g;
            let ldResult;
            while ((ldResult = ldJsonRegex.exec(html)) !== null) {
                try {
                    const ld = JSON.parse(ldResult[1]);
                    const events = ld.mainEntity?.itemListElement || [];
                    events.forEach(ev => {
                        if (ev["@type"] === "SportsEvent") {
                            matches.push({
                                matchId: Math.random(),
                                seriesName: ev.superEvent || 'Cricket',
                                matchDesc: ev.name,
                                status: ev.eventStatus,
                                team1: { name: ev.competitor[0].name, score: '' },
                                team2: { name: ev.competitor[1].name, score: '' },
                                state: 'Live'
                            });
                        }
                    });
                } catch (e) { }
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

        // Save to file as requested
        fs.writeFileSync('./cricket_scores.json', JSON.stringify(finalData, null, 2));

        await Cricket.deleteMany({});
        if (matches.length > 0) {
            await Cricket.create(finalData);
        }

        return finalData;
    } catch (err) {
        console.error('Cricket Payload Scraping Error:', err.message);
        throw err;
    }
}

module.exports = { scrapeCricket };
