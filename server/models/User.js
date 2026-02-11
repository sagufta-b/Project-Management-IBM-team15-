const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'project_manager', 'team_lead', 'member'],
        default: 'member'
    },
    organization: {
        type: mongoose.Schema.ObjectId,
        ref: 'Organization',
        required: false
    },
    jobTitle: String,
    department: String,
    avatar: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hashing and matchPassword handled in auth controller as requested
module.exports = mongoose.model('User', UserSchema);
