const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
    gold: {
        gold24K: String,
        gold22K: String,
        num24K: Number,
        num22K: Number
    },
    silver: {
        silverPerGram: String,
        silverPerKg: String,
        numGram: Number,
        numKg: Number
    },
    timestamp: { type: Date, default: Date.now },
    istTimestamp: String
});

module.exports = mongoose.model('Rate', rateSchema);
