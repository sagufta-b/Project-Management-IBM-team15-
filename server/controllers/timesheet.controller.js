const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Timesheet = require('../models/Timesheet');
const Project = require('../models/Project');
const Task = require('../models/Task');

// @desc      Get all timesheets for logged in user
// @route     GET /api/timesheets
// @access    Private
exports.getTimesheets = asyncHandler(async (req, res) => {
    let query = { user: req.user.id };

    // Admin, PM, and Team Lead can view all timesheets
    if (['admin', 'project_manager', 'team_lead'].includes(req.user.role)) {
        query = {};
    }

    const timesheets = await Timesheet.find(query)
        .populate({
            path: 'user',
            select: 'name email role'
        })
        .populate({
            path: 'project',
            select: 'title key'
        })
        .populate({
            path: 'task',
            select: 'title status'
        })
        .sort('-date');

    res.status(200).json({
        success: true,
        count: timesheets.length,
        data: timesheets
    });
});

// @desc      Create new timesheet entry
// @route     POST /api/timesheets
// @access    Private
exports.createTimesheet = asyncHandler(async (req, res) => {
    req.body.user = req.user.id;

    const { project: projectId, task: taskId } = req.body;

    // Handle empty task string from frontend
    if (taskId === '') {
        delete req.body.task;
    }

    // Check if project exists
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        res.status(400);
        throw new Error('Valid Project ID is required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    // If task is provided, check if it exists and belongs to the project
    if (req.body.task) {
        if (!mongoose.Types.ObjectId.isValid(req.body.task)) {
            res.status(400);
            throw new Error('Invalid Task ID');
        }
        const task = await Task.findById(req.body.task);
        if (!task) {
            res.status(404);
            throw new Error('Task not found');
        }
        if (task.project.toString() !== projectId) {
            res.status(400);
            throw new Error('Task does not belong to the selected project');
        }
    }

    const timesheet = await Timesheet.create(req.body);

    res.status(201).json({
        success: true,
        data: timesheet
    });
});

// @desc      Export timesheets to CSV
// @route     GET /api/timesheets/export
// @access    Private
exports.exportTimesheets = asyncHandler(async (req, res) => {
    let query = { user: req.user.id };

    if (['admin', 'project_manager', 'team_lead'].includes(req.user.role)) {
        query = {};
    }

    const timesheets = await Timesheet.find(query)
        .populate('user', 'name')
        .populate('project', 'title')
        .populate('task', 'title')
        .sort('-date');

    let csv = 'Date,User,Project,Task,Hours,Status,Description\n';

    timesheets.forEach(ts => {
        const date = new Date(ts.date).toLocaleDateString();
        const userName = ts.user ? ts.user.name.replace(/,/g, ' ') : 'N/A';
        const project = ts.project ? ts.project.title.replace(/,/g, ' ') : 'N/A';
        const task = ts.task ? ts.task.title.replace(/,/g, ' ') : 'N/A';
        const hours = ts.hours;
        const status = ts.status;
        const description = ts.description ? ts.description.replace(/,/g, ' ').replace(/\n/g, ' ') : '';

        csv += `${date},${userName},${project},${task},${hours},${status},${description}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`timesheets-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
});
