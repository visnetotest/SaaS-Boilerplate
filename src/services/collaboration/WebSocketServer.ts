// WebSocket Server for Workflow Collaboration
import { Server } from 'socket.io';
import { WorkflowExecution } from '../../types/workflow-local';

interface CollaborationSession {
  id: string;
  workflowId: string;
  participants: CollaborationParticipant[];
  activeUsers: Map<string, CollaborationParticipant>;
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
  type: '👍' | '❤️' | '🎉' | '🚀';
  timestamp: Date;
}

/**
 * Real-time Collaboration WebSocket Server
 */
class CollaborationServer {
  private io: Server;
  private sessions = new Map<string, CollaborationSession>();
  private participantTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.io = new Server({
      cors: {
        origin: process.env.ALLOWED_ORIGINS || ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST']
      },
      transports: ['websocket']
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', this.handleConnection);
    this.io.on('disconnect', this.handleDisconnection);
    this.io.on('error', this.handleError);
  }

  private handleConnection = (socket: any) => {
    console.log(`User connected: ${socket.id}`);

    // Create or join collaboration session
    socket.on('join-workflow', (data) => {
      const { sessionId, workflowId, userId, participant } = data;

      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          id: sessionId,
          workflowId,
          participants: [participant],
          activeUsers: new Map([[participant.id, participant]]),
          messages: [],
          createdAt: new Date()
        });
      }

      socket.join(sessionId);
      socket.emit('session-joined', {
        sessionId,
        participant,
        participants: this.sessions.get(sessionId)?.participants || []
      });

      this.broadcastToSession(sessionId, 'user-joined', { participant });
    });

    socket.on('cursor-move', (data) => {
      this.updateParticipantCursor(sessionId, data.participantId, data.position, data.type);
    });

    socket.on('step-select', (data) => {
      this.updateParticipantCursor(sessionId, data.participantId, null, 'select');
    });

    socket.on('step-move', (data) => {
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        if (session) {
          const step = session.steps.find(s => s.id === data.stepId);
          if (step) {
            session.steps = session.steps.map(s => 
              s.id === data.stepId 
                ? { ...s, position: data.position }
                : s
            );
          }
        }
      }
    });

    socket.on('comment-add', (data) => {
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        if (session) {
          const message: CollaborationMessage = {
            id: crypto.randomUUID(),
            participantId: data.participantId,
            content: data.content,
            stepId: data.stepId,
            timestamp: new Date(),
            resolved: false,
            reactions: []
          };

          session.messages.push(message);
          this.broadcastToSession(sessionId, 'message-added', { message });
        }
      }
    });

    socket.on('message-reaction', (data) => {
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        if (session) {
          const message = session.messages.find(m => m.id === data.messageId);
          if (message) {
            const reactionIndex = message.reactions.findIndex(r => r.participantId === data.participantId);
            
            if (reactionIndex === -1) {
              message.reactions.push({
                participantId: data.participantId,
                type: data.type,
                timestamp: new Date()
              });
            } else {
              message.reactions[reactionIndex] = {
                participantId: data.participantId,
                type: data.type,
                timestamp: new Date()
              };
            }
          }
        }
      }
    });

    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  private updateParticipantCursor(
    sessionId: string, 
    participantId: string, 
    position: { x: number; y: number },
    type?: string
  ): void {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      if (session && session.activeUsers.has(participantId)) {
        const participant = session.activeUsers.get(participantId);
        if (participant) {
          participant.cursor = { position, type: type || 'move' };
          participant.lastSeen = new Date();
        }
      }
    }
  }

  private broadcastToSession(sessionId: string, event: string, data: any): void {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      if (session) {
        this.io.to(sessionId).emit(event, data);
      }
    }
  }

  private handleDisconnection(socket: any): void {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find all sessions this user is participating in
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.participants.some(p => p.userId === socket.userId)) {
        const participantIndex = session.activeUsers.get(socket.userId)?.index;
        if (participantIndex !== -1) {
          const participant = session.activeUsers.get(socket.userId);
          if (participant) {
            clearTimeout(this.participantTimeouts.get(socket.userId));
            this.participantTimeouts.set(socket.userId, setTimeout(() => {
              // Remove inactive participant after timeout
              session.activeUsers.delete(socket.userId);
              this.broadcastToSession(sessionId, 'user-left', { participantId: socket.userId });
            }, 30000));
          }
        }
      }
    }

    this.broadcastToSession(sessionId, 'participant-updated', {
      participants: Array.from(session.activeUsers.values())
    });
  }

  private handleError(socket: any): void {
    console.error(`Socket error: ${socket.id}`);
  }

  /**
   * Get active collaboration sessions
   */
  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get sessions for a workflow
   */
  getWorkflowSessions(workflowId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.workflowId === workflowId
    );
  }

  /**
   * Get participant count for a session
   */
  getParticipantCount(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    return session ? session.activeUsers.size : 0;
  }

  /**
   * Broadcast message to all workflow sessions
   */
  broadcastToWorkflow(workflowId: string, event: string, data: any): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.workflowId === workflowId) {
        this.io.to(sessionId).emit(event, data);
      }
    }
  }

  /**
   * Gracefully close a session
   */
  closeSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Notify participants
        this.io.to(sessionId).emit('session-closed', {
          reason: 'Session ended'
        });

        // Clear timeout
        for (const participant of session.activeUsers.values()) {
          clearTimeout(this.participantTimeouts.get(participant));
          this.participantTimeouts.delete(participant);
        }

        // Remove session
        this.sessions.delete(sessionId);
      }
    }
  }
}

export default CollaborationServer;