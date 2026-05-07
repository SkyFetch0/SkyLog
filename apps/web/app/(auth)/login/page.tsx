import { LoginForm } from '@/components/auth/login-form'

export const metadata = { title: 'Login — SkyLog' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">S</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">SkyLog</span>
          </div>
          <p className="text-muted-foreground text-sm">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}