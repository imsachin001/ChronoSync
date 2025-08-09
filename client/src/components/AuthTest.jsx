import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createApi } from '../utils/api';

const AuthTest = () => {
  const { isSignedIn, getToken } = useAuth();
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);
  const api = createApi(getToken);

  const testAuth = async () => {
    setLoading(true);
    setTestResult('');
    
    try {
      const result = await api.testAuth();
      setTestResult(`✅ Authentication successful! User: ${JSON.stringify(result.user)}`);
    } catch (error) {
      setTestResult(`❌ Authentication failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testTasks = async () => {
    setLoading(true);
    setTestResult('');
    
    try {
      const tasks = await api.getTasks();
      setTestResult(`✅ Tasks fetched successfully! Found ${tasks.length} tasks`);
    } catch (error) {
      setTestResult(`❌ Failed to fetch tasks: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return <div>Please sign in to test authentication</div>;
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px' }}>
      <h3>Authentication Test</h3>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={testAuth} disabled={loading}>
          {loading ? 'Testing...' : 'Test Auth'}
        </button>
        <button onClick={testTasks} disabled={loading} style={{ marginLeft: '10px' }}>
          {loading ? 'Testing...' : 'Test Tasks'}
        </button>
      </div>
      {testResult && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: testResult.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${testResult.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          marginTop: '10px'
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
};

export default AuthTest; 