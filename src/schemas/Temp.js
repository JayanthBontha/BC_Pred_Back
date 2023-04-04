const mongoose = require('mongoose');

const ott = mongoose.Schema({
    otp: {
        type: Number,
        required: true
    },
    phone: {
        type: String,
    },

    email: {
        type: String,
    },
    name: {
        type: String,
        required: true
    },
    insti: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },

    flag: {
        type: Boolean,
        default: false,
        required: true
    },
    expireAt: {
        type:Date,
        default: Date.now,
        index:{expires: '2m'}
    }
})

module.exports = mongoose.model("otp", ott, "otp");