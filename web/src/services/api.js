import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getPorts = async () => {
  const response = await api.get('/ports');
  return response.data;
};

export const getPortConflicts = async () => {
  const response = await api.get('/ports/conflicts');
  return response.data;
};

export const getPortStats = async () => {
  const response = await api.get('/ports/stats');
  return response.data;
};

export const getProcessDetail = async (pid) => {
  const response = await api.get(`/process/${pid}`);
  return response.data;
};

export const killProcess = async (pid) => {
  const response = await api.post(`/process/${pid}/kill`);
  return response.data;
};

export const getProcessLogs = async (pid, lines = 100) => {
  const response = await api.get(`/process/${pid}/logs`, { params: { lines } });
  return response.data;
};

export default api;
