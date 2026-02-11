const asyncHandler = require('express-async-handler');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Timesheet = require('../models/Timesheet');

const mongoose = require('mongoose');

// Helper to build date/project filters
const getTaskFilters = (req) => {
    const { projectId, startDate, endDate } = req.query;
    const orgId = req.user.organization;

    // Base match for organization (via project)
    const match = { 'projectData.organization': new mongoose.Types.ObjectId(orgId) };

    if (projectId && projectId !== 'all') {
        match.project = new mongoose.Types.ObjectId(projectId);
    }

    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    return match;
};

// @desc      Get Project Progress Stats
// @route     GET /api/analytics/projects
// @access    Private
exports.getProjectProgress = asyncHandler(async (req, res) => {
    const orgId = req.user.organization;
    const { projectId } = req.query;

    let projectQuery = { organization: orgId };
    if (projectId && projectId !== 'all') {
        projectQuery._id = projectId;
    }

    const projects = await Project.find(projectQuery).select('title status startDate endDate');

    const projectProgress = await Promise.all(projects.map(async (project) => {
        const totalTasks = await Task.countDocuments({ project: project._id });
        const completedTasks = await Task.countDocuments({ project: project._id, status: 'done' });
        const pendingTasks = await Task.countDocuments({ project: project._id, status: { $ne: 'done' } });

        const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

        return {
            id: project._id,
            name: project.title,
            progress,
            status: project.status,
            totalTasks,
            completedTasks,
            pendingTasks,
            isActive: pendingTasks > 0
        };
    }));

    res.status(200).json({
        success: true,
        data: projectProgress
    });
});

// @desc      Get Task Completion Stats
// @route     GET /api/analytics/tasks
// @access    Private
exports.getTaskCompletionStats = asyncHandler(async (req, res) => {
    const taskMatch = getTaskFilters(req);

    const stats = await Task.aggregate([
        {
            $lookup: {
                from: 'projects',
                localField: 'project',
                foreignField: '_id',
                as: 'projectData'
            }
        },
        { $unwind: '$projectData' },
        { $match: taskMatch },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const formattedStats = {
        todo: 0,
        in_progress: 0,
        review: 0,
        done: 0
    };

    stats.forEach(stat => {
        if (formattedStats.hasOwnProperty(stat._id)) {
            formattedStats[stat._id] = stat.count;
        }
    });

    res.status(200).json({
        success: true,
        data: formattedStats
    });
});

// @desc      Get Time Utilization Reports
// @route     GET /api/analytics/time
// @access    Private
exports.getTimeUtilization = asyncHandler(async (req, res) => {
    const orgId = req.user.organization;
    const { projectId, startDate, endDate } = req.query;

    let projectQuery = { organization: orgId };
    if (projectId && projectId !== 'all') {
        projectQuery._id = projectId;
    }

    const projects = await Project.find(projectQuery);

    const timeStats = await Promise.all(projects.map(async (project) => {
        const taskFilter = { project: project._id };
        const timesheetFilter = { project: project._id };

        if (startDate || endDate) {
            taskFilter.createdAt = {};
            timesheetFilter.date = {};
            if (startDate) {
                taskFilter.createdAt.$gte = new Date(startDate);
                timesheetFilter.date.$gte = new Date(startDate);
            }
            if (endDate) {
                taskFilter.createdAt.$lte = new Date(endDate);
                timesheetFilter.date.$lte = new Date(endDate);
            }
        }

        const tasksCount = await Task.aggregate([
            { $match: taskFilter },
            { $group: { _id: null, totalEstimated: { $sum: "$estimatedHours" } } }
        ]);

        const estimated = tasksCount.length > 0 ? tasksCount[0].totalEstimated : 0;

        const timesheets = await Timesheet.aggregate([
            { $match: timesheetFilter },
            { $group: { _id: null, totalActual: { $sum: "$hours" } } }
        ]);

        const actual = timesheets.length > 0 ? timesheets[0].totalActual : 0;

        return {
            name: project.title,
            estimated,
            actual
        };
    }));

    res.status(200).json({
        success: true,
        data: timeStats
    });
});

// @desc      Get Overdue vs Completed Tasks
// @route     GET /api/analytics/overdue
// @access    Private
exports.getOverdueStats = asyncHandler(async (req, res) => {
    const taskMatch = getTaskFilters(req);
    const today = new Date();

    const stats = await Task.aggregate([
        {
            $lookup: {
                from: 'projects',
                localField: 'project',
                foreignField: '_id',
                as: 'projectData'
            }
        },
        { $unwind: '$projectData' },
        { $match: taskMatch },
        {
            $facet: {
                totalCompleted: [
                    { $match: { status: 'done' } },
                    { $count: 'count' }
                ],
                totalOverdue: [
                    {
                        $match: {
                            status: { $ne: 'done' },
                            dueDate: { $lt: today }
                        }
                    },
                    { $count: 'count' }
                ]
            }
        }
    ]);

    const completed = stats[0].totalCompleted[0] ? stats[0].totalCompleted[0].count : 0;
    const overdue = stats[0].totalOverdue[0] ? stats[0].totalOverdue[0].count : 0;

    res.status(200).json({
        success: true,
        data: {
            completed,
            overdue
        }
    });
});
