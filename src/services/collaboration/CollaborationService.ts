// Import necessary types for WebSocket
import { Workflow, WorkflowExecution } from '../types/workflow-local';

// Collaboration types
interface CollaborationSession {
  id: string;
  workflowId: string;
  participants: CollaborationParticipant[];
  messages: CollaborationMessage[];
  createdAt: Date;
}

interface CollaborationParticipant {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  color: string;
  cursor?: {
    position: { x: number; y: number };
    type: 'move' | 'text' | 'pointer' | 'select';
  };
  isActive: boolean;
  lastSeen: Date;
}

interface CollaborationMessage {
  id: string;
  participantId: string;
  content: string;
  stepId?: string;
  timestamp: Date;
  resolved: boolean;
  reactions: MessageReaction[];
}

interface MessageReaction {
  participantId: string;
  type: '👍' | '❤️' | '🎉' | '🚀' | '👎';
  timestamp: Date;
}

// Mock in-memory data storage (in production, this would use Redis)
const activeCollaborations = new Map<string, CollaborationSession>();
const userSessions = new Map<string, Set<string>>();

/**
 * WebSocket Server for Real-time Workflow Collaboration
 */
export class CollaborationServer {
  private io: any;
  private sessions = new Map<string, CollaborationSession>();
  private participants = new Map<string, Map<string, CollaborationParticipant>>();
  private messageReactions = new Map<string, Set<MessageReaction>>();

  constructor() {
    console.log('🔄 Collaboration Server Starting...');
  }

  /**
   * Start the WebSocket server
   */
  start(port: number = 3001): void {
    this.io = require('socket.io')(port, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS || ['http://localhost:3000', 'http://localhost:3001'],
        credentials: false
      }
    });

    this.io.on('connection', this.handleConnection);
    this.io.on('disconnect', this.handleDisconnection);
    
    // Setup periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log(`🚀 Collaboration Server running on port ${port}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection = (socket: any): void => {
    const sessionId = socket.handshake.auth.sessionId;
    const userId = socket.handshake.auth.userId;
    const role = socket.handshake.auth.role || 'user';
    const tenantId = socket.handshake.auth.tenantId;

    console.log(`👤 User ${userId} (${role}) connected to workflow ${socket.handshake.auth.workflowId}`);

    // Create or join collaboration session
    let session = activeCollaborations.get(socket.handshake.auth.workflowId);
    
    if (!session) {
      session = {
        id: sessionId,
        workflowId: socket.handshake.auth.workflowId,
        participants: new Map(),
        activeUsers: new Set(),
        messages: [],
        createdAt: new Date()
      };

      activeCollaborations.set(socket.handshake.auth.workflowId, session);
    }

    // Create or find participant
    const participant: CollaborationParticipant = {
      id: crypto.randomUUID(),
      userId,
      name: userId,
      avatar: '👤', // Would come from user service
      color: this.generateUserColor(userId),
      isActive: true,
      lastSeen: new Date()
    };

    session.participants.set(userId, participant);
    session.activeUsers.add(userId);

    // Set user session tracking
    if (!userSessions.has(userId)) {
      userSessions.set(userId, new Set([sessionId]));
    }

    socket.emit('session-joined', { sessionId, participant });

    // Broadcast to all workflow sessions
    this.broadcastToWorkflow(socket.handshake.auth.workflowId, 'user-joined', { participant });

    socket.join(`workflow-${socket.handshake.auth.workflowId}`);

    // Setup socket handlers
    socket.on('canvas-mouse-move', (data) => {
      if (session) {
        this.broadcastToSession(sessionId, 'cursor-moved', {
          participantId: userId,
          position: data.position,
          type: 'move'
        });
      }
    });

    socket.on('step-select', (data) => {
      if (session) {
        this.broadcastToSession(sessionId, 'step-selected', {
          participantId: userId,
          stepId: data.stepId,
          type: 'select'
        });
      }
    });

    socket.on('step-add', (data) => {
      if (session) {
        session.steps.push(data.step);
        this.broadcastToSession(sessionId, 'step-added', {
          participantId: userId,
          stepId: data.stepId,
          step: data.step
        });
      }
    });

    socket.on('step-update', (data) => {
      if (session && session.steps) {
        const stepIndex = session.steps.findIndex(s => s.id === data.stepId);
        if (stepIndex !== -1) {
          session.steps[stepIndex] = {
            ...session.steps[stepIndex],
            ...data.step
          };
        }

        this.broadcastToSession(sessionId, 'step-updated', {
          participantId: userId,
          stepId: data.stepId,
          step: data.step
        });
      }
    });

    socket.on('step-delete', (data) => {
      if (session) {
        session.steps = session.steps.filter(s => s.id !== data.stepId);
        this.broadcastToSession(sessionId, 'step-deleted', {
          participantId: userId,
          stepId: data.stepId
        });
      }
    });

    socket.on('comment-add', (data) => {
      if (session) {
        const message: CollaborationMessage = {
          id: crypto.randomUUID(),
          participantId: userId,
          content: data.content,
          stepId: data.stepId,
          timestamp: new Date()
        };

        session.messages.push(message);
        this.broadcastToSession(sessionId, 'message-added', { message });
      }
    });

    socket.on('reaction', (data) => {
      if (session && session.activeUsers.has(userId)) {
        const reaction: MessageReaction = {
          id: crypto.randomUUID(),
          participantId: userId,
          type: data.type,
          timestamp: new Date()
        };

        const session = this.sessions.get(sessionId);
        if (session) {
          const participant = session.participants.get(userId);
          if (participant) {
            const messageIndex = session.messages.findIndex(m => m.id === data.messageId);
            
            if (messageIndex !== -1) {
              const reactions = session.messages[messageIndex].reactions;
              reactions.push(reaction);
            }

            this.broadcastToSession(sessionId, 'message-reaction', {
              participantId: userId,
              message,
              reaction
            });
          }
        }
      }
    });

    socket.on('cursor-update', (data) => {
      this.updateParticipantCursor(sessionId, userId, data.position, data.type);
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection = (socket: any): void => {
    console.log(`👤 User ${socket.id} disconnected`);

    // Find all sessions this user is participating in
    const userSessionsToRemove = Array.from(userSessions.keys()).filter(sessionId => {
      const session = this.sessions.get(sessionId);
      return !session || session.participants.has(socket.userId);
    });

    // Remove user from all sessions
    userSessions.delete(socket.userId);

    // Clean up orphaned sessions
    this.cleanup();
  }

  /**
   * Clean up inactive sessions and participants
   */
  private cleanup(): void {
    const now = Date.now();
    const timeoutMinutes = 30; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      // Remove inactive sessions
      if (now - session.createdAt.getTime() > timeoutMinutes * 60 * 1000) {
        this.sessions.delete(sessionId);
      }

      // Remove inactive participants
      if (session) {
        const inactiveParticipants = Array.from(session.participants.values()).filter(p => 
          !p.isActive && (now - p.lastSeen.getTime() > timeoutMinutes * 60 * 1000)
        );

        for (const participant of inactiveParticipants) {
          session.participants.delete(participant.userId);
        }
      }
    }

    // Clean up empty sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.participants.size === 0 && !session.messages.length) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get active collaboration sessions
   */
  public getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.participants.size > 0
    );
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Broadcast message to all participants in a workflow session
   */
  public broadcastToWorkflow(workflowId: string, event: string, data: any): void {
    const sessions = this.getWorkflowSessions(workflowId);
    if (sessions.length === 0) return;

    sessions.forEach(session => {
      this.io.to(session.id).emit(event, data);
    });
  }

  /**
   * Broadcast message to a specific session
   */
  private broadcastToSession(sessionId: string, event: string, data: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.io.to(session.id).emit(event, data);
    }
  }

  /**
   * Get workflow sessions
   */
  private getWorkflowSessions(workflowId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.workflowId === workflowId
    );
  }

  /**
   * Generate user color based on user ID
   */
  private generateUserColor(userId: string): string {
    const colors = ['#3B82F6', '#10B981', '#06B6D4', '#EF4444', '#F59E0B', '#8B5CF6'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash += userId.charCodeAt(i);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Get active user sessions
   */
  public getActiveUserSessions(): { sessionId: string; userId: string }[] {
    const activeSessions: { sessionId: string; userId: string }[] = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.participants.size > 0) {
        for (const [participantId, participant] of session.participants.entries()) {
          if (participant.isActive) {
            if (!activeSessions[participant.userId]) {
              activeSessions[participant.userId] = activeSessions[participant.userId] || [];
            }
            activeSessions[participant.userId].push({ sessionId, userId: participantId });
          }
        }
      }
    }

    return activeSessions;
  }
}

/**
 * Collaboration Service API for use in workflow components
 */
export class CollaborationService {
  private server: CollaborationServer;

  constructor() {
    this.server = new CollaborationServer();
  }

  /**
   * Start the collaboration server
   */
  start(port: number = 3001): void {
    this.server.start(port);
  }

  /**
   * Stop the collaboration server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
    }
  }

  /**
   * Create or join a collaboration session
   */
  createSession(workflowId: string, userId: string, participant: {
    id: string;
    name: string;
    avatar?: string;
    color?: string;
  }): string {
    const sessionId = crypto.randomUUID();
    
    // Mock session creation (in production, this would create in database)
    const session: CollaborationSession = {
      id: sessionId,
      workflowId,
      participants: new Map([[participant.id, participant]]),
      activeUsers: new Set([participant.id]),
      messages: [],
      createdAt: new Date()
    };

    // Mock joining (in production, this would use auth middleware)
    setTimeout(() => {
      this.server.emit('session-created', {
        sessionId,
        session,
        participant
      });
    }, 100);

    return sessionId;
  }

  /**
   * Join an existing collaboration session
   */
  joinSession(sessionId: string, userId: string): Promise<void> {
    return new Promise((resolve) => {
      // Mock join (in production, this would validate user permissions)
      setTimeout(() => {
        this.server.emit('session-joined', { sessionId });
        resolve(sessionId);
      }, 100);
    });
  }

  /**
   * Send a message in a session
   */
  sendMessage(sessionId: string, userId: string, content: string, stepId?: string): Promise<void> {
    return new Promise((resolve) => {
      // Mock message sending (in production, this would save to database)
      setTimeout(() => {
        this.server.emit('message-added', {
          sessionId,
          participantId: userId,
          content,
          stepId,
          timestamp: new Date()
        });
        resolve();
      }, 50);
    });
  }

  /**
   * Add a reaction to a message
   */
  addReaction(sessionId: string, userId: string, messageId: string, reaction: '👍' | '❤️' | '🎉' | '🚀' | '🎉'): Promise<void> {
    return new Promise((resolve) => {
      // Mock reaction (in production, this would save to database)
      setTimeout(() => {
        this.server.emit('message-reaction', {
          sessionId,
          participantId: userId,
          messageId,
          reaction
        });
        resolve();
      }, 50);
    });
  }

  /**
   * Get active sessions for a workflow
   */
  getWorkflowSessions(workflowId: string): CollaborationSession[] {
    return this.server.getWorkflowSessions(workflowId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CollaborationSession[] {
    return this.server.getActiveSessions();
  }

  /**
   * Get user's active sessions
   */
  getUserSessions(userId: string): CollaborationSession[] {
    return this.server.getActiveUserSessions();
  }

  /**
   * Get session details
   */
  getSession(sessionId: string): CollaborationSession | null {
    return this.server.getSession(sessionId);
  }
}