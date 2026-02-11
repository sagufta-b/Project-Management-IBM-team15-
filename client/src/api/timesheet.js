import axios from 'axios';

export const getTimesheets = async () => {
    const res = await axios.get('http://localhost:5000/api/timesheets');
    return res.data;
};

export const createTimesheet = async (data) => {
    const res = await axios.post('http://localhost:5000/api/timesheets', data);
    return res.data;
};

export const exportTimesheets = async () => {
    const res = await axios.get('http://localhost:5000/api/timesheets/export', {
        responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `timesheets-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};
