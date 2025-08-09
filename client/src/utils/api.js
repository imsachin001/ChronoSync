// Base API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Utility function to make authenticated API calls
export const makeAuthenticatedRequest = async (endpoint, options = {}, getToken) => {
  try {
    // Get the token from Clerk
    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    const response = await fetch(url, finalOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Create API functions that accept getToken function
export const createApi = (getToken) => ({
  // Tasks
  getTasks: () => makeAuthenticatedRequest('/api/tasks', {}, getToken),
  createTask: (taskData) => makeAuthenticatedRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  }, getToken),
  toggleTask: (taskId) => makeAuthenticatedRequest(`/api/tasks/${taskId}/toggle`, {
    method: 'PATCH',
  }, getToken),
  deleteTask: (taskId) => makeAuthenticatedRequest(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  }, getToken),
  getTaskStats: () => makeAuthenticatedRequest('/api/tasks/stats', {}, getToken),
  getProductivityScore: () => makeAuthenticatedRequest('/api/tasks/productivity-score', {}, getToken),
  getBadges: () => makeAuthenticatedRequest('/api/tasks/badges', {}, getToken),

  // Notes
  getNotes: () => makeAuthenticatedRequest('/api/notes', {}, getToken),
  createNote: (noteData) => makeAuthenticatedRequest('/api/notes', {
    method: 'POST',
    body: JSON.stringify(noteData),
  }, getToken),
  updateNote: (noteId, noteData) => makeAuthenticatedRequest(`/api/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(noteData),
  }, getToken),
  deleteNote: (noteId) => makeAuthenticatedRequest(`/api/notes/${noteId}`, {
    method: 'DELETE',
  }, getToken),
  togglePin: (noteId) => makeAuthenticatedRequest(`/api/notes/${noteId}/toggle-pin`, {
    method: 'PATCH',
  }, getToken),
  archiveNote: (noteId) => makeAuthenticatedRequest(`/api/notes/${noteId}/archive`, {
    method: 'PATCH',
  }, getToken),
  unarchiveNote: (noteId) => makeAuthenticatedRequest(`/api/notes/${noteId}/unarchive`, {
    method: 'PATCH',
  }, getToken),
  trashNote: (noteId) => makeAuthenticatedRequest(`/api/notes/${noteId}/trash`, {
    method: 'PATCH',
  }, getToken),

  // Chats
  getChats: () => makeAuthenticatedRequest('/api/chats', {}, getToken),
  createChat: (chatData) => makeAuthenticatedRequest('/api/chats', {
    method: 'POST',
    body: JSON.stringify(chatData),
  }, getToken),
  getChat: (chatId) => makeAuthenticatedRequest(`/api/chats/${chatId}`, {}, getToken),
  deleteChat: (chatId) => makeAuthenticatedRequest(`/api/chats/${chatId}`, {
    method: 'DELETE',
  }, getToken),

  // Test auth
  testAuth: () => makeAuthenticatedRequest('/api/test-auth', {}, getToken),
}); 