const mongoose = require('mongoose');
const ImageSchema = mongoose.Schema({
    added_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    data: {
        type: Buffer,
        required: true
    },
    type:{
        type: String,
        required: true
    },
    predicted_as: {
        type:Number,
        required: true
    },
    user_ans: {
        type:String
    }
});

module.exports = mongoose.model("Image", ImageSchema, "image");