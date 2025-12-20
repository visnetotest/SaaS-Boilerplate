'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = searchParams.get('locale') || 'en'
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailSignUp = async (formData: FormData) => {
    'use client'
    setIsLoading(true)

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      alert('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      // TODO: Implement actual sign-up API call
      console.log('Sign up with:', { email, password })

      // For now, redirect to sign in after "sign up"
      router.push(`/${locale}/sign-in`)
    } catch (error) {
      console.error('Sign up error:', error)
      alert('Sign up failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    signIn(provider, { callbackUrl: `/${locale}/dashboard` })
  }

  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]'>
        <div className='flex flex-col space-y-2 text-center'>
          <h1 className='text-2xl font-semibold tracking-tight'>Create an account</h1>
          <p className='text-sm text-muted-foreground'>
            Enter your email and password below to create your account
          </p>
        </div>

        <form action={handleEmailSignUp} className='flex flex-col space-y-2'>
          <div className='space-y-1'>
            <label
              htmlFor='email'
              className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
            >
              Email
            </label>
            <input
              id='email'
              name='email'
              type='email'
              autoComplete='email'
              required
              disabled={isLoading}
              className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
            />
          </div>
          <div className='space-y-1'>
            <label
              htmlFor='password'
              className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
            >
              Password
            </label>
            <input
              id='password'
              name='password'
              type='password'
              autoComplete='new-password'
              required
              disabled={isLoading}
              className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
            />
          </div>
          <div className='space-y-1'>
            <label
              htmlFor='confirmPassword'
              className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
            >
              Confirm Password
            </label>
            <input
              id='confirmPassword'
              name='confirmPassword'
              type='password'
              autoComplete='new-password'
              required
              disabled={isLoading}
              className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
            />
          </div>
          <button
            type='submit'
            disabled={isLoading}
            className='inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full'
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className='relative'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background px-2 text-muted-foreground'>Or continue with</span>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <button
            onClick={() => handleOAuthSignIn('google')}
            disabled={isLoading}
            className='inline-flex items-center justify-center whitespace-nowrap rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full disabled:cursor-not-allowed disabled:opacity-50'
          >
            <svg className='mr-2 h-4 w-4' viewBox='0 0 24 24'>
              <path
                fill='currentColor'
                d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
              />
              <path
                fill='currentColor'
                d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
              />
              <path
                fill='currentColor'
                d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
              />
              <path
                fill='currentColor'
                d='M5.84 14.09c0 1.32.35 2.26 1.06 3.31l2.85-2.22c-.81-.62-1.06-1.99-1.06-3.31 0-2.47 1.93-5.29 4.53-5.29h7.28c0 3.35-1.18 6.17-3.28 8.09l3.57 2.77C17.46 21.02 14.97 23 12 23'
              />
            </svg>
            Google
          </button>
          <button
            onClick={() => handleOAuthSignIn('github')}
            disabled={isLoading}
            className='inline-flex items-center justify-center whitespace-nowrap rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full disabled:cursor-not-allowed disabled:opacity-50'
          >
            <svg className='mr-2 h-4 w-4' fill='currentColor' viewBox='0 0 24 24'>
              <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205 1.922 1.205 1.922.89 0 1.539-.682 1.902-1.447-.055-.14-.111-.305-.177-.463-.066-.158-.131-.345-.177-.463-.111-.345-.193-.845-.193-3.255 0-5.872 2.918-5.872 2.918 0 2.353 2.193 5.872 2.193v5.872h-2.918c0-2.353-2.193-5.872-2.193-5.872z' />
            </svg>
            GitHub
          </button>
        </div>

        <p className='text-center text-sm text-muted-foreground'>
          Already have an account?{' '}
          <button
            onClick={() => router.push(`/${locale}/sign-in`)}
            className='underline underline-offset-4 hover:text-primary'
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
