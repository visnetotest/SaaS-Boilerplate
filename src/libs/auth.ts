import NeonAdapter from '@auth/neon-adapter'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'

import { db } from '@/libs/DB'
import { roleSchema, tenantSchema, userRoleSchema, userSchema } from '@/models/Schema'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NeonAdapter({
    connectionString: process.env.DATABASE_URL!,
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Find user in database
          const user = await db.query.userSchema.findFirst({
            where: eq(userSchema.email, credentials.email as string),
            with: {
              tenant: true,
              userRoles: {
                with: {
                  role: true,
                },
              },
            },
          })

          if (!user) {
            return null
          }

          // For demo purposes, accept any password for existing users
          // In production, verify: await bcrypt.compare(credentials.password, user.passwordHash)
          if (!user.passwordHash) {
            // Create password hash for demo user
            const hashedPassword = await bcrypt.hash(credentials.password as string, 10)
            await db
              .update(userSchema)
              .set({ passwordHash: hashedPassword })
              .where(eq(userSchema.id, user.id))
          } else {
            // Verify password in production
            const isValid = await bcrypt.compare(
              credentials.password as string,
              user.passwordHash as string
            )
            if (!isValid) {
              return null
            }
          }

          // Return user data for Auth.js
          return {
            id: user.id,
            email: user.email,
            name:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`.trim()
                : user.email || '',
            image: user.avatar,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Add user data to token
      if (user) {
        token.sub = user.id
      }
      return token
    },
    async session({ session, token }) {
      // Add user ID to session
      if (token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async signIn({ user, account }) {
      // Create default tenant for new OAuth users
      if (account?.provider !== 'credentials' && user) {
        const existingUser = await db.query.userSchema.findFirst({
          where: eq(userSchema.id, user.id!),
        })

        if (!existingUser && account) {
          // Create default tenant for new OAuth users
          const [tenant] = await db
            .insert(tenantSchema)
            .values({
              name: `${user.name}'s Workspace`,
              slug: `${user.email?.split('@')[0]}-workspace-${Date.now()}`,
              status: 'active',
            })
            .returning()

          // Update user with tenant info
          await db
            .update(userSchema)
            .set({
              tenantId: tenant?.id,
              email: user.email!,
              firstName: user.name?.split(' ')[0] || '',
              lastName: user.name?.split(' ')[1] || '',
              avatar: user.image,
              provider: account.provider,
              externalId: account.providerAccountId,
              updatedAt: new Date(),
            })
            .where(eq(userSchema.id, user.id!))

          // Assign default role
          const [role] = await db
            .insert(roleSchema)
            .values({
              name: 'owner',
              tenantId: tenant?.id || '',
              permissions: ['read', 'write', 'delete', 'admin'],
              isSystem: true,
            })
            .returning()

          await db.insert(userRoleSchema).values({
            userId: user.id!,
            roleId: role?.id || '',
            assignedBy: user.id!,
            assignedAt: new Date(),
          })
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/sign-in',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
})
