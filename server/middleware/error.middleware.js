const errorHandler = (err, req, res, next) => {
    let error = { ...err };

    error.message = err.message;

    // Log to console for dev
    console.log(err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = `Resource not found`;
        error = new Error(message);
        res.status(404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = new Error(message);
        res.status(400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        error = new Error(message);
        res.status(400);
    }

    const statusCode = res.statusCode === 200 ? 500 : (res.statusCode || 500);
    res.status(statusCode).json({
        success: false,
        error: error.message || 'Server Error'
    });
};

module.exports = errorHandler;
