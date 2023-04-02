const mongoose = require('mongoose');
const UserSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    pass: {
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
    }
});

module.exports = mongoose.model("User", UserSchema, "user");