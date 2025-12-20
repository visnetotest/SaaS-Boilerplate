'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Workflow, WorkflowStep } from '@/features/workflow-automation/types';

// Collaboration types
interface CollaborationUser {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isOnline: boolean;
  cursor?: 'move' | 'text' | 'pointer';
}

interface LiveCursor {
  userId: string;
  position: { x: number; y: number };
  color: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  content: string;
  timestamp: Date;
  stepId?: string;
  resolved: boolean;
}

interface CollaborationPanelProps {
  workflowId: string;
  onUserSelect?: (user: CollaborationUser) => void;
}

/**
 * Real-time Collaboration Panel Component
 */
export default function CollaborationPanel({ workflowId, onUserSelect }: CollaborationPanelProps) {
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [liveCursors, setLiveCursors] = useState<LiveCursor[]>([]);
  const [currentUser, setCurrentUser] = useState<CollaborationUser | null>(null);
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Simulate WebSocket connection for real-time updates
  useEffect(() => {
    // Mock WebSocket connection
    const ws = new WebSocket(`wss://localhost:3000/workflows/${workflowId}/collaborate`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'user-joined':
          setActiveUsers(prev => [...prev.filter(u => u.id !== data.user.id), data.user]);
          break;
          
        case 'user-left':
          setActiveUsers(prev => prev.filter(u => u.id !== data.user.id));
          break;
          
        case 'cursor-moved':
          setLiveCursors(prev => 
            prev.filter(cursor => cursor.userId !== data.cursor.userId).concat([data.cursor])
          );
          break;
          
        case 'comment-added':
          setComments(prev => [...prev, data.comment]);
          break;
          
        case 'step-selected':
          // Handle remote step selection
          break;
      }
    };

    ws.onopen = () => {
      // Join collaboration room
      ws.send(JSON.stringify({
        type: 'join-workflow',
        workflowId
      }));
    };

    // Mock initial data
    setTimeout(() => {
      setActiveUsers([
        { id: '1', name: 'John Doe', avatar: '👤', color: '#3B82F6', isOnline: true, cursor: 'move' },
        { id: '2', name: 'Jane Smith', avatar: '👩', color: '#EC4899', isOnline: true, cursor: 'text' },
        { id: '3', name: 'Bob Johnson', avatar: '🧑', color: '#10B981', isOnline: false }
      ]);
      
      setComments([
        {
          id: '1',
          userId: '1',
          userName: 'John Doe',
          avatar: '👤',
          content: 'I think we should add a validation step here before the approval.',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          stepId: 'step-1'
        },
        {
          id: '2',
          userId: '2',
          userName: 'Jane Smith',
          avatar: '👩',
          content: 'Good point! I added the validation logic already.',
          timestamp: new Date(Date.now() - 3 * 60 * 1000),
          stepId: 'step-2',
          resolved: true
        }
      ]);
    }, 1000);

    return () => {
      ws.close();
    };
  }, [workflowId]);

  // Handle user selection
  const handleUserSelect = useCallback((user: CollaborationUser) => {
    onUserSelect?.(user);
    setCurrentUser(user);
  }, [onUserSelect]);

  // Handle comment submission
  const handleCommentSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!commentText.trim()) return;

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      userId: currentUser?.id || 'anonymous',
      userName: currentUser?.name || 'Anonymous',
      avatar: currentUser?.avatar || '👤',
      content: commentText,
      timestamp: new Date()
    };

    setComments(prev => [...prev, newComment]);
    setCommentText('');
    setIsCommenting(false);
  }, [currentUser, commentText, isCommenting]);

  // Handle comment resolution
  const handleResolveComment = useCallback((commentId: string) => {
    setComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, resolved: true }
          : comment
      )
    );
   }, []);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            🤝 Live Collaboration
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span className={`inline-flex items-center px-2 py-1 rounded-full ${
              activeUsers.filter(u => u.isOnline).length === activeUsers.length 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              {activeUsers.length} Active
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Users */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Active Users</h4>
          <div className="space-y-2">
            {activeUsers.map(user => (
              <div
                key={user.id}
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  currentUser?.id === user.id 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleUserSelect(user)}
              >
                <div className="relative">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${user.color}`}
                  >
                    {user.avatar}
                  </div>
                  {user.isOnline && (
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.isOnline ? 'Online' : 'Away'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comments Section */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Comments</h4>
          <div className="space-y-3">
            {comments.map(comment => (
              <div
                key={comment.id}
                className={`p-3 rounded-lg ${
                  comment.resolved 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-blue-500 flex-shrink-0">
                    {comment.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{comment.userName}</div>
                        <div className="text-xs text-gray-500">
                          {comment.timestamp.toLocaleString()}
                        </div>
                      </div>
                      {comment.resolved && (
                        <div className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          ✅ Resolved
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">{comment.content}</div>
                    {comment.stepId && (
                      <div className="text-xs text-blue-600 mt-2">
                        🔗 Step: {comment.stepId}
                      </div>
                    )}
                  </div>
                  {!comment.resolved && (
                    <button
                      className="ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                      onClick={() => handleResolveComment(comment.id)}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
            
            {/* Comment Input */}
            <div className="mt-4">
              {isCommenting ? (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={handleCommentSubmit}
                  >
                    Post
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setIsCommenting(false);
                      setCommentText('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  onClick={() => setIsCommenting(true)}
                >
                  💬 Add Comment
                </button>
              )}
            </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-50 border-t border-gray-200 p-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>🔴 Live editing enabled</span>
          <span>⏱ Auto-save: On</span>
          <span>📊 Last saved: 2 minutes ago</span>
        </div>
      </div>
    </div>
  );
}