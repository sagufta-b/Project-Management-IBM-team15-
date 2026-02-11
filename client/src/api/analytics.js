import axios from 'axios';

export const getProjectProgress = async (params) => {
    const res = await axios.get('/api/analytics/projects', { params });
    return res.data;
};

export const getTaskCompletionStats = async (params) => {
    const res = await axios.get('/api/analytics/tasks', { params });
    return res.data;
};

export const getTimeUtilization = async (params) => {
    const res = await axios.get('/api/analytics/time', { params });
    return res.data;
};

export const getOverdueStats = async (params) => {
    const res = await axios.get('/api/analytics/overdue', { params });
    return res.data;
};
