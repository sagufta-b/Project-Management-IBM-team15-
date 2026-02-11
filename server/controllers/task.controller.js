const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');

// @desc    Get tasks
// @route   GET /api/tasks
// @route   GET /api/projects/:projectId/tasks
// @access  Private
exports.getTasks = asyncHandler(async (req, res) => {
    let queryObj = { ...req.query };

    if (req.params.projectId) {
        queryObj.project = req.params.projectId;
    }

    // Support projectId in query string as well
    if (req.query.projectId) {
        queryObj.project = req.query.projectId;
        delete queryObj.projectId;
    }

    const tasks = await Task.find(queryObj)
        .populate('assignees', 'name avatar')
        .populate('project', 'title');

    res.status(200).json({
        success: true,
        count: tasks.length,
        data: tasks
    });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
exports.getTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id)
        .populate('project')
        .populate('assignees', 'name avatar')
        .populate('comments.user', 'name avatar')
        .populate('reporter', 'name avatar')
        .populate({
            path: 'parentTask',
            select: 'assignees reporter title'
        });

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    res.status(200).json({
        success: true,
        data: task
    });
});

// @desc    Create task
// @route   POST /api/tasks
// @access  Private
exports.createTask = asyncHandler(async (req, res) => {
    req.body.reporter = req.user.id;

    const project = await Project.findById(req.body.project);
    if (!project) {
        res.status(404);
        throw new Error('Project not found');
    }

    const task = await Task.create(req.body);

    // Notify assignees
    if (req.body.assignees && req.body.assignees.length > 0) {
        for (const assigneeId of req.body.assignees) {
            await Notification.create({
                recipient: assigneeId,
                sender: req.user.id,
                type: 'task_assignment',
                title: 'New Task Assigned',
                message: `Task "${task.title}" has been assigned to you in project "${project.title}"`,
                link: `/tasks/${task._id}`
            });
        }
    }

    // Also notify project manager if they are not the reporter
    if (project.manager && project.manager.toString() !== req.user.id.toString()) {
        await Notification.create({
            recipient: project.manager,
            sender: req.user.id,
            type: 'project_update',
            title: 'New Task Created',
            message: `A new task "${task.title}" was created in your project: ${project.title}`,
            link: `/tasks/${task._id}`
        });
    }

    res.status(201).json({
        success: true,
        data: task
    });
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = asyncHandler(async (req, res) => {
    let task = await Task.findById(req.params.id)
        .populate('project')
        .populate({
            path: 'parentTask',
            select: 'assignees reporter'
        });

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isProjectManager = task.project &&
        (task.project.manager?.toString() === req.user.id ||
            task.project.owner?.toString() === req.user.id);

    // Check if user is an assignee of this task or its parent (inheritance)
    const isAssignee = task.assignees.some(id => id.toString() === req.user.id);
    const isParentAssignee = task.parentTask && task.parentTask.assignees.some(id => id.toString() === req.user.id);
    const isReporter = task.reporter.toString() === req.user.id || (task.parentTask && task.parentTask.reporter?.toString() === req.user.id);

    const hasFullAccess = isAdmin || isProjectManager;
    const hasStatusAccess = isAssignee || isParentAssignee || isReporter;

    if (!hasFullAccess) {
        // If not PM/Admin, they MUST be an assignee/reporter to update status
        if (!hasStatusAccess) {
            res.status(403);
            throw new Error('Not authorized to update this task.');
        }

        // Assignees can ONLY update status or add comments (handled via $push)
        const allowedUpdates = ['status', '$push', '$pull'];
        const attemptedUpdates = Object.keys(req.body);
        const unauthorizedUpdates = attemptedUpdates.filter(field => !allowedUpdates.includes(field));

        if (unauthorizedUpdates.length > 0) {
            res.status(403);
            throw new Error('Not authorized to edit task details. You can only update the status or add comments.');
        }
    }

    // Capture changes for history
    const historyEntries = [];
    const updatableFields = ['title', 'description', 'status', 'priority', 'dueDate', 'assignees', 'milestone'];

    // Dependency and Sub-task Validation: If status is changing to 'done'
    if (req.body.status && req.body.status === 'done') {
        // 1. Check Dependencies
        if (task.dependencies && task.dependencies.length > 0) {
            const dependencies = await Task.find({ _id: { $in: task.dependencies } });
            const incomplete = dependencies.filter(d => d.status !== 'done');
            if (incomplete.length > 0) {
                res.status(400);
                throw new Error(`Cannot complete task. Prerequisite tasks are incomplete: ${incomplete.map(d => d.title).join(', ')}`);
            }
        }

        // 2. Check Sub-tasks (Children)
        const subtasks = await Task.find({ parentTask: task._id });
        const incompleteSubtasks = subtasks.filter(s => s.status !== 'done');
        if (incompleteSubtasks.length > 0) {
            res.status(400);
            throw new Error(`Cannot complete parent task. ${incompleteSubtasks.length} sub-tasks are still open.`);
        }
    }

    // If status is changing to 'in_progress'
    if (req.body.status && req.body.status === 'in_progress') {
        if (task.dependencies && task.dependencies.length > 0) {
            const dependencies = await Task.find({ _id: { $in: task.dependencies } });
            const incomplete = dependencies.filter(d => d.status !== 'done');
            if (incomplete.length > 0) {
                res.status(400);
                throw new Error(`Cannot start task. Dependencies are incomplete: ${incomplete.map(d => d.title).join(', ')}`);
            }
        }
    }

    updatableFields.forEach(field => {
        if (req.body[field] !== undefined && JSON.stringify(req.body[field]) !== JSON.stringify(task[field])) {
            historyEntries.push({
                user: req.user.id,
                action: 'updated',
                field: field,
                oldValue: task[field],
                newValue: req.body[field]
            });
        }
    });

    // Special case for status change action label
    if (req.body.status && req.body.status !== task.status) {
        if (historyEntries.length > 0) {
            historyEntries[historyEntries.length - 1].action = 'status_change';
        } else {
            historyEntries.push({
                user: req.user.id,
                action: 'status_change',
                field: 'status',
                oldValue: task.status,
                newValue: req.body.status
            });
        }
    }

    // Prepare update object, merging $push operations
    const update = { ...req.body };
    if (historyEntries.length > 0) {
        if (!update.$push) {
            update.$push = { history: { $each: historyEntries } };
        } else {
            // merge history with existing $push (like comments)
            update.$push.history = { $each: historyEntries };
        }
    }

    // Update task
    task = await Task.findByIdAndUpdate(
        req.params.id,
        update,
        {
            new: true,
            runValidators: true
        }
    ).populate('project')
        .populate('assignees', 'name avatar')
        .populate('comments.user', 'name avatar')
        .populate('reporter', 'name avatar')
        .populate('history.user', 'name')
        .populate({
            path: 'parentTask',
            select: 'assignees reporter title'
        });

    // Propagate 'done' status to subtasks
    if (req.body.status && req.body.status === 'done') {
        await Task.updateMany({ parentTask: task._id }, { status: 'done' });
    }

    // Trigger Notification for status change
    if (req.body.status && req.body.status !== task.status) {
        await Notification.create({
            recipient: task.reporter,
            sender: req.user.id,
            type: 'project_update',
            title: 'Task Status Updated',
            message: `${task.title} is now ${req.body.status.replace('_', ' ')}`,
            link: `/tasks/${task._id}`
        });
    }

    // Trigger Notification for assignment
    if (req.body.assignees && req.body.assignees.length > 0) {
        for (const userId of req.body.assignees) {
            if (userId !== req.user.id) {
                await Notification.create({
                    recipient: userId,
                    sender: req.user.id,
                    type: 'task_assignment',
                    title: 'Task Assigned',
                    message: `You were assigned to: ${task.title}`,
                    link: `/tasks/${task._id}`
                });
            }
        }
    }

    res.status(200).json({
        success: true,
        data: task
    });
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id).populate('project');

    if (!task) {
        res.status(404);
        throw new Error('Task not found');
    }

    // Check permissions
    // Admin can delete any task
    // Project Manager can delete tasks in their own project
    const isProjectManager = task.project && task.project.manager.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isProjectManager) {
        res.status(403);
        throw new Error('Not authorized to delete this task');
    }

    await task.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});
