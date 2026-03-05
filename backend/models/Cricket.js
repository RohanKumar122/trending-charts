const mongoose = require('mongoose');

const cricketSchema = new mongoose.Schema({
    matches: [{
        matchId: Number,
        seriesName: String,
        matchDesc: String,
        status: String,
        team1: {
            name: String,
            score: String
        },
        team2: {
            name: String,
            score: String
        },
        state: String // Live, Preview, Complete
    }],
    timestamp: { type: Date, default: Date.now },
    istTimestamp: String
});

module.exports = mongoose.model('Cricket', cricketSchema);
