const mongoose = require('mongoose');

const authenticator = mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    ip: {
        type: String,
        required: true
    },

    date: {
        type: Date,
        required: true
    }
})

module.exports = mongoose.model("sesh", authenticator, "cur_sesh");