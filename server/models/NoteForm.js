import mongoose from "mongoose";

const noteSchema = new mongoose.Schema({
    title: {
        type: String,
        default : '',
        trim: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    pinned: {
        type: Boolean,
        default: false
    },
    tags: [{
        type : String,
        trim: true
    }],
    archived: {
        type: Boolean,
        default: false
    },
    trashed: {
        type: Boolean,
        default: false
    },
    reminder: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    user: {
        type: String,
        required: true
    }
});

export default mongoose.model('NoteForm', noteSchema);