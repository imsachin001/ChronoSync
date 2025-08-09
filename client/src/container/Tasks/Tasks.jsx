import React, { useState, useEffect } from 'react'
import "./tasks.css"
import TaskHeader from './TaskHeader/TaskHeader'
import TaskList from './TaskList/TaskList'
import AiScheduler from './AiScheduler/AiScheduler'
import SavedChats from './SavedAiChats/SavedChats'
import TaskForm from './TaskForm/TaskForm'
import Taskfooter from './Taskfooter/Taskfooter'
import { createApi } from '../../utils/api'
import { useAuth } from '../../context/AuthContext'

const Tasks = () => {
  const { isAuthenticated, getToken } = useAuth();
  const [tasks, setTasks] = useState([]);
  const api = createApi(getToken);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAiScheduler, setShowAiScheduler] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    dueDate: '',
    priority: 'medium',
    tags: [],
    estimatedTime: '',
    description: '',
  });

  const [aiSchedule, setAiSchedule] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('today');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      console.log('Fetching tasks with Clerk authentication');
      const data = await api.getTasks();
      console.log('Tasks fetched successfully:', data.length);
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if(newTask.title) {
      try {
        const taskData = {
          ...newTask,
          completed: false
        };

        console.log('Creating new task:', taskData);
        await api.createTask(taskData);

        console.log('Task created successfully');
        // Refresh tasks list
        fetchTasks();
        
        // Dispatch custom event to notify Analytics component
        window.dispatchEvent(new CustomEvent('taskUpdate'));
        
        // Reset form
        setNewTask({
          title: '',
          dueDate: '',
          priority: 'medium',
          tags: [],
          estimatedTime: '',
          description: '',
        });
        setShowTaskForm(false);
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }
  };

  const toggleTaskCompletion = async (taskId) => {
    try {
      const taskToToggle = tasks.find(task => task._id === taskId);
      if (!taskToToggle) {
        console.error('Task not found');
        return;
      }

      console.log('Toggling task completion for:', taskId);
      await api.toggleTask(taskId);

      console.log('Task updated successfully');
      // Update local state
      const updatedTasks = tasks.map(task =>
        task._id === taskId ? { ...task, completed: !task.completed } : task
      );
      setTasks(updatedTasks);
      
      // Dispatch custom event to notify Analytics component
      window.dispatchEvent(new CustomEvent('taskUpdate', { 
        detail: { tasks: updatedTasks } 
      }));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleTaskAdded = () => {
    setShowTaskForm(false);
    fetchTasks();
  };

  const handleAiSchedule = () => {
    setShowAiScheduler(true);
  };

  // Handle task updates from TaskList component
  const handleTaskUpdate = (updatedTasks) => {
    setTasks(updatedTasks);
    // Dispatch custom event to notify Analytics component
    window.dispatchEvent(new CustomEvent('taskUpdate', { 
      detail: { tasks: updatedTasks } 
    }));
  };

  return (
    <div className='tasks-container'>
      <TaskHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedFilter={selectedFilter}
        setSelectedFilter={setSelectedFilter}
        selectedPriority={selectedPriority}
        setSelectedPriority={setSelectedPriority}
        setShowTaskForm={setShowTaskForm}
      />

      <TaskList 
        searchQuery={searchQuery}
        selectedFilter={selectedFilter}
        selectedPriority={selectedPriority}
        onTaskUpdate={handleTaskUpdate}
      />

      <div className="ai-features-container">
        <h2 className="section-title">AI Assistant</h2>
        <AiScheduler />
        
        <h2 className="section-title" style={{marginTop: '30px'}}>Saved AI Chats</h2>
        <SavedChats />
      </div>

      {showTaskForm && (
        <TaskForm
          newTask={newTask}
          setNewTask={setNewTask}
          handleAddTask={handleAddTask}
          onTaskAdded={handleTaskAdded}
          onClose={() => setShowTaskForm(false)}
        />
      )}

      <Taskfooter tasks={tasks} />
    </div>
  )
}

export default Tasks
