// Email templates for notifications

export const getOverdueTaskEmailTemplate = (task, userName) => {
  return {
    subject: `⏰ Task Overdue: ${task.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5; 
            margin: 0; 
            padding: 0; 
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
            overflow: hidden; 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
          }
          .content { 
            padding: 30px; 
          }
          .task-card {
            background: #f8f9fa;
            border-left: 4px solid #ff4757;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .task-title {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin: 0 0 10px 0;
          }
          .task-detail {
            margin: 8px 0;
            font-size: 14px;
            color: #4a5568;
          }
          .task-detail strong {
            color: #2d3748;
            font-weight: 600;
          }
          .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .priority-high { background: #fee; color: #c53030; }
          .priority-medium { background: #fef3c7; color: #d97706; }
          .priority-low { background: #dcfce7; color: #16a34a; }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 13px;
            border-top: 1px solid #e5e7eb;
          }
          .emoji {
            font-size: 24px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="emoji">⏰</div>
            <h1>Task Overdue Alert</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            <p>You have an overdue task that needs your attention:</p>
            
            <div class="task-card">
              <h2 class="task-title">${task.title}</h2>
              ${task.description ? `<p style="color: #6b7280; margin: 10px 0;">${task.description}</p>` : ''}
              <div class="task-detail">
                <strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })} at ${task.dueTime}
              </div>
              <div class="task-detail">
                <strong>Priority:</strong> 
                <span class="priority-badge priority-${task.priority}">${task.priority}</span>
              </div>
              <div class="task-detail">
                <strong>Category:</strong> ${task.category}
              </div>
              ${task.estimatedTime ? `<div class="task-detail"><strong>Estimated Time:</strong> ${task.estimatedTime}</div>` : ''}
            </div>
            
            <p style="color: #6b7280;">Don't let this task fall further behind. Take a moment to complete it today!</p>
            
            <center>
              <a href="http://localhost:5173/tasks" class="cta-button">View Task</a>
            </center>
          </div>
          <div class="footer">
            <p>You're receiving this email because you have notifications enabled for ChronoSync.</p>
            <p style="margin-top: 10px;">ChronoSync - Your Productivity Companion</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${userName || 'there'},

You have an overdue task that needs your attention:

Task: ${task.title}
${task.description ? `Description: ${task.description}` : ''}
Due Date: ${new Date(task.dueDate).toLocaleDateString()} at ${task.dueTime}
Priority: ${task.priority}
Category: ${task.category}

Don't let this task fall further behind. Visit ChronoSync to complete it today!

ChronoSync - Your Productivity Companion
    `
  };
};

export const getReminderEmailTemplate = (note, userName) => {
  return {
    subject: `🔔 Reminder: ${note.title || 'Note Reminder'}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5; 
            margin: 0; 
            padding: 0; 
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
            overflow: hidden; 
          }
          .header { 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
          }
          .content { 
            padding: 30px; 
          }
          .note-card {
            background: #fff9e6;
            border-left: 4px solid #fbbf24;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .note-title {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin: 0 0 15px 0;
          }
          .note-content {
            color: #4a5568;
            white-space: pre-wrap;
            line-height: 1.6;
          }
          .tags {
            margin-top: 15px;
          }
          .tag {
            display: inline-block;
            background: #e0e7ff;
            color: #4338ca;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            margin-right: 6px;
            margin-top: 6px;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 13px;
            border-top: 1px solid #e5e7eb;
          }
          .emoji {
            font-size: 24px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="emoji">🔔</div>
            <h1>Reminder Alert</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            <p>You have a reminder that's due now:</p>
            
            <div class="note-card">
              ${note.title ? `<h2 class="note-title">${note.title}</h2>` : ''}
              <div class="note-content">${note.content}</div>
              ${note.tags && note.tags.length > 0 ? `
                <div class="tags">
                  ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                </div>
              ` : ''}
            </div>
            
            <p style="color: #6b7280;">This reminder was set for ${new Date(note.reminder).toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}.</p>
            
            <center>
              <a href="http://localhost:5173/notes" class="cta-button">View Note</a>
            </center>
          </div>
          <div class="footer">
            <p>You're receiving this email because you have notifications enabled for ChronoSync.</p>
            <p style="margin-top: 10px;">ChronoSync - Your Productivity Companion</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${userName || 'there'},

You have a reminder that's due now:

${note.title ? `Title: ${note.title}` : ''}
${note.content}

${note.tags && note.tags.length > 0 ? `Tags: ${note.tags.map(tag => `#${tag}`).join(', ')}` : ''}

This reminder was set for ${new Date(note.reminder).toLocaleString()}.

Visit ChronoSync to view your note!

ChronoSync - Your Productivity Companion
    `
  };
};

export const getUpcomingTaskEmailTemplate = (tasks, userName) => {
  return {
    subject: `📅 You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} due today`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5; 
            margin: 0; 
            padding: 0; 
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
            overflow: hidden; 
          }
          .header { 
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
          }
          .content { 
            padding: 30px; 
          }
          .task-item {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 15px 0;
            border-radius: 8px;
          }
          .task-item-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 5px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 13px;
            border-top: 1px solid #e5e7eb;
          }
          .emoji {
            font-size: 24px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="emoji">📅</div>
            <h1>Tasks Due Today</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            <p>You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} due today:</p>
            
            ${tasks.map(task => `
              <div class="task-item">
                <div class="task-item-title">${task.title}</div>
                <div style="font-size: 13px; color: #6b7280;">Due at ${task.dueTime} • ${task.priority} priority</div>
              </div>
            `).join('')}
            
            <p style="color: #6b7280; margin-top: 20px;">Start your day strong by tackling these tasks!</p>
          </div>
          <div class="footer">
            <p>ChronoSync - Your Productivity Companion</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
};
